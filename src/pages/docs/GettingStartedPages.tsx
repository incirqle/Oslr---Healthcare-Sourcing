import { DocPage, DocHeading, DocH3, DocParagraph, DocList, DocTip } from "@/components/docs/DocPrimitives";

/* ── Getting Started ── */
export function GettingStartedPage() {
  return (
    <DocPage
      title="Getting Started"
      description="Signing up for Oslr takes seconds. Create your account, set up your organization, and start sourcing healthcare talent immediately."
      slug="getting-started"
      toc={[
        { id: "intro", label: "Introduction to Oslr" },
        { id: "create-account", label: "Create an account" },
        { id: "verify-email", label: "Verify your email" },
        { id: "org-name", label: "Set your organization name" },
        { id: "configure-email", label: "Configure email sending" },
      ]}
    >
      <DocHeading id="intro">Introduction to Oslr</DocHeading>
      <DocParagraph>
        Oslr is the modern way to source healthcare talent. Powered by real-time data aggregated
        from LinkedIn, professional registries, and dozens of other sources, Oslr lets you search
        for candidates using natural language — no Boolean strings required.
      </DocParagraph>
      <DocParagraph>
        From AI-powered search to verified contact enrichment, personalized email campaigns,
        and a built-in healthcare news feed, Oslr gives recruiters everything they need in one platform.
      </DocParagraph>

      <DocHeading id="create-account">Create an account</DocHeading>
      <DocParagraph>
        To get started, click the <strong>"Get Started Free"</strong> button on the Oslr homepage
        or navigate to the sign-in page. You can create an account using your email address and a password.
      </DocParagraph>
      <DocList
        items={[
          "Enter your full name",
          "Provide a valid work email address",
          "Choose a secure password",
          "Click Sign Up",
        ]}
      />

      <DocHeading id="verify-email">Verify your email address</DocHeading>
      <DocParagraph>
        After signing up, you'll receive a verification email. Click the link in the email to
        confirm your account. Once verified, you can sign in and start using Oslr.
      </DocParagraph>
      <DocTip>
        Can't find the verification email? Check your spam or junk folder. You can also request
        a new verification email from the sign-in page.
      </DocTip>

      <DocHeading id="org-name">Set your organization name</DocHeading>
      <DocParagraph>
        When you first sign in, you'll be prompted to create or join an organization. Your
        organization is the shared workspace where your team collaborates on projects, campaigns,
        and candidate pipelines.
      </DocParagraph>
      <DocParagraph>
        Most teams use their company name (e.g., "Acme Health Recruiting" or "Memorial Health Talent Acquisition").
        You can change this later in Team Settings.
      </DocParagraph>

      <DocHeading id="configure-email">Configure email sending</DocHeading>
      <DocParagraph>
        To send outreach campaigns, navigate to <strong>Team Settings</strong> and configure your
        email sender identity. You'll need to set your sender name, from email address, and
        optionally a reply-to address.
      </DocParagraph>
      <DocParagraph>
        Oslr uses Resend for email delivery. Your admin will need to configure the Resend API
        integration to enable campaign sending.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Manage Account ── */
export function ManageAccountPage() {
  return (
    <DocPage
      title="Manage Account"
      description="Learn how to update your profile, manage team members, and configure your organization settings."
      slug="manage-account"
      toc={[
        { id: "profile", label: "Your profile" },
        { id: "team", label: "Team members" },
        { id: "org-settings", label: "Organization settings" },
        { id: "security", label: "Security" },
      ]}
    >
      <DocHeading id="profile">Your profile</DocHeading>
      <DocParagraph>
        Your profile includes your name, email address, and avatar. This information appears
        across the platform — in team activity feeds, project history, and campaign attribution.
      </DocParagraph>

      <DocHeading id="team">Team members</DocHeading>
      <DocParagraph>
        Organization admins can invite team members from the <strong>Team Settings</strong> page.
        Oslr supports three roles:
      </DocParagraph>
      <DocList
        items={[
          "Admin — Full access to all features, settings, and team management",
          "Recruiter — Can search, manage projects, and send campaigns",
          "Viewer — Read-only access to projects and candidate data",
        ]}
      />

      <DocHeading id="org-settings">Organization settings</DocHeading>
      <DocParagraph>
        From Team Settings, admins can update the organization name, configure email sender
        identity, set daily sending limits, and manage API integrations.
      </DocParagraph>

      <DocHeading id="security">Security</DocHeading>
      <DocParagraph>
        Oslr uses row-level security to ensure that your data is isolated to your organization.
        Team members can only access data belonging to their organization. All data is encrypted
        in transit and at rest.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Credits & Usage ── */
export function CreditsUsagePage() {
  return (
    <DocPage
      title="Credits & Usage"
      description="Understand how credits work in Oslr, what actions consume credits, and how to monitor your usage."
      slug="credits-usage"
      toc={[
        { id: "overview", label: "Overview" },
        { id: "what-costs", label: "What uses credits" },
        { id: "monitoring", label: "Monitoring usage" },
        { id: "limits", label: "Daily limits" },
      ]}
    >
      <DocHeading id="overview">Overview</DocHeading>
      <DocParagraph>
        Oslr uses a credit-based system for certain actions that involve external data lookups
        or AI processing. Your plan includes a monthly credit allocation, and usage resets
        each billing cycle.
      </DocParagraph>

      <DocHeading id="what-costs">What uses credits</DocHeading>
      <DocList
        items={[
          "People search queries — Each search against the candidate database uses credits based on the number of results returned",
          "Contact enrichment — Retrieving verified email addresses and phone numbers",
          "AI filter parsing — Converting natural language queries into structured search filters",
          "Email campaigns — Sending outreach emails to candidates",
        ]}
      />
      <DocTip>
        Browsing your existing projects, viewing saved candidates, and reading the news feed
        does not consume any credits.
      </DocTip>

      <DocHeading id="monitoring">Monitoring usage</DocHeading>
      <DocParagraph>
        Your current credit usage is displayed on the Dashboard. You can also see a breakdown
        of usage by action type in Team Settings.
      </DocParagraph>

      <DocHeading id="limits">Daily limits</DocHeading>
      <DocParagraph>
        To protect deliverability and prevent abuse, Oslr enforces a daily email sending limit.
        Admins can configure this limit in Team Settings under Deliverability Controls. The
        default limit is 50 emails per day.
      </DocParagraph>
    </DocPage>
  );
}
