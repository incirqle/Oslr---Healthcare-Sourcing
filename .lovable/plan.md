## Problem

Two issues with the current search loading state:

1. **Duplicate status copy.** The AgentReasoningPanel already streams "Scanning healthcare professional records…" while the SearchNetworkLoader simultaneously shows "SEARCHING / Reranking by clinical fit…" — two competing live captions saying the same thing.
2. **Visual is dated.** The connected-dots constellation reads as busy and "data-vizzy," the opposite of the minimal, fluid feel of Claude Cowork (calm whitespace, a single breathing element, restrained typography).

## Direction

Lean into one quiet motion, lots of negative space, no graph metaphor.

- Single thinking surface: subtle skeleton rows where results will appear, gently shimmering with a slow horizontal light sweep (think Linear / Vercel skeleton, not constellation).
- One small status line, left-aligned, that rotates copy slowly — but only inside the reasoning panel, never duplicated on the canvas.
- Soft, very low-contrast mint primary on near-white; no boxes, no badges, no "SEARCHING" all-caps chip.
- Respects `prefers-reduced-motion` (shimmer freezes to a static low-opacity state).

## Changes

**1. `src/components/search/SearchNetworkLoader.tsx` — full rewrite**
- Remove the constellation SVG, dots, lines, and all the random-graph math.
- Remove the centered "SEARCHING" chip and the rotating CAPTIONS array (the reasoning panel above already owns status copy).
- Render 5–6 skeleton candidate rows (avatar circle + two text bars) at very low opacity.
- Apply a single full-width gradient sweep animation (`translateX(-100%) → translateX(100%)`, ~2.4s ease-in-out infinite) using `linear-gradient(90deg, transparent, hsl(var(--primary)/0.08), transparent)` as a `::before`-style overlay.
- No border, no card background — blends into the page so it feels like the page is breathing, not a widget loading.
- Keep export name `SearchNetworkLoader` so `SearchPage.tsx` doesn't need to change.

**2. No other files touched.** The AgentReasoningPanel keeps its existing streamed reasoning lines — that becomes the single source of "what's happening right now" text.

## Technical notes

- Pure CSS keyframes inlined via `<style>` (same pattern as today).
- Skeleton rows use `bg-foreground/[0.04]` and `bg-foreground/[0.06]` so they sit quietly on both light and dark.
- Sweep overlay is `pointer-events-none absolute inset-0` with `mix-blend-mode: normal` and the gradient above.
- Height matches roughly one viewport of result rows (~360px) so the layout doesn't jump when real results arrive.
- Reduced-motion: sweep `animation: none`, skeletons stay at static opacity.

## Out of scope

- Reasoning panel copy, timing, or layout.
- The results page header, breadcrumb, or chat bubble styling.
- Any backend / search behavior.