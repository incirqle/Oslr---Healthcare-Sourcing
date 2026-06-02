## Problem

The current `SearchNetworkLoader` is just plain skeleton rows with a horizontal sweep — no glowing nodes, no network metaphor. You want the constellation feel back while results are loading.

## Plan

Rebuild `src/components/search/SearchNetworkLoader.tsx` so each skeleton row IS a glowing node in a connected network, instead of a flat sweep.

### Visual

```
 ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●
   ╲                                      
    ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●      
        ╲                                  
         ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●
```

- Replace the gray avatar circle on each row with a **glowing primary-tinted node**: solid core + soft radial halo (box-shadow blur), pulsing on a staggered delay so the column reads as a living constellation.
- Add a thin SVG overlay layered behind the rows drawing **faint connecting lines** between consecutive node centers (slightly curved, primary color at ~10% opacity), with a moving dash offset so the signal appears to flow downward.
- Add a couple of small "satellite" nodes floating in the right-side action slot that pulse on their own cadence — gives the impression of incoming matches.
- Keep the skeleton text bars but tint their shimmer with a primary-mint gradient sweep (instead of plain gray) so the whole surface feels active.
- Respect `prefers-reduced-motion`: nodes stay lit but stop pulsing, lines stop flowing.

### Technical

- Single file change: `src/components/search/SearchNetworkLoader.tsx`.
- Pure CSS keyframes + one inline `<svg>` for the connecting lines. No new deps. No changes to `SearchResults` or `SearchPage`.
- Use `hsl(var(--primary) / …)` tokens only — no hardcoded colors.
- Component still renders ~6 rows so the loader occupies the same vertical space as the result list it replaces.

### Out of scope

- No changes to `AgentReasoningPanel` copy or layout above the loader.
- No changes to skeleton row count or container padding.
