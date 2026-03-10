import { DocPage, DocHeading, DocParagraph, DocList, DocTip } from "@/components/docs/DocPrimitives";

/* ── Projects ── */
export function ProjectsPage() {
  return (
    <DocPage
      title="Projects"
      description="Projects are the core organizational unit in Oslr. Each project represents a hiring initiative — a role, department, or facility you're recruiting for."
      slug="projects"
      toc={[
        { id: "overview", label: "What are projects?" },
        { id: "creating", label: "Creating a project" },
        { id: "managing", label: "Managing projects" },
        { id: "sourcing", label: "Sourcing into projects" },
      ]}
    >
      <DocHeading id="overview">What are projects?</DocHeading>
      <DocParagraph>
        A project in Oslr is a container for a specific hiring initiative. It holds your
        candidate pipeline, search history, and campaign data for a particular role or set
        of roles. Think of it as a dedicated workspace for each position you're filling.
      </DocParagraph>

      <DocHeading id="creating">Creating a project</DocHeading>
      <DocParagraph>
        Navigate to the Projects page and click <strong>"New Project."</strong> Give your
        project a descriptive name (e.g., "ICU Nurses - Memorial Hospital") and an optional
        description. Projects are visible to all team members in your organization.
      </DocParagraph>

      <DocHeading id="managing">Managing projects</DocHeading>
      <DocList
        items={[
          "Edit project name and description at any time",
          "View candidate pipeline with status breakdowns",
          "See campaign history for the project",
          "Delete projects when hiring is complete",
        ]}
      />

      <DocHeading id="sourcing">Sourcing into projects</DocHeading>
      <DocParagraph>
        From a project's detail page, click <strong>"Source Candidates"</strong> to open the
        search interface. Any candidates you save from search results will be added to this
        project's pipeline. You can also search from the main search page and save candidates
        to any project using the save dialog.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Candidate Status ── */
export function CandidateStatusPage() {
  return (
    <DocPage
      title="Candidate Status"
      description="Track where each candidate is in your recruiting pipeline with status labels."
      slug="candidate-status"
      toc={[
        { id: "statuses", label: "Available statuses" },
        { id: "updating", label: "Updating status" },
        { id: "bulk", label: "Bulk actions" },
        { id: "filtering", label: "Filtering by status" },
      ]}
    >
      <DocHeading id="statuses">Available statuses</DocHeading>
      <DocList
        items={[
          "New — Candidate has been added to the project but not yet contacted",
          "Contacted — Initial outreach has been sent",
          "Screening — Candidate is being screened or evaluated",
          "Interview — Candidate is in the interview process",
          "Offer — An offer has been extended",
          "Hired — Candidate has accepted and been hired",
          "Rejected — Candidate has been disqualified or declined",
        ]}
      />

      <DocHeading id="updating">Updating status</DocHeading>
      <DocParagraph>
        Update a candidate's status from the project detail page by clicking the status
        dropdown in the candidate table, or from the candidate's profile drawer.
      </DocParagraph>

      <DocHeading id="bulk">Bulk actions</DocHeading>
      <DocParagraph>
        Select multiple candidates using the checkboxes in the candidate table, then use
        the bulk action bar to update status or remove candidates in one operation.
      </DocParagraph>

      <DocHeading id="filtering">Filtering by status</DocHeading>
      <DocParagraph>
        Use the pipeline summary at the top of the project detail page to filter candidates
        by status. Click on any status count to see only candidates in that stage.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Pipeline Management ── */
export function PipelineManagementPage() {
  return (
    <DocPage
      title="Pipeline Management"
      description="Learn how to manage your entire candidate pipeline from sourcing through hiring."
      slug="pipeline-management"
      toc={[
        { id: "overview", label: "Pipeline overview" },
        { id: "workflow", label: "Typical workflow" },
        { id: "metrics", label: "Pipeline metrics" },
      ]}
    >
      <DocHeading id="overview">Pipeline overview</DocHeading>
      <DocParagraph>
        Each project in Oslr has a visual pipeline summary showing how many candidates are
        in each stage. This gives you an at-a-glance view of your recruiting progress and
        helps identify bottlenecks.
      </DocParagraph>

      <DocHeading id="workflow">Typical workflow</DocHeading>
      <DocList
        items={[
          "1. Source candidates via AI search and save to project",
          "2. Review candidate profiles and update status to 'Contacted'",
          "3. Send outreach campaigns to candidates with email",
          "4. Move responsive candidates to 'Screening' and 'Interview'",
          "5. Extend offers and track acceptances",
          "6. Mark hired candidates and close the project",
        ]}
      />

      <DocHeading id="metrics">Pipeline metrics</DocHeading>
      <DocParagraph>
        The project detail page shows pipeline metrics including total candidates, breakdown
        by status, and campaign performance. Use these metrics to track your sourcing velocity
        and identify where candidates are dropping off.
      </DocParagraph>
    </DocPage>
  );
}
