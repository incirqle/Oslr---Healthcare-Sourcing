

# Marketing Landing Page for Oslr

## Overview

Build a comprehensive, conversion-focused marketing landing page at the root URL (`/`) that communicates Oslr's value proposition as a clinical recruiter sourcing platform. The page will be a single, scroll-based experience with multiple sections, animated elements, and clear CTAs driving visitors to sign up.

## Page Structure

The landing page will be a new component at `src/pages/Landing.tsx` with the following sections:

### 1. Hero Section
- Large headline: "Stop Scrolling LinkedIn. Start Sourcing Smarter."
- Subheadline explaining the pain: traditional healthcare recruiting is slow, manual, and scattered across job boards, LinkedIn, and spreadsheets.
- Animated search bar mockup showing a natural language query ("Orthopedic surgeons in Miami") transforming into structured results.
- Two CTAs: "Get Started Free" (primary) and "See How It Works" (ghost/scroll anchor).
- Floating social proof badges: "1.5B+ professional profiles" / "AI-powered matching".

### 2. Problem Statement / Pain Points
- Section title: "Healthcare recruiting is broken"
- Three-column layout with pain points:
  - **Scattered Data** -- Toggling between LinkedIn, job boards, internal databases, and spreadsheets to find one candidate.
  - **Manual Sourcing** -- Hours spent filtering, copy-pasting, and cross-referencing profiles instead of actually recruiting.
  - **Poor Match Quality** -- Generic search tools built for tech recruiting that don't understand specialties, certifications, or clinical workflows.

### 3. How It Works (3-step flow)
- Step 1: **Search in plain English** -- Type "ICU nurses in Dallas with CCRN" and Oslr's AI parses it into structured filters (job title, location, certifications, experience).
- Step 2: **Review and refine** -- See a preview of matching candidates with match scores, edit filters, narrow results.
- Step 3: **Save, organize, and reach out** -- Save candidates to hiring projects, launch email campaigns, and track your pipeline.

### 4. Key Features Grid
- **AI-Powered Search** -- Natural language queries understood by healthcare-trained AI.
- **Match Scoring** -- Every result scored on title match, location, data completeness.
- **Candidate Enrichment** -- One-click deep profiles with work history, education, contact info, certifications.
- **Project Management** -- Organize candidates into hiring projects by role, department, or facility.
- **Email Campaigns** -- Build outreach templates with merge fields, send campaigns to candidate lists.
- **Healthcare News Feed** -- Stay current with industry news from Becker's, Healthcare Dive, and more.
- **Company Intelligence** -- Enriched company profiles for hospitals and health systems.
- **Team Collaboration** -- Invite recruiters, share projects, track team sourcing performance.

### 5. Social Proof / Stats Bar
- Horizontal strip with key numbers:
  - "1.5B+ professional profiles indexed"
  - "200M+ verified emails and phones"
  - "Natural language AI search"
  - "Built for healthcare recruiting"

### 6. Comparison Section
- "Oslr vs. The Old Way" side-by-side comparison table:
  - LinkedIn Recruiter: expensive, generic, manual filtering
  - Job boards: reactive (waiting for applicants), no outbound
  - Spreadsheets: no intelligence, no enrichment, no collaboration
  - Oslr: AI search, healthcare-specific, enrichment, campaigns, projects -- all in one.

### 7. CTA / Closing Section
- "Ready to source healthcare talent 10x faster?"
- Email input + "Get Started Free" button
- Small note: "No credit card required. Start searching in under 60 seconds."

### 8. Footer
- Oslr logo and tagline
- Links: Product, Pricing, Login, Sign Up
- Copyright line

## Routing Changes

- `src/App.tsx`: Change `/` from redirecting to `/dashboard` to rendering the new `Landing` component. Keep `/dashboard` route as-is.
- The landing page navbar will have "Login" and "Sign Up" buttons linking to `/auth`.

## Technical Details

### New Files
- `src/pages/Landing.tsx` -- The full marketing landing page component

### Modified Files
- `src/App.tsx` -- Update the `/` route to render `Landing` instead of redirecting to `/dashboard`

### Design Approach
- Uses existing Tailwind theme colors (primary green, dark sidebar palette for contrast sections)
- Framer Motion for scroll-triggered animations (fade-in, slide-up) using the already-installed `framer-motion` package
- Fully responsive (mobile-first)
- Dark sections alternating with light sections for visual rhythm
- Lucide icons throughout (already installed)
- DM Sans for headings, Inter for body (already configured)
- No new dependencies required

