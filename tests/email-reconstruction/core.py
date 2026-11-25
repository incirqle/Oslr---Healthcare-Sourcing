"""Isolated research model. A pattern proposes candidates, never verified contacts."""
from dataclasses import dataclass
from datetime import datetime, timezone
import math
import re
import unicodedata

PATTERNS = {
    "first.last": lambda f, m, l: f + "." + l,
    "flast": lambda f, m, l: f[0] + l,
    "f.last": lambda f, m, l: f[0] + "." + l,
    "firstlast": lambda f, m, l: f + l,
    "last.first": lambda f, m, l: l + "." + f,
    "lastf": lambda f, m, l: l + f[0],
    "last.f": lambda f, m, l: l + "." + f[0],
    "first_last": lambda f, m, l: f + "_" + l,
    "fmlast": lambda f, m, l: f[0] + m[0] + l if m else None,
    "first.m.last": lambda f, m, l: f + "." + m[0] + "." + l if m else None,
    "first": lambda f, m, l: f,
    "last": lambda f, m, l: l,
}
CREDENTIALS = {"md", "do", "mbbs", "phd", "dpm", "rn", "bsn", "msn", "dnp", "np", "pa", "pac", "facs", "faan", "mph", "faco", "faaos", "faap", "facp", "frcs", "dr", "doctor", "prof", "professor", "jr", "sr", "ii", "iii", "iv"}
GENERIC = {"info", "contact", "admin", "office", "gme", "residency", "emresidency", "fellowship", "nursing", "support", "admissions", "recruitment"}


def ascii_token(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z]", "", value)


def name_variants(name):
    """Bounded hypotheses; ambiguity is retained, never silently 'resolved'."""
    if not isinstance(name, str) or len(name) > 200:
        return []
    name = re.sub(r"\([^)]*\)|\"[^\"]*\"", "", name.strip())
    comma = name.split(",")
    # Recognize Last, First only when the right side is not credentials.
    if len(comma) > 1 and any(ascii_token(t) not in CREDENTIALS for t in comma[1].split()):
        name = comma[1] + " " + comma[0]
    else:
        name = comma[0]
    raw = [t for t in name.split() if ascii_token(t) and ascii_token(t) not in CREDENTIALS]
    if len(raw) < 2 or any(not ascii_token(t) for t in raw):
        return []
    first, last = ascii_token(raw[0]), ascii_token(raw[-1])
    middle = "".join(ascii_token(t)[0] for t in raw[1:-1])
    out = {(first, middle, last)}
    if "-" in raw[0]:
        pieces = [ascii_token(t) for t in raw[0].split("-") if ascii_token(t)]
        if len(pieces) > 1:
            out.add((pieces[0], pieces[1][0] + middle, last))
    if "-" in raw[-1]:
        pieces = [ascii_token(t) for t in raw[-1].split("-") if ascii_token(t)]
        out.add((first, middle, "-".join(pieces)))
        for part in pieces:
            out.add((first, middle, part))
    # Particles and two surnames can belong to the surname, not a middle name.
    if len(raw) > 2:
        out.add((first, "", "".join(ascii_token(t) for t in raw[1:])))
    return sorted(out)[:8]


def normalize_domain(value):
    if not isinstance(value, str):
        return None
    value = value.strip().lower().removeprefix("https://").removeprefix("http://")
    value = value.split("/")[0].removeprefix("www.").rstrip(".")
    if len(value) > 253 or not re.fullmatch(r"[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?", value):
        return None
    labels = value.split(".")
    if len(labels) < 2 or any(not x or len(x) > 63 or x.startswith("-") or x.endswith("-") for x in labels):
        return None
    return value


def email_parts(email):
    if not isinstance(email, str) or email.count("@") != 1:
        return None
    local, domain = email.strip().lower().split("@")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._+-]{0,63}", local) or local.endswith(".") or ".." in local:
        return None
    domain = normalize_domain(domain)
    return (local, domain) if domain else None


def matching_patterns(name, email):
    parts = email_parts(email)
    if not parts or parts[0] in GENERIC:
        return set()
    return {pattern for variant in name_variants(name) for pattern, fn in PATTERNS.items() if fn(*variant) == parts[0]}


@dataclass(frozen=True)
class Evidence:
    person_id: str
    name: str
    email: str
    domain: str
    organization: str
    cohort: str
    observed_at: str
    identity_bound: bool = True
    current: bool = True
    official: bool = True


def learn_pattern(samples, domain, organization, cohort, now):
    """Requires two independent people in EXACT scope, fresh and unambiguous."""
    usable = []
    seen = set()
    for sample in samples:
        parts = email_parts(sample.email)
        try:
            age = (now - datetime.fromisoformat(sample.observed_at.replace("Z", "+00:00"))).total_seconds()
        except (ValueError, TypeError):
            continue
        if not (parts and parts[1] == domain == sample.domain and sample.organization == organization and sample.cohort == cohort):
            continue
        if not (sample.current and sample.official and sample.identity_bound and 0 <= age <= 90 * 86400):
            continue
        if sample.person_id in seen or sample.email.lower() in {s.email.lower() for s in usable}:
            continue
        seen.add(sample.person_id)
        usable.append(sample)
    if len(usable) < 2:
        return {"state": "insufficient_evidence", "patterns": [], "sample_count": len(usable)}
    common = set(PATTERNS)
    for sample in usable:
        common &= matching_patterns(sample.name, sample.email)
    state = "supported" if len(common) == 1 else "ambiguous" if common else "mixed_or_opaque"
    return {"state": state, "patterns": sorted(common), "sample_count": len(usable)}


def candidates(name, domain, pattern_result):
    domain = normalize_domain(domain)
    if not domain or pattern_result["state"] != "supported":
        return []
    pattern = pattern_result["patterns"][0]
    return sorted({local + "@" + domain for v in name_variants(name) if (local := PATTERNS[pattern](*v)) and local not in GENERIC})[:8]


def release_decision(email, *, exact_person_evidence=False, current_affiliation=False,
                     exact_domain=False, mx="unknown", mailbox="unknown", collision=False,
                     conflicting=False, opted_out=False):
    """Even supported predictions abstain until exact-person evidence exists."""
    if opted_out:
        return "withhold_opted_out"
    if not email_parts(email) or conflicting or collision:
        return "withhold_ambiguous"
    if not (exact_person_evidence and current_affiliation and exact_domain):
        return "withhold_unproven_identity"
    if mx != "present" or mailbox != "deliverable":
        return "withhold_unverified_delivery"
    return "eligible_not_guaranteed"


class Budget:
    def __init__(self, limit=75, reserved=0):
        if not isinstance(limit, (int, float)) or not 0 < limit <= 75:
            raise ValueError("Maximum test budget is 75 credits")
        if not isinstance(reserved, (int, float)) or not 0 <= reserved <= limit:
            raise ValueError("Invalid persisted spend")
        self.limit, self.reserved = limit, reserved

    def reserve(self, amount):
        if not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount < 0 or amount > self.limit - self.reserved + 1e-8:
            raise ValueError("Credit ceiling reached")
        self.reserved = round(self.reserved + amount, 6)
        return self.reserved