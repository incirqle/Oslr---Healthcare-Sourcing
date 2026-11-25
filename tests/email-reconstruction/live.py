"""Explicit, capped research runner; never called by the app or deployed."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from core import Budget, Evidence, candidates, email_parts, learn_pattern, matching_patterns, normalize_domain

BASE = "https://api.crustdata.com"
LIMIT = 75
INSTITUTIONS = [
    ("University of Miami", ["miami.edu", "med.miami.edu", "umiamihealth.org", "jhsmiami.org"], "University of Miami Miller School of Medicine"),
    ("Stanford Medicine", ["stanford.edu", "stanfordhealthcare.org", "stanfordchildrens.org"], "Stanford University School of Medicine"),
    ("Michigan Medicine", ["umich.edu", "med.umich.edu", "michiganmedicine.org", "uofmhealth.org", "sparrow.org"], "University of Michigan Medical School"),
    ("UCSF", ["ucsf.edu", "ucsfhealth.org"], "UCSF"),
    ("Duke University Health System", ["duke.edu", "dm.duke.edu", "mc.duke.edu"], "Duke University"),
    ("Johns Hopkins Medicine", ["jhmi.edu", "jhu.edu", "jh.edu"], "Johns Hopkins University"),
    ("University of Washington", ["uw.edu", "washington.edu", "uwmedicine.org"], "University of Washington"),
    ("Mass General Brigham", ["massgeneralbrigham.org", "partners.org", "harvard.edu", "mgh.harvard.edu", "bwh.harvard.edu"], "Harvard Medical School"),
    ("NYU Langone Health", ["nyulangone.org", "nyu.edu", "nychhc.org"], "NYU Grossman School of Medicine"),
    ("Emory Healthcare", ["emory.edu", "emoryhealthcare.org", "gradyhealth.org"], "Emory University"),
    ("UT Southwestern Medical Center", ["utsouthwestern.edu", "utsw.edu", "parklandhealth.org"], "UT Southwestern Medical Center"),
    ("Mayo Clinic", ["mayo.edu", "mayoclinic.org"], "Mayo Clinic"),
]


def canonical(path, body):
    return hashlib.sha256(json.dumps([path, body], sort_keys=True).encode()).hexdigest()


def profile_url(profile):
    network = profile.get("professional_network", {})
    basic = profile.get("basic_profile", {})
    value = network.get("profile_url") or network.get("url") or basic.get("profile_url")
    if not value:
        value = profile.get("social_handles", {}).get("professional_network_identifier", {}).get("profile_url")
    return value if isinstance(value, str) and value.startswith("https://www.linkedin.com/in/") else None


def validate_request(path, body):
    """Closed endpoint allowlist and strict cost-bearing limits."""
    if path == "/company/identify":
        if set(body) != {"names"} or not 1 <= len(body["names"]) <= 25 or not all(isinstance(n, str) and 0 < len(n) <= 200 for n in body["names"]):
            raise ValueError("Invalid identify request")
        return 0.2 * len(body["names"]) # conservative even if this account reports free
    if path == "/web/search/live":
        if set(body) != {"query", "sources", "page"} or body["sources"] != ["web"] or body["page"] != 1 or not isinstance(body["query"], str) or not 0 < len(body["query"]) <= 1000:
            raise ValueError("Only one standard web page allowed")
        return 1
    if path == "/person/search":
        expected = ["crustdata_person_id", "basic_profile", "experience", "professional_network", "social_handles"]
        if set(body) != {"filters", "fields", "limit"} or body["fields"] != expected or body["limit"] != 3:
            raise ValueError("Only three lightweight colleague profiles allowed")
        conditions = body.get("filters", {}).get("conditions", [])
        if body.get("filters", {}).get("op") != "and" or len(conditions) != 2:
            raise ValueError("Invalid colleague filters")
        if conditions[0].get("field") != "experience.employment_details.current.company_name" or conditions[0].get("type") != "=" or not isinstance(conditions[0].get("value"), str):
            raise ValueError("Require a current exact employer")
        if conditions[1] != {"field": "experience.employment_details.current.business_email_verified", "type": "=", "value": True}:
            raise ValueError("Require verified availability")
        return 0.09
    if path == "/person/contact/enrich":
        urls = body.get("professional_network_profile_urls", [])
        if set(body) != {"professional_network_profile_urls", "fields", "verified"} or body["fields"] != ["contact.business_emails"] or body["verified"] is not True or not 1 <= len(urls) <= 3:
            raise ValueError("Work-email-only colleague sample required")
        if not all(isinstance(u, str) and u.startswith("https://www.linkedin.com/in/") and len(u) <= 500 for u in urls):
            raise ValueError("Invalid colleague URLs")
        # Account endpoints: base 1 + business-email 1 + verified .5 per person.
        return 2.5 * len(urls)
    raise ValueError("Endpoint not allowed by research budget")


def parse_search(body):
    if not isinstance(body, dict) or body.get("success") is not True or not isinstance(body.get("results"), list):
        raise ValueError("Invalid search envelope")
    return [x for x in body["results"] if isinstance(x, dict) and isinstance(x.get("url"), str)]


def parse_contacts(body, expected_urls):
    if not isinstance(body, list):
        raise ValueError("Invalid sync envelope")
    expected = set(expected_urls)
    output = []
    for row in body:
        if not isinstance(row, dict) or row.get("matched_on") not in expected:
            continue
        # Multiple identity matches are ambiguous; do not pick first blindly.
        matches = row.get("matches", [])
        if not isinstance(matches, list) or len(matches) != 1:
            continue
        person = matches[0].get("person_data", {})
        contact = person.get("contact", {})
        for e in contact.get("business_emails", []):
            if isinstance(e, dict) and email_parts(e.get("email")):
                output.append({"url": row["matched_on"], "email": e["email"].lower(), "status": e.get("status", "unknown"), "company_id": e.get("crustdata_company_id")})
    return output


class LiveRunner:
    def __init__(self, directory, live=False):
        self.directory = Path(directory).resolve()
        # Live personal records must not land in source/public/Files directories.
        if not str(self.directory).startswith("/tmp/"):
            raise ValueError("Private live data belongs under /tmp")
        self.directory.mkdir(parents=True, exist_ok=True)
        self.live = live
        self.lock = (self.directory / "run.lock").open("a")
        fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        self.ledger_path = self.directory / "ledger.json"
        self.ledger = json.loads(self.ledger_path.read_text()) if self.ledger_path.exists() else {"limit": LIMIT, "reserved": 0, "header_spend": 0, "start_balance": None, "calls": []}
        self.budget = Budget(LIMIT, self.ledger["reserved"])
        self.last_call = 0

    def close(self):
        self.lock.close()

    def save(self):
        temp = self.ledger_path.with_suffix(".new")
        temp.write_text(json.dumps(self.ledger, indent=2))
        temp.replace(self.ledger_path)

    def headers(self):
        key = os.environ.get("CRUSTDATA_API_KEY")
        if not key:
            raise ValueError("Provider credential missing")
        if os.environ.get("CRUSTDATA_KILLED", "").lower() in ["1", "true"]:
            raise ValueError("Provider kill switch enabled")
        return {"Authorization": "Token " + key, "x-api-version": "2025-11-01", "Content-Type": "application/json"}

    def balance(self):
        response = requests.get(BASE + "/user/credits", headers=self.headers(), timeout=30, allow_redirects=False)
        response.raise_for_status()
        value = response.json().get("credits")
        if not isinstance(value, (int, float)) or value < 0:
            raise ValueError("Cannot verify provider balance")
        return value

    def request(self, path, body):
        cost = validate_request(path, body)
        key = canonical(path, body)
        file = self.directory / (key + ".json")
        if file.exists():
            return json.loads(file.read_text())
        if not self.live:
            raise ValueError("Replay has no recorded response for this request")
        if self.ledger.get("halted"):
            raise ValueError("Live run halted: " + self.ledger["halted"])
        # An uncertain request cannot be retried by restarting the runner.
        if any(c["key"] == key and c["state"] != "complete" for c in self.ledger["calls"]):
            raise ValueError("Previous request outcome uncertain; no automatic resubmission")
        before = self.balance()
        if self.ledger["start_balance"] is None:
            self.ledger["start_balance"] = before
        global_drop = max(0, self.ledger["start_balance"] - before)
        if max(global_drop, self.budget.reserved) + cost > LIMIT + 1e-8 or before < cost:
            raise ValueError("75-credit ceiling reached; remaining calls withheld")
        self.ledger["reserved"] = self.budget.reserve(cost)
        entry = {"key": key, "path": path, "max_cost": cost, "state": "uncertain", "balance_before": before}
        self.ledger["calls"].append(entry)
        self.save() # reserve durably BEFORE sending
        wait = max(0, 6.2 - (time.monotonic() - self.last_call))
        if wait:
            time.sleep(wait)
        self.last_call = time.monotonic()
        response = requests.post(BASE + path, headers=self.headers(), json=body, timeout=60, allow_redirects=False)
        entry["http_status"] = response.status_code
        header = response.headers.get("x-credits-used")
        if header is not None:
            entry["header_cost"] = float(header)
            self.ledger["header_spend"] = round(self.ledger["header_spend"] + float(header), 6)
        entry["balance_after"] = self.balance()
        self.save()
        # Never retry: every retry would need its own reservation and known outcome.
        if not response.ok:
            entry["state"] = "failed"
            self.save()
            raise ValueError("Provider HTTP " + str(response.status_code))
        data = response.json()
        text = json.dumps(data).lower()
        if any(x in text for x in ["insufficient_credit", "not enough credits", "credit limit", '"quota"']):
            raise ValueError("Provider credit failure; stop")
        file.write_text(json.dumps(data, indent=2))
        entry["state"] = "complete"
        self.save()
        if entry.get("header_cost", 0) > cost + 1e-8 or before - entry["balance_after"] > cost + 1e-8:
            self.ledger["halted"] = "Observed cost exceeds reservation"
            self.save()
            raise ValueError("Observed cost exceeds reservation; stop and investigate")
        return data


def manifest():
    out = []
    for institution, domains, school in INSTITUTIONS:
        for cohort, topic in [("faculty", "faculty physician email directory"), ("trainee", "residents fellows email contact"), ("nursing", "nursing school faculty staff email directory")]:
            sites = " OR ".join("site:" + d for d in domains[:3])
            query = '(' + sites + ') "' + institution + '" ' + topic + ' "@"'
            if cohort == "nursing":
                query = '(' + sites + ') "' + school + '" nursing faculty email "@"'
            out.append({"institution": institution, "cohort": cohort, "domains": domains, "query": query})
    return out


def targeted_manifest():
    cases = [
        ("University of Miami", "gme", "med.miami.edu", 'residency fellowship "@med.miami.edu"'),
        ("University of Miami", "nursing", "miami.edu", 'nursing faculty "@miami.edu"'),
        ("Stanford Medicine", "gme", "med.stanford.edu", 'residents fellows email contact'),
        ("Stanford Medicine", "hospital", "stanfordhealthcare.org", 'nursing physician email contact'),
        ("Michigan Medicine", "gme", "med.umich.edu", 'house officers residency "@med.umich.edu"'),
        ("Michigan Medicine", "nursing", "nursing.umich.edu", 'faculty email contact'),
        ("UCSF", "fellows", "geriatrics.ucsf.edu", 'current fellows email'),
        ("Duke University Health System", "residents", "medicine.duke.edu", 'current residents email contact'),
        ("Johns Hopkins Medicine", "nursing", "nursing.jhu.edu", 'faculty email contact'),
        ("Mass General Brigham", "faculty", "nutrition.hms.harvard.edu", 'Brigham faculty email'),
        ("UT Southwestern Medical Center", "gme", "utsouthwestern.edu", 'residency fellowship email contact'),
        ("Mayo Clinic", "nursing", "mayo.edu", 'nursing faculty email contact'),
    ]
    return [{"institution": institution, "cohort": cohort, "domains": [domain], "query": "site:" + domain + " " + query} for institution, cohort, domain, query in cases]


def independent_holdouts(samples, organization, now):
    groups = defaultdict(list)
    for s in samples:
        groups[(s.domain, s.cohort)].append(s)
    holdouts = []
    scoped = []
    for (domain, cohort), group in groups.items():
        people = defaultdict(list)
        for s in group:
            people[s.person_id].append(s)
        scoped.append({"domain": domain, "cohort": cohort, "people": len(people), "addresses": len(group)})
        if len(people) < 3:
            continue
        ids = sorted(people)
        for target_id in ids:
            training = [sorted(people[i], key=lambda s: s.email)[0] for i in ids if i != target_id]
            target = people[target_id][0]
            result = learn_pattern(training, domain, organization, cohort, now)
            predicted = candidates(target.name, domain, result)
            holdouts.append({"domain": domain, "cohort": cohort, "training_people": len(training), "state": result["state"], "patterns": result["patterns"], "prediction_count": len(predicted), "exact_match": any(t.email in predicted for t in people[target_id])})
    return scoped, holdouts


def host_allowed(url, domains):
    try:
        parsed = urlparse(url)
        return parsed.scheme == "https" and parsed.port in [None, 443] and not parsed.username and any(parsed.hostname == d or (parsed.hostname or "").endswith("." + d) for d in domains)
    except ValueError:
        return False


def fetch_public_page(url, domains, directory):
    """Free public-source inspection, never SMTP or credential-bearing requests."""
    if not host_allowed(url, domains):
        return {"state": "unapproved_host"}
    key = hashlib.sha256(url.encode()).hexdigest()
    file = directory / ("page-" + key + ".json")
    if file.exists():
        return json.loads(file.read_text())
    try:
        # No redirects to arbitrary hosts; do not fetch non-HTML or huge files.
        with requests.get(url, timeout=20, allow_redirects=False, stream=True) as response:
            if response.status_code != 200:
                result = {"state": "http_" + str(response.status_code)}
            elif "text/html" not in response.headers.get("content-type", ""):
                result = {"state": "not_html"}
            else:
                content = bytearray()
                for chunk in response.iter_content(16384):
                    content.extend(chunk)
                    if len(content) > 2_000_000:
                        break
                if len(content) > 2_000_000:
                    result = {"state": "oversize"}
                else:
                    soup = BeautifulSoup(content.decode(errors="replace"), "html.parser")
                    for node in soup(["script", "style", "nav", "footer"]):
                        node.decompose()
                    text = soup.get_text(" ", strip=True)
                    addresses = set(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text))
                    for anchor in soup.select('a[href^="mailto:"]'):
                        addresses.add(anchor.get("href", "")[7:].split("?")[0])
                    result = {"state": "fetched", "url": url, "emails": sorted(e.lower() for e in addresses if email_parts(e)), "text": text[:100000]}
        file.write_text(json.dumps(result))
        return result
    except requests.RequestException:
        return {"state": "fetch_failed"}


def run(directory, live, phase, start=0, stop=36):
    runner = LiveRunner(directory, live)
    try:
        summary_file = runner.directory / "summary.json"
        summary = json.loads(summary_file.read_text()) if summary_file.exists() else {"institutions": [], "searches": [], "colleague_trials": []}
        if phase in ["identify", "all"]:
            names = [x[0] for x in INSTITUTIONS]
            data = runner.request("/company/identify", {"names": names})
            if not isinstance(data, list) or len(data) != len(names):
                raise ValueError("Unexpected company response alignment")
            summary["institutions"] = []
            for name, row in zip(names, data):
                hits = []
                for match in row.get("matches", []):
                    info = match.get("company_data", {}).get("basic_info", {})
                    hits.append({"name": info.get("name"), "confidence": match.get("confidence_score"), "domains": info.get("all_domains", []), "primary_domain": info.get("primary_domain")})
                summary["institutions"].append({"query": name, "hits": hits})
        if phase in ["web", "targeted", "all"]:
            search_key = "targeted_searches" if phase == "targeted" else "searches"
            searches = list(summary.get(search_key, []))
            for entry in (targeted_manifest() if phase == "targeted" else manifest())[start:stop]:
                searches = [s for s in searches if (s["institution"], s["cohort"]) != (entry["institution"], entry["cohort"])]
                body = {"query": entry["query"], "sources": ["web"], "page": 1}
                try:
                    data = runner.request("/web/search/live", body)
                    results = parse_search(data)
                    official = [r for r in results if host_allowed(r["url"], entry["domains"])]
                    pages = [fetch_public_page(r["url"], entry["domains"], runner.directory) for r in official[:2]]
                    text = " ".join(str(r.get("snippet", "")) for r in official)
                    emails = sorted({e.lower() for e in re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text) if email_parts(e)})
                    page_emails = sorted({e for p in pages for e in p.get("emails", [])})
                    searches.append({"institution": entry["institution"], "cohort": entry["cohort"], "results": len(results), "official_results": len(official), "snippet_email_count": len(emails), "page_email_count": len(page_emails), "email_domains": dict(Counter(e.split("@")[1] for e in set(emails + page_emails))), "numeric_localparts": sum(bool(re.search(r"\d", e.split("@")[0])) for e in set(emails + page_emails)), "page_states": [p["state"] for p in pages], "sources": [r["url"] for r in official[:2]], "identity_verified": False})
                    print(entry["institution"], entry["cohort"], len(results), "results;", len(page_emails), "public emails")
                except ValueError as error:
                    searches.append({"institution": entry["institution"], "cohort": entry["cohort"], "error": str(error)})
                    if "credit" in str(error).lower() or "uncertain" in str(error) or "reservation" in str(error):
                        break
            summary[search_key] = searches
        if phase in ["colleagues", "all"]:
            trials = []
            for organization in ["University of Miami", "Stanford University", "University of Michigan"]:
                body = {"filters": {"op": "and", "conditions": [{"field": "experience.employment_details.current.company_name", "type": "=", "value": organization}, {"field": "experience.employment_details.current.business_email_verified", "type": "=", "value": True}]}, "fields": ["crustdata_person_id", "basic_profile", "experience", "professional_network", "social_handles"], "limit": 3}
                profiles = runner.request("/person/search", body).get("profiles", [])
                mapping = {}
                for profile in profiles:
                    urls = profile_url(profile)
                    if urls:
                        mapping[urls] = profile
                if not mapping:
                    trials.append({"organization": organization, "profiles": len(profiles), "state": "no_usable_profile_url"})
                    continue
                urls = list(mapping)
                contacts = parse_contacts(runner.request("/person/contact/enrich", {"professional_network_profile_urls": urls, "fields": ["contact.business_emails"], "verified": True}), urls)
                now = datetime.now(timezone.utc)
                samples = []
                statuses = Counter()
                wrong_domain = 0
                institution_domains = {"University of Miami": {"miami.edu", "med.miami.edu"}, "Stanford University": {"stanford.edu"}, "University of Michigan": {"umich.edu", "med.umich.edu"}}[organization]
                for contact in contacts:
                    profile = mapping[contact["url"]]
                    statuses[contact["status"]] += 1
                    current = profile.get("experience", {}).get("employment_details", {}).get("current", [])
                    role = next((r for r in current if (r.get("company_name") or r.get("name", "")).lower() == organization.lower()), None)
                    if not role or contact["status"] != "deliverable":
                        continue
                    if contact["email"].split("@")[1] not in institution_domains:
                        wrong_domain += 1
                        continue
                    title = role.get("title", "").lower()
                    cohort = "faculty" if any(w in title for w in ["professor", "faculty"]) else "resident" if "resident" in title else "fellow" if "fellow" in title else "nursing" if "nurs" in title else "other"
                    samples.append(Evidence(str(profile.get("crustdata_person_id")), profile.get("basic_profile", {}).get("name", ""), contact["email"], contact["email"].split("@")[1], organization, cohort, now.isoformat(), official=True, identity_bound=True))
                scoped, holdouts = independent_holdouts(samples, organization, now)
                trials.append({"organization": organization, "profiles": len(profiles), "contact_addresses": len(contacts), "statuses": dict(statuses), "wrong_domain_addresses_excluded": wrong_domain, "scope_eligible_addresses": len(samples), "scoped_groups": scoped, "holdouts": holdouts, "state": "tested"})
            summary["colleague_trials"] = trials
        if live:
            end = runner.balance()
            summary["credit_account_drop"] = round((runner.ledger["start_balance"] or end) - end, 6)
        summary["credit_reserved"] = runner.ledger["reserved"]
        summary["credit_header_spend"] = runner.ledger["header_spend"]
        summary["paid_requests"] = len(runner.ledger["calls"])
        summary["budget"] = LIMIT
        summary["generated_emails_released"] = 0
        summary["timestamp"] = datetime.now(timezone.utc).isoformat()
        summary_file.write_text(json.dumps(summary, indent=2))
        print(json.dumps({k: v for k, v in summary.items() if k not in ["institutions", "searches", "targeted_searches", "colleague_trials"]}, indent=2))
    finally:
        runner.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--directory", default="/tmp/email-reconstruction-live")
    parser.add_argument("--live", action="store_true")
    parser.add_argument("--phase", choices=["identify", "web", "targeted", "colleagues", "all"], default="all")
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--stop", type=int, default=36)
    args = parser.parse_args()
    if not 0 <= args.start < args.stop <= 36:
        raise SystemExit("Invalid case slice")
    run(args.directory, args.live, args.phase, args.start, args.stop)