# CandidateDrawer Enhancement — Juicebox-style Depth

Bring our profile drawer up to the visual and informational density Juicebox shows. The bones are right (header, AI summary, tabs, timeline). What's missing is the **chrome that makes a profile feel deep at a glance**: branded chips, derived achievement badges, grouped experience under a parent company, and a persistent action footer.

---

## 1. Identity header — add company + school chips

Currently the header shows: name · title, then company · location · LinkedIn link.

Juicebox moves company and school into **branded chips with favicons** directly under the location line. This gives instant brand recognition (Arthrex logo, Illinois "I" mark) without scanning text.

Changes:
- Keep name as the primary line.
- Second line: just location (`Naples, Florida, United States`).
- Third line: two chips — **current company** (favicon + name) and **top education** (favicon + school name), each clickable to LinkedIn company/school page when we have the URL.
- Move LinkedIn icon to the top right of the header block (Juicebox parity).
- Keep FitPill where it is.

We already have `extractDomain` + `logoUrl` (favicon via Google s2) — reuse those.

---

## 2. Achievement badges — auto-derived signal pills

Juicebox shows pills like **Promoted Twice**, **High Avg. Tenure**, **International Exp.**, **Top 50 US Uni** in the Overview tab.

These are computed from existing PDL data — no new fetch needed. Add a small `deriveAchievements()` helper:

| Badge              | Rule                                                                 |
|--------------------|----------------------------------------------------------------------|
| Promoted Nx        | ≥2 sequential roles at the **same company** with ascending seniority |
| High Avg. Tenure   | Avg tenure across roles ≥ 4 years                                    |
| Long Tenure        | Any single role ≥ 8 years                                            |
| International Exp. | Experience entries spanning ≥2 countries                              |
| Top 50 US Uni      | School name matches a small static list (start with top-25 med + top-25 nursing schools) |
| Career Switcher    | Industry change between any two consecutive roles                     |
| Currently Hiring Mkt | Practice locality matches a requested location                      |

Render as a horizontal chip row with a small icon per badge (lucide: `TrendingUp`, `Clock`, `Globe`, `GraduationCap`, `Repeat`, `MapPin`). Cap at 4 visible, "+N more" overflow.

This is the single highest-impact addition — it makes the profile feel **intelligent** instead of just listed.

---

## 3. Experience tab — group by company with sub-role timeline

Today each role is its own row. Juicebox groups multiple roles at the same company under **one company header (with logo)**, with sub-roles indented under a vertical timeline.

Example:
```text
[Arthrex logo]  Arthrex
                16 yrs 6 mos
   ●─  Human Resources and Organizational Development Director  [Promotion]   Oct 2014 – Present
   │   Naples, Florida, United States
   │   💰 $100,000 – $160,000
   │   HR Director for Arthrex Manufacturing Inc responsible for…
   │
   ●─  SR. Director Human Resources                                            Jul 2019 – Present
   │   Naples FL
   │
   ●─  Human Resources Manager                                                 Oct 2009 – Sep 2014
       HR Manager for Arthrex Manufacturing located in beautiful Naples FL…
```

Implementation:
- Group `experienceEntries` by `company` (preserve order, merge consecutive entries with the same company).
- Compute per-company total tenure from min(start) to max(end).
- Detect **promotion** between consecutive same-company entries (later role has higher seniority keywords or sequential dates with no gap) → render a small green "Promotion" chip.
- Render salary chip (`inferred_salary`) on the most recent role per company.
- Render entry location and description (already in PDL `experience[].summary` / `experience[].location_names`).
- Add a **3-card stat strip above the timeline**: Avg tenure · Current tenure · Total experience (mirrors Juicebox).

---

## 4. Add a dedicated Education tab

Education currently lives nowhere user-visible (we moved it to Experience tab earlier but it's underweight). Juicebox gives it its own tab so the user can scan academic credentials cleanly.

New tab order: **Overview · Experience · Education · Skills · Notes · Contact**.

Education tab shows each school as a card:
- School favicon + name
- Degree, majors
- Date range
- Activities / societies (from `education[].raw` if present)

---

## 5. Skills tab (promote from Overview)

Move the Skills section out of Overview into its own **Skills** tab so Overview stays scannable.

Skills tab content:
- **Clinical Skills** group (already derived)
- **Additional Skills** group with all remaining skills as outlined pills
- **+N** overflow chip that expands inline (Juicebox shows `+48`)
- **Languages** section at the bottom (from `languages` in PDL raw, if present) with a chat-bubble icon
- **Certifications** also lives here

Overview keeps: AI Summary, Current Role card, Achievement badges, Quick stats, About/summary text from PDL with "Read more" truncation.

---

## 6. Sticky action footer

Juicebox pins a status pill + primary CTA (Shortlisted · Add to LSI Innovator) at the bottom of the drawer so the user can act without scrolling back up.

Add a 56px sticky footer at the bottom of the drawer body:
- Left: FitPill (Shortlisted / Maybe / Not a fit dropdown)
- Right: primary action — `Add to {Project name}` button if a project is active, otherwise `Save to project`

The existing FitPill in the header becomes redundant — remove it from the header and rely on the footer one.

---

## 7. Overview status row

Add a compact label-value strip in Overview matching Juicebox's `Status · Contact · Activity · Tags` row. This is a single table-like block:

```text
Status   ● Not contacted
Contact  mgcwboose@comcast.net (+3)   +1 (239) 216-7084 (+2)
Activity 1 note
Tags     [Juicebox Agent] [+]
```

`Status` is the candidate's outreach state (we can wire this to the Fit/contact-state hook in a follow-up — initial pass just renders "Not contacted" placeholder). `Tags` is a no-op chip row for now with a `+` button stub.

---

## Files to touch

- `src/components/CandidateDrawer.tsx` — header rework, tab reorder, sticky footer, achievement strip, status row.
- `src/components/search/candidate-ui.tsx` — add `deriveAchievements()` helper + `<AchievementBadge />` chip component + `groupExperienceByCompany()` helper.
- No backend, no PDL query, no schema changes.

## Out of scope (next iterations)

- Notes panel parity (Juicebox shows it as a right-side rail; ours stays inside a tab for now).
- "Agent Assessment" sidebar — that's an Oslr Agents feature, separate work.
- Salary chip styling polish — render plain for now, refine if user wants.
- Real outreach status wiring (placeholder copy in this pass).
