
Three targeted fixes to the candidate drawer. All doable.

## 1. LinkedIn link — visible color

The link at the top of the drawer currently uses `text-linkedin`, which maps to `--linkedin-bg: 214 100% 97%` — that's the very-light background token, not the foreground blue. Result: nearly white text on white.

**Fix:** swap to `text-linkedin-foreground` (the proper LinkedIn blue) plus a faint pill background so it reads as a real link/badge instead of plain text.

```text
[ in  LinkedIn ]   ← bg-linkedin/40, text-linkedin-foreground, font-medium
```

Also apply the same `text-linkedin-foreground` token to the LinkedIn mark next to candidate names in the search results row (currently `text-info`, which is a different shade), so the brand color is consistent everywhere.

## 2. Remove the "RT" initials circle from the drawer header

Today, when a candidate has no LinkedIn photo we render a colored circle with their initials ("RT"). It looks like an AI-generated placeholder and the user wants it gone.

**Fix:** in the drawer header only, render the photo when present, otherwise render **nothing** — the name + meta line stands on its own. No replacement icon, no outline circle.

Note: the small avatar in the **search results row** stays as-is (that list needs a visual anchor per row). Only the big header avatar is removed.

## 3. Real company + school logos in the Experience tab

PDL's enriched person record includes domain info for each experience/education entry (`company.website`, `company.linkedin_url`, `school.website`, `school.linkedin_url`). Raw payloads have `company_website` / `company_url` / `school_url` as fallback fields.

**Approach:**

- Extend `ExperienceEntry` and `EducationEntry` with a derived `logoDomain: string | null`. Resolve it in `normalizeExperience` / `normalizeEducation` by checking website → linkedin_url → null. Strip protocol + `www.` and take the host.
- Build the logo URL from Google's public favicon service (no API key, works for every domain):
  ```text
  https://www.google.com/s2/favicons?domain={domain}&sz=128
  ```
  This is the same service LinkedIn-style company logos rely on for low-friction fetches. Reliable, cached at Google's edge, and free.
- Render `<img>` in the existing 40×40 timeline slot. On `onError`, hide it and reveal the existing initials block as fallback (same pattern already used for the candidate avatar at line 590).
- When `logoDomain` is null (no domain in the data), skip the image entirely and render the initials block straight away.

### Visual

```text
[Wellspan logo]  Orthopaedic Surgeon, Hand and Upper Extremity   [Current]
                 Wellspan Health
                 Jan 2015 — Present · 11y 4m

[4x Naturals favicon]  Bioengineered Cosmetics and Skin Protectants  [Current]
                       4x Naturals
                       Aug 2013 — Present · 12y 9m
```

Same treatment for the Education section (Medical College of Wisconsin → mcw.edu favicon, Mayo Clinic → mayo.edu, etc.).

### Edge cases

- Logos with transparent or weird backgrounds: wrap the `<img>` in a `bg-white dark:bg-white/95 rounded-md p-1` container so light/dark logos remain visible on the dark theme. (The drawer uses light surfaces, so this is mostly about consistency.)
- Companies missing domain data fall back to the existing colored-initials tile — unchanged behavior, so we degrade gracefully.

## Files touched

- `src/components/CandidateDrawer.tsx` — fix LinkedIn token, delete header initials block, swap timeline avatars for `<img>` with fallback, add `logoDomain` to entry types.
- `src/components/search/SearchResults.tsx` — change the row LinkedIn mark from `text-info` to `text-linkedin-foreground` (one-line tweak).

## Out of scope

- Server-side enrichment changes — we use what PDL already returns.
- Using a paid logo API (Clearbit/Logo.dev). Google favicons are free and good enough; we can revisit if quality complaints come up.
