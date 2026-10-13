/**
 * Browser-side paging of search results: with every kept row on the page,
 * Previous / Next must follow the local page count and never a server
 * flag. (2026-10-13: Next was disabled by the server's hasMore=false even
 * though 60 rows and 4 pages were present.)
 *
 * Rendered to static markup with react-dom/server so no extra test
 * dependency is needed; the disabled state is what the bug was about.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SearchResults, type Candidate } from "@/components/search/SearchResults";

const candidate = (i: number): Candidate => ({
  id: `p${i}`,
  full_name: `Surgeon ${i}`,
  title: "Orthopaedic Surgeon",
  current_employer: `Practice ${i}`,
  location: "Miami, Florida",
  linkedin_url: `https://linkedin.com/in/s${i}`,
  email: null,
  phone: null,
  skills: [],
  avg_tenure_months: null,
  industry: null,
  company_size: null,
  preview: false,
  has_email: false,
  has_phone: false,
  has_skills: false,
  has_experience: false,
  match_score: 80,
  profile_pic_url: null,
  inferred_salary: null,
  years_experience: 10,
  clinical_skills: [],
  has_contact_info: false,
  summary: null,
  raw: {},
});

const filters = {
  job_titles: [], locations: ["miami florida"], companies: [], keywords: [], experience_years: null,
  specialties: ["orthopedic surgery"], role_class: "surgeon", employment_model: "private_practice",
};
const all = Array.from({ length: 60 }, (_, i) => candidate(i + 1));

/** The pager's buttons as {label, disabled} in document order. */
function pagerButtons(html: string): Array<{ label: string; disabled: boolean }> {
  const out: Array<{ label: string; disabled: boolean }> = [];
  const re = /<button([^>]*)>([\s\S]*?)<\/button>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const label = m[2].replace(/<[^>]+>/g, "").trim();
    // The attribute itself — not Tailwind's "disabled:opacity-50" class prefix.
    if (/^(Previous|Next|\d+)$/.test(label)) out.push({ label, disabled: /(^|\s)disabled(=""|\s|$)/.test(m[1]) });
  }
  return out;
}

function renderPage(page: number, hasMore?: boolean): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
    <SearchResults
      query="orthopedic surgeons in Miami in private practice"
      candidates={all.slice((page - 1) * 15, page * 15)}
      total={60}
      browsableTotal={60}
      page={page}
      pageSize={15}
      hasMore={hasMore}
      selected={new Set()}
      filters={filters}
      onToggleSelect={() => {}}
      onToggleSelectAll={() => {}}
      onOpenCandidate={() => {}}
      onSaveBulk={() => {}}
      onPageChange={() => {}}
    />
    </QueryClientProvider>,
  );
}

describe("search results paging (browser-side)", () => {
  it("shows the kept count with no estimate and four pages for 60 rows", () => {
    const html = renderPage(1, false);
    expect(html).toContain("Showing 1–15 of 60");
    expect(html).not.toContain("matches)");
    expect(html).toContain("60 candidates");
    expect(pagerButtons(html).map((b) => b.label)).toEqual(["Previous", "1", "2", "3", "4", "Next"]);
  });

  it("Next is enabled on page 1 of 4 even when the server reports hasMore=false", () => {
    const buttons = pagerButtons(renderPage(1, false));
    expect(buttons.find((b) => b.label === "Next")?.disabled).toBe(false);
    expect(buttons.find((b) => b.label === "Previous")?.disabled).toBe(true);
  });

  it("Next is disabled on the last page and Previous enabled", () => {
    const buttons = pagerButtons(renderPage(4, false));
    expect(buttons.find((b) => b.label === "Next")?.disabled).toBe(true);
    expect(buttons.find((b) => b.label === "Previous")?.disabled).toBe(false);
  });
});
