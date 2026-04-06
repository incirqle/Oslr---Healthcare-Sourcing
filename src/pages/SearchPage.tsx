import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { SearchHero } from "@/components/search/SearchHero";
import { FilterReview, type ParsedFilters } from "@/components/search/FilterReview";
import { FilterEditor } from "@/components/search/FilterEditor";
import { SearchResults, type Candidate } from "@/components/search/SearchResults";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useProject, useAddCandidates, useProjectCandidates } from "@/hooks/useProjects";

type SearchStep = "hero" | "parsing" | "review" | "searching" | "results";

export default function SearchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data: project } = useProject(projectId ?? "");
  const { data: existingCandidates = [] } = useProjectCandidates(projectId ?? "");
  const addCandidates = useAddCandidates();

  const { history, addEntry, clearHistory } = useSearchHistory();
  const [step, setStep] = useState<SearchStep>("hero");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ParsedFilters>({
    job_titles: [], locations: [], companies: [], keywords: [], experience_years: null, specialties: [],
  });
  const [filterTotal, setFilterTotal] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);
  const [filterEditorOpen, setFilterEditorOpen] = useState(false);
  const [parsedPayload, setParsedPayload] = useState<Record<string, unknown> | null>(null);
  const [scrollToken, setScrollToken] = useState<string | null>(null);

  // Guard: must be in a project context (all hooks already called above)
  if (!projectId) {
    return null;
  }

  // Track which PDL IDs are already saved to this project
  const savedPdlIds = new Set(existingCandidates.map((c) => c.pdl_id).filter(Boolean));
  const savedIds = new Set(
    candidates.filter((c) => savedPdlIds.has(c.id)).map((c) => c.id)
  );

  const handleInitialSearch = async (q: string) => {
    setQuery(q);
    setStep("parsing");

    try {
      const { data, error } = await supabase.functions.invoke("pdl-search", {
        body: { query: q, preview: true },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Map new parsed payload to the existing ParsedFilters shape for FilterReview
      const parsed = data.parsed || {};
      const loc = parsed.location || {};
      const locations: string[] = [];
      if (loc.city && loc.state) locations.push(`${loc.city} ${loc.state}`);
      else if (loc.state) locations.push(loc.state);
      else if (loc.city) locations.push(loc.city);

      const mappedFilters: ParsedFilters = {
        job_titles: parsed.job_titles || [],
        locations,
        companies: parsed.current_companies || parsed.companies || [],
        keywords: parsed.required_keywords || parsed.keywords || [],
        experience_years: parsed.min_years_experience || null,
        specialties: parsed.specialties || (parsed.specialty ? [parsed.specialty] : []),
      };

      setFilters(mappedFilters);
      setFilterTotal(data.total || 0);
      setParsedPayload(parsed);
      setStep("review");
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Failed to parse search");
      setStep("hero");
    }
  };

  const handleRunSearch = async (searchPage = 1) => {
    setStep("searching");
    setSelected(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("pdl-search", {
        body: {
          query,
          filters: {
            job_titles: filters.job_titles,
            companies: filters.companies,
            keywords: filters.keywords,
            specialties: filters.specialties,
          },
          parsed: parsedPayload,
          page: searchPage - 1,
          size: pageSize,
          scroll_token: searchPage > 1 ? scrollToken : null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Map FormattedCandidate from new API to existing Candidate interface
      const mappedCandidates: Candidate[] = (data.results || []).map((r: any) => ({
        id: r.id,
        full_name: r.full_name || "",
        title: r.job_title || null,
        current_employer: r.job_company_name || null,
        location: [r.location_locality, r.location_region].filter(Boolean).join(", ") || null,
        linkedin_url: r.linkedin_url || null,
        email: r.email || r.emails?.[0] || null,
        phone: r.phone || r.phone_numbers?.[0] || null,
        skills: r.all_skills || r.skills || [],
        avg_tenure_months: null,
        industry: r.job_company_industry || r.industry || null,
        company_size: r.job_company_size || null,
        preview: false,
        has_email: !!(r.email || (r.emails?.length || 0) > 0),
        has_phone: !!(r.phone || (r.phone_numbers?.length || 0) > 0),
        has_skills: (r.skills?.length || 0) > 0,
        has_experience: (r.experience_history?.length || r.experience?.length || 0) > 0,
        match_score: 75,
        // V2 enriched fields
        profile_pic_url: r.profile_pic_url || null,
        inferred_salary: r.inferred_salary || null,
        years_experience: r.years_experience || r.inferred_years_experience || 0,
        clinical_skills: r.clinical_skills || [],
        has_contact_info: r.has_contact_info || false,
        summary: r.summary || r.headline || null,
        raw: r,
      }));

      setCandidates(mappedCandidates);
      setTotal(data.total || 0);
      setScrollToken(data.scroll_token || null);
      setPage(searchPage);
      setStep("results");

      if (mappedCandidates.length > 0) {
        toast.success(`Found ${(data.total || 0).toLocaleString()} matching professionals`);
      } else {
        toast.info("No results found. Try adjusting your filters.");
      }
      if (searchPage === 1) addEntry(query, data.total || 0);
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Search failed");
      setStep("review");
    }
  };

  const handleSaveCandidates = async (toSave: Candidate[]) => {
    if (toSave.length === 0) return;
    try {
      const count = await addCandidates.mutateAsync({
        projectId,
        candidates: toSave.map((c) => ({
          full_name: c.full_name,
          title: c.title,
          current_employer: c.current_employer,
          location: c.location,
          linkedin_url: c.linkedin_url,
          email: c.email,
          phone: c.phone,
          skills: c.skills,
          avg_tenure_months: c.avg_tenure_months,
          pdl_id: c.id,
        })),
      });
      toast.success(`${count} candidate${count === 1 ? "" : "s"} saved to "${project?.name}"`);
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to save candidates");
    }
  };

  const handlePageChange = (newPage: number) => {
    handleRunSearch(newPage);
  };

  const handleReset = () => {
    setStep("hero");
    setQuery("");
    setFilters({ job_titles: [], locations: [], companies: [], keywords: [], experience_years: null, specialties: [] });
    setCandidates([]);
    setTotal(0);
    setPage(1);
    setSelected(new Set());
    setScrollToken(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map((c) => c.id)));
  };

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Project context header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {project?.name ?? "Back to Project"}
          </button>
          {project && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-sm font-medium text-foreground">Source Candidates</span>
            </>
          )}
        </div>

        {step === "hero" && (
          <SearchHero onSearch={handleInitialSearch} loading={false} history={history} onClearHistory={clearHistory} />
        )}

        {step === "parsing" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Analyzing your search…</p>
            <p className="text-xs mt-1.5 opacity-60">Translating your query into search filters</p>
          </div>
        )}

        {step === "review" && (
          <FilterReview
            query={query}
            filters={filters}
            total={filterTotal}
            onEdit={() => setFilterEditorOpen(true)}
            onReset={handleReset}
            onRunSearch={handleRunSearch}
            loading={false}
          />
        )}

        {step === "searching" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Searching healthcare professionals…</p>
            <p className="text-xs mt-1.5 opacity-60">Running search with your filters</p>
          </div>
        )}

        {step === "results" && (
          <SearchResults
            candidates={candidates}
            total={total}
            selected={selected}
            savedIds={savedIds}
            projectName={project?.name}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onOpenCandidate={setDrawerCandidate}
            onSaveSingle={(c) => handleSaveCandidates([c])}
            onSaveBulk={() => handleSaveCandidates(selectedCandidates)}
            onEditFilters={() => setStep("review")}
            onNewSearch={handleReset}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            isSaving={addCandidates.isPending}
          />
        )}
      </div>

      <FilterEditor
        open={filterEditorOpen}
        onOpenChange={setFilterEditorOpen}
        filters={filters}
        onFiltersChange={setFilters}
        total={filterTotal}
      />

      <CandidateDrawer
        open={!!drawerCandidate}
        onOpenChange={(open) => !open && setDrawerCandidate(null)}
        candidate={drawerCandidate}
        projectId={projectId || ""}
      />
    </AppLayout>
  );
}
