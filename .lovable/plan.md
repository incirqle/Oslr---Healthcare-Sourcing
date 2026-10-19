# Search screen and company page fixes

## 1. Table scrolling
- The results table currently scrolls sideways inside a box while the page also scrolls, so columns (Job title, Company, Education, Shortlist) get cut off past the right edge.
- Fix: give the table its own scroll area with a fixed height inside the page, keep the header row pinned at the top and the Name column pinned on the left, and show a visible sideways scrollbar. Trackpad and mouse-wheel scrolling work in both directions without the page jumping.

## 2. Results open on their own screen, not under the criteria
- When a search finishes, results take over the screen. The query box, "Ranked by" strip, and employer note fold into one slim summary bar at the top ("7 candidates · Orthopedic Surgery at Naval Medical Center San Diego") with "Edit search" and "Edit ranking" buttons.
- Criteria open in the existing ranking panel on demand, not stacked above the table.
- Page scrolls to the top of results when they arrive.

## 3. Searches saved for 30 days
- Today a finished search is only kept for 4 hours, so clicking a past search runs it again.
- Change: keep each search's results for 30 days. Clicking a recent search loads the saved results instantly with no new search and no count against the daily limit. A small "Saved results from Oct 12 · Refresh" note lets the user re-run on purpose.
- Ranking edits on old searches keep working for the same 30 days.

## 4. Company page redesign (Apple-style)
Company first, people second. Opens on an "Overview" tab instead of a blank people picker.

```text
+-----------------------------------------------------------+
| [Logo]  OrthoMiami                         Export   X     |
|         Independent practice · Miami, FL · orthomiami.com |
|-----------------------------------------------------------|
|  Overview   People   Movement                             |
|-----------------------------------------------------------|
|  33 employees   +13.8% in a year   Founded 2001   11-50   |
|  [ large headcount chart, full width ]                    |
|  About (description)          | Where staff work (bars)   |
|  Who works here: Doctors 3 · PAs/NPs 1 · Clinical 5 ...   |
|  Leadership (names, titles, photos)                       |
|  Recent hires and departures (top 3 each, "See all")      |
+-----------------------------------------------------------+
```

- Big readable header with logo, name, type, location, website; no narrow grey side column.
- Key numbers as large stat tiles, headcount chart full width.
- "Who works here" shows group counts as tappable tiles that jump to the People tab with that group already checked.
- People and Movement tabs keep today's behavior (group picker, Pull, Load next, Movement pull), restyled with roomier rows and clear empty states instead of disabled grey boxes.
- Smooth, gentle transitions, soft shadows, translucent header, no prices or credits shown, LinkedIn only as the badge, no em dashes.
- Loading shows shaped placeholders, not a blank page.

## Technical details
- Table: `ResultsTable.tsx` wrapper becomes `max-h-[calc(100vh-…)] overflow-auto` with `sticky top-0` thead and sticky first column; remove competing outer overflow in `SearchResults`/`SearchPage`.
- Results view: `SearchPage.tsx` collapses `QueryReadback`/employer banner into a compact summary bar once `keptCount > 0`; scroll-to-top on new results.
- Cache: `SEARCH_TTL_MS` and the `clin:run:<run_id>` snapshot TTL raised to 30 days in `cache.ts`/`rank-route.ts`; `search_history` stores run id and query; history click passes a `from_cache` flag so `meterSearch` treats it as a free repeat (repeat window extended to 30 days). Redeploy search-people and search-clinicians.
- Company page: new `OverviewPanel.tsx`, rebuilt header in `CompanyIntelModal.tsx`, `CompanyRail.tsx` retired from layout, restyle of `PeoplePanel`/`MovementPanel`. Uses data already in `useCompanyBrief` (base, preview counts, movement); no backend change.
- Run typecheck, tests, build; browser-check table scroll and company page.
