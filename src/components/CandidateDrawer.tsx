import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Building2,
  Copy,
  Lock,
  Mail,
  MapPin,
  Phone,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cleanDisplayName,
  formatDateLabel,
  formatExperienceDuration,
  getAvatarToneClass,
  getInitials,
  LinkedInMark,
  normalizeLinkedInUrl,
  toStringArray,
} from "@/components/search/candidate-ui";
import { CandidateSalaryBadge } from "@/components/search/CandidateSalaryBadge";

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
    raw?: Record<string, unknown>;
  } | null;
  isSaved?: boolean;
  isSavingCandidate?: boolean;
  onSaveCandidate?: () => Promise<void> | void;
  onAddToCampaign?: () => void;
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
    .map((entry) => `${entry.title || "Unknown role"} at ${entry.company || "Unknown company"} (${formatDateLabel(entry.startDate)} — ${formatDateLabel(entry.endDate)})`)
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
}: CandidateDrawerProps) {
  const [enriched, setEnriched] = useState<EnrichedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const summaryCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!open || !candidate) {
      setEnriched(null);
      setError(null);
      setContactUnlocked(false);
      setShowAllSkills(false);
      setActiveTab("overview");
      return;
    }

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
    return raw
      .map((c: unknown) => {
        if (typeof c === "string") return c.trim();
        if (c && typeof c === "object" && "name" in c) return String((c as { name: unknown }).name).trim();
        return "";
      })
      .filter((s: string) => s.length > 0);
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
      <SheetContent side="right" className="shadow-panel w-full max-w-full gap-0 border-ui-border-medium p-0 sm:w-[580px] sm:max-w-[580px]">
        <div className="flex h-full flex-col bg-card">
          <div className="shrink-0 border-b border-ui-border-light px-6 pb-5 pt-6 pr-14 sm:px-7">
            <div className="flex items-start gap-4">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={cleanDisplayName(candidate.full_name)}
                  className="h-16 w-16 rounded-full object-cover"
                  onError={(event) => {
                    (event.target as HTMLImageElement).style.display = "none";
                    (event.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                  }}
                />
              ) : null}
              <div
                className={cn(
                  "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[20px] font-bold",
                  getAvatarToneClass(candidate.full_name),
                  profilePicture ? "hidden" : "flex",
                )}
              >
                {getInitials(cleanDisplayName(candidate.full_name))}
              </div>

              <div className="min-w-0 flex-1">
                <SheetTitle className="text-[20px] font-bold text-ui-text-primary">{cleanDisplayName(candidate.full_name)}</SheetTitle>
                <p className="mt-1 text-[15px] text-ui-text-secondary">{title || "—"}</p>

                {companyName && (
                  <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-ui-text-tertiary">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{companyName}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {locationLabel && (
                <div className="inline-flex items-center gap-1.5 rounded-md bg-ui-surface-subtle px-3 py-1.5 text-sm text-ui-text-tertiary">
                  <MapPin className="h-3.5 w-3.5" />
                  {locationLabel}
                </div>
              )}
              {salary && (
                <div className="rounded-md bg-salary px-3 py-1.5 text-[14px] font-medium text-salary-foreground">{salary}</div>
              )}
              {(yearsExperience ?? 0) > 0 && (
                <div className="rounded-md bg-ui-surface-subtle px-3 py-1.5 text-sm text-ui-text-tertiary">{yearsExperience} yrs exp</div>
              )}
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-linkedin px-3 py-1.5 text-[14px] text-linkedin-foreground transition-opacity hover:opacity-80"
                >
                  <LinkedInMark className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b border-ui-border-light px-6 sm:px-7">
              <TabsList className="h-auto w-full justify-start gap-2 rounded-none bg-transparent p-0 text-left">
                <TabsTrigger
                  value="overview"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-[14px] font-normal text-ui-text-tertiary data-[state=active]:border-ui-info data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ui-info data-[state=active]:shadow-none"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="experience"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-[14px] font-normal text-ui-text-tertiary data-[state=active]:border-ui-info data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ui-info data-[state=active]:shadow-none"
                >
                  Experience
                </TabsTrigger>
                <TabsTrigger
                  value="contact"
                  className="rounded-none border-b-2 border-transparent px-4 py-3 text-[14px] font-normal text-ui-text-tertiary data-[state=active]:border-ui-info data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ui-info data-[state=active]:shadow-none"
                >
                  Contact
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <TabsContent value="overview" className="mt-0 space-y-8 px-6 py-6 pb-28 sm:px-7">
                <div className="rounded-[10px] border border-ai-border bg-ai px-5 py-[18px]">
                  <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-ai-foreground">
                    <Sparkles className="h-4 w-4" />
                    AI Summary
                  </div>

                  {aiSummaryLoading || loading ? (
                    <div className="space-y-2">
                      <div className="h-4 w-full animate-pulse rounded bg-ui-border-light" />
                      <div className="h-4 w-5/6 animate-pulse rounded bg-ui-border-light" />
                      <div className="h-4 w-3/4 animate-pulse rounded bg-ui-border-light" />
                    </div>
                  ) : (
                    <p className="text-[15px] leading-7 text-ui-text-secondary">{aiSummary || "Summary not available."}</p>
                  )}
                </div>

                {certifications.length > 0 && (
                  <section className="space-y-4">
                    <SectionHeading label="Certifications" />
                    <div className="space-y-2">
                      {certifications.map((certification) => (
                        <div key={certification} className="flex items-start gap-3 text-[15px] text-ui-text-secondary">
                          <span className="mt-[9px] h-1.5 w-1.5 rounded-full bg-ui-info" />
                          <span>{certification}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {educationEntries.length > 0 && (
                  <section className="space-y-4">
                    <SectionHeading label="Education" />
                    <div className="space-y-3">
                      {educationEntries.map((entry, index) => (
                        <div key={`${entry.school}-${index}`} className="space-y-1">
                          <p className="text-[15px] font-semibold text-ui-text-primary">{entry.school || "Unknown school"}</p>
                          <p className="text-sm text-ui-text-tertiary">
                            {[entry.degree, entry.major].filter(Boolean).join(entry.degree && entry.major ? " · " : "") || "Degree not available"}
                          </p>
                          <p className="text-[13px] text-ui-text-muted">
                            {formatDateLabel(entry.startDate)} — {formatDateLabel(entry.endDate)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {primarySkills.length > 0 && (
                  <section className="space-y-4">
                    <SectionHeading label="Clinical Skills" />
                    <div className="flex flex-wrap gap-2">
                      {(showAllSkills ? allSkills : primarySkills).map((skill) => (
                        <span key={skill} className="rounded-md bg-tag px-3 py-1.5 text-[14px] text-tag-foreground">
                          {skill}
                        </span>
                      ))}
                    </div>
                    {allSkills.length > primarySkills.length && (
                      <button
                        type="button"
                        className="text-[14px] font-medium text-ui-info hover:underline"
                        onClick={() => setShowAllSkills((current) => !current)}
                      >
                        {showAllSkills ? "Show fewer skills" : `Show all ${allSkills.length} skills`}
                      </button>
                    )}
                  </section>
                )}

                {error && <p className="text-[14px] text-ui-text-muted">{error}</p>}
              </TabsContent>

              <TabsContent value="experience" className="mt-0 px-6 py-6 pb-28 sm:px-7">
                {experienceEntries.length > 0 ? (
                  <section className="space-y-5">
                    <SectionHeading label="Career Timeline" />
                    <div className="space-y-5">
                      {experienceEntries.map((entry, index) => {
                        const duration = formatExperienceDuration(entry.startDate, entry.endDate);
                        return (
                          <div key={`${entry.title}-${entry.company}-${index}`} className="relative flex gap-4">
                            <div className="relative flex w-5 justify-center">
                              <span
                                className={cn(
                                  "relative z-10 mt-1 h-2.5 w-2.5 rounded-full",
                                  entry.isCurrent ? "bg-timeline-current ring-2 ring-timeline-ring" : "bg-timeline-past",
                                )}
                              />
                              {index < experienceEntries.length - 1 && (
                                <span className="absolute top-4 h-[calc(100%+16px)] w-0.5 bg-timeline-line" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1 pb-1">
                              <div className="flex flex-wrap items-start gap-2">
                                <p className="text-[16px] font-semibold text-ui-text-primary">{entry.title || "Unknown role"}</p>
                                {entry.isCurrent && (
                                  <span className="rounded-[4px] bg-current-badge px-2 py-0.5 text-[12px] font-semibold text-current-badge-foreground">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 text-[15px] text-ui-text-secondary">{entry.company || "Unknown company"}</p>
                              <p className="mt-1 text-[13px] text-ui-text-muted">
                                {formatDateLabel(entry.startDate)} — {formatDateLabel(entry.endDate)}
                                {duration ? ` · ${duration}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : (
                  <p className="text-[15px] text-ui-text-tertiary">Experience history is not available for this profile yet.</p>
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
      </SheetContent>
    </Sheet>
  );
}
