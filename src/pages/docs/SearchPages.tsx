import { DocPage, DocHeading, DocH3, DocParagraph, DocList, DocTip } from "@/components/docs/DocPrimitives";

/* ── Search ── */
export function SearchPage() {
  return (
    <DocPage
      title="Search"
      description="Learn how to use Oslr's AI-powered search to find healthcare professionals using natural language or structured filters."
      slug="search"
      toc={[
        { id: "overview", label: "How search works" },
        { id: "nl-search", label: "Natural language search" },
        { id: "structured", label: "Structured filters" },
        { id: "results", label: "Understanding results" },
        { id: "saving", label: "Saving candidates" },
      ]}
    >
      <DocHeading id="overview">How search works</DocHeading>
      <DocParagraph>
        Oslr's search is powered by real-time data aggregated from over 30 sources including
        LinkedIn, NPI registries, state licensing boards, and professional associations. When
        you search, Oslr queries across 1.5 billion+ professional profiles to find the best
        matches for your criteria.
      </DocParagraph>

      <DocHeading id="nl-search">Natural language search</DocHeading>
      <DocParagraph>
        Just type what you're looking for in plain English. For example:
      </DocParagraph>
      <DocList
        items={[
          '"General surgeons in Miami"',
          '"ICU nurses in Dallas with CCRN certification"',
          '"Orthopedic surgeons completing fellowship in California"',
          '"CRNAs in Houston with 5+ years experience"',
        ]}
      />
      <DocParagraph>
        Oslr's AI automatically translates your query into structured search filters — extracting
        job titles, locations, specialties, certifications, and experience requirements.
      </DocParagraph>

      <DocHeading id="structured">Structured filters</DocHeading>
      <DocParagraph>
        After the AI parses your query, you'll see the extracted filters in a review panel. You
        can edit, add, or remove filters before running the search. Available filter types include:
      </DocParagraph>
      <DocList
        items={[
          "Job title — Current or past role",
          "Location — City, state, or region",
          "Company — Current or past employer",
          "Skills — Technical skills and certifications",
          "Industry — Healthcare sub-sectors",
          "Education — Degree, school, or program",
          "Experience — Years of experience range",
        ]}
      />

      <DocHeading id="results">Understanding results</DocHeading>
      <DocParagraph>
        Search results are displayed in a table with key candidate information including name,
        title, current employer, location, and a match score. The match score indicates how
        well the candidate matches your search criteria based on title relevance, location
        proximity, and data completeness.
      </DocParagraph>

      <DocHeading id="saving">Saving candidates</DocHeading>
      <DocParagraph>
        Select candidates from your search results and save them to a project. You can save
        individual candidates or bulk-select multiple candidates at once. Saved candidates
        appear in your project's candidate pipeline with their full enriched profile data.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Filters vs Natural Language ── */
export function FiltersVsNLPage() {
  return (
    <DocPage
      title="Filters vs Natural Language"
      description="Understand the difference between typing a natural language query and using structured filters — and when to use each."
      slug="filters-vs-natural-language"
      toc={[
        { id: "nl", label: "Natural language" },
        { id: "filters", label: "Structured filters" },
        { id: "when", label: "When to use which" },
        { id: "combining", label: "Combining both" },
      ]}
    >
      <DocHeading id="nl">Natural language</DocHeading>
      <DocParagraph>
        Natural language search lets you describe who you're looking for the way you'd tell
        a colleague. Oslr's AI parses your intent and converts it into precise search parameters.
        This is the fastest way to get started with a new search.
      </DocParagraph>

      <DocHeading id="filters">Structured filters</DocHeading>
      <DocParagraph>
        Structured filters give you precise control over every search parameter. After the AI
        parses your natural language query, you can fine-tune the extracted filters — adjusting
        locations, adding skills, or changing experience ranges.
      </DocParagraph>

      <DocHeading id="when">When to use which</DocHeading>
      <DocList
        items={[
          "Use natural language for quick, exploratory searches when you want to cast a wide net",
          "Use structured filters when you have very specific requirements and want granular control",
          "Start with natural language and refine with filters for the best of both worlds",
        ]}
      />

      <DocHeading id="combining">Combining both</DocHeading>
      <DocParagraph>
        The most effective workflow is to start with a natural language query, review the
        AI-generated filters, make adjustments, and then run the search. This gives you the
        speed of AI with the precision of manual filtering.
      </DocParagraph>
    </DocPage>
  );
}

/* ── AI Filters ── */
export function AIFiltersPage() {
  return (
    <DocPage
      title="AI Filters"
      description="Oslr's AI automatically extracts structured search parameters from your natural language queries. Learn how it works."
      slug="ai-filters"
      toc={[
        { id: "how", label: "How AI filters work" },
        { id: "supported", label: "Supported filter types" },
        { id: "editing", label: "Editing AI filters" },
        { id: "accuracy", label: "Improving accuracy" },
      ]}
    >
      <DocHeading id="how">How AI filters work</DocHeading>
      <DocParagraph>
        When you type a natural language query like "Cardiologists in Florida with board certification,"
        Oslr's AI model analyzes your text and extracts structured parameters: job title = "Cardiologist",
        location = "Florida", and skills = "Board Certified."
      </DocParagraph>
      <DocParagraph>
        The AI understands healthcare-specific terminology, including medical specialties,
        certifications (CCRN, ACLS, BLS), training stages (residency, fellowship), and
        organizational types (health systems, private practice, academic medical centers).
      </DocParagraph>

      <DocHeading id="supported">Supported filter types</DocHeading>
      <DocList
        items={[
          "Job titles and roles",
          "Geographic locations (city, state, region)",
          "Medical specialties and sub-specialties",
          "Certifications and licenses",
          "Current and past employers",
          "Education and training programs",
          "Years of experience",
          "Skills and competencies",
        ]}
      />

      <DocHeading id="editing">Editing AI filters</DocHeading>
      <DocParagraph>
        After the AI parses your query, you'll see the extracted filters in a review panel.
        Each filter can be edited, removed, or you can add new filters manually. The filter
        editor supports autocomplete suggestions for common healthcare titles and locations.
      </DocParagraph>

      <DocHeading id="accuracy">Improving accuracy</DocHeading>
      <DocTip>
        For the best results, be specific in your queries. Instead of "doctors in Texas,"
        try "Internal medicine physicians in Houston, TX with 5+ years of experience."
        The more context you provide, the better the AI can extract precise filters.
      </DocTip>
    </DocPage>
  );
}

/* ── Search Criteria ── */
export function SearchCriteriaPage() {
  return (
    <DocPage
      title="Search Criteria"
      description="Deep dive into the search criteria and filter options available when building a candidate search."
      slug="search-criteria"
      toc={[
        { id: "title", label: "Job title filters" },
        { id: "location", label: "Location filters" },
        { id: "company", label: "Company filters" },
        { id: "skills", label: "Skills & certifications" },
        { id: "experience", label: "Experience" },
      ]}
    >
      <DocHeading id="title">Job title filters</DocHeading>
      <DocParagraph>
        Filter by exact job titles or use broader role categories. The job title filter searches
        across current and past positions, so you'll find candidates who have held the relevant
        role at any point in their career.
      </DocParagraph>

      <DocHeading id="location">Location filters</DocHeading>
      <DocParagraph>
        Search by city, metropolitan area, state, or region. Oslr understands common location
        aliases — for example, "NYC" maps to "New York, NY" and "Bay Area" covers the
        San Francisco metropolitan region.
      </DocParagraph>

      <DocHeading id="company">Company filters</DocHeading>
      <DocParagraph>
        Filter by current employer, past employer, or exclude specific companies. This is
        useful for targeting candidates at competitor health systems or excluding your own
        organization from results.
      </DocParagraph>

      <DocHeading id="skills">Skills & certifications</DocHeading>
      <DocParagraph>
        Search for specific clinical certifications (CCRN, ACLS, BLS, board certifications),
        technical skills (EHR systems, specific procedures), and competencies. Skills are
        extracted from candidate profiles and matched against your criteria.
      </DocParagraph>

      <DocHeading id="experience">Experience</DocHeading>
      <DocParagraph>
        Set minimum and maximum years of experience to find candidates at the right career
        stage. You can also filter by average tenure to identify candidates who tend to stay
        in roles longer.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Candidate Insights ── */
export function CandidateInsightsPage() {
  return (
    <DocPage
      title="Candidate Insights"
      description="Understand the data points available for each candidate and how to use them for better recruiting decisions."
      slug="candidate-insights"
      toc={[
        { id: "data-points", label: "Available data points" },
        { id: "match-score", label: "Match score" },
        { id: "tenure", label: "Average tenure" },
        { id: "enrichment", label: "Contact enrichment" },
      ]}
    >
      <DocHeading id="data-points">Available data points</DocHeading>
      <DocParagraph>
        For each candidate in your search results, Oslr provides a comprehensive profile including:
      </DocParagraph>
      <DocList
        items={[
          "Full name and professional headline",
          "Current title and employer",
          "Location (city, state)",
          "Work history with dates",
          "Education and training",
          "Skills and certifications",
          "LinkedIn profile URL",
          "Verified email and phone (when available)",
        ]}
      />

      <DocHeading id="match-score">Match score</DocHeading>
      <DocParagraph>
        Every candidate receives a match score from 0-100 based on how well they match your
        search criteria. The score considers title relevance, location proximity, skill overlap,
        and overall profile completeness. Higher scores indicate stronger matches.
      </DocParagraph>

      <DocHeading id="tenure">Average tenure</DocHeading>
      <DocParagraph>
        Oslr calculates average tenure across a candidate's work history. This metric helps
        you identify candidates who are likely to be stable, long-term hires versus those
        who change roles frequently.
      </DocParagraph>

      <DocHeading id="enrichment">Contact enrichment</DocHeading>
      <DocParagraph>
        When you save a candidate to a project, their contact information is enriched with
        verified emails and phone numbers. Enrichment data is sourced from multiple providers
        to ensure accuracy.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Candidate Profiles ── */
export function CandidateProfilesPage() {
  return (
    <DocPage
      title="Candidate Profiles"
      description="Learn how to view and interact with detailed candidate profile information."
      slug="candidate-profiles"
      toc={[
        { id: "overview", label: "Profile overview" },
        { id: "details", label: "Profile details" },
        { id: "actions", label: "Profile actions" },
        { id: "raw-data", label: "Raw data" },
      ]}
    >
      <DocHeading id="overview">Profile overview</DocHeading>
      <DocParagraph>
        Click on any candidate in a search result or project to open their detailed profile
        in a side drawer. The profile provides a complete view of the candidate's professional
        background and contact information.
      </DocParagraph>

      <DocHeading id="details">Profile details</DocHeading>
      <DocParagraph>
        The profile drawer displays the candidate's full name, current title, employer, location,
        LinkedIn URL, email address, phone number, skills, and tags. If available, you'll also
        see their work history, education details, and average tenure.
      </DocParagraph>

      <DocHeading id="actions">Profile actions</DocHeading>
      <DocList
        items={[
          "Update candidate status (New, Contacted, Screening, Interview, Offer, Hired, Rejected)",
          "Add notes for your team",
          "Copy email or phone to clipboard",
          "Open LinkedIn profile in a new tab",
          "Add or edit tags for categorization",
        ]}
      />

      <DocHeading id="raw-data">Raw data</DocHeading>
      <DocParagraph>
        For advanced users, you can view the raw enrichment data for any candidate. This
        includes the complete data payload from the enrichment provider, which may contain
        additional data points not surfaced in the standard profile view.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Sharing Searches ── */
export function SharingSearchesPage() {
  return (
    <DocPage
      title="Sharing Searches"
      description="Share your searches with team members so they can view results and collaborate on sourcing."
      slug="sharing-searches"
      toc={[
        { id: "how", label: "How sharing works" },
        { id: "permissions", label: "Permissions" },
      ]}
    >
      <DocHeading id="how">How sharing works</DocHeading>
      <DocParagraph>
        All searches conducted within a project are automatically visible to all team members
        who have access to that project. When you run a search and save candidates, your
        team members can see the search history and the saved results.
      </DocParagraph>
      <DocParagraph>
        Search history is stored at the organization level, so team members can learn from
        each other's search strategies and avoid duplicating effort.
      </DocParagraph>

      <DocHeading id="permissions">Permissions</DocHeading>
      <DocParagraph>
        Team members with the Recruiter or Admin role can run new searches and save candidates.
        Viewers can see search results and candidate profiles but cannot initiate new searches
        or modify candidate data.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Search Library ── */
export function SearchLibraryPage() {
  return (
    <DocPage
      title="Search Library"
      description="Access your search history and re-run previous searches with one click."
      slug="search-library"
      toc={[
        { id: "history", label: "Search history" },
        { id: "rerun", label: "Re-running searches" },
        { id: "clearing", label: "Clearing history" },
      ]}
    >
      <DocHeading id="history">Search history</DocHeading>
      <DocParagraph>
        Every search you run is saved to your search history. You can see your recent searches
        on the search page, including the query text, number of results, and when it was run.
        Search history is scoped to your organization.
      </DocParagraph>

      <DocHeading id="rerun">Re-running searches</DocHeading>
      <DocParagraph>
        Click on any previous search to instantly re-run it with the same parameters. This is
        useful for recurring sourcing needs — for example, running a weekly search for new
        candidates matching your criteria.
      </DocParagraph>

      <DocHeading id="clearing">Clearing history</DocHeading>
      <DocParagraph>
        You can clear your search history from the search page. Note that clearing history
        does not affect any candidates that were saved to projects from those searches.
      </DocParagraph>
    </DocPage>
  );
}

/* ── Tips & Tricks ── */
export function TipsTricksPage() {
  return (
    <DocPage
      title="Tips & Tricks"
      description="Pro tips for getting the most out of Oslr's search capabilities."
      slug="tips-tricks"
      toc={[
        { id: "specific", label: "Be specific" },
        { id: "iterate", label: "Iterate quickly" },
        { id: "combine", label: "Combine approaches" },
        { id: "healthcare", label: "Healthcare-specific tips" },
      ]}
    >
      <DocHeading id="specific">Be specific</DocHeading>
      <DocParagraph>
        The more specific your query, the better your results. Instead of "nurses in Texas,"
        try "ICU nurses in Houston, TX with CCRN certification and 3+ years experience."
      </DocParagraph>

      <DocHeading id="iterate">Iterate quickly</DocHeading>
      <DocParagraph>
        Don't spend too long crafting the perfect query. Run a quick search, review the results,
        adjust your filters, and search again. Oslr is designed for rapid iteration.
      </DocParagraph>

      <DocHeading id="combine">Combine approaches</DocHeading>
      <DocParagraph>
        Start with natural language to get a baseline, then switch to structured filters to
        fine-tune. You can edit individual filters without re-typing your entire query.
      </DocParagraph>

      <DocHeading id="healthcare">Healthcare-specific tips</DocHeading>
      <DocList
        items={[
          "Use standard medical specialty names (e.g., 'Orthopedic Surgery' not 'Ortho')",
          "Include certification acronyms (CCRN, ACLS, BLS, CNOR) for more precise results",
          "Search by training stage — 'completing fellowship' or 'PGY-3' work as natural language inputs",
          "Use health system names to target candidates at specific organizations",
          "Try location-based searches like 'within 50 miles of Nashville' for regional sourcing",
        ]}
      />
    </DocPage>
  );
}
