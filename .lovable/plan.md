## Goal

Add a third **Talent Flow** tab to the Company Intel modal showing where recent hires came from and where recent departures went — a Sankey diagram on the left, a filterable people list on the right, with role and time-range filters.

---

## 1. Edge function — `supabase/functions/company-enrichment/index.ts`

Reuse the `companyId` already resolved by the identify step. No new API key.

**Add `fetchTalentFlow(companyId, direction)`** that POSTs to `/screener/persondb/search` using the spec'd filters:
- `hires` → `current_employers.company_id` in `[companyId]` + `recently_changed_jobs = true`
- `departures` → `past_employers.company_id` in `[companyId]` + `recently_changed_jobs = true`
- `count: 100`, sorted by `current_employers.start_date desc`

Map each result into `TalentFlowPerson` (name, linkedin url, profile picture, current/previous title + company + dates, `function_category`, `seniority_level`). For departures, find the target company inside `past_employers` to pick up `end_date`.

**Add `aggregateTalentFlow(hires, departures)`** that builds `top_hire_sources` / `top_departure_destinations` (top 10 each, with count + LinkedIn URL).

**Wire into the main `Promise.all`** alongside `enrich` and `fetchJobs`:

```ts
const [enrichment, jobsResult, hires, departures] = await Promise.all([
  enrich(companyId),
  fetchJobs(companyId),
  fetchTalentFlow(companyId, "hires"),
  fetchTalentFlow(companyId, "departures"),
]);
const talent_flow = aggregateTalentFlow(hires, departures);
```

Add `talent_flow` to the response object. **Bump `schema_version` from 5 → 6** so stale cache entries are invalidated (the cache check already gates on schema version).

Failures from either talent-flow query are non-fatal — return `{ hires: [], departures: [], ... }` so the rest of the modal still renders.

---

## 2. Hook + types — `src/hooks/useCompanyEnrichment.ts`

Add `TalentFlowPerson` and `TalentFlowResult` interfaces (mirroring the edge response). Add `talent_flow?: TalentFlowResult | null` to `CompanyIntel`. No logic changes — the hook already forwards the full payload.

---

## 3. Sankey dependency

Install `d3-sankey` + `d3-shape` (already a Recharts transitive dep, but we'll import directly):

```
bun add d3-sankey d3-shape
bun add -D @types/d3-sankey @types/d3-shape
```

Renders inside our own SVG — no CDN, no runtime fetch. Recharts has no Sankey, so this is the cleanest path.

---

## 4. New components

### `src/components/company-intel/TalentFlowTab.tsx`
Top-level tab. Holds local state:
- `direction: "hires" | "departures"` (right-panel toggle)
- `roleFilter: string | "all"`
- `rangeFilter: "3M" | "6M" | "1Y" | "2Y"`

Derives:
- `filteredHires`, `filteredDepartures` — apply role + date filter client-side. Hires use `current_company_start_date`; departures use `previous_end_date`.
- `roleOptions` — unique `function_category` across both lists.
- Recomputed `topHireSources` / `topDepDests` after filtering (so the Sankey reflects active filters).

Layout (CSS grid `1fr 320px` on desktop, stacks on mobile):
- Header row: title + Role select + Date select (right-aligned chips, matching modal style).
- Left: `<TalentFlowSankey />` inside a `Section` card.
- Right: `<TalentFlowPeopleList />` with Hires/Departures toggle pill.

### `src/components/company-intel/TalentFlowSankey.tsx`
Pure SVG using `d3-sankey`:
- Nodes: source companies (left), target company (center, with logo / initial), destination companies (right).
- Links: hire sources → target (indigo gradient `--chart-1`), target → destinations (coral gradient `--chart-3`).
- Node labels: company name + count badge. Center node uses larger badge and the company's logo via the existing favicon fallback chain.
- Tooltip on hover (simple absolutely-positioned div) showing "8 people moved from X to Stryker".
- Responsive: ResizeObserver → re-layout on container resize. Height ~ `max(360, nodeCount * 38)`.
- Empty state when both sides are empty: a centered "No recent hires or departures in this range" panel.

### `src/components/company-intel/TalentFlowPeopleList.tsx`
- Pill toggle at top: `Hires (N)` / `Departures (N)`, indigo for hires, coral for departures.
- Sorted by relevant date desc, first 10 shown, "Show all" expands the rest.
- Row: initials/profile avatar (24px), name + LinkedIn icon link, secondary line `Title at Company`, right-aligned `MMM YYYY` from the relevant date.

### `src/components/company-intel/PersonAvatar.tsx`
Small shared avatar: profile picture with onError → colored initials circle. Matches existing `CompanyLogo` fallback pattern.

---

## 5. Modal wiring — `src/components/CompanyIntelModal.tsx`

- Add a new `TabsTrigger value="talent"` labeled **Talent Flow** between Insights and Hiring, styled identically.
- Add matching `<TabsContent value="talent">` rendering `<TalentFlowTab data={data} />`.
- If `data.talent_flow` is missing or both arrays are empty, render the same `<Empty />` pattern with a "Talent flow data unavailable for this company" message.

---

## 6. Styling

Reuses existing `Section`, semantic tokens, and the `--chart-1..6` palette (already planned in the prior premium-look pass; if not yet present, add `--chart-1: 238 84% 67%` indigo and `--chart-3: 0 84% 67%` coral to `src/index.css` as part of this change so the Sankey gradients render correctly).

---

## Files touched

- `supabase/functions/company-enrichment/index.ts` — add `fetchTalentFlow`, `aggregateTalentFlow`, wire into `Promise.all`, bump `schema_version` to 6, add `talent_flow` to response.
- `src/hooks/useCompanyEnrichment.ts` — add `TalentFlowPerson`, `TalentFlowResult`, extend `CompanyIntel`.
- `src/components/CompanyIntelModal.tsx` — add third tab + content.
- `src/components/company-intel/TalentFlowTab.tsx` *(new)*
- `src/components/company-intel/TalentFlowSankey.tsx` *(new)*
- `src/components/company-intel/TalentFlowPeopleList.tsx` *(new)*
- `src/components/company-intel/PersonAvatar.tsx` *(new)*
- `src/index.css` — chart palette tokens (only if not already added).
- `package.json` — `d3-sankey`, `d3-shape`, plus `@types/*`.

## Out of scope

- Real company logos for Sankey nodes (would cost N extra identify calls per render — initials only, per the brief).
- Watchers / live updates — initial build is the cached 7-day enrichment payload only.
- Compensation tab.
