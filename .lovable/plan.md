

## Plan: Clinical Salary Filter (Physicians + Nurses)

### Reality check before we build

A few things in your prompt conflict with what's already in the codebase. I want to flag them so we build this correctly rather than copy-paste a spec that fights the existing system.

1. **Salary display was deliberately disabled.** `SearchPage.tsx` line 141 hard-codes `inferred_salary: null` with a comment "PDL salary inference is unreliable for healthcare — do not display". The prompt now wants us to surface it as a badge AND filter on it. Reversing that decision is fine — but worth a confirmation, because earlier judgment was that the data is noisy on clinical roles.
2. **`job_title_class` isn't used in our query builder today.** We use `job_title_sub_role` (doctor/nursing/dental/etc.) plus O\*NET codes. Both fields exist in PDL. Adding `job_title_class` filtering alongside our existing role logic is fine, but we shouldn't replace what's working — we just spent the last several turns dialing in the company-anchored relaxation logic.
3. **The prompt's standalone `pdlQueryBuilder.ts` would bypass our entire pipeline** (parse-query → resolve companies → build-pdl-query → cascade → AI rerank). We should NOT create a parallel query path. Instead the preset should feed values into the existing parsed payload that flows through `pdl-search/index.ts`.
4. **`inferred_years_experience` warning is correct** — the prompt rightly says don't make it required. Our existing builder already treats it as opt-in.

### What I propose to build

**New file: `src/constants/clinicalSalaryPresets.ts`**
Exact preset config from your spec (Physicians: Resident/Fellow, Early Attending, Established Attending, Surgical High-Earner. Nurses & APPs: Staff RN, Senior RN, NP/PA, CRNA, Nurse Leadership). Bucket strings match PDL's canonical `inferred_salary` keyword values.

**New file: `src/components/search/ClinicalSalaryFilter.tsx`**
Tabs (Physicians | Nurses & APPs) → radio list of presets with sublabel and human-formatted salary range (`$150K–$250K+`) → optional "require experience data" toggle (disabled with tooltip on Nurses tab). Single-preset selection. Emits `{ salaryBuckets, jobTitleClasses, experienceHint }` upward — NOT a raw PDL query.

**New file: `src/components/search/CandidateSalaryBadge.tsx`**
Renders `💰 $85K–$100K (inferred)` and `⏱ 9 yrs (inferred)` badges. Omits whichever side is null.

**Integration point: `FilterEditor.tsx`**
Add a new collapsible "Clinical Role & Salary" section at the top that hosts `ClinicalSalaryFilter`. When a preset is selected, store it on `ParsedFilters` as a new optional field `salary_preset?: { id, salaryBuckets, jobTitleClasses, experienceHint }`.

**Wire-through: `SearchPage.tsx` + edge function**
- Extend `ParsedFilters` interface in `FilterReview.tsx` with `salary_preset`.
- Pass `salary_preset` in the `filters` payload to the `pdl-search` edge function.
- In `build-pdl-query.ts`, when `filters.salary_preset` is present:
  - Push `{ terms: { inferred_salary: salaryBuckets } }` into `filterClauses`.
  - Push `{ terms: { job_title_class: jobTitleClasses } }` into `filterClauses`.
  - These are ADDITIVE hard filters — they sit alongside (not replace) the existing sub_role / O\*NET / company-anchor logic.
  - Skip the optional experience range unless the toggle is on.
- Show a small chip in `FilterReview.tsx` summarizing the active preset (e.g. "CRNA · $150K–$250K+").

**Re-enable salary surfacing**
- In `SearchPage.tsx` line 141, change `inferred_salary: null` → `inferred_salary: r.inferred_salary || null`.
- In `SearchResults.tsx` candidate row and `CandidateDrawer.tsx`, render `CandidateSalaryBadge`. Always tag as "inferred" so recruiters know it's a model estimate.

### What I am NOT doing (and why)

- **Not creating a standalone `lib/pdlQueryBuilder.ts`.** Our query builder lives in the edge function and already handles cascade, company resolution, and rerank. A second client-side builder would be dead code at best, and at worst would diverge.
- **Not making the salary filter the primary search entry point.** It's an additive filter on top of the natural-language search — it lives in the existing FilterEditor sheet, not as a new top-level page.
- **Not removing existing role logic.** The `job_title_class` filter is layered on top of (not instead of) `job_title_sub_role` and O\*NET codes.

### Open question worth answering before I build

The earlier judgment in the codebase was that PDL's `inferred_salary` is unreliable for clinical roles — bands like "$70K–$85K" landing on real attending physicians, etc. The preset system mitigates this by treating salary as a *filter to narrow within a role*, not as a truth signal. But the candidate-card badge re-exposes that noisy data to recruiters. I'll add it with the "inferred" label as you specified, but flag this: if recruiters complain the badges look wrong, we can keep the filter and drop the badge without touching anything else.

### Files touched

| File | Change |
|---|---|
| `src/constants/clinicalSalaryPresets.ts` | NEW — preset config |
| `src/components/search/ClinicalSalaryFilter.tsx` | NEW — tabs + radio UI |
| `src/components/search/CandidateSalaryBadge.tsx` | NEW — badge component |
| `src/components/search/FilterReview.tsx` | Add `salary_preset` to `ParsedFilters`, render summary chip |
| `src/components/search/FilterEditor.tsx` | Mount ClinicalSalaryFilter as new section |
| `src/components/search/SearchResults.tsx` | Render salary + experience badges in row |
| `src/components/CandidateDrawer.tsx` | Render badges in drawer header |
| `src/pages/SearchPage.tsx` | Stop nulling `inferred_salary`; pass `salary_preset` through filters |
| `supabase/functions/pdl-search/build-pdl-query.ts` | Add `inferred_salary` + `job_title_class` term filters when preset present |

