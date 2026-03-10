import { DocPage, DocHeading, DocParagraph, DocList, DocTip } from "@/components/docs/DocPrimitives";

/* ── News Feed ── */
export function NewsFeedPage() {
  return (
    <DocPage
      title="News Feed"
      description="Stay ahead with curated healthcare industry news, PE activity, policy changes, and workforce trends."
      slug="news-feed"
      toc={[
        { id: "overview", label: "Overview" },
        { id: "sources", label: "News sources" },
        { id: "categories", label: "Categories" },
        { id: "filtering", label: "Filtering & search" },
      ]}
    >
      <DocHeading id="overview">Overview</DocHeading>
      <DocParagraph>
        Oslr's Market Intelligence feed aggregates news from leading healthcare publications
        so you're always the most informed recruiter in the room. Track facility expansions,
        M&A activity, executive moves, and policy changes that create hiring opportunities.
      </DocParagraph>

      <DocHeading id="sources">News sources</DocHeading>
      <DocList
        items={[
          "Becker's Hospital Review",
          "Healthcare Dive",
          "Modern Healthcare",
          "Fierce Healthcare",
          "Health Affairs",
          "MedPage Today",
          "And more — new sources added regularly",
        ]}
      />

      <DocHeading id="categories">Categories</DocHeading>
      <DocList
        items={[
          "PE & M&A — Private equity deals, mergers, and acquisitions",
          "Policy — Regulatory changes, CMS updates, legislation",
          "Workforce — Staffing trends, burnout, retention",
          "Technology — Health IT, digital health, EHR news",
          "Leadership — Executive appointments and departures",
        ]}
      />

      <DocHeading id="filtering">Filtering & search</DocHeading>
      <DocParagraph>
        Use category pills to filter news by topic. Search for specific keywords, health systems,
        or regions. Switch between grid and list views. Sort by newest, oldest, or most relevant.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Reading List ── */
export function ReadingListPage() {
  return (
    <DocPage
      title="Reading List"
      description="Save articles to your reading list for later reference and build your healthcare intelligence library."
      slug="reading-list"
      toc={[
        { id: "saving", label: "Saving articles" },
        { id: "managing", label: "Managing your list" },
        { id: "sharing", label: "Sharing with team" },
      ]}
    >
      <DocHeading id="saving">Saving articles</DocHeading>
      <DocParagraph>
        Click the bookmark icon on any article in the News Feed to save it to your personal
        reading list. Saved articles are accessible from the News page under the "Saved" tab.
      </DocParagraph>

      <DocHeading id="managing">Managing your list</DocHeading>
      <DocParagraph>
        Your reading list persists across sessions. Remove articles by clicking the bookmark
        icon again. Use the search and filter tools to find specific saved articles.
      </DocParagraph>

      <DocHeading id="sharing">Sharing with team</DocHeading>
      <DocParagraph>
        Currently, reading lists are personal to each user. Team-wide article sharing is
        on our roadmap. In the meantime, share interesting articles by copying the URL and
        sending it to your team.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Team Management ── */
export function TeamManagementPage() {
  return (
    <DocPage
      title="Team Management"
      description="Invite team members, assign roles, and manage your organization's access controls."
      slug="team-management"
      toc={[
        { id: "inviting", label: "Inviting members" },
        { id: "roles", label: "Roles & permissions" },
        { id: "removing", label: "Removing members" },
      ]}
    >
      <DocHeading id="inviting">Inviting members</DocHeading>
      <DocParagraph>
        Organization admins can invite new team members from the Team Settings page. Send
        an invite to their work email address and they'll be prompted to create an account
        and join your organization.
      </DocParagraph>

      <DocHeading id="roles">Roles & permissions</DocHeading>
      <DocList
        items={[
          "Admin — Full access: manage team, settings, billing, and all features",
          "Recruiter — Search, manage projects, send campaigns, view analytics",
          "Viewer — Read-only access to projects, candidates, and analytics",
        ]}
      />
      <DocTip>
        Roles are managed at the organization level. A user can only have one role per
        organization. To change a user's role, an admin must update it from Team Settings.
      </DocTip>

      <DocHeading id="removing">Removing members</DocHeading>
      <DocParagraph>
        Admins can remove team members from the organization. Removing a member does not
        delete the candidates or projects they created — that data remains in the organization.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Email Settings ── */
export function EmailSettingsPage() {
  return (
    <DocPage
      title="Email Settings"
      description="Configure your organization's email sender identity, daily limits, and deliverability settings."
      slug="email-settings"
      toc={[
        { id: "sender", label: "Sender identity" },
        { id: "limits", label: "Daily limits" },
        { id: "deliverability", label: "Deliverability tips" },
        { id: "integration", label: "Email integration" },
      ]}
    >
      <DocHeading id="sender">Sender identity</DocHeading>
      <DocParagraph>
        Configure the name, email address, and reply-to address that appears on outgoing
        campaign emails. Use a professional sender name and a real email address that
        candidates can reply to.
      </DocParagraph>

      <DocHeading id="limits">Daily limits</DocHeading>
      <DocParagraph>
        Set a daily email sending limit to protect your sender reputation. The default is
        50 emails per day. Admins can increase this limit, but we recommend staying under
        200 per day for new sender domains.
      </DocParagraph>

      <DocHeading id="deliverability">Deliverability tips</DocHeading>
      <DocList
        items={[
          "Warm up new sender domains by starting with low volume and gradually increasing",
          "Use a consistent sender name and email address",
          "Avoid spam trigger words in subject lines",
          "Keep your bounce rate under 2% by using verified contact data",
          "Include an unsubscribe option in campaign emails",
        ]}
      />

      <DocHeading id="integration">Email integration</DocHeading>
      <DocParagraph>
        Oslr uses Resend as the email delivery provider. Your organization admin will need
        to configure the Resend API key in Team Settings. Once connected, you can start
        sending campaigns immediately.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Data Sources ── */
export function DataSourcesPage() {
  return (
    <DocPage
      title="Data Sources"
      description="Learn about the data sources Oslr aggregates to power candidate search and enrichment."
      slug="data-sources"
      toc={[
        { id: "overview", label: "Overview" },
        { id: "sources", label: "Source list" },
        { id: "freshness", label: "Data freshness" },
        { id: "coverage", label: "Coverage" },
      ]}
    >
      <DocHeading id="overview">Overview</DocHeading>
      <DocParagraph>
        Oslr aggregates professional data from over 30 sources to provide the most comprehensive
        and up-to-date candidate information available. Our data pipeline continuously ingests,
        deduplicates, and enriches records to maintain quality.
      </DocParagraph>

      <DocHeading id="sources">Source list</DocHeading>
      <DocList
        items={[
          "LinkedIn — Professional profiles and work history",
          "NPI Registry — National Provider Identifier data for healthcare providers",
          "State licensing boards — Active medical licenses and certifications",
          "Professional associations — Medical society memberships",
          "Hospital and health system directories — Staff and physician rosters",
          "Academic medical centers — Residency and fellowship program data",
          "Business databases — Company information and employee data",
        ]}
      />

      <DocHeading id="freshness">Data freshness</DocHeading>
      <DocParagraph>
        Unlike traditional sourcing tools that rely on databases updated quarterly or annually,
        Oslr's data is refreshed continuously. This means you can find physicians currently
        in fellowship, nurses who recently relocated, and executives who just changed roles.
      </DocParagraph>

      <DocHeading id="coverage">Coverage</DocHeading>
      <DocParagraph>
        Oslr covers 1.5 billion+ professional profiles globally, with particularly deep
        coverage of US healthcare professionals. The platform includes data on physicians,
        nurses, allied health professionals, healthcare executives, and administrative staff.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Help Center ── */
export function HelpCenterPage() {
  return (
    <DocPage
      title="Help Center"
      description="Find answers to common questions and learn how to get the most out of Oslr."
      slug="help-center"
      toc={[
        { id: "faq", label: "Frequently asked questions" },
        { id: "troubleshooting", label: "Troubleshooting" },
      ]}
    >
      <DocHeading id="faq">Frequently asked questions</DocHeading>

      <DocParagraph><strong>How many searches can I run?</strong></DocParagraph>
      <DocParagraph>
        The number of searches depends on your plan's credit allocation. Each search consumes
        credits based on the number of results returned. Check your usage on the Dashboard.
      </DocParagraph>

      <DocParagraph><strong>Can I export candidate data?</strong></DocParagraph>
      <DocParagraph>
        Yes, you can export candidate data from any project. Navigate to the project detail
        page and use the export function to download candidate information as a CSV file.
      </DocParagraph>

      <DocParagraph><strong>How accurate is the contact data?</strong></DocParagraph>
      <DocParagraph>
        Oslr's verified email addresses have a 95%+ deliverability rate. We use multiple
        verification steps including MX record checks and deliverability testing.
      </DocParagraph>

      <DocParagraph><strong>Can multiple team members work on the same project?</strong></DocParagraph>
      <DocParagraph>
        Yes! Projects are shared across your organization. All team members with Recruiter
        or Admin access can search, add candidates, and send campaigns within any project.
      </DocParagraph>

      <DocHeading id="troubleshooting">Troubleshooting</DocHeading>
      <DocList
        items={[
          "Search not returning results? Try broadening your filters or using different keywords",
          "Campaign emails failing? Verify your email sender identity and Resend API configuration",
          "Can't access a project? Check with your admin that you have the correct role",
          "News feed not loading? The feed refreshes periodically — check your internet connection",
        ]}
      />
    </DocPage>
  );
}

/* ── Contact Support ── */
export function ContactSupportPage() {
  return (
    <DocPage
      title="Contact Support"
      description="Need help? Here's how to reach the Oslr support team."
      slug="contact-support"
      toc={[
        { id: "channels", label: "Support channels" },
        { id: "info", label: "What to include" },
      ]}
    >
      <DocHeading id="channels">Support channels</DocHeading>
      <DocList
        items={[
          "Email — Reach us at support@oslr.com for general inquiries",
          "In-app — Use the help button in the bottom right corner of any page",
          "Documentation — Browse these docs for self-service answers",
        ]}
      />

      <DocHeading id="info">What to include in a support request</DocHeading>
      <DocParagraph>
        To help us resolve your issue quickly, please include:
      </DocParagraph>
      <DocList
        items={[
          "A clear description of the issue",
          "Steps to reproduce the problem",
          "Screenshots or screen recordings (if applicable)",
          "Your organization name and email address",
          "The browser and device you're using",
        ]}
      />
      <DocTip>
        Our support team typically responds within 24 hours during business days (Monday–Friday, 9 AM – 6 PM ET).
      </DocTip>
    </DocPage>
  );
}
