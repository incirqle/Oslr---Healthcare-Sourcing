import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from live import LiveRunner, canonical, host_allowed, manifest, parse_contacts, parse_search, profile_url, validate_request

URL = "https://www.linkedin.com/in/synthetic-clinician"
CONTACT_BODY = {"professional_network_profile_urls": [URL], "fields": ["contact.business_emails"], "verified": True}


class ContractTests(unittest.TestCase):
    def test_all_live_cases_are_bounded_and_cover_three_populations(self):
        cases = manifest()
        self.assertEqual(len(cases), 36)
        self.assertEqual(len({c["institution"] for c in cases}), 12)
        self.assertEqual({c["cohort"] for c in cases}, {"faculty", "trainee", "nursing"})
        self.assertEqual(sum(validate_request("/web/search/live", {"query": c["query"], "sources": ["web"], "page": 1}) for c in cases), 36)

    def test_only_work_emails_are_requested_and_budgeted(self):
        self.assertEqual(validate_request("/person/contact/enrich", CONTACT_BODY), 2.5)
        for change in [{"fields": ["contact"]}, {"fields": ["contact.personal_emails"]}, {"verified": False}, {"professional_network_profile_urls": [URL] * 4}]:
            with self.assertRaises(ValueError):
                validate_request("/person/contact/enrich", {**CONTACT_BODY, **change})

    def test_unknown_endpoints_modes_and_multiple_pages_rejected(self):
        for path in ["/batch/person/contact/enrich", "/person/enrich", "https://evil.test", "/web/enrich/live"]:
            with self.assertRaises(ValueError):
                validate_request(path, {})
        for change in [{"sources": ["ai"]}, {"page": 2}, {"human_mode": True}, {"fetch_content": True}]:
            with self.assertRaises(ValueError):
                validate_request("/web/search/live", {"query": "synthetic", "sources": ["web"], "page": 1, **change})

    def test_search_schema_failures_do_not_become_no_result_success(self):
        for body in [None, [], {}, {"success": False, "results": []}, {"success": True, "results": {}}]:
            with self.assertRaises(ValueError):
                parse_search(body)
        self.assertEqual(parse_search({"success": True, "results": []}), [])

    def test_sync_reordered_rows_mismatched_ids_and_multiple_matches(self):
        match = {"person_data": {"contact": {"business_emails": [{"email": "alice@med.example.edu", "status": "catch_all"}, {"email": "alice.jones@med.example.edu", "status": "deliverable"}]}}}
        rows = [{"matched_on": "wrong-person", "matches": [match]}, {"matched_on": URL, "matches": [match]}]
        contacts = parse_contacts(rows, [URL])
        self.assertEqual(len(contacts), 2)
        self.assertEqual(contacts[0]["status"], "catch_all")
        self.assertEqual(contacts[1]["status"], "deliverable")
        self.assertEqual(parse_contacts([{ "matched_on": URL, "matches": [match, match]}], [URL]), [])
        self.assertEqual(parse_contacts(list(reversed(rows)), [URL]), contacts)
        with self.assertRaises(ValueError):
            parse_contacts({"results": []}, [URL])

    def test_real_profile_url_schema_does_not_invent_a_handle_from_a_display_name(self):
        self.assertEqual(profile_url({"social_handles": {"professional_network_identifier": {"profile_url": URL}}}), URL)
        self.assertIsNone(profile_url({"basic_profile": {"professional_network_name": "synthetic-clinician"}}))
        self.assertIsNone(profile_url({"basic_profile": {"professional_network_name": "Alice Smith"}}))

    def test_public_fetch_host_boundary_blocks_redirect_and_spoofing_targets(self):
        for url in ["http://med.example.edu", "https://med.example.edu.evil.test/", "https://localhost/", "https://127.0.0.1/", "https://user@med.example.edu/", "https://med.example.edu:8443"]:
            self.assertFalse(host_allowed(url, ["med.example.edu"]))
        self.assertTrue(host_allowed("https://people.med.example.edu/faculty", ["med.example.edu"]))


class RunnerSafetyTests(unittest.TestCase):
    def test_offline_default_makes_zero_network_calls(self):
        with tempfile.TemporaryDirectory() as directory, patch("live.requests.post") as post, patch("live.requests.get") as get:
            runner = LiveRunner(directory)
            try:
                with self.assertRaisesRegex(ValueError, "Replay"):
                    runner.request("/person/contact/enrich", CONTACT_BODY)
                post.assert_not_called()
                get.assert_not_called()
                self.assertEqual(runner.budget.reserved, 0)
            finally:
                runner.close()

    def test_repeat_replay_never_spends_again(self):
        with tempfile.TemporaryDirectory() as directory, patch("live.requests.post") as post, patch("live.requests.get") as get:
            (Path(directory) / (canonical("/person/contact/enrich", CONTACT_BODY) + ".json")).write_text("[]")
            runner = LiveRunner(directory, True)
            try:
                for _ in range(10):
                    self.assertEqual(runner.request("/person/contact/enrich", CONTACT_BODY), [])
                post.assert_not_called()
                get.assert_not_called()
            finally:
                runner.close()

    def test_exhausted_budget_prevents_paid_call(self):
        with tempfile.TemporaryDirectory() as directory, patch("live.requests.post") as post:
            runner = LiveRunner(directory, True)
            try:
                runner.budget.reserve(75)
                with patch.object(runner, "balance", return_value=100):
                    with self.assertRaisesRegex(ValueError, "ceiling"):
                        runner.request("/person/contact/enrich", CONTACT_BODY)
                post.assert_not_called()
            finally:
                runner.close()

    def test_uncertain_outcome_survives_restart_without_retry(self):
        with tempfile.TemporaryDirectory() as directory, patch("live.requests.post") as post:
            runner = LiveRunner(directory, True)
            runner.ledger["calls"].append({"key": canonical("/person/contact/enrich", CONTACT_BODY), "state": "uncertain"})
            runner.save()
            runner.close()
            resumed = LiveRunner(directory, True)
            try:
                with self.assertRaisesRegex(ValueError, "uncertain"):
                    resumed.request("/person/contact/enrich", CONTACT_BODY)
                post.assert_not_called()
            finally:
                resumed.close()

    def test_simultaneous_runs_cannot_share_ledger(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = LiveRunner(directory)
            try:
                with self.assertRaises(BlockingIOError):
                    LiveRunner(directory)
            finally:
                runner.close()

    def test_429_402_and_503_never_automatically_retry(self):
        for status in [429, 402, 503]:
            with self.subTest(status=status), tempfile.TemporaryDirectory() as directory:
                runner = LiveRunner(directory, True)
                response = Mock(ok=False, status_code=status, headers={})
                try:
                    with patch.object(runner, "balance", return_value=100), patch.object(runner, "headers", return_value={}), patch("live.requests.post", return_value=response) as post:
                        with self.assertRaisesRegex(ValueError, str(status)):
                            runner.request("/person/contact/enrich", CONTACT_BODY)
                        self.assertEqual(post.call_count, 1)
                        self.assertEqual(runner.budget.reserved, 2.5)
                        with self.assertRaisesRegex(ValueError, "uncertain"):
                            runner.request("/person/contact/enrich", CONTACT_BODY)
                        self.assertEqual(post.call_count, 1)
                finally:
                    runner.close()

    def test_reservation_written_before_network_and_timeout_keeps_it(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = LiveRunner(directory, True)
            def timeout(*args, **kwargs):
                ledger = json.loads((Path(directory) / "ledger.json").read_text())
                self.assertEqual(ledger["reserved"], 2.5)
                self.assertEqual(ledger["calls"][0]["state"], "uncertain")
                raise TimeoutError("Synthetic timeout")
            try:
                with patch.object(runner, "balance", return_value=100), patch.object(runner, "headers", return_value={}), patch("live.requests.post", side_effect=timeout):
                    with self.assertRaises(TimeoutError):
                        runner.request("/person/contact/enrich", CONTACT_BODY)
                self.assertEqual(runner.budget.reserved, 2.5)
            finally:
                runner.close()

    def test_abnormal_cost_permanently_halts_future_live_calls(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = LiveRunner(directory, True)
            response = Mock(ok=True, status_code=200, headers={"x-credits-used": "4"})
            response.json.return_value = []
            try:
                with patch.object(runner, "balance", side_effect=[100, 96]), patch.object(runner, "headers", return_value={}), patch("live.requests.post", return_value=response) as post:
                    with self.assertRaisesRegex(ValueError, "reservation"):
                        runner.request("/person/contact/enrich", CONTACT_BODY)
                    self.assertEqual(post.call_count, 1)
                self.assertTrue(runner.ledger["halted"])
                with self.assertRaisesRegex(ValueError, "halted"):
                    runner.request("/web/search/live", {"query": "synthetic", "sources": ["web"], "page": 1})
            finally:
                runner.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)