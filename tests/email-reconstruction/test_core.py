import itertools
import math
import unittest
from datetime import datetime, timedelta, timezone
from core import Budget, Evidence, PATTERNS, candidates, email_parts, learn_pattern, matching_patterns, name_variants, normalize_domain, release_decision

NOW = datetime(2026, 11, 25, tzinfo=timezone.utc)
SCOPE = ("med.example.edu", "Example University", "faculty")


def sample(person, name, email, **changes):
    fields = dict(person_id=person, name=name, email=email, domain=SCOPE[0], organization=SCOPE[1], cohort=SCOPE[2], observed_at=NOW.isoformat())
    fields.update(changes)
    return Evidence(**fields)


def learn(samples):
    return learn_pattern(samples, *SCOPE, NOW)


class NameTests(unittest.TestCase):
    def test_credentials_and_prefixes(self):
        for name in ["Dr. Sarah Jenkins, MD", "Sarah Jenkins MD PhD", "Professor Sarah Jenkins RN BSN", "Sarah Jenkins, DNP", "Sarah Jenkins FACS", "Sarah Jenkins Jr."]:
            with self.subTest(name=name):
                self.assertIn(("sarah", "", "jenkins"), name_variants(name))

    def test_last_first_and_accents(self):
        self.assertIn(("jose", "", "nunez"), name_variants("Núñez, José"))
        self.assertIn(("anne", "", "oneill"), name_variants("Anne O’Neill"))

    def test_compound_and_middle_names(self):
        self.assertIn("fmlast", matching_patterns("Maria-Cristina Wells", "mcwells@med.example.edu"))
        self.assertIn(("gabriel", "", "perezlopez"), name_variants("Gabriel Perez-Lopez"))
        self.assertIn(("gabriel", "", "perez-lopez"), name_variants("Gabriel Perez-Lopez"))
        self.assertIn(("maria", "", "delacruz"), name_variants("Maria de la Cruz"))
        self.assertIn(("sarah", "r", "jenkins"), name_variants("Sarah Rose Jenkins"))

    def test_unknown_script_mononyms_missing_names_abstain(self):
        for name in [None, "", "Prince", "李 小龙", "MD", "a" * 201]:
            self.assertEqual(name_variants(name), [])

    def test_nickname_does_not_change_legal_first_name(self):
        self.assertIn(("robert", "", "smith"), name_variants('Robert "Bob" Smith'))
        self.assertEqual(matching_patterns("Robert Smith", "bob.smith@med.example.edu"), set())


class PatternTests(unittest.TestCase):
    def test_each_supported_formula_with_independent_colleagues_and_holdout(self):
        for pattern, fn in PATTERNS.items():
            with self.subTest(pattern=pattern):
                pairs = [("Sarah Rose Jenkins", ("sarah", "r", "jenkins")), ("Michael Lee Patel", ("michael", "l", "patel"))]
                evidence = [sample(str(i), n, str(fn(*v)) + "@" + SCOPE[0]) for i, (n, v) in enumerate(pairs)]
                result = learn(evidence)
                self.assertEqual(result["state"], "supported")
                self.assertEqual(result["patterns"], [pattern])
                expected = str(fn("alice", "j", "torres")) + "@" + SCOPE[0]
                self.assertIn(expected, candidates("Alice June Torres", SCOPE[0], result))
                self.assertEqual(release_decision(expected, mx="present", mailbox="deliverable"), "withhold_unproven_identity")

    def test_every_exact_domain_and_role_scope_is_separate(self):
        base = sample("1", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0])
        for change in [{"domain": "example.edu"}, {"organization": "Affiliated Hospital"}, {"cohort": "resident"}, {"cohort": "fellow"}, {"cohort": "bedside_nurse"}, {"cohort": "nursing_faculty"}, {"cohort": "student"}, {"cohort": "administrator"}]:
            self.assertEqual(learn([base, sample("2", "Michael Patel", "michael.patel@" + SCOPE[0], **change)])["state"], "insufficient_evidence")

    def test_duplicate_person_email_and_sources_are_not_independent(self):
        a = sample("same-person", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0])
        b = sample("same-person", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0])
        c = sample("other-id", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0])
        self.assertEqual(learn([a, b, c])["sample_count"], 1)

    def test_mixed_schemes_and_opaque_or_collision_ids_never_invent_numbers(self):
        a = sample("1", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0])
        for address in ["mpatel", "mpatel4", "patel.27", "abc1234", "michaelp91"]:
            r = learn([a, sample("2", "Michael Patel", address + "@" + SCOPE[0])])
            self.assertEqual(r["state"], "mixed_or_opaque")
            self.assertEqual(candidates("Alice Torres", SCOPE[0], r), [])

    def test_single_initial_ambiguity(self):
        result = learn([sample("1", "S Jenkins", "sjenkins@" + SCOPE[0]), sample("2", "M Patel", "mpatel@" + SCOPE[0])])
        self.assertEqual(result["state"], "ambiguous")
        self.assertEqual(candidates("Alice Torres", SCOPE[0], result), [])

    def test_stale_future_unknown_and_unbound_evidence(self):
        base = sample("1", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0])
        changes = [{"observed_at": (NOW - timedelta(days=91)).isoformat()}, {"observed_at": (NOW + timedelta(days=1)).isoformat()}, {"observed_at": "unknown"}, {"current": False}, {"identity_bound": False}, {"official": False}]
        for change in changes:
            self.assertEqual(learn([base, sample("2", "Michael Patel", "michael.patel@" + SCOPE[0], **change)])["state"], "insufficient_evidence")

    def test_90_day_boundary(self):
        result = learn([sample("1", "Sarah Jenkins", "sarah.jenkins@" + SCOPE[0]), sample("2", "Michael Patel", "michael.patel@" + SCOPE[0], observed_at=(NOW - timedelta(days=90)).isoformat())])
        self.assertEqual(result["state"], "supported")

    def test_shared_program_mailboxes_are_not_people(self):
        for address in ["emresidency", "gme", "info", "admissions", "fellowship"]:
            self.assertEqual(matching_patterns("Emergency Residency", address + "@" + SCOPE[0]), set())


class SafetyTests(unittest.TestCase):
    def test_mx_and_smtp_cannot_prove_identity_even_if_all_patterns_agree(self):
        for mx, mailbox, collision, conflict in itertools.product(["present", "absent", "null_mx", "timeout", "unknown"], ["deliverable", "catch_all", "unknown", "blocked", "invalid", "greylisted"], [True, False], [True, False]):
            decision = release_decision("john.smith@med.example.edu", mx=mx, mailbox=mailbox, collision=collision, conflicting=conflict)
            self.assertNotEqual(decision, "eligible_not_guaranteed")

    def test_full_matrix_requires_all_four_independent_checks(self):
        for identity, current, domain, mx, mailbox, collision, conflict, optout in itertools.product([False, True], [False, True], [False, True], ["present", "absent", "null_mx", "unknown"], ["deliverable", "catch_all", "invalid", "unknown"], [False, True], [False, True], [False, True]):
            decision = release_decision("alice@med.example.edu", exact_person_evidence=identity, current_affiliation=current, exact_domain=domain, mx=mx, mailbox=mailbox, collision=collision, conflicting=conflict, opted_out=optout)
            expected = identity and current and domain and mx == "present" and mailbox == "deliverable" and not collision and not conflict and not optout
            self.assertEqual(decision == "eligible_not_guaranteed", expected)

    def test_spoofed_sibling_and_parent_domains_are_not_exact_scope(self):
        for domain in ["med.example.edu.evil.com", "evil-example.edu", "example.edu", "hospital.example.edu", "med.example.edu:443", "med.example.edu?foo=1"]:
            self.assertNotEqual(normalize_domain(domain), SCOPE[0])
        self.assertEqual(normalize_domain("https://www.MED.EXAMPLE.EDU/people"), SCOPE[0])

    def test_invalid_addresses(self):
        for value in ["x@", "@example.edu", "x@@example.edu", "a b@example.edu", "a..b@example.edu", "x@-example.edu", "x@example..edu", "a." + "@example.edu"]:
            self.assertIsNone(email_parts(value))

    def test_75_credit_ceiling_exactly(self):
        b = Budget(75)
        for _ in range(75):
            b.reserve(1)
        self.assertEqual(b.reserved, 75)
        with self.assertRaises(ValueError):
            b.reserve(0.01)

    def test_budget_bad_inputs_and_restart(self):
        for value in [76, 0, -1, math.nan, math.inf]:
            with self.assertRaises(ValueError):
                Budget(value)
        b = Budget(75, 74.5)
        b.reserve(0.5)
        with self.assertRaises(ValueError):
            b.reserve(0.1)
        for value in [-1, math.nan, math.inf]:
            with self.assertRaises(ValueError):
                Budget().reserve(value)

    def test_candidates_are_bounded_and_never_random_id_brute_force(self):
        for name in ["Maria-Cristina de la Cruz-Perez", "John Smith", "A B C D E F G"]:
            for pattern in PATTERNS:
                result = candidates(name, SCOPE[0], {"state": "supported", "patterns": [pattern]})
                self.assertLessEqual(len(result), 8)
                self.assertTrue(all(not any(c.isdigit() for c in e.split("@")[0]) for e in result))


if __name__ == "__main__":
    unittest.main(verbosity=2)