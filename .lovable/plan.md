# Talent Flow tab — white-screen crash fix

## Root cause

`TalentFlowSankey` calls `d3-sankey` with this extent:

```ts
.extent([[140, 16], [width - 140, h - 16]])
```

`width` starts at `640` but is overwritten by a `ResizeObserver` measuring the SVG's parent. Inside the Company Intel modal the chart column is often narrower than 280px (especially on the 729px viewport in the screenshot, where the modal's two-column grid leaves the left cell well under 280px). When `width - 140 <= 140`, the sankey extent becomes invalid and `d3-sankey` either throws or enters a pathological layout loop. Because there is **no error boundary anywhere in the app** (`rg ErrorBoundary` returns nothing), the throw unmounts the entire React tree → the whole screen goes white and the tab feels frozen.

Secondary contributors:
- The "no data" guard only triggers when **both** sides are empty. If only `destinations` is empty (or only `hireSources` is), the sankey still runs with a center node that has only inbound or only outbound links — another configuration `d3-sankey` is known to mis-handle.
- The 12mo/24mo widening in the edge function can return `talent_flow` with hires-only or departures-only payloads, which is exactly the asymmetric case above.

## Fix

### 1. Make `TalentFlowSankey` robust (`src/components/company-intel/TalentFlowSankey.tsx`)

- Compute a safe inner width: `const innerWidth = width - 280;` Bail out and render a small inline message ("Chart needs more room — switch to the people list") when `innerWidth < 80` or when both `hireSources` and `destinations` are empty.
- Drop the "center" node and any links to/from it when one side is empty; render only the populated side as a simple horizontal bar list (same chart-1/chart-3 colors). This avoids feeding `d3-sankey` a degenerate graph and keeps the visual.
- Wrap the `sankey()` call in `try/catch`; on any error fall back to the bar-list view instead of throwing.
- Initial `width` state: start at `0` and skip rendering until the ResizeObserver delivers a real measurement, so we never paint with a stale 640 that briefly produces a wrong layout.

### 2. Add a focused error boundary around the Talent Flow tab (`src/components/CompanyIntelModal.tsx`)

- Create a small `<TabErrorBoundary>` (class component, local to the modal file) that catches render errors and shows: "We hit a snag rendering this section." with a Retry button.
- Wrap `<TalentFlowTab data={data} />` with it. Also wrap the Hiring tab body for parity since it shares the same Recharts/SVG class of risk.
- This is a safety net: even after fix #1, any future chart bug stays scoped to one tab instead of whitescreening the app.

### 3. Guard the data shape in `TalentFlowTab.tsx`

- Replace `tf.hires.length === 0 && tf.departures.length === 0` with `(tf?.hires?.length ?? 0) === 0 && (tf?.departures?.length ?? 0) === 0`.
- Default `range` to `"2Y"` when `tf` reports `hire_count + departure_count < 5` — avoids the "I see data exists but the chart is empty" jarring state after the edge function widened to 24mo.

## Out of scope

- No edge-function changes. The data is fine; only the renderer crashes.
- No new dependencies. We reuse `d3-sankey` for the happy path and render the fallback with plain SVG.

## Files

- `src/components/company-intel/TalentFlowSankey.tsx` — width guard, asymmetric graph fallback, try/catch.
- `src/components/CompanyIntelModal.tsx` — add local `TabErrorBoundary`, wrap Talent Flow + Hiring tabs.
- `src/components/company-intel/TalentFlowTab.tsx` — null-safe length checks, smarter default range.

## Expected result

- Clicking the Talent Flow tab never whitescreens. Worst case shows an inline fallback message inside the tab.
- Asymmetric (hires-only or departures-only) results render correctly as a single-side bar list.
- A future render bug in any chart is contained to its tab via the error boundary.
