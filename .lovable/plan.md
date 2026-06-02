## Add an animated "network of dots" loader to the search results area

While a search is in flight, the blank area under the reasoning panel currently shows generic gray skeleton rows. Replace that with a subtle, on-brand animated visualization that signals "we're scanning the network" — a faint constellation of dots connected by thin lines, gently pulsing in the mint primary color.

### What the user will see

- The moment the reasoning panel starts streaming ("Parsed your query… Scanning healthcare professional records…"), the area below shows a soft animated dot network instead of bare skeleton bars.
- Dots fade in/out at staggered intervals; thin connecting lines pulse softly.
- A short caption underneath ("Searching across millions of clinical profiles…") rotates through 2–3 phrases.
- As soon as the first real candidates arrive, the loader fades out and the result rows take over — no jarring transition.

### Files to change

1. **`src/components/search/SearchNetworkLoader.tsx`** (new)
   - SVG-based component, ~360px tall, full width, centered.
   - ~24 dots positioned on a loose grid with slight random offsets, rendered as `<circle>` elements with `fill="hsl(var(--primary) / 0.35)"`.
   - ~30 thin lines (`<line>` with `stroke="hsl(var(--primary) / 0.12)"`) connecting nearby dots.
   - Two CSS keyframe animations defined inline via a `<style>` tag (scoped class names): `dot-pulse` (opacity 0.2 → 0.9 → 0.2, 2.4s) and `line-pulse` (opacity 0.05 → 0.25 → 0.05, 3.2s). Each element gets a random `animation-delay` so the network breathes rather than blinks in unison.
   - Below the SVG, a small `<p>` showing a rotating caption (state-driven, swaps every 2.5s with a fade).
   - All colors use semantic tokens (`--primary`, `--muted-foreground`) so it works in light and dark themes.

2. **`src/pages/SearchPage.tsx`**
   - Replace the `{skeletonCount > 0 && …}` block (lines ~355–371) with `{skeletonCount > 0 && <SearchNetworkLoader />}`.
   - Import the new component.

### Technical notes

- Pure CSS animations (no framer-motion needed) — keeps it lightweight and avoids any new deps.
- Uses `prefers-reduced-motion: reduce` to disable animation for accessibility.
- The loader only renders while `skeletonCount > 0`, which is already controlled by `searchPhase === "running"` and the absence of streamed candidates, so it disappears the instant real rows arrive.
- No backend, hook, or query changes — purely a presentation swap.

### Out of scope

- No changes to the reasoning panel itself (it already animates nicely).
- No changes to the post-results skeleton inside `SearchResults.tsx` (those are for pagination transitions).
