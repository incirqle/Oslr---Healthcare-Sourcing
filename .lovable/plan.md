## Goals

1. The "Employer intel" row card on the candidate drawer should show the real company logo (not the "U" letter fallback) whenever a candidate-row logo elsewhere on the page can.
2. The charts inside the Company Intel modal must be **legible without hovering** — a user should immediately know what they are looking at, what the current value is, and what the trend is.

---

## 1. Logo fix in `CompanyIntelCard`

The drawer's company-row chip already renders the logo via Google's favicon endpoint (`s2/favicons?...&sz=128`), which works for `uchealth.org`. The `CompanyIntelCard` only tries Clearbit, which returns 404 for many healthcare domains, so it falls back to the "U" initial.

Change `CompanyLogo` inside `src/components/CompanyIntelCard.tsx` to use the same fallback chain we already use in the modal:

  1. Clearbit (`logo.clearbit.com/<domain>`)
  2. Google favicons (`www.google.com/s2/favicons?domain=<domain>&sz=128`)
  3. Initial letter

Pattern: maintain an `idx` state, increment on `onError`, render the initial only when all sources are exhausted. (No new props, no enrichment fetch.)

---

## 2. Chart redesign in `CompanyIntelModal`

The current charts (`HeadcountChart`, `FunctionTimeseriesChart`, `DepartmentDonut`) require the user to hover to see anything meaningful. Rebuild each so the key information is **visible up front**.

### 2a. Headcount over time (`HeadcountChart`)

Replace the "tooltip-only" area chart with a **summary header + annotated chart**:

- Header strip above the chart shows three big stats inline:
  - **Now** — latest employee count (large)
  - **vs start of range** — absolute delta + % delta, colored green/red (e.g. `+1,122  (+5.1%)`)
  - **Range min / max** — small muted text
- On the chart itself:
  - Plot a visible **end-point dot** with a label callout (`"Oct 2025 · 22,780"`) anchored to the right edge so the user sees the current value without hovering.
  - Show **first and last X-axis ticks** explicitly (formatted `MMM YYYY`, not just year), plus 2–3 evenly spaced interior ticks. No more "2025 2025 2025 2025 …" repeats.
  - Keep gradient fill but darken stroke for contrast.
  - Tooltip stays for power users but is no longer the only source of truth.

### 2b. Hiring by department (`FunctionTimeseriesChart`)

Today this is 5 thin lines with a legend below — unreadable without hover.

Replace with a **department leaderboard + sparklines** layout:

- For each of the top 5 departments, render a row containing:
  - Color dot + department name
  - Current count (large, right-aligned)
  - Delta over the selected range (`+312` and `+2.4%`, colored)
  - A small inline **sparkline** (~120px wide) showing that department's trend
- Keep the range toggle (`6mo / 1Y / 2Y`).
- Drop the shared multi-line chart entirely — it never communicated anything useful at this scale because Healthcare Services dwarfs every other line.

### 2c. Department breakdown donut (`DepartmentDonut`)

- Add a **center label** inside the donut showing the largest segment's name + percentage (e.g. `Healthcare · 62%`), so the chart communicates its headline at rest.
- Keep the side legend with percentages (already there).

### 2d. Region distribution & department growth bars

These already show all values inline — no chart changes needed, only minor polish:
- Right-align numeric columns consistently.
- Use `tabular-nums` so percentages line up.

---

## Files touched

- `src/components/CompanyIntelCard.tsx` — logo fallback chain.
- `src/components/CompanyIntelModal.tsx` — rewrite `HeadcountChart`, replace `FunctionTimeseriesChart` body with leaderboard + sparklines, add center label to `DepartmentDonut`, minor polish on `RegionDistribution` / `DepartmentGrowth`.

No backend, hook, or data-shape changes. All work is presentation-only and uses existing semantic tokens.
