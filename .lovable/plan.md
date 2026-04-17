
## Plan: Dashboard Redesign — Onboarding Checklist + Live KPIs

### Reality check on "build everything end-to-end"

Three of the five steps from the prompt need backends that don't exist yet. Some I can build now; one I genuinely can't in a single turn without lying to you. I'll be explicit about each:

| Step | What "end-to-end" actually means | My recommendation |
|---|---|---|
| 1. Tell us about your team | Add `team_profile` columns to `companies` (roles, team_size, primary_specialty). Real save. | ✅ Build for real |
| 2. Create first project | Add `role_title`, `location`, `target_start_date` to `projects`. Real create. | ✅ Build for real |
| 3. Invite teammates | New `company_invites` table + edge function that sends invite emails via Resend. Accepting an invite would auto-join the company on signup. | ✅ Build for real (table + send function + accept flow on Auth page) |
| 4. Connect tools | Greenhouse/Lever/Gmail/Outlook OAuth. Each is a separate OAuth app registration + token exchange + refresh + storage. **This is days of work per provider, and 3 of the 4 require apps you haven't registered.** | ⚠️ Build the UI honestly: each card opens a "Coming soon — join waitlist" dialog that records interest in a `connector_interest` table. Marking the step complete = clicking "Skip for now" or registering interest in any. I will NOT fake OAuth buttons that go nowhere. |
| 5. Run first search | Already exists — just reuse the natural-language input and route to `/projects/:id/search?q=...`. Sandbox button reuses existing `seed-data` function. | ✅ Build for real |

If you genuinely want real Greenhouse/Lever/Gmail/Outlook OAuth, that's a separate multi-turn effort and I'd need you to register OAuth apps with each provider first. Flag if you disagree with the waitlist approach for step 4.

### Architecture

**New table: `company_onboarding`** (one row per company)
- `company_id` (PK, FK companies)
- `step_team_complete` bool, `step_project_complete` bool, `step_invites_complete` bool, `step_connectors_complete` bool, `step_search_complete` bool
- `success_banner_dismissed` bool
- `created_at`, `updated_at`

Why per-company not per-user: invites + project + connectors are company-level. New users joining an already-onboarded company should land in a working dashboard, not redo onboarding.

**New table: `company_invites`**
- `id`, `company_id`, `email`, `role` (admin/recruiter/viewer), `invited_by`, `token`, `accepted_at`, `created_at`
- RLS: company members can see/create, admins can delete; public can SELECT by token (for accept flow)

**New table: `connector_interest`**
- `id`, `company_id`, `user_id`, `connector` (text: greenhouse|lever|gmail|outlook), `created_at`

**Schema additions:**
- `companies` → `recruiting_roles text[]`, `team_size text`, `primary_specialty text`
- `projects` → `role_title text`, `location text`, `target_start_date date`

**New edge function: `send-invite`**
- Validates inviter is admin/recruiter, generates token, inserts row, sends email via Resend with link to `/auth?invite=<token>`

**Auth page update** (small): if `?invite=<token>` present, after signup auto-join that company instead of provisioning a new one.

### Files

**New**
- `src/hooks/useOnboarding.ts` — fetch + mutate `company_onboarding` row, derive `currentStep` and `isComplete`
- `src/components/onboarding/OnboardingChecklist.tsx` — the card with the 5 expandable rows
- `src/components/onboarding/StepRow.tsx` — collapsible row primitive
- `src/components/onboarding/Step1Team.tsx`
- `src/components/onboarding/Step2Project.tsx`
- `src/components/onboarding/Step3Invites.tsx` — uses new `useInvites` hook
- `src/components/onboarding/Step4Connectors.tsx` — 4 cards, each opens "Join waitlist" dialog
- `src/components/onboarding/Step5Search.tsx` — rotating-placeholder input + sandbox button
- `src/components/onboarding/SuccessBanner.tsx`
- `src/hooks/useInvites.ts` — list/create/revoke invites
- `src/hooks/useDashboardStats.ts` — live counts for the 4 KPIs
- `supabase/functions/send-invite/index.ts`

**Edited**
- `src/pages/Dashboard.tsx` — full rebuild: greeting (kept) → checklist OR (banner + KPIs + panels), typography fixes, em-dash for empty metrics
- `src/pages/Auth.tsx` — handle `?invite=<token>` param, attach to company on signup instead of auto-provisioning
- `src/integrations/supabase/types.ts` — auto-regen after migration

### Live KPIs (replacing the hardcoded zeros)

| KPI | Source | Empty value |
|---|---|---|
| Candidates Sourced | `count(candidates) where company_id = X` + `count(... where created_at > now() - 7d)` for delta | `—` if 0 |
| Active Projects | `count(projects)` + `count(projects where updated within 7d)` for "in progress" | `—` if 0 |
| Searches Run | `count(search_history where user_id)` + today's count | `—` if 0 |
| Response Rate | `sum(open_count) / sum(sent_count)` from `email_campaigns where company_id`. If `sum(sent) = 0`, show `—`. | `—` |

### Typography

Translate the prompt's slate/emerald to our tokens (since you said "keep current branding"):
- `text-slate-900` → `text-foreground`
- `text-slate-700` → `text-foreground/80`
- `text-slate-600` → `text-muted-foreground`
- `text-slate-500` → `text-muted-foreground` (smaller weight)
- `bg-emerald-50 / border-emerald-200` → `bg-primary/10 border-primary/30`
- KPI numerals: `text-4xl font-semibold font-display`

### Visibility logic

- `useOnboarding()` returns `{ steps, completedCount, isFullyComplete, bannerDismissed }`
- If `!isFullyComplete` → render only `<OnboardingChecklist />` (greeting stays above)
- If `isFullyComplete && !bannerDismissed` → render `<SuccessBanner />` then KPIs + panels
- If `isFullyComplete && bannerDismissed` → KPIs + panels only

For existing users who already have projects/candidates, I'll auto-mark steps as complete in the migration backfill so they don't get force-onboarded.

### What I will NOT do
- Fake OAuth buttons for Greenhouse/Lever/Gmail/Outlook. Each is a "join waitlist" interaction that records interest. If you want real OAuth for any provider, that's a follow-up scoped per-provider.
- Touch the sidebar or the greeting header.
- Modify any dark-theme tokens — onboarding card uses `bg-card`, fits the existing palette.

### Migration order
1. Run migration (5 schema changes — new tables, new columns, RLS, backfill).
2. Wait for types regen.
3. Build hooks + components + edge function.
4. Verify the redirect flow on `/dashboard` for both empty and post-onboarded states.

I'll start by writing the migration. Let me know if you want to swap step 4 from "waitlist dialogs" to "actually build OAuth for one specific provider first" before I run it.
