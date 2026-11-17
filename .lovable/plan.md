# Resident search: PGY-4 and PGY-5 residents only

## What the research found

I traced your New York search through every step that decides who shows up and in what order. The same four causes explain both problems.

1. **The search adds fellows on its own.** When a search asks for PGY-4 or PGY-5 residents, Oslr quietly widens it to "residents or fellows." That was a deliberate rule from the earlier builds, and it is wrong for your recruiting. Fellows also take up spots in the first batch of results that real residents should fill.
2. **Every fellow is treated as a perfect year match.** Any current fellow is scored the same as a resident whose profile says "PGY-4." That is why Stefano Ghirardelli, Aymen Alqazzaz and Rachel Bronheim sit with the top residents.
3. **The AI reviewer was told fellows can be strong matches.** Its instructions say "a current fellow can be a strong match for a senior-resident ask," so it scores them highly.
4. **The final order ignores training year.** The list is sorted by the AI reviewer's score and by sports medicine evidence. The training-year check runs, then gets overwritten. A PGY-2 with sports research (Kira Tanghe, Akiro Duey) outranks a PGY-4 at Northwell (John Tarazi). PGY-1s like Gabrielle Dykhouse stay in the list.

Two smaller problems:
- The date check allows about 10 months either way, so some PGY-3 start dates count as PGY-4.
- Profiles that say "PGY-5" somewhere other than the job title or headline (Eric Haunschild) get marked as the wrong year.

## The rule we will enforce

A PGY-4/PGY-5 resident search shows only current residents in year 4 or year 5. Nothing else.

- **Fellows: never shown.** A resident and a fellow are different roles. A resident who says they are applying to or matched into a sports fellowship stays in the list. That is the interest you're looking for.
- **PGY-1, PGY-2 and PGY-3: never shown.** This applies whether the year is written on the profile or worked out from the start date.
- **Former residents, attendings and stale entries (for example, a "resident" role open since 2013): never shown.**
- **Year written on the profile beats a date estimate.** "PGY-4" or "PGY-5" anywhere on the profile counts: title, headline, summary, job descriptions or education.
- **Date estimate, current academic year (July 2026 to June 2027):** a residency that started in 2023 is PGY-4, and one that started in 2022 is PGY-5. A 2021 start counts only if the profile shows a research year. Otherwise it is removed.
- **Chief resident in orthopedics** counts as a final-year (PGY-5) resident.
- **Residents with no year and no start date** can't be confirmed. They go to the separate "set aside" group with the reason "training year not listed," not the main list. You can open it if you want to check them.
- **Location rules stay as built.** Anyone working outside the searched area is removed completely.
- **Order within the list:** written PGY-4/5 first, then date-confirmed PGY-4/5. Sports medicine evidence decides the order inside each group, and the AI reviewer's score only breaks ties.

## What to expect (honest numbers)

From the last saved New York search, about 16 people are confirmed PGY-4/5 orthopedic residents at New York programs. About 4 more have no dates, and those go to "set aside." The first batch of results will no longer include fellows, so more real residents should come in and this number may grow. I will report the real count, not an estimate.

## How I'll verify before anything goes live

1. Replay your exact last New York search offline at no credit cost. I'll list every person shown, every person removed, and why.
2. Check by hand that no fellow, PGY-1/2/3 or out-of-area person is in the list.
3. Run the existing test suites, plus new tests: one per rule above.
4. Run one fresh live search, which costs normal search credits, and send you the full list before you publish.
5. Agents use the same rule, because they share the same search.

## Technical details

- `clinical-intent.ts`: remove `seniorFellowRecall`. Resident and PGY asks set `stages: ["residency"]`, and role classes are resident only. Fellows are added only when the query says "fellow."
- `match-scope.ts` `assessStageFit`: delete the automatic `in_window` result for fellows. Read stated PGY from the headline, summary, every current role's title and description, and education. Tighten `stageStartWindow` to the start's calendar year (plus a research-year exception for PGY-5). Treat chief resident as PGY-5 only for 5-year programs.
- `clinical-timeline.ts` `assessCurrentTraining`: when `years` is set, a current role that is only a fellowship becomes ineligible ("current fellow, not a resident"). A stated or dated year outside the request becomes ineligible. Undated goes to set-aside with the reason "training year not listed." Stale open entries past program length plus 6 months are removed. Never treat "incoming/applying/matched fellow" text as a fellowship role.
- `audit.ts` grader prompt: replace line 90 so that, for a resident ask, a current fellow is rejected and fellowship plans count as interest evidence.
- `handler.ts`: final order = stage tier (stated, then dated), then match rate, then grader score. Stage tier always comes before the grader score.
- Bump `CLINICIAN_ENGINE_VERSION` to `crustdata_clin_v13` so old saved results refresh. This is internal only and never shown.
- Delete dead `applyClinicalInterestEvidenceGate` and its tests.
- Deploy `search-clinicians`, `clinician-agent` and `agents-tick` only after the replay and tests pass.
