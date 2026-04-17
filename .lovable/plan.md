
## Candidate Drawer — Layout Rebuild

**Goal:** Eliminate the cramped scroll area. Same data, dramatically more breathing room, prioritized by what recruiters actually need (current experience first).

---

### 1. Compact sticky header (one tight zone, ~140px instead of ~340px)

Restructure the header into **3 thin rows** that always stay visible:

```text
┌──────────────────────────────────────────────────────────────┐
│ ‹ Prev   Next ›                            J/K        ⤢   ✕ │  row 1: nav (h-9)
├──────────────────────────────────────────────────────────────┤
│ [SL]  Sameer Lodha · Orthopaedic Surgeon                     │  row 2: identity (h-14)
│       Panorama Orthopedics · Denver, CO · 🔗  [Unreviewed▾] │
├──────────────────────────────────────────────────────────────┤
│ ✦ Matched: Panorama Orthopedics · Colorado · Orthopedics    │  row 3: chip strip (h-8)
└──────────────────────────────────────────────────────────────┘
   ↓ Tabs (sticky) ↓
   Overview · Experience · Notes · Contact
```

Changes:
- Avatar shrinks from 64px → 44px
- Title, company, location, LinkedIn, Fit pill collapse onto one meta line
- "Why they matched" becomes a thin single-line chip strip (no boxed card, no label header — just `✦ Matched:` prefix + chips). Tooltip on each chip explains the reason.
- Location and LinkedIn pills are removed as separate row — folded into meta line
- Tabs become sticky directly under the header so they're always reachable while scrolling

### 2. Resizable drawer with expand toggle

- Add an **expand button (⤢)** in the nav row. Clicking toggles between:
  - **Compact:** `sm:w-[620px]` (current)
  - **Wide:** `sm:w-[960px]` (or `min(960px, 90vw)`)
- Persist the preference in `localStorage` (`oslr.drawer.size`) so it survives reloads and applies to next candidate
- Smooth width transition (`transition-[width] duration-200`)

### 3. Overview tab — reorganized by importance

User explicitly wants: **current experience > education > certifications**. New order inside the scrollable content area:

1. **AI Summary** (unchanged, top of overview — the recruiter's quick read)
2. **Current Role card** (NEW): pulls the primary/current experience entry to the top with title, company, start date, duration, and any current-role context. Visually distinct (subtle border).
3. **Quick Stats strip**: years experience · avg tenure · salary band (when available) — inline, one row, no headers
4. **Education** (compact: school + degree on one line, year on the right)
5. **Certifications** (rendered as inline chips instead of bulleted list — saves ~60% vertical space)
6. **Clinical Skills** (chip cloud — unchanged but moved below certs)

In **wide mode**, sections 4–6 lay out as a 2-column grid for further density. In compact mode, they remain stacked.

### 4. Experience tab — tighter timeline

- Reduce timeline node spacing (`space-y-5` → `space-y-4`)
- Compact each entry: title + Current badge on row 1, company on row 2, dates+duration as muted right-aligned tail
- In **wide mode**, optionally show 2-up cards for older roles (>3 entries collapse into 2 columns)

### 5. Polish

- Reduce content padding `py-6` → `py-5`, `px-7` → `px-6`
- Sticky tabs get a subtle bottom border so they read as a pinned bar while scrolling
- `prefers-reduced-motion` disables the width-transition animation

---

### Files to edit

- `src/components/CandidateDrawer.tsx` — header restructure, tabs sticky, Overview reorder, Current Role card, expand toggle, wide-mode grid
- `src/components/ui/sheet.tsx` — verify width prop pattern (likely just className override on `SheetContent`)
- New tiny hook (inline or `src/hooks/useDrawerSize.ts`) for the localStorage-backed compact/wide state

No DB changes. No API changes. No new dependencies.

### Acceptance

- On 911px viewport in compact mode: tabs visible without scrolling AND ≥ 3 Overview sections visible without scrolling
- Expand toggle widens to ~960px and back; preference persists across candidates
- Current role appears at the top of Overview, above education and certifications
- "Why matched" chips render as a single thin strip with tooltips, no boxed panel
- All existing data (notes, fit, AI summary, navigation, J/K) continues to work unchanged
