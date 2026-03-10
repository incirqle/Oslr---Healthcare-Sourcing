import { DocPage, DocHeading, DocParagraph, DocList, DocTip } from "@/components/docs/DocPrimitives";

/* ── Email Campaigns ── */
export function EmailCampaignsPage() {
  return (
    <DocPage
      title="Email Campaigns"
      description="Create and send personalized email outreach campaigns to candidates in your projects."
      slug="email-campaigns"
      toc={[
        { id: "overview", label: "Overview" },
        { id: "creating", label: "Creating a campaign" },
        { id: "steps", label: "Campaign builder steps" },
        { id: "sending", label: "Sending" },
      ]}
    >
      <DocHeading id="overview">Overview</DocHeading>
      <DocParagraph>
        Oslr's campaign system lets you send personalized email outreach at scale. Create
        reusable templates with merge fields, select recipients from your projects, preview
        each email, and track delivery and engagement.
      </DocParagraph>

      <DocHeading id="creating">Creating a campaign</DocHeading>
      <DocParagraph>
        Navigate to the Campaigns page and click <strong>"New Campaign."</strong> The campaign
        builder walks you through five steps:
      </DocParagraph>

      <DocHeading id="steps">Campaign builder steps</DocHeading>
      <DocList
        items={[
          "1. Name — Give your campaign a descriptive name",
          "2. Template — Select an email template or create a new one",
          "3. Recipients — Choose a project and select candidates with email addresses",
          "4. Preview — Review personalized emails with merge fields resolved",
          "5. Confirm — Review daily quota and send the campaign",
        ]}
      />

      <DocHeading id="sending">Sending</DocHeading>
      <DocParagraph>
        Before sending, Oslr checks your daily sending quota. If you're approaching your
        limit, you'll see a warning indicating how many emails will be sent and how many
        will be skipped. Campaigns are sent immediately upon confirmation.
      </DocParagraph>
      <DocTip>
        Make sure your email sender identity is configured in Team Settings before sending
        your first campaign. Campaigns without a configured sender will fail.
      </DocTip>
    </DocPage>
  );
}

/* ── Templates ── */
export function TemplatesPage() {
  return (
    <DocPage
      title="Templates"
      description="Create reusable email templates with merge fields for personalized outreach at scale."
      slug="templates"
      toc={[
        { id: "creating", label: "Creating templates" },
        { id: "merge-fields", label: "Merge fields" },
        { id: "best-practices", label: "Best practices" },
      ]}
    >
      <DocHeading id="creating">Creating templates</DocHeading>
      <DocParagraph>
        From the Campaigns page, switch to the Templates tab and click <strong>"New Template."</strong> Each
        template has a name, subject line, and body. Templates are shared across your
        organization so any team member can use them.
      </DocParagraph>

      <DocHeading id="merge-fields">Merge fields</DocHeading>
      <DocParagraph>
        Use double curly braces to insert dynamic candidate data into your templates:
      </DocParagraph>
      <DocList
        items={[
          "{{first_name}} — Candidate's first name",
          "{{last_name}} — Candidate's last name",
          "{{full_name}} — Candidate's full name",
          "{{title}} — Current job title",
          "{{company}} — Current employer",
          "{{location}} — City and state",
        ]}
      />

      <DocHeading id="best-practices">Best practices</DocHeading>
      <DocList
        items={[
          "Keep subject lines under 50 characters for better open rates",
          "Personalize the first line with the candidate's name and role",
          "Keep emails concise — 3-5 sentences is ideal for initial outreach",
          "Include a clear call-to-action (e.g., schedule a call)",
          "Test your template by previewing with a real candidate before sending",
        ]}
      />
    </DocPage>
  );
}

/* ── Campaign Tracking ── */
export function CampaignTrackingPage() {
  return (
    <DocPage
      title="Campaign Tracking"
      description="Track the delivery and engagement of your email campaigns in real-time."
      slug="campaign-tracking"
      toc={[
        { id: "events", label: "Email events" },
        { id: "statuses", label: "Campaign statuses" },
        { id: "real-time", label: "Real-time updates" },
      ]}
    >
      <DocHeading id="events">Email events</DocHeading>
      <DocParagraph>
        Oslr tracks the following events for every email sent through a campaign:
      </DocParagraph>
      <DocList
        items={[
          "Sent — Email was accepted by the delivery provider",
          "Delivered — Email was successfully delivered to the recipient's inbox",
          "Opened — Recipient opened the email (tracked via pixel)",
          "Clicked — Recipient clicked a link in the email",
          "Bounced — Email could not be delivered (invalid address, full inbox, etc.)",
        ]}
      />

      <DocHeading id="statuses">Campaign statuses</DocHeading>
      <DocList
        items={[
          "Draft — Campaign created but not yet sent",
          "Sent — Campaign has been dispatched",
          "Completed — All tracking data has been collected",
        ]}
      />

      <DocHeading id="real-time">Real-time updates</DocHeading>
      <DocParagraph>
        Campaign analytics update in real-time as events are received from the email delivery
        provider. Open the Campaign Analytics drawer to see a live breakdown of delivery
        rates, open rates, click rates, and bounce rates.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Campaign Analytics ── */
export function CampaignAnalyticsPage() {
  return (
    <DocPage
      title="Campaign Analytics"
      description="Analyze your campaign performance with detailed metrics and engagement data."
      slug="campaign-analytics"
      toc={[
        { id: "overview", label: "Analytics overview" },
        { id: "metrics", label: "Key metrics" },
        { id: "improving", label: "Improving performance" },
      ]}
    >
      <DocHeading id="overview">Analytics overview</DocHeading>
      <DocParagraph>
        The Campaigns page shows aggregate statistics across all your campaigns, including
        total emails sent, average open rate, click rate, and reply rate. Click on any
        campaign to open detailed analytics.
      </DocParagraph>

      <DocHeading id="metrics">Key metrics</DocHeading>
      <DocList
        items={[
          "Send rate — Percentage of campaign emails successfully dispatched",
          "Delivery rate — Percentage of sent emails that reached the inbox",
          "Open rate — Percentage of delivered emails that were opened",
          "Click rate — Percentage of opened emails with at least one click",
          "Bounce rate — Percentage of emails that bounced",
        ]}
      />

      <DocHeading id="improving">Improving performance</DocHeading>
      <DocParagraph>
        Low open rates? Try shorter, more compelling subject lines. High bounce rates?
        Review your candidate data quality — stale email addresses are a common cause.
        Oslr's contact enrichment provides verified emails to minimize bounces.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Maximize Replies ── */
export function MaximizeRepliesPage() {
  return (
    <DocPage
      title="Maximize Replies"
      description="Best practices for getting more responses from your outreach campaigns."
      slug="maximize-replies"
      toc={[
        { id: "subject", label: "Subject line tips" },
        { id: "personalization", label: "Personalization" },
        { id: "timing", label: "Timing" },
        { id: "follow-up", label: "Follow-up strategy" },
      ]}
    >
      <DocHeading id="subject">Subject line tips</DocHeading>
      <DocList
        items={[
          "Keep it under 50 characters",
          "Mention the candidate's specialty or location",
          "Avoid generic phrases like 'Great opportunity'",
          "Try question formats: 'Open to exploring ICU roles in Miami?'",
        ]}
      />

      <DocHeading id="personalization">Personalization</DocHeading>
      <DocParagraph>
        Emails that reference specific details about the candidate get significantly higher
        reply rates. Use merge fields to include their name, title, and employer. Go further
        by referencing their background or training.
      </DocParagraph>

      <DocHeading id="timing">Timing</DocHeading>
      <DocParagraph>
        Healthcare professionals often check email early in the morning or late in the evening.
        Tuesday through Thursday tend to have the highest engagement. Avoid weekends and
        Monday mornings when inboxes are most cluttered.
      </DocParagraph>

      <DocHeading id="follow-up">Follow-up strategy</DocHeading>
      <DocParagraph>
        Most responses come from follow-up emails, not the initial outreach. Plan a sequence
        of 2-3 touches spaced 3-5 business days apart. Each follow-up should add new value
        rather than simply "checking in."
      </DocParagraph>
    </DocPage>
  );
}

/* ── Contact Data ── */
export function ContactDataPage() {
  return (
    <DocPage
      title="Contact Data"
      description="Understand how Oslr sources, verifies, and delivers candidate contact information."
      slug="contact-data"
      toc={[
        { id: "sources", label: "Data sources" },
        { id: "verification", label: "Verification" },
        { id: "accuracy", label: "Accuracy rates" },
        { id: "privacy", label: "Privacy & compliance" },
      ]}
    >
      <DocHeading id="sources">Data sources</DocHeading>
      <DocParagraph>
        Oslr aggregates contact data from multiple providers to maximize coverage. Sources
        include professional databases, public registries, and verified business directories.
        Data is refreshed regularly to maintain accuracy.
      </DocParagraph>

      <DocHeading id="verification">Verification</DocHeading>
      <DocParagraph>
        Email addresses are verified through multi-step validation including syntax checking,
        MX record verification, and deliverability testing. Phone numbers are cross-referenced
        against carrier databases.
      </DocParagraph>

      <DocHeading id="accuracy">Accuracy rates</DocHeading>
      <DocParagraph>
        Oslr's verified contact data achieves industry-leading accuracy rates. Email
        deliverability typically exceeds 95% for verified addresses. If you encounter an
        invalid contact, it will be reflected in your campaign bounce metrics.
      </DocParagraph>

      <DocHeading id="privacy">Privacy & compliance</DocHeading>
      <DocParagraph>
        All contact data is sourced from publicly available and commercially licensed databases.
        Oslr complies with applicable data privacy regulations. Candidates can request removal
        from our platform at any time.
      </DocParagraph>
    </DocPage>
  );
}
