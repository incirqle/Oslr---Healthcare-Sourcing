# Campaigns

Campaigns are multi-step email sequences that send personalized outreach to the candidates in a project. Each campaign attaches to a project, sends from your connected Gmail or Microsoft 365 account, and pauses automatically when a candidate replies.

---

## Where Campaigns lives

Two entry points:

1. **The Campaigns section** in the left nav — a list of every campaign across your projects, with high-level performance metrics.
2. **Inside a project** — the **Campaigns** tab at the top of any project view shows just the campaigns for that project.

You'll create most campaigns from inside a project, since that's where the audience already lives.

---

## Before you start

You need three things in place before you build your first campaign:

1. **A connected sending account.** Open **Settings → Integrations** and connect Gmail or Microsoft 365. Outreach sends from your real email account, not from an Oslr address — this protects deliverability and is the right legal posture for outreach.
2. **A project with candidates in it.** See [Projects](/resources/projects).
3. **A clear pitch.** If you can't say in two sentences why a candidate should reply, the campaign isn't ready yet. The [email templates](/resources/templates) are starting points organized by audience.

---

## Step 1 — Create a campaign

From a project, click **Campaigns → + New Campaign**. (You can also start from the **Campaigns** tab in the left nav, then attach a project.)

Fill in:

- **Campaign name** — descriptive, e.g., "Spine Surgeon — Mayo — cold outreach Q2 2026"
- **Sending account** — the email account this campaign will send from
- **Project to attach** — the candidates this campaign will target

Click **Create draft**.

---

## Step 2 — Build the sequence

A campaign is one or more emails sent on a schedule. You'll see a sequence editor with **+ Add step**.

For each step:

### Subject line
Write a clear, specific subject. Healthcare candidates respond better to direct subjects than to clever ones.

### Body
Write the email body. Keep it short — physicians and clinicians scan email on phones between cases. Three to six short paragraphs is the right length for most outreach.

### Merge fields
Click `{ }` in the editor toolbar to insert merge fields. Available fields include:

- `{first_name}` — candidate's first name
- `{last_name}` — last name
- `{specialty}` — specialty as listed
- `{current_employer}` — current organization
- `{city}` — city as listed
- `{sender_first_name}`, `{sender_full_name}`, `{sender_title}`, `{sender_phone}`, `{sender_calendar_link}`

If a merge field is empty for a candidate, Oslr will pause that candidate's send and surface a warning so you can choose to fix or skip.

### Send delay
Set when this step sends relative to the previous step. Most cold sequences use 0 / +4 days / +7 days / +10 days for a 4-step sequence over 21 days. Adjust based on how passive your audience is.

### Send window
By default, Oslr sends Monday–Friday, 8 AM to 5 PM in the campaign's time zone. You can tighten this further (for example, Tuesday–Thursday only) in **Campaign settings**.

---

## Step 3 — Test on yourself

Before launching, click **Send test** at the top of the campaign. Oslr sends Step 1 to your own email address using your name as the merge values. Read it on a phone — if it looks cluttered or generic on a phone, rewrite it.

Check:

- The subject line renders correctly
- All merge fields populate (no `{first_name}` leftovers)
- The unsubscribe link appears in the footer
- Your physical postal address appears in the footer (required by CAN-SPAM)

---

## Step 4 — Review the audience

Click **Audience** at the top of the campaign. You'll see every candidate who will receive this sequence, with a flag next to anyone:

- Missing a required merge field
- Already in another active campaign from your workspace
- Previously unsubscribed
- Without a usable email address

Resolve flags individually or click **Skip flagged candidates** to launch without them.

---

## Step 5 — Launch

Click **Launch campaign** at the top right. Oslr begins sending Step 1 to the audience according to your send window and rate limits.

A new campaign sends slowly at first to protect your sender reputation — the first few hours throttle to a small batch, then ramp. You can adjust the daily send cap in **Campaign settings**.

---

## Step 6 — Watch it run

Once a campaign is live, you'll see real-time metrics in the campaign view:

- **Sent** — how many candidates have received Step 1
- **Opens** — open rate (a noisy metric in 2026; treat as a directional signal only)
- **Replies** — total replies received
- **Bounces** — emails that failed to deliver
- **Unsubscribes** — opt-outs

Replies pause that candidate's sequence automatically. You'll see replies in your sending account's inbox and inside Oslr under **Replies** on the campaign view.

---

## Compliance basics

Oslr enforces a few things automatically. The rest are on you.

### What Oslr does
- Adds the unsubscribe link to every campaign email
- Adds your sending domain's postal address to the footer
- Honors unsubscribes platform-wide — once a candidate unsubscribes from any Oslr-sent email, all future campaigns from your workspace skip them

### What's on you
- Truthful subject lines and sender identification
- Honest content
- Honoring direct opt-out requests that come back as replies (e.g., "please don't email me again")
- Avoiding any audience or message type prohibited under our [Terms](/terms)

If you're sending into Canada, the EU, or the UK, additional rules apply. Consult with whoever handles compliance at your organization before launching outreach into those regions.

---

## Tips

- **Start small.** Launch your first campaign to 25–50 candidates, not 500. Read the first 10 replies before scaling.
- **Don't send the same sequence to everyone.** A residency grad and a 15-year attending need different framing. Use separate campaigns for separate segments.
- **Step 2 is where most sequences fail.** Generic "just bumping this to the top of your inbox" emails get ignored. Add one new piece of context in Step 2.
- **Step 4 should not pressure.** A polite "I'll stop emailing after this" close gets occasional late replies. A pushy close gets you reported.

---

## Where to go next

- **[Email templates](/resources/templates)** — pre-structured sequences by audience.
- **[Projects](/resources/projects)** — campaigns attach to projects.
- **[Search](/resources/search)** — finding the candidates a campaign will target.

---

*Stuck on a campaign? Email **hello@oslr.health**.*
