## Problems

1. **Status block is bloated.** Status, Contact, Activity, Fit each get their own full-width row in a bordered card — eating ~200px before the AI Summary appears.
2. **Employer Intel is gated like a paywall.** The "Unlock (1 credit)" lock chip mirrors the contact-info pattern, which feels punitive for company data. User wants a soft, premium, user-initiated lookup that leads with the company's actual brand — not a generic building icon.
3. **Caching should be silent.** Cache exists server-side (7-day TTL); keep it working but do not surface a "Cached · Xd ago" badge in the UI.

## Direction

### A. Compact status into a single horizontal meta row

Replace the 4-row stacked dl with one inline meta strip directly above the AI Summary:

```
●  Not contacted    •    🔒 Email hidden  Unlock    •    0 notes    •    Fit: Unreviewed ▾
```

- Single row, ~32px tall, no card border — sits as a quiet meta line, not a table.
- Wraps to two rows on narrow widths.
- Contact stays gated (still 1 credit, sensitive PII) but reads as one chip, not a labeled table row.
- Fit pill becomes inline, not a `dd` cell.

### B. Employer Intel — premium, brand-led lookup

Reframe the locked card as a soft, branded call to action. No lock icon. No "1 credit" chip. The company's own logo is the visual anchor.

Default (not-yet-fetched) state:

```
┌──────────────────────────────────────────────────────────┐
│  [LOGO]   UCHealth                                       │
│           Look up company intel              [Look up →] │
│                                                          │
│   Headcount · growth · leadership · Glassdoor            │
└──────────────────────────────────────────────────────────┘
```

- **Logo first.** Resolve a high-quality company mark via Clearbit Logo API (`https://logo.clearbit.com/{domain}`). Use `job_company_website` when present; otherwise slug company name (lowercase, strip non-alphanumerics, append `.com`). On 404, fall back to a colored monogram tile (first letter, `bg-primary/10`, primary letter) — never a generic building icon.
- 56×56 rounded-[12px] logo with `border border-ui-border-light/60` and subtle shadow.
- Heading: company name in `text-[15px] font-semibold` (Comfortaa via existing heading class).
- Subheading: small muted "Look up company intel".
- Primary action: right-aligned text button **"Look up →"** in primary color, `hover:underline` — feels editorial, not transactional.
- Footer line: `text-[11px] text-ui-text-muted` "Headcount · growth · leadership · Glassdoor."
- On click → existing `useCompanyEnrichment` hook fires; card morphs into the full intel layout in place (no layout shift).

Loaded state:
- Same logo + name header stays at top, intel content below.
- **No cache badge** — caching is invisible to the user.

### C. Caching stays server-side and silent

- Existing 7-day TTL in `company_enrichment_cache` (`getCompanyEnrichment`) is correct — no changes required to the edge function or the hook.
- Do not surface `cached_at` to the UI.

## Changes

**1. `src/components/CandidateDrawer.tsx`**
- Replace lines 873–939 (the bordered `dl` block) with the inline meta strip from direction A.
- Pass a `domain` prop to `CompanyIntelCard` (from `candidate.job_company_website` when available).

**2. `src/components/CompanyIntelCard.tsx`**
- Rewrite the not-yet-fetched branch per direction B (logo-led, no Lock icon, no credit chip, "Look up →" action).
- Add a small inline `CompanyLogo` helper that tries Clearbit and falls back to a colored monogram tile on `onError`.
- After fetch: keep the logo + name header; render intel content; no cache badge.

**3. No backend or hook changes.**

## Out of scope

- Removing the Contact unlock gate (still 1 credit, still locked — only the Employer Intel framing changes).
- Tab structure, AI Summary card, Signals chips, stat strip, Current Role card.
- Any results-page or loader changes.

## Technical notes

- Clearbit logo endpoint is public, unauthenticated, free for branding lookups, returns 404 cleanly → easy `onError` fallback.
- Monogram fallback: `bg-primary/10 text-primary font-semibold text-[20px]` on the same 56×56 rounded tile.
- Cache TTL stays 7 days, server-side only.