import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { SearchHero } from "@/components/search/SearchHero";
import type { ParsedFilters } from "@/components/search/FilterReview";
import { FilterEditor } from "@/components/search/FilterEditor";
import { SearchResults, type Candidate } from "@/components/search/SearchResults";
import { AgentReasoningPanel } from "@/components/search/AgentReasoningPanel";
import type { ActiveFilter } from "@/components/search/ActiveFilterBar";
import { buildReasoningLines, classifyFilters } from "@/components/search/reasoning-script";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useProject, useAddCandidates, useProjectCandidates } from "@/hooks/useProjects";

type SearchStep = "hero" | "results";

const EMPTY_FILTERS: ParsedFilters = {
  job_titles: [],
  locations: [],
  companies: [],
  keywords: [],
  experience_years: null,
  specialties: [],
};

export default function SearchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoRanRef = useRef(false);

  const { data: project } = useProject(projectId ?? "");
  const { data: existingCandidates = [] } = useProjectCandidates(projectId ?? "");
  const addCandidates = useAddCandidates();

  const { history, addEntry, clearHistory } = useSearchHistory();
  const [step, setStep] = useState<SearchStep>("hero");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ParsedFilters>(EMPTY_FILTERS);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);
  const [filterEditorOpen, setFilterEditorOpen] = useState(false);
  const [parsedPayload, setParsedPayload] = useState<Record<string, unknown> | null>(null);
  const [scrollToken, setScrollToken] = useState<string | null>(null);
  const [geoScope, setGeoScope] = useState<Record<string, unknown> | null>(null);
  const [companyScope, setCompanyScope] = useState<Record<string, unknown> | null>(null);
  const [specialtyFunnel, setSpecialtyFunnel] = useState<Record<string, unknown> | null>(null);
  const [searchPhase, setSearchPhase] = useState<"idle" | "running" | "done" | "error">("idle");

  // Auto-run a search if ?q= is present (e.g. coming from onboarding step 5)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoRanRef.current && projectId) {
      autoRanRef.current = true;
      runFullSearch(q);
      const next = new URLSearchParams(searchParams);
      next.delete("q");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (!projectId) return null;

  const savedPdlIds = new Set(existingCandidates.map((c) => c.pdl_id).filter(Boolean));
  const savedIds = new Set(candidates.filter((c) => savedPdlIds.has(c.id)).map((c) => c.id));

  /**
   * Single-shot: parse + run search in one go. Navigates to results step
   * immediately so the reasoning panel and skeletons are visible while
   * the request is in flight.
   */
  const runFullSearch = async (q: string, overrideFilters?: ParsedFilters) => {
    setQuery(q);
    setStep("results");
    setSearchPhase("running");
    setSelected(new Set());
    setCandidates([]);
    setRevealedCount(0);
    setTotal(0);
    setPage(1);
    setScrollToken(null);
    setGeoScope(null);

    try {
      // Step 1: parse (preview) to get filter interpretation
      const { data: previewData, error: previewError } = await supabase.functions.invoke("pdl-search", {
        body: { query: q, preview: true },
      });
      if (previewError) throw previewError;
      if (previewData?.error) throw new Error(previewData.error);

      const parsed = previewData.parsed || {};
      const loc = parsed.location || {};
      const locations: string[] = [];
      if (loc.city && loc.state) locations.push(`${loc.city} ${loc.state}`);
      else if (loc.state) locations.push(loc.state);
      else if (loc.city) locations.push(loc.city);

      const mappedFilters: ParsedFilters = overrideFilters ?? {
        job_titles: parsed.job_titles || [],
        locations,
        companies: parsed.current_companies || parsed.companies || [],
        keywords: parsed.required_keywords || parsed.keywords || [],
        experience_years: parsed.min_years_experience || null,
        specialties: parsed.specialties || (parsed.specialty ? [parsed.specialty] : []),
      };

      setFilters(mappedFilters);
      setParsedPayload(parsed);

      // Step 2: full search
      await runResultsFetch(q, mappedFilters, parsed, 1, null);
    } catch (err: unknown) {
      console.error("Search error:", err);
      const msg = err instanceof Error ? err.message : "Search failed";
      toast.error(msg);
      setSearchPhase("error");
    }
  };

  const runResultsFetch = async (
    q: string,
    f: ParsedFilters,
    parsed: Record<string, unknown> | null,
    targetPage: number,
    token: string | null,
  ) => {
    const { data, error } = await supabase.functions.invoke("pdl-search", {
      body: {
        query: q,
        filters: {
          job_titles: f.job_titles,
          companies: f.companies,
          keywords: f.keywords,
          specialties: f.specialties,
        },
        parsed,
        page: targetPage - 1,
        size: pageSize,
        scroll_token: targetPage > 1 ? token : null,
      },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    const mapped: Candidate[] = (data.results || []).map((r: Record<string, any>) => ({
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
      match_score: r.relevance_score ?? 75,
      profile_pic_url: r.profile_pic_url || null,
      inferred_salary: null,
      years_experience: r.years_experience || r.inferred_years_experience || 0,
      clinical_skills: r.clinical_skills || [],
      has_contact_info: r.has_contact_info || false,
      summary: r.summary || r.headline || null,
      raw: r,
    }));

    setCandidates(mapped);
    setTotal(data.total || 0);
    setScrollToken(data.scroll_token || null);
    setGeoScope(data.geo_scope || null);
    setCompanyScope(data.company_scope || null);
    setPage(targetPage);
    setSearchPhase("done");
    if (targetPage === 1) addEntry(q, data.total || 0);

    // Progressive reveal only on the first page of a new search. Pagination
    // jumps should feel instant — no drip, no unmount/remount of the list.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (targetPage > 1 || reduce || mapped.length === 0) {
      setRevealedCount(mapped.length);
    } else {
      setRevealedCount(0);
      const stepMs = Math.max(60, Math.min(150, 1500 / Math.max(mapped.length, 1)));
      mapped.forEach((_, i) => {
        setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), 400 + i * stepMs);
      });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save candidates";
      toast.error(msg);
    }
  };

  const handlePageChange = (newPage: number) => {
    setSearchPhase("running");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    runResultsFetch(query, filters, parsedPayload, newPage, scrollToken).catch((err) => {
      console.error(err);
      setSearchPhase("error");
      toast.error(err instanceof Error ? err.message : "Search failed");
    });
  };

  const handleReset = () => {
    setStep("hero");
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setCandidates([]);
    setRevealedCount(0);
    setTotal(0);
    setPage(1);
    setSelected(new Set());
    setScrollToken(null);
    setGeoScope(null);
    setCompanyScope(null);
    setSearchPhase("idle");
  };

  const handleEditQuery = () => {
    // Cancel current view and return to hero with the query pre-filled by being remembered.
    setStep("hero");
    setSearchPhase("idle");
  };


  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const visible = candidates.slice(0, revealedCount).filter((c) => !savedIds.has(c.id)).map((c) => c.id);
    const allSelected = visible.length > 0 && visible.every((id) => selected.has(id));
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible));
  };

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  // Derive UI bits from current state
  const reasoningLines = buildReasoningLines({
    rawQuery: query,
    filters,
    parsed: parsedPayload,
    total,
    shownCount: candidates.length,
    geoExpanded: !!geoScope?.geo_expanded,
    errored: searchPhase === "error",
    searchComplete: searchPhase === "done",
  });
  const activeFilters: ActiveFilter[] = classifyFilters(query, filters);

  // Compact filter summary for the condensed reasoning line.
  // Show first 3 labels, then "+N more" if there are extras.
  const buildFilterSummary = (filters: ActiveFilter[]): string => {
    if (filters.length === 0) return "";
    const labels = filters.map((f) => f.label);
    if (labels.length <= 3) return labels.join(", ");
    return `${labels.slice(0, 3).join(", ")} +${labels.length - 3} more`;
  };

  // Visible candidates list — drip in during streaming
  const visibleCandidates = candidates.slice(0, revealedCount);
  const skeletonCount = searchPhase === "running" ? Math.max(0, 10 - revealedCount) : 0;

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
          <SearchHero
            onSearch={runFullSearch}
            loading={false}
            history={history}
            onClearHistory={clearHistory}
          />
        )}

        {step === "results" && (
          <div className="space-y-5">
            <AgentReasoningPanel
              query={query}
              lines={reasoningLines}
              streaming={searchPhase === "running"}
              onEditQuery={handleEditQuery}
              errored={searchPhase === "error"}
              done={searchPhase === "done"}
              totalCount={total}
              filterSummary={buildFilterSummary(activeFilters)}
              onRefine={() => setFilterEditorOpen(true)}
            />


            {/* Animated dot-network loader while results stream in */}
            {skeletonCount > 0 && <SearchNetworkLoader />}

            {visibleCandidates.length > 0 && (
              <SearchResults
                query={query}
                candidates={visibleCandidates}
                total={total}
                selected={selected}
                savedIds={savedIds}
                projectName={project?.name}
                filters={filters}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                onClearSelection={() => setSelected(new Set())}
                onOpenCandidate={setDrawerCandidate}
                onSaveBulk={() => handleSaveCandidates(selectedCandidates)}
                onAddToCampaignBulk={() => toast.info("Campaign builder integration coming soon")}
                onEditFilters={() => setFilterEditorOpen(true)}
                onNewSearch={handleReset}
                onSubmitQuery={runFullSearch}
                page={page}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                isSaving={addCandidates.isPending}
                isLoading={searchPhase === "running"}
                geoScope={geoScope as any}
                companyScope={companyScope as any}
              />
            )}

            {/* Zero-result helper after stream completes */}
            {searchPhase === "done" && total === 0 && (
              <div className="rounded-xl border border-border/50 bg-card/40 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No matches. Open{" "}
                  <button
                    onClick={() => setFilterEditorOpen(true)}
                    className="font-medium text-primary hover:underline"
                  >
                    Refine
                  </button>{" "}
                  to loosen your filters.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <FilterEditor
        open={filterEditorOpen}
        onOpenChange={setFilterEditorOpen}
        filters={filters}
        onFiltersChange={(next) => {
          setFilters(next);
          // re-run on change
          setSearchPhase("running");
          setCandidates([]);
          setRevealedCount(0);
          runResultsFetch(query, next, parsedPayload, 1, null).catch((err) => {
            console.error(err);
            setSearchPhase("error");
            toast.error(err instanceof Error ? err.message : "Search failed");
          });
        }}
        total={total}
      />

      <CandidateDrawer
        open={!!drawerCandidate}
        onOpenChange={(open) => !open && setDrawerCandidate(null)}
        candidate={drawerCandidate}
        projectId={projectId}
        isSaved={drawerCandidate ? savedIds.has(drawerCandidate.id) : false}
        isSavingCandidate={addCandidates.isPending}
        onSaveCandidate={drawerCandidate ? () => handleSaveCandidates([drawerCandidate]) : undefined}
        filters={filters}
        onPrev={() => {
          if (!drawerCandidate) return;
          const idx = visibleCandidates.findIndex((c) => c.id === drawerCandidate.id);
          if (idx > 0) setDrawerCandidate(visibleCandidates[idx - 1]);
        }}
        onNext={() => {
          if (!drawerCandidate) return;
          const idx = visibleCandidates.findIndex((c) => c.id === drawerCandidate.id);
          if (idx >= 0 && idx < visibleCandidates.length - 1) {
            setDrawerCandidate(visibleCandidates[idx + 1]);
          }
        }}
        hasPrev={!!drawerCandidate && visibleCandidates.findIndex((c) => c.id === drawerCandidate.id) > 0}
        hasNext={
          !!drawerCandidate &&
          visibleCandidates.findIndex((c) => c.id === drawerCandidate.id) < visibleCandidates.length - 1
        }
      />
    </AppLayout>
  );
}
