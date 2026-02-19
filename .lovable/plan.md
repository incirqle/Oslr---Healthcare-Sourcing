

# Oslr Marketing Landing Page -- Revised Messaging

## Overview

Build a conversion-focused marketing landing page at `/` that positions Oslr as **the modern way to source healthcare talent** -- powered by real-time data, natural language AI, and an all-in-one recruiting workflow. The messaging shifts away from criticizing any specific platform and instead frames the narrative as **old methods vs. the new way**.

---

## Messaging Pillars

1. **Real-time data, not stale databases** -- Source from live, aggregated data across LinkedIn, professional registries, and dozens of other sources. Know where physicians are doing their residency or fellowship right now.
2. **Natural language search** -- Stop writing Boolean strings. Just type what you need in plain English.
3. **Enrich, sequence, and track** -- Go from a name to verified contact info, personalized email sequences, and campaign analytics without leaving the platform.
4. **Enhance your sourcing, don't replace it** -- Oslr makes recruiters faster and better. It's a force multiplier, not a replacement.
5. **Market intelligence built in** -- Daily digest of healthcare news, PE activity, and industry trends so you're always the most informed person in the room.

---

## Page Sections

### 1. Sticky Navigation Bar
- Oslr logo (left)
- Anchored links: How It Works, Features, Intelligence, Pricing (scroll targets)
- "Log In" (ghost) and "Get Started Free" (primary button) on the right, both link to `/auth`

### 2. Hero Section
- **Headline:** "The New Way to Source Healthcare Talent"
- **Subheadline:** "Real-time data. Natural language AI. Verified contact info. Email sequences. Market intelligence. All in one platform built for healthcare recruiting."
- Animated mock search bar showing a query like "Orthopedic surgeons completing fellowship in Miami" morphing into structured filter chips (job title, location, training stage)
- Two CTAs: "Get Started Free" (primary) | "See How It Works" (ghost, scrolls down)
- Floating proof badges: "1.5B+ professional profiles" / "Real-time data aggregation" / "AI-powered matching"

### 3. The Problem (Old Way vs. New Way) -- no villain, just progress
- **Section title:** "Recruiting technology hasn't kept up with healthcare"
- Three-column layout:
  - **Stale Data** -- Most sourcing tools rely on databases that are months or years out of date. You need to know where a physician is training right now, not where they were two years ago.
  - **Manual Workflows** -- Copy-pasting between tabs, building spreadsheets, hand-writing outreach emails. Your time should be spent recruiting, not doing data entry.
  - **Fragmented Tools** -- One tool to search, another to find emails, another to send campaigns, another to read industry news. Context-switching kills productivity.

### 4. How It Works (3 steps)
- **Step 1: Search in plain English** -- Type "ICU nurses in Dallas with CCRN certification" and Oslr's AI instantly translates it into structured filters across real-time data sources.
- **Step 2: Enrich and verify** -- One click gives you verified emails, phone numbers, work history, education, residency and fellowship details, and certifications.
- **Step 3: Sequence, track, and recruit** -- Save candidates to hiring projects, build personalized email sequences with merge fields, and track open rates and responses.

### 5. Key Features Grid (2x4 cards with icons)
- **Natural Language Search** -- Just describe who you're looking for. No Boolean strings, no complex filters.
- **Real-Time Data** -- Aggregated from LinkedIn, professional registries, and dozens of sources. Always current.
- **Contact Enrichment** -- Verified emails, direct phone numbers, and professional details in one click.
- **Email Sequences** -- Build personalized outreach templates with merge fields and send campaigns at scale.
- **Match Scoring** -- Every candidate scored on title match, location, data completeness, and relevance.
- **Hiring Projects** -- Organize candidates by role, department, or facility. Track your pipeline.
- **Team Collaboration** -- Invite your team, share projects, and track sourcing performance together.
- **Analytics and Tracking** -- Monitor campaign performance, open rates, and recruiter activity.

### 6. Market Intelligence Section (dedicated, not just a feature bullet)
- **Section title:** "More than sourcing. Your daily healthcare intelligence briefing."
- **Description:** Stay ahead with curated news from Becker's, Healthcare Dive, Modern Healthcare, and more. Track private equity moves, M&A activity, system expansions, and policy changes. Build your daily digest so you're always the most informed recruiter in the room.
- Visual mockup: stacked news cards with category pills (PE/M&A, Policy, Workforce, etc.)
- CTA: "Explore the News Feed" linking to `/auth`

### 7. Social Proof / Stats Bar
- Horizontal strip with animated count-up numbers:
  - "1.5B+ professional profiles"
  - "200M+ verified contact records"
  - "Real-time data from 30+ sources"
  - "Built exclusively for healthcare"

### 8. For Recruiters Section (approachable, not adversarial)
- **Headline:** "Built to make great recruiters unstoppable"
- **Copy:** Whether you're an in-house talent acquisition team or an agency recruiter, Oslr gives you the data advantage. Find candidates your competitors can't, reach them faster, and close roles sooner. This isn't about replacing your expertise -- it's about amplifying it.
- Three proof points with icons:
  - "10x faster sourcing with natural language"
  - "Verified contact info means no dead ends"
  - "One platform instead of six tabs"

### 9. CTA / Closing Section
- **Headline:** "Stop sourcing the old way."
- **Subtext:** "Real-time data. AI search. Verified contacts. Email sequences. Market intelligence. All free to start."
- Email input + "Get Started Free" button
- "No credit card required. Start searching in under 60 seconds."

### 10. Footer
- Oslr logo + tagline: "The modern healthcare sourcing platform"
- Link groups: Product (Search, Projects, Campaigns, News), Company (Pricing, Login, Sign Up)
- Copyright line

---

## Technical Details

### New Files
- `src/pages/Landing.tsx` -- The complete landing page component with all sections above

### Modified Files
- `src/App.tsx` -- Change the `/` route from `<Navigate to="/dashboard">` to `<Landing />`

### Design and Animation
- Framer Motion `whileInView` animations for scroll-triggered fade-in and slide-up on each section
- Alternating dark (sidebar palette) and light (background) sections for visual rhythm
- Animated gradient text on key headlines
- Mock search bar animation using Framer Motion `AnimatePresence` to cycle through example queries
- Count-up animation on stats bar numbers using Framer Motion
- All existing Tailwind theme tokens, Lucide icons, and fonts (DM Sans / Inter)
- Fully responsive with mobile-first breakpoints
- No new dependencies required
