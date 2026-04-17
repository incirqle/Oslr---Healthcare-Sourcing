
User wants to revert the entire salary filter system. Let me identify everything to remove.

Files to delete:
- `src/constants/clinicalSalaryPresets.ts`
- `src/components/search/ClinicalSalaryFilter.tsx`
- `src/components/search/CandidateSalaryBadge.tsx`

Files to revert:
- `src/components/search/FilterReview.tsx` — remove `salary_preset` from `ParsedFilters`, remove the salary chip + DollarSign import, remove findPresetById import
- `src/components/search/FilterEditor.tsx` — remove the "Clinical Role & Salary" section, remove ClinicalSalaryFilter + DollarSign imports
- `src/components/search/SearchResults.tsx` — remove `CandidateSalaryBadge` rendering and import
- `src/components/CandidateDrawer.tsx` — remove `CandidateSalaryBadge` rendering and import from drawer header
- `src/pages/SearchPage.tsx` — restore `inferred_salary: null` (the original disabled state with the "PDL salary inference is unreliable for healthcare" comment), stop passing `salary_preset` in filters payload
- `supabase/functions/pdl-search/build-pdl-query.ts` — remove the `inferred_salary` + `job_title_class` term filter block that was added for `filters.salary_preset`

What stays untouched (NOT part of salary work):
- The company-anchor detection fix (`hasResolvedCompanyAnchor` checking ids/names/websites/wildcards) — that was a separate fix from the prior turn for the Panorama 22→29 issue, unrelated to salary.
- All title-cluster demotion logic from earlier turns.

## Plan: Remove Clinical Salary Filter System

### Delete
- `src/constants/clinicalSalaryPresets.ts`
- `src/components/search/ClinicalSalaryFilter.tsx`
- `src/components/search/CandidateSalaryBadge.tsx`

### Revert
| File | Change |
|---|---|
| `src/components/search/FilterReview.tsx` | Drop `salary_preset` field from `ParsedFilters`; remove the salary preset chip, `findPresetById` and `DollarSign` imports |
| `src/components/search/FilterEditor.tsx` | Remove the "Clinical Role & Salary" `FilterSection`; drop `ClinicalSalaryFilter` and `DollarSign` imports |
| `src/components/search/SearchResults.tsx` | Remove `CandidateSalaryBadge` from candidate rows + import |
| `src/components/CandidateDrawer.tsx` | Remove `CandidateSalaryBadge` from drawer header + import |
| `src/pages/SearchPage.tsx` | Restore `inferred_salary: null` with the original "unreliable for healthcare — do not display" comment; stop passing `salary_preset` to the edge function |
| `supabase/functions/pdl-search/build-pdl-query.ts` | Remove the block that pushes `inferred_salary` + `job_title_class` terms when `filters.salary_preset` is present; redeploy |

### Explicitly NOT touching
- The `hasResolvedCompanyAnchor` broadening fix from the prior turn (ids/names/websites/wildcards) — that fix was for the Panorama 22→29 regression and is unrelated to salary work. It stays.
- All earlier title-cluster demotion + Option B inclusive-role-filter logic. Stays.

Net effect: codebase returns to exactly where it was before the salary plan was approved, with the unrelated company-anchor detection fix preserved.

<lov-actions>
<lov-suggestion message="After the salary system is removed, re-run 'doctors at panorama orthopedics in colorado MD' and confirm we're still landing at ~29 results — i.e. the company-anchor fix from the prior turn survived the rollback cleanly.">Verify rollback didn't regress Panorama</lov-suggestion>
<lov-suggestion message="Now that salary is off the table, add a small chip under each candidate row showing their current employer tenure (years at current company) computed from PDL experience array. That's a more reliable seniority signal than inferred_salary for clinical roles.">Add tenure-at-current-company chip</lov-suggestion>
<lov-suggestion message="Add a 'PDL ceiling' line in FilterReview that runs a quick preview count using only sub_role + company filters, so I can see 'PDL has 32 doctors at this company' before clicking Run Search.">Show PDL ceiling in FilterReview</lov-suggestion>
</lov-actions>
