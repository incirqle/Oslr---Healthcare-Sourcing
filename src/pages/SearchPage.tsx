import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { SearchHero } from "@/components/search/SearchHero";
import type { ParsedFilters } from "@/components/search/FilterReview";
import { FilterEditor } from "@/components/search/FilterEditor";
import { SearchResults, type Candidate, type CandidateCriterionResult } from "@/components/search/SearchResults";
import { SetAsideTab } from "@/components/search/SetAsideTab";
import { QueryReadback, type FilterField } from "@/components/search/QueryReadback";
import { CriteriaPanel } from "@/components/search/CriteriaPanel";
import type { ResultsView } from "@/components/search/SearchResults";
import type { TableSort } from "@/components/search/ResultsTable";
import { mergeRanking, recomputeRanking, sortByCriterion, type RankingCriterion, type RequiredCriterion } from "@/lib/ranking";
import { cn } from "@/lib/utils";
import { AgentReasoningPanel } from "@/components/search/AgentReasoningPanel";
import { SearchNetworkLoader } from "@/components/search/SearchNetworkLoader";
import type { ActiveFilter } from "@/components/search/ActiveFilterBar";
import { buildReasoningLines, classifyFilters } from "@/components/search/reasoning-script";
import { dropSpecialtyEchoes, locationLabelsFromParsed } from "@/components/search/filter-utils";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useProject, useProjects, useAddCandidates, useProjectCandidates, useCreateProject } from "@/hooks/useProjects";
import { invokeSearchPeople, fetchSearchUsage, pingEngagement, SearchLimitError, type SearchUsage } from "@/lib/search-meter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SaveToProjectDialog } from "@/components/SaveToProjectDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const NO_PROJECT = "__none__";
const NEW_PROJECT = "__new__";

type SearchStep = "hero" | "results";

const VIEW_KEY = "oslr.results.view";
function readView(): ResultsView {
  try { return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "table"; } catch { return "table"; }
}

/** Healthcare suggestions for the Criteria panel, keyed off the parse. */
function suggestionsFor(roleClass: string | null | undefined, specialties: string[]): string[] {
  const rc = (roleClass ?? "").toLowerCase();
  if (/nurse|rn|np|crna/.test(rc)) {
    return ["BSN or higher", "Charge nurse experience", "Magnet hospital experience", "3+ years in the current specialty", "Travel or per diem experience"];
  }
  const base = ["Fellowship trained", "Board certified", "5+ years in practice", "Private practice", "Academic medical center experience", "Leadership role such as chief or director"];
  if (specialties.some((x) => /ortho|joint|arthro/i.test(x))) {
    return ["Revision arthroplasty", "Outpatient or ASC total joints", "Direct anterior hip approach", "Accepting call at a Level II trauma center", ...base];
  }
  return base;
}

/**
 * The engine build this UI was written against. Lovable rebuilds the UI on
 * every push but redeploys an edge function only when asked, so the two can
 * drift (2026-10-13: a v4 UI ran a v3 engine and every number on the page
 * was wrong). When the response names a different build, say so.
 */
const EXPECTED_ENGINE_VERSION = "crustdata_clin_v4";

const EMPTY_FILTERS: ParsedFilters = {
  job_titles: [],
  locations: [],
  companies: [],
  keywords: [],
  experience_years: null,
  specialties: [],
  role_class: null,
  employment_model: null,
};

export default function SearchPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const autoRanRef = useRef(false);

  const { data: project } = useProject(projectId ?? "");
  const { data: existingCandidates = [] } = useProjectCandidates(projectId ?? "");
  const { data: allProjects = [] } = useProjects();
  const addCandidates = useAddCandidates();
  const createProject = useCreateProject();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const handleCreateProject = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const id = await createProject.mutateAsync({ name });
      setNewOpen(false);
      toast.success(`Project "${name}" created. Saves now go there.`);
      navigate(`/projects/${id}/search`, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create project");
    }
  };
  const [pendingSave, setPendingSave] = useState<{
    candidates: Candidate[];
    contact?: { email: string | null; phone: string | null };
  } | null>(null);

  const { history, addEntry, clearHistory } = useSearchHistory(projectId);
  const [step, setStep] = useState<SearchStep>("hero");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ParsedFilters>(EMPTY_FILTERS);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [totalIsEstimate, setTotalIsEstimate] = useState(false);
  const [engineVersion, setEngineVersion] = useState<string | null>(null);
  const [filteredBreakdown, setFilteredBreakdown] = useState<Record<string, number> | null>(null);
  const [browsableTotal, setBrowsableTotal] = useState(0);
  const [hiddenCandidates, setHiddenCandidates] = useState<Candidate[]>([]);
  const [resultsTab, setResultsTab] = useState<"results" | "set_aside">("results");
  // Ranked criteria (docs/oslr-criteria-ranking-spec.md 3.3, 6.1, 9).
  const [ranking, setRankingState] = useState<RankingCriterion[]>([]);
  const rankingRef = useRef<RankingCriterion[]>([]);
  const removedRef = useRef<Set<string>>(new Set());
  const setRanking = (next: RankingCriterion[]) => {
    const nextIds = new Set(next.map((c) => c.id));
    for (const c of rankingRef.current) if (!nextIds.has(c.id)) removedRef.current.add(c.id);
    rankingRef.current = next;
    setRankingState(next);
  };
  const [requiredCriteria, setRequiredCriteria] = useState<RequiredCriterion[]>([]);
  const [cantCheck, setCantCheck] = useState<{ id: string; label: string }[]>([]);
  const [criteriaOpen, setCriteriaOpen] = useState(false);
  const [filterFocus, setFilterFocus] = useState<FilterField | null>(null);
  const [view, setViewState] = useState<ResultsView>(readView);
  const setView = (v: ResultsView) => {
    setViewState(v);
    try { window.localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
  };
  const [tableSort, setTableSort] = useState<TableSort>(null);
  const ranked = useMemo(() => recomputeRanking(candidates, hiddenCandidates, ranking), [candidates, hiddenCandidates, ranking]);
  const displayRows = useMemo(() => {
    if (view !== "table" || !tableSort) return ranked.kept;
    if (tableSort.key === "criterion") return sortByCriterion(ranked.kept, tableSort.id);
    return tableSort.dir === "desc" ? ranked.kept : [...ranked.kept].reverse();
  }, [ranked, view, tableSort]);
  const keptCount = ranked.kept.length;
  const setAsideRows = ranked.setAside;
  const restoreCandidate = (c: Candidate) => {
    if (candidates.some((x) => x.id === c.id)) {
      // Set aside here for a must-have: keep it in results for this session.
      setCandidates((prev) => prev.map((x) => (x.id === c.id ? { ...x, restored: true } : x)));
      return;
    }
    setHiddenCandidates((prev) => prev.filter((x) => x.id !== c.id));
    setCandidates((prev) => [...prev, { ...c, restored: true }]);
    setTotal((t) => t + 1);
    setBrowsableTotal((b) => b + 1);
    setRevealedCount((n) => n + 1);
  };
  const describeSetAside = (b: Record<string, number> | null, n: number): string => {
    if (!b) return `${n} ${n === 1 ? "profile" : "profiles"} the search pulled ${n === 1 ? "was" : "were"} set aside.`;
    const parts: string[] = [];
    if (b.role_class_noise) parts.push(`${b.role_class_noise} not in the asked role (therapists, PAs, recruiters, vendors)`);
    if (b.employment_model) parts.push(`${b.employment_model} with the wrong employer type`);
    if (b.military_reserve) parts.push(`${b.military_reserve} Guard or Reserve with a civilian primary employer`);
    if (b.thin_profile) parts.push(`${b.thin_profile} thin ${b.thin_profile === 1 ? "profile" : "profiles"} with no location, history or summary`);
    if (b.duplicates) parts.push(`${b.duplicates} duplicate ${b.duplicates === 1 ? "profile" : "profiles"}`);
    if (b.must_have) parts.push(`${b.must_have} with a No on a must-have`);
    if (b.grader) parts.push(`${b.grader} judged a poor fit on reading the profile`);
    return `${n} ${n === 1 ? "profile" : "profiles"} the search pulled ${n === 1 ? "was" : "were"} set aside: ${parts.join(", ")}.`;
  };
  const [hasMore, setHasMore] = useState(false);
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
  const [usage, setUsage] = useState<SearchUsage | null>(null);
  const burstRetryRef = useRef(0);

  useEffect(() => { fetchSearchUsage().then((u) => u && setUsage(u)); }, []);
  useEffect(() => { if (drawerCandidate) pingEngagement(); }, [drawerCandidate?.id]);

  // Auto-run a search if ?q= is present (e.g. coming from onboarding step 5)
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && !autoRanRef.current) {
      autoRanRef.current = true;
      runFullSearch(q);
      const next = new URLSearchParams(searchParams);
      next.delete("q");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // A person counts as saved when their provider id OR their LinkedIn URL is
  // already in the project — LinkedIn matching keeps candidates saved under
  // the old data provider recognized by the new one.
  const normLinkedin = (url?: string | null) =>
    (url ?? "").toLowerCase().replace(/\/+$/, "").replace(/^https?:\/\/(www\.)?/, "");
  const savedPersonIds = new Set(existingCandidates.map((c) => c.person_id).filter(Boolean));
  const savedLinkedin = new Set(
    existingCandidates.map((c) => normLinkedin(c.linkedin_url)).filter(Boolean),
  );
  const savedIds = new Set(
    candidates
      .filter((c) =>
        savedPersonIds.has(c.id) ||
        (!!c.linkedin_url && savedLinkedin.has(normLinkedin(c.linkedin_url)))
      )
      .map((c) => c.id),
  );

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
    setFilteredBreakdown(null);
    setBrowsableTotal(0);
    setHiddenCandidates([]);
    setHasMore(false);
    setPage(1);
    setScrollToken(null);
    setGeoScope(null);
    setTableSort(null);
    removedRef.current = new Set();
    setRanking([]);

    try {
      // ONE request. The engine parses the sentence and returns the parse
      // with the results; the filter chips are derived from that. A separate
      // preview round trip used to add a parser call (~4 s) before the
      // search even started (2026-10-13).
      await runResultsFetch(q, overrideFilters ?? null, null, 1, null);
      burstRetryRef.current = 0;
      fetchSearchUsage().then((u) => u && setUsage(u));
    } catch (err: unknown) {
      if (err instanceof SearchLimitError) {
        if (err.usage) setUsage(err.usage);
        if (err.code === "burst" && err.retryAfterMs <= 30_000 && burstRetryRef.current < 2) {
          burstRetryRef.current += 1;
          toast.info(err.message);
          setTimeout(() => runFullSearch(q, overrideFilters), Math.max(err.retryAfterMs, 3000));
          return;
        }
        burstRetryRef.current = 0;
        toast.warning(err.message, { duration: 8000 });
        setSearchPhase("error");
        return;
      }
      console.error("Search error:", err);
      const msg = err instanceof Error ? err.message : "Search failed";
      toast.error(msg);
      setSearchPhase("error");
    }
  };

  /** The editor's filter values as the engine's parse implies them. */
  const filtersFromParsed = (parsed: Record<string, any>): ParsedFilters => {
    const specialties: string[] = parsed.specialties || (parsed.specialty ? [parsed.specialty] : []);
    return {
      job_titles: parsed.job_titles || [],
      locations: locationLabelsFromParsed(parsed),
      companies: parsed.current_companies || parsed.companies || [],
      // Keyword chips that only re-spell a specialty are not shown: they
      // are not extra requirements, and they made specialty edits no-ops.
      keywords: dropSpecialtyEchoes(parsed.required_keywords || parsed.keywords || [], specialties),
      experience_years: parsed.min_years_experience || null,
      specialties,
      role_class: parsed.role_class || (Array.isArray(parsed.role_classes) ? parsed.role_classes[0] : null) || null,
      employment_model: parsed.employment_model || null,
    };
  };

  const runResultsFetch = async (
    q: string,
    // null on a fresh search: the engine parses and the chips follow its parse.
    f: ParsedFilters | null,
    parsed: Record<string, unknown> | null,
    targetPage: number,
    token: string | null,
  ) => {
    const data = await invokeSearchPeople({
        query: q,
        ...(f && parsed
          ? {
            filters: {
              job_titles: f.job_titles,
              companies: f.companies,
              keywords: f.keywords,
              specialties: f.specialties,
              locations: f.locations,
              experience_years: f.experience_years ?? null,
              role_class: f.role_class ?? null,
              employment_model: f.employment_model ?? null,
            },
            parsed,
          }
          : {}),
        page: targetPage - 1,
        size: pageSize,
        scroll_token: targetPage > 1 ? token : null,
        // The recruiter's ordered criteria, so a refine or page keeps them (6.1).
        ...(rankingRef.current.length > 0 ? { ranking_criteria: rankingRef.current } : {}),
    });

    if (data?.error) throw new Error(data.error);

    // A fresh search: adopt the engine's parse so the chips and the editor
    // show exactly what was enforced, and later edits re-send it.
    if (!f || !parsed) {
      const engineParsed = (data.parsed && typeof data.parsed === "object" ? data.parsed : {}) as Record<string, unknown>;
      setParsedPayload(engineParsed);
      setFilters(f ?? filtersFromParsed(engineParsed));
    }

    // Criterion titles for the per-candidate results (spec 3.3).
    const criterionMeta = new Map<string, { title: string; group: "required" | "preferred" }>();
    for (const c of (Array.isArray(data.required_criteria) ? data.required_criteria : []) as Array<Record<string, any>>) {
      if (c?.id) criterionMeta.set(String(c.id), { title: String(c.label ?? c.id), group: "required" });
    }
    for (const c of (Array.isArray(data.ranking_criteria) ? data.ranking_criteria : []) as Array<Record<string, any>>) {
      if (c?.id) criterionMeta.set(String(c.id), { title: String(c.title || c.text || c.id), group: "preferred" });
    }
    const serverRanking: RankingCriterion[] = ((Array.isArray(data.ranking_criteria) ? data.ranking_criteria : []) as Array<Record<string, any>>)
      .filter((c) => c?.id)
      .map((c, i) => ({
        id: String(c.id), text: String(c.text ?? c.title ?? c.id), title: String(c.title || c.text || c.id),
        position: i, must_have: c.must_have === true, origin: (c.origin ?? "parsed") as RankingCriterion["origin"],
        kind: c.kind, source_criterion_id: c.source_criterion_id,
      }));
    setRanking(!f || !parsed ? serverRanking : mergeRanking(rankingRef.current, serverRanking, removedRef.current));
    setRequiredCriteria(((Array.isArray(data.required_criteria) ? data.required_criteria : []) as Array<Record<string, any>>)
      .filter((c) => c?.id).map((c) => ({ id: String(c.id), kind: String(c.kind ?? ""), label: String(c.label ?? c.id) })));
    setCantCheck(((Array.isArray(data.cant_check) ? data.cant_check : []) as Array<Record<string, any>>)
      .filter((c) => c?.id).map((c) => ({ id: String(c.id), label: String(c.label ?? c.id) })));
    const mapRow = (r: Record<string, any>): Candidate => ({
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
      company_logo_url: r.job_company_logo_url || null,
      company_domain: r.job_company_domain || null,
      military_affiliation: (r.military_affiliation as string | null | undefined) ?? null,
      location_note: (r.location_note as string | null | undefined) ?? null,
      inferred_salary: null,
      years_experience: r.years_experience || r.inferred_years_experience || 0,
      clinical_skills: r.clinical_skills || [],
      has_contact_info: r.has_contact_info || false,
      summary: r.summary || r.headline || null,
      audit_verdict: r.audit_verdict ?? null,
      audit_reason: r.audit_reason ?? null,
      audit_evidence: r.audit_evidence ?? null,
      audit_score: r.audit_score ?? null,
      match_scope: r.match_scope ?? null,
      stage_fit: r.stage_fit ?? null,
      employment_model: r.employment_model ?? null,
      employment_model_evidence: r.employment_model_evidence ?? null,
      military_evidence: r.military_evidence ?? null,
      evidence_snippet: r.evidence_snippet ?? null,
      soft_matches: r.soft_matches ?? [],
      criteria_results: (Array.isArray(r.criteria_results) ? r.criteria_results : []).map((x: Record<string, any>): CandidateCriterionResult => ({
        ...(x as CandidateCriterionResult),
        title: criterionMeta.get(String(x.criterion_id))?.title ?? String(x.criterion_id),
        group: criterionMeta.get(String(x.criterion_id))?.group ?? "preferred",
      })),
      match_rate: r.match_rate ?? null,
      set_aside_reason: r.set_aside_reason ?? null,
      set_aside_note: r.set_aside_note ?? null,
      raw: r,
    });
    // The engine returns EVERY kept row; this page paginates in the browser.
    // (A second server request re-read the cache, re-graded, and came up
    // empty — 2026-10-13.)
    const mapped: Candidate[] = (data.results || []).map(mapRow);
    const hidden: Candidate[] = (data.hidden_results || []).map(mapRow);

    setCandidates(mapped);
    setHiddenCandidates(hidden);
    if (targetPage === 1) setResultsTab("results");
    setTotal(mapped.length);
    setTotalIsEstimate(false);
    setEngineVersion(typeof data.engine_version === "string" ? data.engine_version : null);
    setFilteredBreakdown(data.filtered && typeof data.filtered === "object" ? data.filtered : null);
    setBrowsableTotal(mapped.length);
    setHasMore(false);
    setScrollToken(null);
    setGeoScope(data.geo_scope || null);
    setCompanyScope(data.company_scope || null);
    setPage(1);
    setSearchPhase("done");
    if (targetPage === 1) addEntry(q, mapped.length);

    // Progressive reveal of the first page only.
    const firstPage = Math.min(mapped.length, pageSize);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || firstPage === 0) {
      setRevealedCount(firstPage);
    } else {
      setRevealedCount(0);
      const stepMs = Math.max(60, Math.min(150, 1500 / Math.max(firstPage, 1)));
      for (let i = 0; i < firstPage; i++) {
        setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), 400 + i * stepMs);
      }
    }
  };

  const handleSaveCandidates = async (
    toSave: Candidate[],
    contact?: { email: string | null; phone: string | null },
    target?: { id: string; name: string },
  ) => {
    if (toSave.length === 0) return;
    const destId = target?.id ?? projectId;
    const destName = target?.name ?? project?.name ?? "project";
    if (!destId) {
      // Not in a project: ask which one to save into.
      setPendingSave({ candidates: toSave, contact });
      return;
    }
    try {
      const count = await addCandidates.mutateAsync({
        projectId: destId,
        candidates: toSave.map((c) => ({
          full_name: c.full_name,
          title: c.title,
          current_employer: c.current_employer,
          location: c.location,
          linkedin_url: c.linkedin_url,
          email: contact?.email || c.email,
          phone: contact?.phone || c.phone,
          skills: c.skills,
          avg_tenure_months: c.avg_tenure_months,
          person_id: c.id,
          // Full search-row payload so the drawer can show experience and
          // education for saved contacts without a fresh enrichment call.
          raw_data: c.raw ?? null,
        })),
      });
      toast.success(`${count} candidate${count === 1 ? "" : "s"} saved to "${destName}"`);
      setSelected(new Set());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save candidates";
      toast.error(msg);
    }
  };

  // Paging is local: every kept row is already here. No request, no drip.
  const handlePageChange = (newPage: number) => {
    const lastPage = Math.max(1, Math.ceil(keptCount / pageSize));
    const next = Math.min(Math.max(1, newPage), lastPage);
    setPage(next);
    setRevealedCount(candidates.length);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleReset = () => {
    setStep("hero");
    setQuery("");
    setFilters(EMPTY_FILTERS);
    setCandidates([]);
    setRevealedCount(0);
    setTotal(0);
    setFilteredBreakdown(null);
    setBrowsableTotal(0);
    setHiddenCandidates([]);
    setHasMore(false);
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
    const visible = visibleCandidates.filter((c) => !savedIds.has(c.id)).map((c) => c.id);
    const allSelected = visible.length > 0 && visible.every((id) => selected.has(id));
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(visible));
  };

  const selectedCandidates = ranked.kept.filter((c) => selected.has(c.id));

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

  // Visible candidates: the current page's slice; page 1 drips in on a new search.
  const pageSlice = displayRows.slice((page - 1) * pageSize, page * pageSize);
  const visibleCandidates = page === 1 ? pageSlice.slice(0, revealedCount) : pageSlice;
  const skeletonCount = searchPhase === "running" ? Math.max(0, 10 - revealedCount) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Project context header */}
        <div className="flex flex-wrap items-center gap-3">
          {projectId && (
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Project:</span>
            <Select
              value={projectId ?? NO_PROJECT}
              onValueChange={(v) => {
                if (v === NEW_PROJECT) { setNewName(""); setNewOpen(true); return; }
                navigate(v === NO_PROJECT ? "/search" : `/projects/${v}/search`);
              }}
            >
              <SelectTrigger className="h-8 w-[220px] text-sm">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NEW_PROJECT}>+ Create new project</SelectItem>
                <SelectItem value={NO_PROJECT}>None (not in a project)</SelectItem>
                {allProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8" onClick={() => { setNewName(""); setNewOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" /> New project
            </Button>
          </div>
          {usage && (
            <span className="ml-auto text-xs text-muted-foreground" title="Paging through results and repeating a search don't count.">
              Daily searches: {usage.used} / {usage.limit}
            </span>
          )}
        </div>

        {usage && usage.used >= usage.limit - 10 && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            {usage.used >= usage.limit
              ? `You've used all ${usage.limit} new searches for today. Limits refresh at midnight UTC — you can still page through results.`
              : `You've used ${usage.used} of your ${usage.limit} daily searches. Daily limits refresh at midnight UTC.`}
          </div>
        )}

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
            {engineVersion && engineVersion !== EXPECTED_ENGINE_VERSION && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
                The search engine that answered is build <span className="font-mono">{engineVersion}</span>, but this
                page was built for <span className="font-mono">{EXPECTED_ENGINE_VERSION}</span>. Counts, filters and
                paging may be wrong until the search functions are redeployed.
              </div>
            )}
            <AgentReasoningPanel
              query={query}
              lines={reasoningLines}
              streaming={searchPhase === "running"}
              onEditQuery={handleEditQuery}
              errored={searchPhase === "error"}
              done={searchPhase === "done"}
              totalCount={total}
              totalIsEstimate={totalIsEstimate}
              filterSummary={buildFilterSummary(activeFilters)}
              onRefine={() => { setFilterFocus(null); setFilterEditorOpen(true); }}
            />

            {searchPhase === "done" && (
              <QueryReadback
                query={query}
                filters={filters}
                required={requiredCriteria}
                ranking={ranking}
                cantCheck={cantCheck}
                keptCount={keptCount}
                setAsideCount={setAsideRows.length}
                onOpenFilter={(field) => { setFilterFocus(field ?? null); setFilterEditorOpen(true); }}
                onOpenCriteria={() => setCriteriaOpen(true)}
                onReset={handleReset}
              />
            )}


            {/* Animated dot-network loader while results stream in */}
            {skeletonCount > 0 && <SearchNetworkLoader />}

            {searchPhase === "done" && setAsideRows.length > 0 && (
              <div className="flex items-center gap-1 border-b border-border/60" role="tablist" aria-label="Search views">
                {(["results", "set_aside"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={resultsTab === t}
                    onClick={() => setResultsTab(t)}
                    className={cn(
                      "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                      resultsTab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t === "results" ? "Results" : "Set aside"}{" "}
                    <span className="tabular-nums text-muted-foreground">{t === "results" ? keptCount : setAsideRows.length}</span>
                  </button>
                ))}
              </div>
            )}

            {resultsTab === "set_aside" && searchPhase === "done" && setAsideRows.length > 0 && (
              <SetAsideTab candidates={setAsideRows} onRestore={restoreCandidate} onOpenCandidate={setDrawerCandidate} />
            )}

            {resultsTab === "results" && visibleCandidates.length > 0 && (
              <SearchResults
                query={query}
                candidates={visibleCandidates}
                total={keptCount}
                totalIsEstimate={totalIsEstimate}
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
                browsableTotal={keptCount}
                view={view}
                onViewChange={setView}
                ranking={ranking}
                requiredCriteria={requiredCriteria}
                onReorderRanking={setRanking}
                tableSort={tableSort}
                onTableSortChange={(st) => { setTableSort(st); setPage(1); }}
                hasMore={hasMore}
                onPageChange={handlePageChange}
                isSaving={addCandidates.isPending}
                isLoading={searchPhase === "running"}
                geoScope={geoScope as any}
                companyScope={companyScope as any}
              />
            )}

            {resultsTab === "results" && searchPhase === "done" && setAsideRows.length > 0 && (
              <div className="rounded-xl border border-border/50 bg-card/40 p-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {describeSetAside(
                    setAsideRows.some((c) => c.set_aside_reason === "must_have")
                      ? { ...(filteredBreakdown ?? {}), must_have: setAsideRows.filter((c) => c.set_aside_reason === "must_have").length }
                      : filteredBreakdown,
                    setAsideRows.length,
                  )}
                </p>
                <button onClick={() => setResultsTab("set_aside")} className="text-sm font-medium text-primary hover:underline">
                  See why
                </button>
              </div>
            )}

            {/* Zero-result helper after stream completes */}
            {searchPhase === "done" && keptCount === 0 && setAsideRows.length === 0 && (
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
        total={keptCount}
        focusField={filterFocus}
      />

      <CriteriaPanel
        open={criteriaOpen}
        onOpenChange={setCriteriaOpen}
        ranking={ranking}
        onChange={setRanking}
        suggestions={suggestionsFor(filters.role_class, filters.specialties)}
      />

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">New project</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. ICU Nurses - Q1 Hiring"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!newName.trim() || createProject.isPending}>
              {createProject.isPending ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SaveToProjectDialog
        open={!!pendingSave}
        onOpenChange={(open) => !open && setPendingSave(null)}
        candidates={pendingSave?.candidates ?? []}
        onPick={async (id, name) => {
          if (!pendingSave) return;
          await handleSaveCandidates(pendingSave.candidates, pendingSave.contact, { id, name });
          setPendingSave(null);
        }}
      />

      <CandidateDrawer
        open={!!drawerCandidate}
        onOpenChange={(open) => !open && setDrawerCandidate(null)}
        candidate={drawerCandidate}
        projectId={projectId}
        isSaved={drawerCandidate ? savedIds.has(drawerCandidate.id) : false}
        isSavingCandidate={addCandidates.isPending}
        onSaveCandidate={drawerCandidate ? (contact) => handleSaveCandidates([drawerCandidate], contact) : undefined}
        savedContactId={
          drawerCandidate
            ? existingCandidates.find((c) =>
                c.person_id === drawerCandidate.id ||
                (!!drawerCandidate.linkedin_url && normLinkedin(c.linkedin_url) === normLinkedin(drawerCandidate.linkedin_url)),
              )?.id ?? null
            : null
        }
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
