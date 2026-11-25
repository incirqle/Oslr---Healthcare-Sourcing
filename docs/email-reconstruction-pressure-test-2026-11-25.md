# Institutional email reconstruction: measured pressure test

**Date:** November 25, 2026 UTC  
**Decision:** The test environment is built; automatic reconstructed-email delivery is **not ready**. No production contact logic was changed.

## The important correction

My earlier “10/10 airtight” assessment was not justified. A confidence score for an approach is not an observed bounce rate. Neither colleague patterns, domain mail records nor a server accepting a recipient can guarantee that an email belongs to the intended person or reaches their inbox. There is no finite test that covers every possible present and future institutional identifier.

The achievable safety rule is: **do not release an invented address when evidence is insufficient**. That is different from promising to find a correct address for everyone.

## Actual spend and coverage

| Measure | Observed result |
|---|---:|
| Authorized maximum | 75 provider credits |
| Charged credits from response headers | 62.04 |
| Shared account balance decrease during campaign | 62.47 |
| Conservative reservations, including failed/uncertain exposure | 73.44 |
| Provider requests in ledger | 58 |
| Company identification | 12 institution names in one request |
| Standard web searches | 36 |
| Targeted exception searches | 12 |
| Web results returned | 463 |
| Searches with an allowlisted institutional result | 22 / 48 |
| Searches with email text in institutional snippets | 8 / 48 |
| Searches with email text extracted from fetched pages | 9 / 48 |
| Colleague profiles retrieved | 18 rows across two field selections; 9 unique sampled people |
| Work-email contact calls | 3 calls, covering those 9 people |
| Provider-reported work addresses returned | 24 |
| Outside-target-institution addresses excluded from learning | 10 / 24 |
| Target-institution addresses retained as sampling evidence | 14 / 24 |
| Reconstructed emails delivered or saved to customers | **0** |

The 0.43-credit difference between headers and shared balance movement is not attributed to this test without further account-level evidence. Both measures stayed below 75. No additional paid calls were made after the final targeted round. Reservations were intentionally not refunded to fund more experiments.

These calls used CrustData's authenticated v2 REST APIs, not MCP. There were no PDL calls, new waterfall providers, sent emails or live SMTP recipient probes.

## Institutions and populations tested

Miami, Stanford, Michigan, UCSF, Duke, Johns Hopkins, University of Washington, Mass General Brigham/Harvard affiliation, NYU Langone, Emory, UT Southwestern and Mayo.

Each had a faculty/physician, resident/fellow and nursing/nursing-school discovery query. Twelve additional queries targeted clinical subdomains, hospital staff, GME, current fellows, nursing faculty and academic affiliates. Query coverage is not proof that an appropriate person or address was retrieved in every population.

## What the real data disproved

### 1. Company identification is useful, not a complete system map

Identification was free on this configured account (`base_credits: 0` and zero charge observed). Current public documentation lists 0.2 credits per matched identifier; it is not universally free.

The top Miami match supplied `miami.edu`, not every clinical and teaching-affiliate domain. “Stanford Medicine” first matched Children's Health and Medicine Partners rather than a single full Stanford cluster. Michigan supplied several useful domains but that does not prove every clinical subdomain or affiliate is present. Washington returned nonmedical university-associated domains as well.

**Consequence:** never equate `all_domains` with a complete, correct email-routing graph; do not select the first match or every domain blindly.

### 2. Other people's addresses help, but two samples do not universally determine another person's address

| Institution sample | People | Returned addresses | Exact institutional addresses | Result |
|---|---:|---:|---:|---|
| University of Miami | 3 | 4 | 2 | One faculty person and one other-role person; insufficient independent same-cohort evidence |
| Stanford University | 3 | 8 | 5 | Three faculty people with aliases/mixed or opaque local parts |
| University of Michigan | 3 | 12 | 7 | Two faculty people plus another role; aliases do not make additional people |

The samples were selected for current-employer verified-email availability. They were not a representative cohort of physicians, residents, fellows or nurses; some were university faculty outside medicine. Their results cannot establish clinical-role-specific success rates.

For Stanford's three independent same-domain faculty people, each was held out once and all their aliases excluded from training. **All 3 held-out trials abstained** because the two training people did not establish a single supported formula. There were **0 predictions**, so prediction precision and deliverability are **not estimable**. Reporting this as “100% accurate” or as a 0% bounce rate would be misleading.

**Consequence:** use empirical patterns to generate hypotheses, not as sufficient evidence for a paid, verified contact.

### 3. A verified provider address can belong to another affiliation

Every returned work-address status in this sample was provider-reported `deliverable`, yet 10 addresses were outside the university being tested. These included other businesses and professional affiliations. That does not mean the addresses are invalid; it means they cannot teach the requested institution's convention.

**Consequence:** retain multiple addresses and their organization links, then verify exact target affiliation before learning or selecting an address. “First email returned” is unsafe.

### 4. Live web retrieval does not reliably produce usable colleague evidence

Only 22 of 48 queries surfaced an allowlisted institutional result. Only 9 queries produced email text on the limited pages fetched. Page inspection attempts included 26 HTML successes, 9 HTTP 403 responses, one oversized page and one non-HTML document. Some results were old newsletters, program offices, administrative directories or unrelated university pages—not current clinician profiles.

Successful examples included Washington faculty pages, Duke program pages, Emory contacts and a UT Southwestern GME page. Numeric local parts appeared in three search cases. Email text alone is not a name-bound, current, individual mailbox.

**Consequence:** office addresses, stale newsletters, unrelated school departments and inaccessible pages must remain unresolved, not become pattern confirmations.

## Repeated automated checks

The isolated suite passed **35 test functions**, including a **1,024-case eligibility matrix**, **120 combinations showing that mail-routing/mailbox acceptance cannot establish identity**, and independent hold-outs for all **12 implemented formulas**.

Covered cases include credentials; accents; apostrophes; compound first names and surnames; surname particles; middle initials; nicknames; last-name-first notation; mononyms and unknown scripts; collision suffixes and opaque IDs; mixed schemes; aliases; role, organization and exact-domain separation; stale/future/undated evidence; duplicated sources and people; office mailboxes; spoofed domains; catch-all/unknown/invalid mailboxes; opt-outs; malformed provider envelopes; mismatched and reordered profiles; missing real profile URLs; 429/402/503 responses; request timeouts; durable reservations; restart safety; concurrent runner exclusion; unexpected-cost shutdown; and zero-network replay.

An initial adversarial run found a non-finite reservation-input bug in the new lab; it was corrected and the suite rerun. Captured responses also exposed the real profile-link location (`social_handles.professional_network_identifier.profile_url`); the lab now uses it and never constructs a profile handle from a display name.

The existing production contact-waterfall suite was separately executed with paid network access disabled: **17 tests passed**. Passing those tests demonstrates their existing expectations, not the stronger reconstruction guarantees above. The app build remained OK.

## Production-flow risks found by inspection, not changed here

- Primary work-email acceptance checks syntax, not the normalized verification flag.
- Secondary work-domain matching accepts a missing employer website and parent/subdomain relationships; it is not an independent current-affiliation check.
- A rejected synchronous personal address can still displace a useful batch result because combination retains any nonempty synchronous personal list.
- A partial provider outage can be cached as a 30-day missing contact.

These need their own scoped production fix and end-to-end tests; this research lab does not silently change the existing waterfall.

## What remains unverified

No independent recipient ownership confirmation, real delivery/bounce outcome, mailbox catch-all assessment, production reconstruction integration, complete affiliate graph or representative population success rate was established. PDFs and blocked/oversized pages were not comprehensively parsed. Public-page email extraction was counted, not converted into a trusted contact directory.

**Recommendation:** keep the candidate generator behind an evidence gate; require exact-person, current-affiliation and delivery evidence before releasing a reconstructed address. Unknown schemes must be safe misses. More permutations alone cannot solve missing identity information.

## Sources and reproducibility

- Recorded private provider responses, request ledger and aggregate summary: `/tmp/email-reconstruction-live` (temporary; contains identifying records and is not published).
- Maintained isolated lab and synthetic fixtures: `tests/email-reconstruction`.
- Provider documentation checked live: https://docs.crustdata.com/llms-full.txt ; https://docs.crustdata.com/company-docs/identify/introduction ; https://docs.crustdata.com/person-docs/contact/enrich ; https://docs.crustdata.com/web-docs/search/introduction . Account-specific endpoint access/prices were also read before spending.
- Mail-routing and verification limits: https://www.rfc-editor.org/rfc/rfc5321 ; https://support.google.com/a/answer/12943537 ; https://learn.microsoft.com/en-us/exchange/mail-flow-best-practices/use-directory-based-edge-blocking .
- Institutional exception references: https://oit.duke.edu/service/email-and-calendar/ ; https://myjhsupport.jh.edu/how-do-i-create-an-email-alias/ ; https://geriatrics.ucsf.edu/education/fellowships/current-fellows ; https://nutrition.hms.harvard.edu/affiliatedhospital/brigham-and-womens-hospital ; https://education.uwmedicine.org/technology/email/ .