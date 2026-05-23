# Nylas for Campaigns Outreach

Scope: **Campaigns module only.** Oslr Agents stay on their current Resend path. `send-invite` stays on Resend (transactional).

Replace Resend in `send-campaign` with per-user Nylas mailboxes (Gmail/Outlook OAuth) so campaign emails come from the recruiter's real inbox, thread properly, and surface real replies.

---

## M1 — Connect a mailbox

**Goal:** Recruiter clicks "Connect mailbox" in Team Settings → completes Nylas hosted OAuth → sees mailbox connected.

### Secrets
- `NYLAS_API_KEY`
- `NYLAS_CLIENT_ID`
- `NYLAS_API_URI` = `https://api.us.nylas.com`
- `NYLAS_WEBHOOK_SECRET` (added in M3)

### Schema
```sql
create table user_mailboxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  company_id uuid not null,
  provider text not null,           -- 'google' | 'microsoft'
  email text not null,
  display_name text,
  nylas_grant_id text not null unique,
  scopes text[],
  status text not null default 'active',  -- active | invalid | revoked
  last_error text,
  connected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, email)
);
-- RLS: user_id = auth.uid()
```

### Edge functions
- `nylas-auth-start` — returns hosted-auth URL (`/v3/connect/auth`) with signed `state`.
- `nylas-oauth-callback` — exchanges code → grant, upserts `user_mailboxes`, redirects to `/settings/team?mailbox=connected`.
- `nylas-disconnect` — `DELETE /v3/grants/{id}` + delete row.

### UI
- `src/components/settings/MailboxCard.tsx` — connection status, disconnect, last verified.
- Add a "Sending mailbox" section to `TeamSettings.tsx` (separate from the existing Resend domain block, which stays untouched).

---

## M2 — Send campaigns through Nylas

**Goal:** `send-campaign` sends through the campaign owner's connected mailbox.

### Shared sender
- `supabase/functions/_shared/nylas-send.ts` → `sendViaNylas({ grantId, to, subject, html, replyToMessageId?, trackingLabel, listUnsubscribe })`
  - `POST /v3/grants/{grantId}/messages/send`
  - 150s timeout, retry-on-503 (exp backoff, max 3)
  - `tracking_options: { opens: true, links: true, thread_replies: true, label }`
  - Omits `List-Unsubscribe-Post` for Microsoft mailboxes
  - Returns `{ message_id, thread_id }`

### Schema additions
```sql
alter table email_campaigns
  add column mailbox_id uuid references user_mailboxes(id);

create table campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  company_id uuid not null,
  recipient_email text not null,
  recipient_name text,
  candidate_id uuid,
  nylas_message_id text,
  nylas_thread_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,
  bounced boolean default false,
  error text
);
-- RLS: company-scoped

create table email_suppressions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  email text not null,
  reason text not null,    -- bounce | complaint | unsubscribe | manual
  created_at timestamptz default now(),
  unique (company_id, email)
);
-- RLS: company-scoped
```

### Rewrite `send-campaign`
- Resolve mailbox: `email_campaigns.mailbox_id` → `user_mailboxes` (active). If none → return 400 with `mailbox_required`.
- For each recipient:
  - Skip if in `email_suppressions` (record skip).
  - `sendViaNylas`, write `campaign_sends` row.
  - Respect a simple per-mailbox cap (default 80/hr Gmail, 60/hr Microsoft) — pause and return remaining count if exceeded.
- Update `email_campaigns.sent_count` from `campaign_sends`.

### Campaign Builder UI
- Add a "Send from" mailbox picker in `CampaignBuilder.tsx` / `NewCampaignModal.tsx` — lists current user's `user_mailboxes`. Disable "Send" until one is selected.
- Empty state: "Connect a mailbox in Team Settings to send campaigns."

---

## M3 — Webhooks: opens, clicks, bounces, replies

**Goal:** Campaign analytics + auto-stop on reply, driven by Nylas events.

### Edge function
- `nylas-webhook` (`verify_jwt = false`):
  - HMAC-verify with `NYLAS_WEBHOOK_SECRET`.
  - Match incoming `message_id` / `thread_id` to `campaign_sends`.
  - `message.opened` → `opened_at`, bump `email_campaigns.open_count`.
  - `message.link_clicked` → `clicked_at`, bump `click_count`.
  - `message.bounce_detected` → `bounced=true`, bump `bounce_count`, insert into `email_suppressions`.
  - `thread.replied` / inbound `message.created` on tracked thread → `replied_at`. (No multi-step sequence to pause — campaigns are single-send. Just record.)

### Registration
- `nylas-webhook-register` one-shot edge function (or guard inside `nylas-webhook`) that calls `POST /v3/webhooks` with our callback URL + the events above.

### Grant health
- `nylas-grant-health` daily cron: `GET /v3/grants/{id}` per mailbox; on invalid/expired → `status='invalid'`, show reconnect banner in Team Settings + disable Campaign send.

---

## M4 — Compliance & polish

- `email_unsubscribe_tokens` table (per recipient/company).
- `unsubscribe` edge function (`verify_jwt=false`) → token → insert suppression → confirmation page.
- Every campaign send includes:
  - `List-Unsubscribe: <mailto:unsub@…>, <https://…/unsubscribe?t=…>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (Gmail only)
- Campaign analytics panel reads from `campaign_sends` instead of Resend webhook counters.
- Remove Resend code paths from `send-campaign` only. Leave `agent-sequence-sender`, `resend-webhook`, `register-sending-domain`, `verify-domain`, `delete-domain`, `send-invite`, `user_sending_domains` untouched.

---

## Files

**New**
- `supabase/functions/_shared/nylas-send.ts`
- `supabase/functions/nylas-auth-start/index.ts`
- `supabase/functions/nylas-oauth-callback/index.ts`
- `supabase/functions/nylas-disconnect/index.ts`
- `supabase/functions/nylas-webhook/index.ts`
- `supabase/functions/nylas-webhook-register/index.ts`
- `supabase/functions/nylas-grant-health/index.ts`
- `supabase/functions/unsubscribe/index.ts`
- `src/components/settings/MailboxCard.tsx`
- `src/hooks/useMailbox.ts`

**Edited**
- `src/pages/TeamSettings.tsx`
- `src/components/campaigns/CampaignBuilder.tsx`
- `src/components/campaigns/NewCampaignModal.tsx`
- `src/pages/CampaignDetail.tsx` (analytics + send button gating)
- `supabase/functions/send-campaign/index.ts`
- `supabase/config.toml` (add `verify_jwt=false` for new public functions)

**Untouched**
- Everything under `agent-*`, `resend-webhook`, `*-domain`, `send-invite`, `user_sending_domains`.

---

## Out of scope
- Oslr Agents (stay on Resend).
- Transactional / invite emails (stay on Resend).
- Nylas Templates, Signatures, scheduled-send (`send_at`).
- Multi-step sequencing for campaigns.

---

## Before M1 starts
1. Confirm I should request the 3 Nylas secrets now.
2. Confirm you've created the Nylas v3 app + Google/Microsoft OAuth credentials in the Nylas dashboard (or want guidance first).
