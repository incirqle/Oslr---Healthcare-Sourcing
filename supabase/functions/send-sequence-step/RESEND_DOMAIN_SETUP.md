# Resend domain setup for `send-sequence-step`

This function sends from `${RESEND_FROM_DOMAIN}` (default `oslr.health`).
Resend won't deliver until you verify that domain.

## One-time setup

1. Go to https://resend.com/domains and click **Add Domain**.
2. Enter the sending domain. Recommended: `mail.oslr.health` (subdomain isolates marketing sends from your transactional auth emails on `oslr.health`).
3. Resend will show 3 DNS records. Add them to whoever runs DNS for `oslr.health`:
   - **MX** record (only if you also want Resend to receive replies — defer for v1)
   - **TXT** for SPF: typically `v=spf1 include:amazonses.com ~all`
   - **CNAME** for DKIM: 3 CNAMEs that Resend generates per-domain
4. (Optional but recommended) Add a DMARC TXT at `_dmarc.mail.oslr.health`:
   `v=DMARC1; p=none; rua=mailto:dmarc@oslr.health`
5. Wait 5-10 min for propagation, then click **Verify** in the Resend dashboard.

## Required env vars (set in Supabase project → Edge Functions → Secrets)

| Key | Value |
|---|---|
| `RESEND_API_KEY` | from https://resend.com/api-keys (full-access for v1) |
| `RESEND_FROM_DOMAIN` | `mail.oslr.health` (or whichever domain you verified) |
| `RESEND_WEBHOOK_SECRET` | Resend → Webhooks → Signing secret |

## Webhook URL to configure in Resend

`https://<your-supabase-project-ref>.supabase.co/functions/v1/resend-webhook`

Subscribe to events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`.

## What's NOT in this PR

- Reply detection via Resend Inbound Email (deferred to v1.5 — the `replied_at` column exists; will be populated by a separate inbound webhook handler)
- Gmail / Outlook OAuth mailboxes (the `mailbox_provider` enum has `gmail` / `outlook` slots; no implementation yet)
