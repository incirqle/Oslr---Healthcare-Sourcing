# Juicebox-Style Exports

Add two export formats that match Juicebox conventions, and surface them everywhere candidates are listed.

## 1. Enhanced CSV (replaces current export)

New columns, in Juicebox order:

```text
First name, Last name, Location, LinkedIn,
Personal Email, Personal Email Verification,
Work Email, Work Email Verification,
Phone Numbers, GitHub,
Current Title, Current Org Name, Education,
Average Tenure (Years), Current Tenure (Years), Total Experience (Years)
```

Notes:
- Split `full_name` on the last space (fallback: whole name in First).
- `Personal Email` / `Work Email` come from the PDL `personal_emails` / `work_email` mapping already wired up; verification = `Deliverable` when PDL flags the address as recommended, else `Unverified`.
- `Phone Numbers` = comma-joined `phone_numbers`.
- `GitHub` = first `profile_networks` entry where network=github (blank if none).
- `Education` = comma-joined `education[].school.name`.
- Tenure values reuse the existing `candidate-insights` helpers (`tenureMonths`, average across `experienceEntries`, current = active role months). Round to one decimal.
- Empty cells stay blank (no "N/A").

## 2. Per-candidate PDF dossier

Single page-flowing PDF per candidate, generated client-side with `jspdf`. When multiple candidates are selected, bundle PDFs into a single `.zip` using `jszip` (filename: `oslr-profiles-YYYY-MM-DD.zip`). Single candidate exports a `.pdf` directly.

Layout (matches the Juicebox sample):

```text
┌───────────────────────────────────────────────┐
│ Oslr wordmark (top-right, muted)              │
│                                               │
│ {Full Name}                  ← H1, Comfortaa  │
│ {Current Title} at {Current Org}              │
│ {Location}                                    │
│                                               │
│ {LinkedIn URL}                                │
│ {Primary email}                               │
│ {Primary phone}                               │
│ ───────────────────────────────────────────   │
│ Summary                                       │
│ {about / pdl summary}                         │
│                                               │
│ Experience                                    │
│ **{Title} at {Company}**                      │
│ {start} – {end or "Present"}                  │
│ {description}                                 │
│ … (every role)                                │
│                                               │
│ Education                                     │
│ **{School}**                                  │
│ {degree}, {majors}                            │
│ {start–end}                                   │
│                                               │
│ Skills                                        │
│ {comma-joined skills, wrapped}                │
└───────────────────────────────────────────────┘
```

Typography: Helvetica (jsPDF built-in) for body, bold for section headers and role titles. Monochrome with a single mint accent line under the name. Auto page-break via `splitTextToSize` + manual `y` tracker.

## 3. Surfaces

A shared `useCandidateExport()` hook exposes `exportCsv(candidates)` and `exportPdfs(candidates)`.

Add export entry points:

| Surface | Action location | Behavior |
|---|---|---|
| Search bulk bar (`BulkActionBar`) | Existing "Export CSV" becomes a split: `Export ▾` → CSV / PDFs | Uses currently selected candidates |
| Search candidate drawer (`CandidateDrawer`) | "Export" button in sticky footer next to FitPill | Single CSV row or single PDF |
| Project pipeline (`ProjectDetail`) | New `Export ▾` button in the Candidates header (next to search/filter) | Selected rows, or all filtered if none selected |
| Project candidate row drawer (if present) | Same Export menu as Search drawer | Single |
| Campaign recipients (`CampaignDetail`) | `Export ▾` in the recipients toolbar | Selected or all |

Each entry uses a small `<ExportMenu />` dropdown component (CSV / PDF dossier(s)) so behavior stays identical.

## 4. Data adapter

Project + Campaign candidates use the `project_candidates` shape, which has fewer fields than the live PDL `Candidate`. Add `src/lib/candidate-export-adapter.ts` exporting:

```ts
toExportRow(c: AnyCandidate): ExportRow
toDossier(c: AnyCandidate): DossierData
```

Both accept either a search `Candidate` (with `raw` PDL payload) or a stored `project_candidates` row, normalizing missing fields to blanks. Stored rows won't have experience entries → PDF gracefully omits the section.

## 5. Out of scope

- Saving exports to Lovable Cloud storage / shareable links.
- Email verification re-checking (we surface whatever PDL gave us).
- Async server-side rendering of bulk PDFs (client-side handles ≤100 cleanly).
- Resume-style branded PDF themes — single clean dossier only.

## Files touched

- New: `src/lib/candidate-export-adapter.ts`, `src/lib/export-pdf.ts`, `src/lib/export-csv.ts`, `src/hooks/useCandidateExport.ts`, `src/components/ExportMenu.tsx`
- Edited: `BulkActionBar.tsx`, `SearchResults.tsx`, `CandidateDrawer.tsx`, `ProjectDetail.tsx`, `CampaignDetail.tsx`
- Removed: `src/components/search/csv-export.ts` (superseded)
- New deps: `jspdf`, `jszip`
