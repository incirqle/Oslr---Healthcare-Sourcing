import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Lock,
  Mail,
  Maximize2,
  Minimize2,
  Phone,
  Sparkles,
  StickyNote,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FitPill } from "@/components/search/FitPill";
import { useCandidateFits, useSetCandidateFit } from "@/hooks/useCandidateFit";
import { useDrawerSize } from "@/hooks/useDrawerSize";
import {
  useCandidateNotes,
  useAddCandidateNote,
  useDeleteCandidateNote,
} from "@/hooks/useCandidateNotes";
import type { ParsedFilters } from "@/components/search/FilterReview";
import { buildMatchChips } from "@/components/search/match-chips";
import { collectHighlightTerms, highlightText } from "@/components/search/highlight";
import {
  cleanDisplayName,
  formatDateLabelSmart,
  formatDegree,
  formatExperienceDuration,
  getAvatarToneClass,
  getInitials,
  LinkedInMark,
  normalizeLinkedInUrl,
  renderNamedValue,
  toStringArray,
  toTitleCase,
} from "@/components/search/candidate-ui";

interface CandidateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  candidate: {
    id: string;
    full_name: string;
    title: string | null;
    current_employer: string | null;
    location: string | null;
    linkedin_url: string | null;
    email: string | null;
    phone?: string | null;
    skills: string[] | null;
    avg_tenure_months: number | null;
    notes?: string | null;
    profile_pic_url?: string | null;
    inferred_salary?: string | null;
    years_experience?: number;
    clinical_skills?: string[];
    has_contact_info?: boolean;
    summary?: string | null;
    industry?: string | null;
    raw?: Record<string, unknown>;
  } | null;
  isSaved?: boolean;
  isSavingCandidate?: boolean;
  onSaveCandidate?: () => Promise<void> | void;
  onAddToCampaign?: () => void;
  /** Filters from the active search — used for query-aware highlighting + match chips. */
  filters?: ParsedFilters;
  /** Prev/next navigation through the visible result list. */
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

interface EnrichedData {
  full_name: string;
  job_title: string;
  job_company_name: string;
  location_locality: string;
  location_region: string;
  linkedin_url: string;
  work_email: string;
  personal_emails: string[];
  mobile_phone: string;
  phone_numbers: string[];
  skills: string[];
  summary: string;
  certifications: string[];
  inferred_salary?: string;
  profile_pic_url?: string;
  inferred_years_experience?: number;
  experience: {
    title: { name: string } | null;
    company: { name: string } | null;
    start_date: string;
    end_date: string | null;
    is_primary: boolean;
  }[];
  education: {
    school: { name: string } | null;
    degrees: string[];
    majors: string[];
    start_date: string;
    end_date: string | null;
  }[];
}

interface ExperienceEntry {
  title: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

interface EducationEntry {
  school: string | null;
  degree: string | null;
  major: string | null;
  startDate: string | null;
  endDate: string | null;
}

function SectionHeading({ label }: { label: string }) {
  return <h3 className="text-[14px] font-semibold uppercase tracking-[0.5px] text-ui-text-muted">{label}</h3>;
}

function getRawArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeExperience(candidate: CandidateDrawerProps["candidate"], enriched: EnrichedData | null): ExperienceEntry[] {
  if (enriched?.experience?.length) {
    return enriched.experience.map((entry) => ({
      title: entry.title?.name ?? null,
      company: entry.company?.name ?? null,
      startDate: entry.start_date ?? null,
      endDate: entry.end_date ?? null,
      isCurrent: !entry.end_date || entry.is_primary,
    }));
  }

  if (!candidate?.raw) return [];

  const rawExperience = [
    ...getRawArray<Record<string, unknown>>(candidate.raw.experience_history),
    ...getRawArray<Record<string, unknown>>(candidate.raw.experience),
  ];

  return rawExperience.map((entry) => ({
    title:
      typeof entry.title === "string"
        ? entry.title
        : typeof entry.job_title === "string"
          ? entry.job_title
          : (entry.title as { name?: string } | null)?.name ?? null,
    company:
      typeof entry.company_name === "string"
        ? entry.company_name
        : typeof entry.company === "string"
          ? entry.company
          : typeof entry.job_company_name === "string"
            ? entry.job_company_name
            : (entry.company as { name?: string } | null)?.name ?? null,
    startDate:
      typeof entry.start_date === "string"
        ? entry.start_date
        : typeof entry.job_start_date === "string"
          ? entry.job_start_date
          : null,
    endDate:
      typeof entry.end_date === "string"
        ? entry.end_date
        : typeof entry.job_end_date === "string"
          ? entry.job_end_date
          : null,
    isCurrent: Boolean(entry.is_current ?? entry.is_primary ?? !entry.end_date),
  }));
}

function normalizeEducation(candidate: CandidateDrawerProps["candidate"], enriched: EnrichedData | null): EducationEntry[] {
  if (enriched?.education?.length) {
    return enriched.education.map((entry) => ({
      school: entry.school?.name ?? null,
      degree: entry.degrees?.join(", ") || null,
      major: entry.majors?.join(", ") || null,
      startDate: entry.start_date ?? null,
      endDate: entry.end_date ?? null,
    }));
  }

  if (!candidate?.raw) return [];

  return getRawArray<Record<string, unknown>>(candidate.raw.education).map((entry) => ({
    school:
      typeof entry.school_name === "string"
        ? entry.school_name
        : typeof entry.school === "string"
          ? entry.school
          : (entry.school as { name?: string } | null)?.name ?? null,
    degree: toStringArray(entry.degrees).join(", ") || null,
    major: toStringArray(entry.majors).join(", ") || null,
    startDate: typeof entry.start_date === "string" ? entry.start_date : null,
    endDate: typeof entry.end_date === "string" ? entry.end_date : null,
  }));
}

function buildSummaryPrompt(
  candidate: NonNullable<CandidateDrawerProps["candidate"]>,
  enriched: EnrichedData | null,
  experience: ExperienceEntry[],
  education: EducationEntry[],
  skills: string[],
  certifications: string[],
) {
  const currentRole = enriched?.job_title || candidate.title || "Unknown";
  const company = enriched?.job_company_name || candidate.current_employer || "Unknown";
  const location = [enriched?.location_locality, enriched?.location_region].filter(Boolean).join(", ") || candidate.location || "Unknown";
  const yearsExperience = enriched?.inferred_years_experience || candidate.years_experience || "Unknown";
  const career = experience
    .slice(0, 3)
    .map((entry) => `${entry.title || "Unknown role"} at ${entry.company || "Unknown company"} (${formatDateLabelSmart(entry.startDate)} — ${formatDateLabelSmart(entry.endDate)})`)
    .join("; ");
  const educationSummary = education
    .slice(0, 3)
    .map((entry) => `${entry.degree || "Degree"}${entry.major ? ` in ${entry.major}` : ""} from ${entry.school || "Unknown school"}`)
    .join("; ");

  return `Write a 3-4 sentence professional summary for a healthcare recruiting context. Be factual and concise.

Name: ${candidate.full_name}
Current Role: ${currentRole} at ${company}
Location: ${location}
Years of Experience: ${yearsExperience}
Career: ${career || "Not available"}
Education: ${educationSummary || "Not available"}
Skills: ${skills.join(", ") || "Not available"}
Certifications: ${certifications.join(", ") || "Not available"}
Write as a paragraph. Focus on what makes this person valuable to a healthcare recruiter.`;
}

function ContactCard({
  icon,
  label,
  value,
  href,
  onCopy,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-contact px-4 py-4">
      <div className="text-contact-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ui-text-muted">{label}</p>
        {href ? (
          <a href={href} className="truncate text-[15px] text-contact-foreground hover:underline">
            {value}
          </a>
        ) : (
          <p className="truncate text-[15px] text-ui-text-primary">{value}</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={onCopy}
        className="h-8 border-ui-border-medium px-3 text-[13px] text-ui-text-secondary hover:bg-ui-surface-hover"
      >
        <Copy className="h-3.5 w-3.5" />
        Copy
      </Button>
    </div>
  );
}

export function CandidateDrawer({
  open,
  onOpenChange,
  candidate,
  isSaved = false,
  isSavingCandidate = false,
  onSaveCandidate,
  onAddToCampaign,
  filters,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: CandidateDrawerProps) {
  const { size: drawerSize, toggle: toggleDrawerSize, isWide } = useDrawerSize();
  const [enriched, setEnriched] = useState<EnrichedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [noteDraft, setNoteDraft] = useState("");
  const summaryCache = useRef<Map<string, string>>(new Map());

  // Per-user fit + notes for this candidate
  const candidatePdlIds = useMemo(() => (candidate ? [candidate.id] : []), [candidate?.id]);
  const { data: fitMap } = useCandidateFits(candidatePdlIds);
  const setFit = useSetCandidateFit();
  const fitStatus = candidate ? fitMap?.get(candidate.id) ?? "unreviewed" : "unreviewed";

  const { data: notes = [] } = useCandidateNotes(candidate?.id ?? null);
  const addNote = useAddCandidateNote();
  const deleteNote = useDeleteCandidateNote();

  // Highlight terms derived from the parsed query
  const highlightTerms = useMemo(
    () => (filters ? collectHighlightTerms(filters) : []),
    [filters],
  );

  // Match chips for the in-drawer "Why they matched" panel
  const matchChips = useMemo(() => {
    if (!candidate || !filters) return [];
    return buildMatchChips(candidate as never, filters);
  }, [candidate, filters]);

  // J/K keyboard navigation while drawer is open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.key === "j" && hasNext && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === "k" && hasPrev && onPrev) {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, hasNext, hasPrev, onNext, onPrev]);

  useEffect(() => {
    if (!open || !candidate) {
      setEnriched(null);
      setError(null);
      setContactUnlocked(false);
      setShowAllSkills(false);
      setActiveTab("overview");
      setNoteDraft("");
      return;
    }
    setNoteDraft("");

    const cached = summaryCache.current.get(candidate.id);
    setAiSummary(cached ?? null);

    let cancelled = false;

    const fetchEnriched = async () => {
      setLoading(true);
      setError(null);

      try {
        const params: Record<string, unknown> = { action: "enrich_person" };
        if (candidate.linkedin_url) params.linkedin_url = candidate.linkedin_url;
        else if (candidate.email) params.email = candidate.email;
        else {
          setLoading(false);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke("pdl-search", { body: params });
        if (cancelled) return;
        if (fnError) throw fnError;

        // Guard against error response bodies
        if (data && typeof data === "object" && "error" in data) {
          throw new Error(typeof (data as { error: unknown }).error === "string" ? (data as { error: string }).error : "Enrichment failed");
        }
        const payload = (data as { data?: unknown } | null)?.data;
        if (payload && typeof payload === "object") {
          setEnriched(payload as EnrichedData);
        }
      } catch (fetchError) {
        if (cancelled) return;
        console.error("Enrich error:", fetchError);
        setError("Failed to load enriched profile data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchEnriched();

    return () => { cancelled = true; };
  }, [open, candidate?.id]);

  const experienceEntries = useMemo(() => normalizeExperience(candidate, enriched), [candidate, enriched]);
  const educationEntries = useMemo(() => normalizeEducation(candidate, enriched), [candidate, enriched]);
  const certifications = useMemo(() => {
    const raw = enriched?.certifications?.length
      ? enriched.certifications
      : (candidate?.raw?.certifications ?? []);
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of raw) {
      const name = renderNamedValue(c);
      if (!name) continue;
      const titled = toTitleCase(name);
      const key = titled.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(titled);
    }
    return out;
  }, [candidate?.raw, enriched?.certifications]);
  const primarySkills = useMemo(() => {
    if (candidate?.clinical_skills?.length) return candidate.clinical_skills;
    const rawClinicalSkills = toStringArray(candidate?.raw?.clinical_skills);
    if (rawClinicalSkills.length) return rawClinicalSkills;
    return (enriched?.skills || candidate?.skills || []).slice(0, 12);
  }, [candidate?.clinical_skills, candidate?.raw, candidate?.skills, enriched?.skills]);
  const allSkills = useMemo(() => {
    const rawSkills = toStringArray(candidate?.raw?.all_skills);
    return enriched?.skills?.length ? enriched.skills : rawSkills.length ? rawSkills : candidate?.skills || [];
  }, [candidate?.raw, candidate?.skills, enriched?.skills]);

  useEffect(() => {
    if (!open || !candidate || loading || aiSummary || summaryCache.current.has(candidate.id)) return;

    const generateSummary = async () => {
      setAiSummaryLoading(true);
      try {
        const prompt = buildSummaryPrompt(candidate, enriched, experienceEntries, educationEntries, primarySkills, certifications);
        const { data, error: fnError } = await supabase.functions.invoke("pdl-search", {
          body: { action: "ai_summary", prompt },
        });

        if (fnError) throw fnError;

        const summary = typeof data?.summary === "string" ? data.summary : null;
        if (summary) {
          setAiSummary(summary);
          summaryCache.current.set(candidate.id, summary);
          return;
        }

        throw new Error("Summary not available");
      } catch {
        const fallback = `${candidate.full_name} is ${candidate.title ? `a ${candidate.title}` : "a healthcare professional"}${candidate.current_employer ? ` at ${candidate.current_employer}` : ""}${candidate.location ? ` based in ${candidate.location}` : ""}. ${(candidate.years_experience ?? 0) > 0 ? `They bring approximately ${candidate.years_experience} years of experience.` : ""}`.trim();
        setAiSummary(fallback);
        summaryCache.current.set(candidate.id, fallback);
      } finally {
        setAiSummaryLoading(false);
      }
    };

    void generateSummary();
  }, [open, candidate?.id, loading, aiSummary, enriched, experienceEntries, educationEntries, primarySkills, certifications]);

  // Pull current role to feature at top of overview (must be before early return)
  const currentRoleEntry = useMemo(
    () => experienceEntries.find((e) => e.isCurrent) ?? experienceEntries[0] ?? null,
    [experienceEntries],
  );

  if (!candidate) return null;

  const inferredSalary = enriched?.inferred_salary || candidate.inferred_salary || null;
  const yearsExperience = enriched?.inferred_years_experience || candidate.years_experience;
  const profilePicture = enriched?.profile_pic_url || candidate.profile_pic_url;
  const linkedinUrl = normalizeLinkedInUrl(enriched?.linkedin_url || candidate.linkedin_url);
  const companyName = enriched?.job_company_name || candidate.current_employer;
  const title = enriched?.job_title || candidate.title;
  const locationLabel = [enriched?.location_locality, enriched?.location_region].filter(Boolean).join(", ") || candidate.location;
  const contactEmail = enriched?.work_email || enriched?.personal_emails?.[0] || candidate.email || null;
  const contactPhone = enriched?.mobile_phone || enriched?.phone_numbers?.[0] || candidate.phone || null;

  const handleCopy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const handleSave = async () => {
    if (!onSaveCandidate || isSaved) return;
    await onSaveCandidate();
  };

  const handleAddCampaign = () => {
    if (onAddToCampaign) {
      onAddToCampaign();
      return;
    }
    toast.info("Open Campaigns to add this candidate after saving them to the project.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "shadow-panel w-full max-w-full gap-0 border-ui-border-medium p-0 transition-[width,max-width] duration-200 ease-out motion-reduce:transition-none",
          isWide
            ? "sm:w-[min(960px,90vw)] sm:max-w-[min(960px,90vw)]"
            : "sm:w-[620px] sm:max-w-[620px]",
        )}
      >
        <TooltipProvider delayDuration={150}>
        <div className="flex h-full flex-col bg-card">
          {/* Row 1: Nav strip — prev/next, J/K hint, expand toggle */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-ui-border-light bg-ui-surface-subtle/40 px-3 text-[12px] text-ui-text-muted">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onPrev}
                disabled={!hasPrev}
                className="h-7 gap-1 px-2 text-[12px]"
                aria-label="Previous candidate (K)"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onNext}
                disabled={!hasNext}
                className="h-7 gap-1 px-2 text-[12px]"
                aria-label="Next candidate (J)"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline">
                <kbd className="rounded border border-ui-border-light bg-card px-1.5 py-0.5 text-[10px] font-mono">J</kbd>
                {" / "}
                <kbd className="rounded border border-ui-border-light bg-card px-1.5 py-0.5 text-[10px] font-mono">K</kbd>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleDrawerSize}
                    className="hidden h-7 w-7 px-0 sm:inline-flex"
                    aria-label={isWide ? "Collapse drawer" : "Expand drawer"}
                  >
                    {isWide ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {isWide ? "Collapse drawer" : "Expand drawer"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Row 2: Identity — avatar + name/meta inline + fit pill */}
          <div className="shrink-0 border-b border-ui-border-light px-5 py-3 pr-12 sm:px-6">
            <div className="flex items-center gap-3">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={cleanDisplayName(candidate.full_name)}
                  className="h-11 w-11 shrink-0 rounded-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                    (event.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold",
                  getAvatarToneClass(candidate.full_name),
                  profilePicture ? "hidden" : "flex",
                )}
              >
                {getInitials(cleanDisplayName(candidate.full_name))}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <SheetTitle className="truncate text-[17px] font-bold text-ui-text-primary">
                    {toTitleCase(cleanDisplayName(candidate.full_name))}
                  </SheetTitle>
                  {title && (
                    <>
                      <span className="text-ui-text-muted">·</span>
                      <span className="truncate text-[14px] text-ui-text-secondary">{toTitleCase(title)}</span>
                    </>
                  )}
                </div>
                {/* Inline meta: company · location · LinkedIn */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-ui-text-tertiary">
                  {companyName && <span className="truncate">{toTitleCase(companyName)}</span>}
                  {companyName && locationLabel && <span aria-hidden="true">·</span>}
                  {locationLabel && <span className="truncate">{locationLabel}</span>}
                  {linkedinUrl && (
                    <>
                      <span aria-hidden="true">·</span>
                      <a
                        href={linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-linkedin hover:underline"
                        aria-label="View on LinkedIn"
                      >
                        <LinkedInMark className="h-3 w-3" />
                        LinkedIn
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                <FitPill
                  status={fitStatus}
                  onChange={(next) => setFit.mutate({ pdlId: candidate.id, status: next })}
                  size="sm"
                  stopPropagation={false}
                />
              </div>
            </div>
          </div>

          {/* Row 3: Match chip strip — single line with tooltips */}
          {matchChips.length > 0 && (
            <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-ui-border-light bg-primary/[0.04] px-5 py-1.5 sm:px-6">
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                Matched
              </span>
              <div className="flex shrink-0 items-center gap-1.5">
                {matchChips.map((chip) => (
                  <Tooltip key={chip.id}>
                    <TooltipTrigger asChild>
                      <span
                        className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                        tabIndex={0}
                      >
                        {chip.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs text-xs">
                      {chip.reason}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            {/* Sticky tabs */}
            <div className="sticky top-0 z-10 shrink-0 border-b border-ui-border-light bg-card px-5 sm:px-6">
              <TabsList className="h-auto w-full justify-start gap-1 rounded-none bg-transparent p-0 text-left">
                {[
                  { value: "overview", label: "Overview" },
                  { value: "experience", label: "Experience" },
                  { value: "notes", label: `Notes${notes.length > 0 ? ` (${notes.length})` : ""}` },
                  { value: "contact", label: "Contact" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="rounded-none border-b-2 border-transparent px-3 py-2.5 text-[13px] font-normal text-ui-text-tertiary data-[state=active]:border-ui-info data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ui-info data-[state=active]:shadow-none"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* OVERVIEW — reorganized: AI summary → Current role → Quick stats → Education → Certs → Skills */}
              <TabsContent value="overview" className="mt-0 space-y-5 px-5 py-5 pb-24 sm:px-6">
                {/* AI Summary */}
                <div className="rounded-[10px] border border-ai-border bg-ai px-4 py-4">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ai-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Summary
                  </div>
                  {aiSummaryLoading || loading ? (
                    <div className="space-y-2">
                      <div className="h-3.5 w-full animate-pulse rounded bg-ui-border-light" />
                      <div className="h-3.5 w-5/6 animate-pulse rounded bg-ui-border-light" />
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-ui-border-light" />
                    </div>
                  ) : (
                    <p className="text-[14px] leading-6 text-ui-text-secondary">
                      {aiSummary ? highlightText(aiSummary, highlightTerms) : "Summary not available."}
                    </p>
                  )}
                </div>

                {/* Current Role — featured card */}
                {currentRoleEntry && (
                  <section className="rounded-[10px] border border-primary/25 bg-primary/[0.04] px-4 py-3">
                    <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      <span className="inline-block h-2 w-2 rounded-full bg-timeline-current ring-2 ring-timeline-ring" />
                      Current Role
                    </div>
                    <p className="text-[15px] font-semibold text-ui-text-primary">
                      {currentRoleEntry.title ? toTitleCase(currentRoleEntry.title) : "Unknown role"}
                    </p>
                    <p className="text-[14px] text-ui-text-secondary">
                      {currentRoleEntry.company ? toTitleCase(currentRoleEntry.company) : "Unknown company"}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ui-text-muted">
                      {formatDateLabelSmart(currentRoleEntry.startDate)} — {formatDateLabelSmart(currentRoleEntry.endDate) || "Present"}
                      {(() => {
                        const dur = formatExperienceDuration(currentRoleEntry.startDate, currentRoleEntry.endDate);
                        return dur ? ` · ${dur}` : "";
                      })()}
                    </p>
                  </section>
                )}

                {/* Quick Stats strip — years + avg tenure only (no salary band) */}
                {(yearsExperience || candidate.avg_tenure_months) && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[10px] border border-ui-border-light bg-ui-surface-subtle/40 px-4 py-2.5 text-[13px]">
                    {yearsExperience ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-ui-text-primary">{yearsExperience}y</span>
                        <span className="text-ui-text-muted">experience</span>
                      </div>
                    ) : null}
                    {candidate.avg_tenure_months ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-ui-text-primary">
                          {Math.round(candidate.avg_tenure_months / 12 * 10) / 10}y
                        </span>
                        <span className="text-ui-text-muted">avg tenure</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Certifications + Skills (Education moved to Experience tab) */}
                <div className={cn("space-y-5", isWide && "sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-5 sm:space-y-0")}>
                  {certifications.length > 0 && (
                    <section className="space-y-2">
                      <SectionHeading label="Certifications" />
                      <div className="flex flex-wrap gap-1.5">
                        {certifications.map((certification) => (
                          <span
                            key={certification}
                            className="inline-flex items-center rounded-md border border-ui-border-light bg-ui-surface-subtle px-2 py-0.5 text-[12px] text-ui-text-secondary"
                          >
                            {certification}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {primarySkills.length > 0 && (
                    <section className={cn("space-y-2", isWide && certifications.length === 0 && "sm:col-span-2")}>
                      <SectionHeading label="Clinical Skills" />
                      <div className="flex flex-wrap gap-1.5">
                        {(showAllSkills ? allSkills : primarySkills).map((skill) => (
                          <span key={skill} className="rounded-md bg-tag px-2 py-0.5 text-[12px] text-tag-foreground">
                            {skill}
                          </span>
                        ))}
                      </div>
                      {allSkills.length > primarySkills.length && (
                        <button
                          type="button"
                          className="text-[12px] font-medium text-ui-info hover:underline"
                          onClick={() => setShowAllSkills((current) => !current)}
                        >
                          {showAllSkills ? "Show fewer skills" : `Show all ${allSkills.length} skills`}
                        </button>
                      )}
                    </section>
                  )}
                </div>

                {error && <p className="text-[13px] text-ui-text-muted">{error}</p>}
              </TabsContent>

              {/* EXPERIENCE — LinkedIn-style: Experience section + Education section */}
              <TabsContent value="experience" className="mt-0 space-y-6 px-5 py-5 pb-24 sm:px-6">
                {/* Experience */}
                <section>
                  <h3 className="mb-3 text-[15px] font-semibold text-ui-text-primary">Experience</h3>
                  {experienceEntries.length > 0 ? (
                    <div className="space-y-4">
                      {experienceEntries.map((entry, index) => {
                        const duration = formatExperienceDuration(entry.startDate, entry.endDate);
                        const companyInitials = getInitials(entry.company || "?");
                        const isLast = index === experienceEntries.length - 1;
                        return (
                          <div
                            key={`${entry.title}-${entry.company}-${index}`}
                            className="relative flex gap-3"
                          >
                            {/* Company logo placeholder + connecting line */}
                            <div className="relative flex w-10 flex-col items-center">
                              <div
                                className={cn(
                                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                                  getAvatarToneClass(entry.company || entry.title || "x"),
                                )}
                                aria-hidden="true"
                              >
                                {companyInitials}
                              </div>
                              {!isLast && (
                                <span className="mt-1 w-0.5 flex-1 bg-ui-border-light" aria-hidden="true" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 pb-3">
                              <div className="flex flex-wrap items-baseline gap-x-2">
                                <p className="text-[14px] font-semibold text-ui-text-primary">
                                  {entry.title ? toTitleCase(entry.title) : "Unknown role"}
                                </p>
                                {entry.isCurrent && (
                                  <span className="rounded-[4px] bg-current-badge px-1.5 py-0 text-[10px] font-semibold text-current-badge-foreground">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-[13px] text-ui-text-secondary">
                                {entry.company ? toTitleCase(entry.company) : "Unknown company"}
                              </p>
                              <p className="mt-0.5 text-[12px] text-ui-text-muted">
                                {formatDateLabelSmart(entry.startDate)} — {formatDateLabelSmart(entry.endDate) || "Present"}
                                {duration ? ` · ${duration}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[14px] text-ui-text-tertiary">No experience history available.</p>
                  )}
                </section>

                {/* Education */}
                {educationEntries.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-[15px] font-semibold text-ui-text-primary">Education</h3>
                    <div className="space-y-4">
                      {educationEntries.map((entry, index) => {
                        const degreeInfo = formatDegree(
                          entry.degree && entry.major
                            ? { degree: entry.degree, major: entry.major }
                            : entry.degree ?? entry.major,
                        );
                        const school = entry.school ? toTitleCase(entry.school) : "Unknown school";
                        const schoolInitials = getInitials(entry.school || "?");
                        const isLast = index === educationEntries.length - 1;
                        const startYear = formatDateLabelSmart(entry.startDate);
                        const endYear = formatDateLabelSmart(entry.endDate);
                        const dateLabel =
                          startYear && endYear
                            ? `${startYear} — ${endYear}`
                            : endYear || startYear || null;
                        return (
                          <div key={`${entry.school}-${index}`} className="relative flex gap-3">
                            <div className="relative flex w-10 flex-col items-center">
                              <div
                                className={cn(
                                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                                  getAvatarToneClass(entry.school || "edu"),
                                )}
                                aria-hidden="true"
                              >
                                {schoolInitials}
                              </div>
                              {!isLast && (
                                <span className="mt-1 w-0.5 flex-1 bg-ui-border-light" aria-hidden="true" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 pb-3">
                              <p className="text-[14px] font-semibold text-ui-text-primary">{school}</p>
                              {degreeInfo.display && (
                                <p className="text-[13px] text-ui-text-secondary">{degreeInfo.display}</p>
                              )}
                              {dateLabel && (
                                <p className="mt-0.5 text-[12px] text-ui-text-muted">{dateLabel}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-0 space-y-5 px-6 py-6 pb-28 sm:px-7">
                <div className="flex items-center gap-2 text-[12px] text-ui-text-muted">
                  <StickyNote className="h-3.5 w-3.5" />
                  Private — only you can see these notes.
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!candidate || !noteDraft.trim()) return;
                    addNote.mutate(
                      { pdlId: candidate.id, body: noteDraft },
                      {
                        onSuccess: () => {
                          setNoteDraft("");
                          toast.success("Note saved");
                        },
                        onError: (err) => {
                          toast.error(err instanceof Error ? err.message : "Failed to save note");
                        },
                      },
                    );
                  }}
                  className="space-y-2"
                >
                  <Textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="e.g. Reached out via LinkedIn 4/16 — waiting on reply…"
                    rows={3}
                    className="resize-none border-ui-border-medium bg-card text-[14px]"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-ui-text-muted">
                      ⌘/Ctrl + Enter to save
                    </span>
                    <Button
                      type="submit"
                      disabled={!noteDraft.trim() || addNote.isPending}
                      className="h-9 bg-ui-info px-4 text-[13px] font-medium text-ui-info-foreground hover:bg-ui-info/90"
                    >
                      {addNote.isPending ? "Saving…" : "Add note"}
                    </Button>
                  </div>
                </form>

                {notes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-ui-border-light px-4 py-6 text-center text-[13px] text-ui-text-muted">
                    No notes yet. Capture context, follow-ups, or anything you'd want to remember next time you see this profile.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        className="group rounded-lg border border-ui-border-light bg-ui-surface-subtle/40 px-4 py-3"
                      >
                        <p className="whitespace-pre-wrap text-[14px] leading-6 text-ui-text-primary">
                          {note.body}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-ui-text-muted">
                          <span>{new Date(note.created_at).toLocaleString()}</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (!candidate) return;
                              deleteNote.mutate(
                                { id: note.id, pdlId: candidate.id },
                                {
                                  onSuccess: () => toast.success("Note deleted"),
                                  onError: (err) =>
                                    toast.error(err instanceof Error ? err.message : "Failed to delete note"),
                                },
                              );
                            }}
                            className="inline-flex items-center gap-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            aria-label="Delete note"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contact" className="mt-0 px-6 py-6 pb-28 sm:px-7">
                {!contactUnlocked ? (
                  <div className="rounded-xl border border-locked-border bg-locked px-8 py-10 text-center">
                    <Lock className="mx-auto h-[18px] w-[18px] text-ui-text-muted" />
                    <h3 className="mt-4 text-[17px] font-semibold text-ui-text-primary">Contact info is gated</h3>
                    <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-7 text-ui-text-tertiary">
                      Unlock this candidate&apos;s email and phone number. This uses 1 contact credit.
                    </p>
                    <Button
                      type="button"
                      onClick={() => setContactUnlocked(true)}
                      className="mt-6 h-12 rounded-lg bg-ui-info px-7 text-[15px] font-semibold text-ui-info-foreground hover:bg-ui-info/90"
                    >
                      Unlock Contact Info
                    </Button>
                  </div>
                ) : contactEmail || contactPhone ? (
                  <div className="space-y-3">
                    {contactEmail && (
                      <ContactCard
                        icon={<Mail className="h-4 w-4" />}
                        label="Email"
                        value={contactEmail}
                        href={`mailto:${contactEmail}`}
                        onCopy={() => handleCopy(contactEmail, "Email")}
                      />
                    )}
                    {contactPhone && (
                      <ContactCard
                        icon={<Phone className="h-4 w-4" />}
                        label="Phone"
                        value={contactPhone}
                        href={`tel:${contactPhone}`}
                        onCopy={() => handleCopy(contactPhone, "Phone")}
                      />
                    )}
                  </div>
                ) : (
                  <p className="py-10 text-center text-[15px] text-ui-text-muted">No contact information available</p>
                )}
              </TabsContent>
            </div>
          </Tabs>

          <div className="shrink-0 border-t border-ui-border-light bg-card px-6 py-4 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleSave}
                disabled={!onSaveCandidate || isSaved || isSavingCandidate}
                className="h-12 flex-1 border-ui-border-medium bg-card text-[14px] font-medium text-ui-text-secondary hover:bg-ui-surface-hover"
              >
                {isSaved ? "Saved to Project" : isSavingCandidate ? "Saving…" : "Save to Project"}
              </Button>
              <Button
                type="button"
                onClick={handleAddCampaign}
                className="h-12 flex-1 bg-ui-info text-[14px] font-medium text-ui-info-foreground hover:bg-ui-info/90"
              >
                Add to Campaign
              </Button>
            </div>
          </div>
        </div>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
