# Search

Oslr's search engine takes a natural-language question about US healthcare professionals and returns a ranked list of candidates. This guide walks through how it works, what you can ask for, and how to read what comes back.

---

## Where Search lives

Two places:

1. **The standalone Search screen** in the left nav. Use this for ad-hoc exploration when you don't yet know which project the candidates belong to.
2. **Inside a project** — click **Source Candidates** at the top of any project. The same search experience, but candidates you save are saved to that project automatically.

Most day-to-day searching happens from inside a project. The standalone Search screen is for exploration.

---

## How to write a query

Search accepts plain English. You don't need Boolean operators, quotation marks, or special syntax. Examples that work today:

- *ICU nurses with BSN near Chicago*
- *Orthopedic surgeons at Panorama Orthopedics, Colorado*
- *Spine surgeons at the Mayo Clinic in Rochester*
- *Hospitalists with 5+ years experience in Texas*
- *Nurse practitioners in family medicine in Atlanta*

What Oslr extracts from your query:

- **Job titles** (clinical roles only — see [scope](#what-search-doesnt-do))
- **Specialty** (cardiology, orthopedics, oncology, ICU, etc.)
- **Location** — city, state, or metro
- **Companies** — current or past employers, including health systems and their affiliated facilities
- **Credentials** (RN, MD, DO, NP, PA-C, CRNA, etc.)
- **Training stage** — automatically detected when you mention "resident," "fellow," "intern," or "student"
- **Years of experience** — when phrased as "X+ years" or similar
- **Past vs. current role** — switches based on words like "former," "ex-," "previously"

---

## The search workflow

When you submit a query, two things happen:

1. **Preview** — Oslr parses your query and runs a count. You'll see the total candidate count and the parsed filters Oslr inferred.
2. **Full search** — Oslr fetches the first page of results (15 candidates per page). A reasoning panel at the top streams what it understood while results drip in.

If your query was ambiguous, the parsed filters will show you exactly what Oslr decided. You can edit any of them via **Refine** (top right) or remove individual filters from the active filter bar.

---

## Reading the result page

You'll see four things:

### Reasoning panel
A short explainer of what Oslr understood from your query and what filters it applied. Useful for confirming Oslr interpreted the question the way you intended.

### Active filter bar
A row of pill-shaped chips showing the filters in play (job titles, specialty, location, company, keywords, experience). Click the X on any chip to remove that filter and re-run the search.

### Candidate rows
Each row shows:

- **Avatar with initials** and a **LinkedIn icon** if available
- **Full name**
- **Current title** (e.g., "Chair, Division of Dermatologic Surgery")
- **Current employer** and **location**
- **Tag pills** in green — matched specialty, location, and employer
- **Email** and **phone** icons indicating whether contact info is on file
- **Status dropdown** — defaults to "Unreviewed"

Click anywhere on a row to open the candidate drawer with the full profile.

### Total count
Shown above the result list — for example, "1,692 candidates." This is the total number of matches in the underlying data, not just what's on this page. Use the pagination controls at the bottom to move through results.

---

## Refining a search

Two ways to narrow or broaden:

### From the active filter bar
Click the X on any filter chip to remove it. The search re-runs immediately with the filter dropped.

### From the Refine panel
Click **Refine** (top right) to open the filter editor. You can add or edit:

- **Locations** — by state, city, or radius from a city
- **Job Titles** — current job titles to match
- **Company** — current or past employers
- **Experience** — minimum years
- **Specialties** — medical specialties or areas of focus
- **Keywords** — required skills, certifications, or other text matches

Save the changes and the search re-runs against the new filter set.

---

## When Oslr expands or relaxes your search

If your query is too narrow, Oslr will progressively relax filters until enough candidates come back. You'll see a banner at the top of the results explaining what happened. Common cases:

- **"Geo expanded to metro"** — your city had too few results, so Oslr widened to the surrounding metro area.
- **"Geo expanded to state"** — the metro had too few results, so Oslr widened to the full state.
- **"Specialty filter dropped"** — Oslr couldn't find enough candidates with that specific specialty in your geography, so it dropped the specialty constraint and ranked by everything else.

When you see one of these banners, the candidates returned are still scored against your original query — they just aren't filtered as strictly. If you want to enforce the original constraints, narrow the search a different way (different geography, different specialty, etc.).

---

## When Oslr refuses to run a search

Two cases trigger a refusal:

### Empty intent
If your query has no clinical role, specialty, employer, or credential — for example, *"people in Nashville"* — Oslr will refuse and ask you to add one. This protects you from accidentally pulling tens of thousands of irrelevant profiles.

**Fix:** add a role or specialty. *"Nurses in Nashville"* or *"Cardiologists in Nashville"* works.

### Too broad
If your query would return more than ~5,000 candidates with no specific role or company, Oslr will refuse to rank them — the ranking signal is too weak to be useful. You'll see: *"Found X candidates — that's too broad to rank meaningfully. Add a specialty, title, or employer to narrow this down."*

**Fix:** add a specialty, title, geography, or employer.

---

## Health-system searches

When you search for candidates at a major health system (Mayo Clinic, Cleveland Clinic, HCA, Kaiser, UCHealth, Ascension, etc.), Oslr automatically expands to include affiliated facilities. You'll see a banner at the top:

> *Mayo Clinic spans multiple affiliated entities — including Mayo Clinic Health System, Mayo Clinic Arizona, Mayo, +22 more. Showing candidates across all of them.*

This is intentional. A "Mayo Clinic" search that returned only the Rochester campus would miss candidates at Mayo's other locations and affiliated entities. If you want a single specific facility, narrow your search by city or by a more specific health-system name (e.g., "Mayo Clinic Arizona" instead of "Mayo Clinic").

For small or single-location practices, this expansion doesn't apply — Oslr detects whether the resolved company is a multi-entity health system or a single practice and adjusts.

---

## What Search doesn't do

Some things Oslr's search engine does *not* support today:

- **Non-clinical roles.** Recruiters, billers, IT, executives without clinical licenses, administrators — out of scope. Oslr will return an "out of scope" notice.
- **PGY-1 / PGY-2 / PGY-3 filtering.** Training stage is recognized as a category ("resident," "fellow") but not by specific PGY year.
- **Graduation year as a hard filter.** "Graduating in 2027" gets passed through as a keyword but isn't a structured filter.
- **Board certification as a hard filter.** Credentials get extracted into the parsed query, but there's no UI toggle for "must be board-certified."
- **NPI presence as a UI filter.** NPI numbers appear on candidate cards where publicly listed, but you can't filter the list to "has NPI" via a checkbox.

These limits are listed honestly so you know the boundaries. If one of them is blocking work you need to do, email **hello@oslr.health** — these are exactly the gaps we want to know about.

---

## Tips

- **Specificity beats sophistication.** *"Spine surgeons at Mayo Clinic in Rochester"* works better than *"experienced ortho specialists with neurosurgery exposure."*
- **One specialty per search.** Combining multiple specialties in one query usually returns a confusing mix. Run them as separate searches.
- **Check the parsed filters.** If the reasoning panel says Oslr extracted something different from what you meant, edit via Refine before scrolling further.
- **Read the banners.** If you see "geo expanded" or "specialty dropped," that's important context for whether the results match your original ask.

---

## Where to go next

- **[Writing good searches](/resources/best-practices/writing-good-searches)** — patterns that work and patterns that don't.
- **[Projects](/resources/projects)** — where the candidates you save end up.
- **[Sourcing healthcare talent](/resources/best-practices/sourcing-healthcare-talent)** — sourcing tactics for specific clinical roles.

---

*Found a search pattern that should work but doesn't? Email **hello@oslr.health**.*
