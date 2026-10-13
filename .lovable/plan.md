# Full end-to-end audit of Oslr

Goal: walk every part of the app the way a real customer would, find what is broken or confusing, fix it, and hand back one plain-language report.

## How the audit runs

For each area: test it in a real browser as a signed-in user (an approved account and an unpaid account), record what breaks, fix it, then re-test. No stopping between areas — one report at the end.

## Areas and what gets checked

1. **Sign-in and sign-up**
   - Email sign-up, confirm link, sign-in, wrong password, password reset.
   - Google button (start of the flow; Google's own screen can only be finished on the live site).
   - Old or deleted logins land on the sign-in page, never an error screen.
   - Unpaid accounts go to Stripe; approved accounts go straight in; nobody gets free credits.
2. **Public pages** — homepage, docs, share picture and page titles. No LinkedIn, no data-provider name, no unproven claims, no internal credit prices, no dead links (campaigns, analytics).
3. **Dashboard** — the four number cards match reality (fix "Searches Today" using a different "today" than the daily limit), recent searches reopen correctly, setup steps save and finish, remove the leftover campaigns lookup.
4. **Projects** — create, edit, delete, open; Source Candidates and Contacts buttons; CSV export.
5. **Find clinicians / Search** — searching with and without a project, switching projects, paging, refining, saving people, daily meter and limits, history going to the right project (not always the test project), empty and error states.
6. **Contacts** — all saved people show, project filter works, notes and fit labels save, export works.
7. **Enrichment** — single and bulk, correct credits taken, nothing charged when nothing found, results saved forever and reused, enriched people appear in Contacts.
8. **Settings** — General, Team, Billing & Credits (subscription status, monthly credits, history), Usage/Monitoring numbers match the meter.
9. **Privacy check** — each workspace only sees its own projects, contacts, history and credits.
10. **Health check** — browser errors, failed requests, and the backend security scan.

## What you get at the end

A short list: what was broken, what was fixed, what still needs your decision (for example publishing, or blocking searches on the backend for unpaid accounts).

## Technical details

- Playwright runs against the preview with minted sessions for an exempt and a non-exempt test user; screenshots per step.
- Known targets: Dashboard search count uses local midnight vs meter's UTC midnight; useDashboardStats still queries email_campaigns; verify SearchEntry retirement removed the auto-redirect to the newest project.
- Edge functions under supabase/functions/search-people, search-clinicians and _shared are not modified without your explicit approval (they are your source of truth); any issue found there is reported, not changed.
- Run security scan and linter; fix RLS gaps found.
