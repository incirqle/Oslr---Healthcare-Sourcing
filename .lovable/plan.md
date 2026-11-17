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
- **Date estimate is a guide, not a cutoff.** New York programs commonly add research years, and many profiles list the date residency was matched, not the day it started. Allison Morgan's profile says PGY-4, yet her start date is 2021. So residencies started in 2020 through 2023 count as possible PGY-4/5 and stay in. Only clear juniors are removed: starts in 2024 or later (PGY-3 and below), or a written PGY-1/2/3.
- **Chief resident in orthopedics** counts as a final-year (PGY-5) resident.
- **Residents with no year and no start date** can't be confirmed. They go to the separate "set aside" group with the reason "training year not listed," not the main list. You can open it if you want to check them.
- **Location rules stay as built.** Anyone working outside the searched area is removed completely.
- **Order within the list:** written PGY-4/5 first, then date-confirmed PGY-4/5. Sports medicine evidence decides the order inside each group, and the AI reviewer's score only breaks ties.

## Why the count was low, and what to expect

My earlier 16 was wrong. It came from date math that was too strict. Rechecking that saved search one person at a time:
- It held only 150 people in total. **18 of them were fellows**, taking spots real residents should have had.
- It had about 33 orthopedic residents. Of those, **about 25 are possible PGY-4/5 residents at New York programs** (2020 to 2023 starts, plus people with no dates listed). Only about 8 are clear juniors or stale entries.

The bigger problem is that the search is gathering too few residents to begin with. The fix also has to bring in more of them:
- Stop asking for fellows, so every slot goes to residents.
- Search all common ways residents describe themselves: "orthopaedic/orthopedic surgery resident," "resident physician" at an orthopedic department, "chief resident," "PGY-4/PGY-5," and "house staff." Use both the person's city and their hospital's location in New York City.
- Pull more pages of residents before ranking, within the normal credit limit for a search.

I will not promise a number. The offline replay and one live search will show the real count, and you'll see every name before anything goes live.

## Recall target from your program list

Your table shows about 60 residents per year across 9 New York City programs, about 300 in total. That means **about 120 PGY-4 and PGY-5 residents** exist, around 60 in each year. Not every resident has a public profile, so the real reachable number will be lower. We will measure it, not guess it.

- **Search program by program.** Search each of the 9 programs by name, with all its name variants: NYU Langone and Hospital for Joint Diseases, HSS and Weill Cornell, Mount Sinai and Icahn, Montefiore and Einstein, Columbia and NewYork-Presbyterian, SUNY Downstate and Kings County, Maimonides, Lenox Hill and Northwell, and One Brooklyn Health and Kingsbrook. This runs alongside the city search, and results are merged with duplicates removed.
- **Coverage check per program.** For each program, compare residents found with the expected count (for example, NYU 16 per year, so about 32 PGY-4/5). This shows exactly where we are missing people.
- **Main list target.** Every PGY-4/5 orthopedic resident we can find at these programs, with no fellows and no juniors. Sports medicine evidence decides the order only.
- **Cost.** Program searches use the normal search pull. I will show you the extra credit cost per search before anything goes live, and keep it within the existing search credit limit.

## How I'll verify before anything goes live

1. Run the program-by-program pull once, and report residents found per program against your expected counts.
2. Replay your exact last New York search offline at no credit cost. I'll list every person shown, every person removed, and why.
2. Check by hand that no fellow, PGY-1/2/3 or out-of-area person is in the list.
3. Run the existing test suites, plus new tests: one per rule above.
4. Run one fresh live search, which costs normal search credits, and send you the full list before you publish.
5. Agents use the same rule, because they share the same search.

## Technical details

- `clinical-intent.ts`: remove `seniorFellowRecall`. Resident and PGY asks set `stages: ["residency"]`, and role classes are resident only. Fellows are added only when the query says "fellow."
- `match-scope.ts` `assessStageFit`: delete the automatic `in_window` result for fellows. Read stated PGY from the headline, summary, every current role's title and description, and education. Replace the narrow `stageStartWindow` with: starts in 2020 through 2023 = possible PGY-4/5 (keep), starts in 2024 or later = junior (remove), written PGY wins over dates. Treat chief resident as PGY-5 only for 5-year programs.
- `clinical-timeline.ts` `assessCurrentTraining`: when `years` is set, a current role that is only a fellowship becomes ineligible ("current fellow, not a resident"). A stated or dated year outside the request becomes ineligible. Undated goes to set-aside with the reason "training year not listed." Stale open entries past program length plus 6 months are removed. Never treat "incoming/applying/matched fellow" text as a fellowship role.
- `audit.ts` grader prompt: replace line 90 so that, for a resident ask, a current fellow is rejected and fellowship plans count as interest evidence.
- `handler.ts`: final order = stage tier (stated, then dated), then match rate, then grader score. Stage tier always comes before the grader score.
- `build-clinician-query.ts`: resident-only title variants (including chief and PGY titles), personal-city or employer-city in the NYC metro, and a larger resident fetch within the existing credit budget (`credit-budget.ts`).
- Bump `CLINICIAN_ENGINE_VERSION` to `crustdata_clin_v13` so old saved results refresh. This is internal only and never shown.
- Delete dead `applyClinicalInterestEvidenceGate` and its tests.
- Deploy `search-clinicians`, `clinician-agent` and `agents-tick` only after the replay and tests pass.
