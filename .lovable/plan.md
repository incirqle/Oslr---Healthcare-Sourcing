# Audit: pain-management searches and company profiles (last 2 hours)

I pulled every search your beta user ran between 18:58 and 19:41 UTC today and traced them through the search engine and the company profile path. Here is what the data actually shows, then what I would fix.

## What he ran, and what came back

| Time (UTC) | Search | Shown |
|---|---|---|
| 18:58 | long "ownership or executives at pain management groups" paragraph | 0 |
| 19:11 | same paragraph again | 0 |
| 19:13 | pain mgmt and interventional pain group ownership | 0 |
| 19:15 | pain management groups, ownership and decision makers | 0 |
| 19:17 | cfo and ceo of pain management groups | 15 |
| 19:28 | same, page 2 | 0 |
| 19:32 | pain management doctors in Mississippi | 12 |
| 19:37 | interventional pain doctors in Memphis | 2 |
| 19:38 | pain management doctors in Memphis | 5 |
| 19:41 | pain managemnet doctors in atlaqnta | 15 |
| 19:41 | pain management doctors in Nashville | 15 |

Every search took 14-27 seconds. Four returned nothing at all.

## Cause 1 — business-role asks are silently thrown away

For "ownership and decision makers", the engine recorded the phrases "Pain Management Groups" and "Ownership And Decision Makers" as **unsupported** and dropped them. What was left was "senior leadership, United States" — 18.4 million people. It then asked the AI reviewer to grade the first 50 of those 18 million, the reviewer rejected 50 out of 50, and the screen showed zero.

So the search was not weak; it was effectively no search at all, and he paid 20 seconds to watch it fail. This is the single biggest driver of "terrible results".

You've said Oslr stays clinicians-only. The fix is therefore honesty, not new coverage: when the meaningful part of a request is dropped, stop before spending the time and credits and tell him what Oslr can and cannot look for, with a suggested clinical rewrite.

## Cause 2 — the reviewer hides everything with no explanation

On the four empty searches the reviewer rejected 100% of what it graded. On "cfo and ceo of pain management groups" it rejected 35 of 49. Rejected people are removed from the list entirely and nothing tells the user it happened, so a search that found people still renders as an empty page. Page 2 of that search then returned zero for the same reason.

## Cause 3 — pain medicine is not in the clinical vocabulary

There is no pain entry in the specialty vocabulary. "Pain management" is matched as a literal phrase only, so anyone described as interventional pain, pain medicine, chronic pain, algology, physiatry / PM&R, or anesthesiology-pain is invisible. That is why Memphis returned 2 people and Mississippi 12 — those markets genuinely have dozens of pain physicians.

## Cause 4 — company profiles are resolving to the wrong company

This is why the company panels look empty. When a company is looked up, any candidate whose name merely contains a shared word of four or more letters is accepted. For "Auzenne Pain" the word "pain" pulled in 25 unrelated companies, and the winner is then chosen mostly by employee count — so a large unrelated company outranks the actual small practice. Cached examples from this morning:

- auzenne pain -> 25 entity IDs, 0 leaders
- southern vascular & pain management -> 25 entity IDs, 0 leaders
- jackson neurosurgery clinic -> 25 entity IDs, 0 leaders

By contrast, correctly resolved large organisations have 6-56 leaders. The empty executive teams are mostly a matching bug, not missing data — though small private practices will legitimately have no leadership records even after the fix.

## Cause 5 — many rows have no clickable company at all

The company panel only renders when the result carries an employer name. Independent physicians and private-practice owners frequently come back with a blank employer, so there is nothing to click. The employer name is available elsewhere on those profiles (headline text, past employers, practice domain) and is not being used as a fallback.

## Proposed fixes, in order of impact

1. **Stop empty-by-design searches.** When the core subject of a request is unsupported, return immediately with a plain explanation and a clinical rewrite suggestion instead of grading 50 random senior executives.
2. **Never render an empty page silently.** Keep filtered-out people out of the main list but always show "X results hidden as poor matches" with a one-click reveal, and stop page 2 from emptying the screen.
3. **Add the pain-medicine vocabulary** — interventional pain, pain medicine, chronic pain, pain physician, algology, physiatry / PM&R, anesthesiology-pain, plus the fellowship and procedure language (epidural, nerve block, radiofrequency ablation, spinal cord stimulator, kyphoplasty) — as specialty synonyms and soft-rank signals.
4. **Tighten company matching.** Require a distinctive token match (ignore generic words such as pain, care, health, clinic, center, medical, group, associates), prefer exact name and domain matches over headcount, and cap the entity set. Bump the cache version and clear the bad entries currently stored.
5. **Fall back for missing employers** so the company panel is clickable from the headline, latest employer, or practice domain, and show an honest "no public records for this practice" state when a small practice genuinely has no leadership data.
6. **Speed.** Searches spend most of their 20+ seconds on an AI grading pass over results that are often irrelevant. Once fixes 1, 3 and 4 land, grade a smaller, better pool and report progress to the user while it runs.

## Technical notes

- Evidence: `clinician_search_intelligence` rows 18:58-19:41 UTC (`criteria`, `provider_query`, `audit_summary`), `company_enrichment_cache` keys written 19:34-19:39 UTC.
- Cause 1: `clinician-criteria.ts` pushes `kind: "unsupported", enforcement: "dropped"`; `handler.ts` continues regardless. Add a pre-flight guard when every user-sourced hard criterion is dropped or only seniority/location survive.
- Cause 2: `handler.ts` line ~999 filters `audit_verdict !== "reject"` before returning; surface `rejected_filtered` in the response and in `SearchResults`, with an "include weaker matches" toggle.
- Cause 3: `clinical-vocabulary.ts` has no pain entry; add specialty family + subspecialty siblings + `soft-rank.ts` signals, and extend `title-vocabulary.ts`.
- Cause 4: `company-enrichment/index.ts` `identifyByName()` accepts `overlap >= 1` on any 4+ char token and `pickBestCandidate()` adds `headcount/1000`; add a stopword list, require exact-name or domain evidence for the primary, restrict `all_ids`, raise `schema_version` to 11 and purge `company_enrichment_cache`.
- Cause 5: `CandidateDrawer.tsx` line ~650 `companyName = enriched?.job_company_name || candidate.current_employer`; add fallbacks from `current_employers[0].name`, headline parsing, and `company_website_domain`.
