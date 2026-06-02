# Subtle pulsing dots for active search step

## Goal
While the search is running, the in-progress reasoning line (e.g. "Scanning healthcare professional records…") should show a calm, modern three-dot pulse — not the current blinking caret. Completed lines stay plain text. This is the only "search is happening" indicator in the reasoning panel.

## Change (single file: `src/components/search/AgentReasoningPanel.tsx`)

1. **Drop the typewriter caret.** In `ReasoningLineRow`, remove the `<span ... animate-pulse>` block that renders the vertical bar when `cursor` is true.

2. **Add a `PulsingDots` sub-component** — three 4px dots, `bg-muted-foreground/60`, staggered `animate-pulse` via inline `animationDelay: 0ms / 200ms / 400ms`, `gap-1`, vertically centered.

3. **Render dots on the live line.** When `cursor` is true (i.e. the line currently being typed), render `<PulsingDots />` inline after the text with `ml-2 inline-flex align-middle`. They sit at the end of "Scanning healthcare professional records" while it types and after it finishes, until the next line takes over.

4. **Replace the empty-state "Thinking…" pulse** (line 242–245) with the same `PulsingDots` component alone (no text), keeping it left-aligned. This removes the second "words" state the user complained about earlier.

5. **Reduced-motion**: when `reducedMotion` is true, render the three dots statically at 60% opacity (no animation), same layout.

## Out of scope
- `SearchNetworkLoader` (skeleton rows below the panel) — untouched.
- Reasoning script copy, typing speed, header bubble, condensed done state.
- No new files, no design tokens added.

## Technical notes
- Pure Tailwind + inline `style={{ animationDelay }}`. No keyframe additions needed; `animate-pulse` already exists.
- Dot markup:
  ```tsx
  <span className="inline-flex items-center gap-1 ml-2 align-middle" aria-hidden>
    {[0, 200, 400].map((d) => (
      <span
        key={d}
        className="h-1 w-1 rounded-full bg-muted-foreground/60 animate-pulse"
        style={{ animationDelay: `${d}ms` }}
      />
    ))}
  </span>
  ```
