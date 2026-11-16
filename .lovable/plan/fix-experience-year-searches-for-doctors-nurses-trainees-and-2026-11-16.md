# Fix experience-year searches for doctors, nurses, trainees and students

## What is actually wrong today (confirmed in the code)

1. **Residents and fellows slip into "12 years of experience" searches.** We correctly stop counting residency and fellowship as practice years. But a resident then has *no* practice years, and our filter treats "no practice years" as "unknown" and lets them through. So the people we meant to exclude are exactly the ones passing.
2. **The provider's own experience number is unusable on its own.** CrustData's "years of experience" starts from the first job listed, including college jobs, residency and fellowship. That is why we stopped sending it, which is right, but we never replaced it with a clear rule for each type of person.
3. **"12 years" is read as 11 to 13 years.** The search reader is still told to put a ceiling on a plain number, so someone with 15 years is hidden. A plain number should mean "at least".
4. **Students are not their own group.** Medical, nursing and PA students are not treated as a separate career stage, so they can show up as "unknown" in experienced searches.
5. **Nurses are judged by doctor rules.** Nursing has no residency, but new-graduate nurse residency programs and nurse-tech/student roles are not separated from licensed RN years.

## What we will build (inside the existing engine, no rebuild)

One shared "career stage" for every profile, worked out from CrustData's job and education history after we clean it up:

```text
student  ->  trainee (resident, fellow, nurse residency)  ->  practicing (years counted)
```

- **Clean the CrustData data first:** one consistent job list (current + past, no duplicates, overlapping jobs counted once), college/student/tech jobs labeled, training jobs labeled, practice jobs labeled by role (doctor, nurse, advanced practice, allied health).
- **Experience searches ("5 years", "10+ years", "12 years"):**
  - Count only licensed, post-training practice years.
  - Current residents, fellows and students are **excluded**, not "unknown".
  - Only profiles with no dates at all stay "unknown", and they sort below confirmed matches instead of mixing in.
  - A plain number means "at least". Ceilings only for real ranges ("3 to 5 years", "under 4", "recent graduate").
  - One year short shows as a partial match, not hidden.
- **Trainee searches (PGY-4, current fellows, students)** keep working as they do now; experience years are never applied to them.
- **Nurses:** RN years start at the first licensed nursing role; nurse residency counts as practice for nurses (it is a paid licensed job), student nurse / nurse tech roles do not.
- **Same rule in Search, Talent Search, ranking cards and Agents**, from one shared file, so they cannot drift apart again.

## How we prove it (before saying it works)

- Tests with real-shaped CrustData records for each case: resident with 12 years of total history, fellow, medical student, new-grad nurse, 15-year RN, attending who moved jobs last year, profile with no dates.
- Run the real search path (the actual query reader + CrustData + ranking, not hand-built tests) on: "orthopedic surgeons with 12 years of experience", "ER nurses with 5 years experience", "recent graduate foot and ankle fellows", "current PGY-4/5 orthopedic residents in New York". Check that no current trainee appears in the experienced searches and that the trainee searches still return what they did before.
- Report the real counts and a few sample people from each, with credits used kept small.

## Technical details

- `clinical-timeline.ts`: add `careerStage` (student / trainee / practicing / undated); `splitExperienceRows` and `experienceFit` reject current trainees and students, keep only truly undated as unknown with lower rank; add student and nurse-tech patterns; nurse residency counts as practice.
- `parse-query.ts` prompt + `clinical-intent.ts`: plain numbers become a floor only.
- `ranking-criteria.ts`, `src/lib/ranking.ts`, `agents/agent-brain.ts`: use the same stage result.
- New tests in `clinical-timeline.test.ts`; bump the search cache version so old results are not reused; redeploy search and agent functions.
