

## The University of Miami problem

A query like *"cardiologist at University of Miami"* will under-retrieve for the same reason OrthoSouth did, but worse — because UMiami isn't one company in PDL. It's a constellation of entities:

- `university of miami` (the university)
- `university of miami miller school of medicine`
- `umiami health` / `uhealth` (clinical practice)
- `sylvester comprehensive cancer center`
- `bascom palmer eye institute`
- `jackson memorial hospital` (primary teaching affiliate, technically separate but staffed by UMiami faculty)
- Plus dozens of departmental/practice sub-entities

Our current resolver does discover affiliates via `affiliated_profiles` + autocomplete + alt_names, but I suspect three weaknesses for big systems:

1. **Autocomplete root extraction is too narrow** — `extractRootNames` only matches `^university of [a-z]+`. So for "University of Miami" we'd query autocomplete with "university of miami" — that surfaces `umiami` siblings but misses health-system brand siblings like `uhealth`, `sylvester`, `bascom palmer` that don't share the root token.

2. **Affiliated profiles cap (`slice(0, 5)`)** — UMiami has more than 5 affiliated PDL entities. We're truncating before we've seen UHealth.

3. **Specialty filter is hard-must when company-anchored** — for "cardiologist at UMiami" we still require `cardiology` as a hard keyword. A cardiologist whose PDL profile says only "Associate Professor of Medicine, UMiami Miller School" with sub-fields buried in `experience` would be filtered out. Same precision-vs-recall tradeoff we already accepted for OrthoSouth.

## Proposed plan (no diagnostic needed yet — pattern is well understood)

### Step 1: Diagnostic first (read-only, ~5 PDL credits)
Before changing code, run the same diagnostic we ran for OrthoSouth, but for UMiami cardiology. Goal: confirm the ceiling and identify which sibling entities (UHealth, Sylvester, Bascom Palmer, Jackson) actually contain the missing cardiologists.

```
A) job_company_name="university of miami" + cardiology + Miami → baseline
B) Drop cardiology hard filter → does count jump? (tells us specialty filter is the bottleneck)
C) experience.company.name="university of miami" → does count jump? (already enabled for company-anchored)
D) Search affiliated entities individually: uhealth, sylvester, jackson memorial → how many cardiologists?
E) Total unique people across A+C+D → the true ceiling
```

### Step 2: Targeted code changes (only if diagnostic confirms the gaps)

**A. Broaden affiliate discovery for health systems** (`index.ts` resolver)
- Lift the `affiliated_profiles.slice(0, 5)` cap to 15 for health-system anchors (detect via name keywords: "university of", "health system", "medical center", "healthcare").
- Add a second autocomplete pass keyed off the *brand* token, not just the root pattern. E.g. for "university of miami" also query autocomplete for "uhealth", "miller school", "sylvester" — derived from the alt_names returned by enrich.

**B. Health-system-aware affiliate filtering** (`index.ts`)
- Currently `nameIsHealthRelated` keeps anything with "medical/hospital/health". For an academic health system, also include affiliated entities whose name contains the parent brand token (e.g. anything starting with "umiami" or containing "miller school").

**C. Company-anchored specialty softening** (`build-pdl-query.ts`)
- We already soft-demote specialty when titles encode it. Extend the same logic: when `hasResolvedCompanyAnchor === true` AND the company is a multi-entity health system (e.g. >3 resolved IDs/names), demote specialty to a `should` boost rather than a hard `must`. Academic faculty titles are notoriously generic ("Associate Professor of Medicine") and the specialty lives in summary/skills/department fields PDL doesn't index reliably.

**D. UI honesty banner**
- For company-anchored searches that resolved >3 affiliated entities, show an info banner: *"University of Miami spans multiple entities (UHealth, Miller School, Sylvester…). Showing candidates across all affiliated organizations."* So the user understands why a "cardiologist at UMiami" result might list "Sylvester Comprehensive Cancer Center" as employer.

### Step 3: Validate
Re-run diagnostic search after changes. Target: capture ≥80% of the unique-person ceiling identified in Step 1.

### What I need from you
Approve **Step 1 (diagnostic only)**. It's read-only, costs ~5 PDL credits, and tells us whether the bottleneck is affiliate discovery, specialty filtering, or PDL coverage itself. Then we'll know which subset of B/C/D is actually worth shipping — same disciplined approach as the OrthoSouth fix.

