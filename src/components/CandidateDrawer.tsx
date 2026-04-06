import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Building2,
  Mail,
  Phone,
  ExternalLink,
  Briefcase,
  GraduationCap,
  Clock,
  Loader2,
  Globe,
  Users,
  StickyNote,
  Sparkles,
  Lock,
  Linkedin,
  DollarSign,
  Copy,
  Download,
  FolderPlus,
  Smartphone,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateCandidateNotes } from "@/hooks/useProjects";
import { toast } from "sonner";

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
    // V2 enriched fields from search results
    profile_pic_url?: string | null;
    inferred_salary?: string | null;
    years_experience?: number;
    clinical_skills?: string[];
    has_contact_info?: boolean;
    summary?: string | null;
    raw?: Record<string, unknown>;
  } | null;
}

interface EnrichedData {
  full_name: string;
  first_name: string;
  last_name: string;
  job_title: string;
  job_company_name: string;
  job_company_size: string;
  job_company_industry: string;
  job_company_website: string;
  job_company_founded: number;
  job_company_location_locality: string;
  job_company_location_region: string;
  location_locality: string;
  location_region: string;
  location_country: string;
  linkedin_url: string;
  work_email: string;
  personal_emails: string[];
  mobile_phone: string;
  phone_numbers: string[];
  skills: string[];
  interests: string[];
  industry: string;
  experience: {
    title: { name: string } | null;
    company: { name: string; size: string; industry: string } | null;
    start_date: string;
    end_date: string | null;
    is_primary: boolean;
    location_names: string[];
  }[];
  education: {
    school: { name: string } | null;
    degrees: string[];
    majors: string[];
    start_date: string;
    end_date: string | null;
  }[];
  summary: string;
  sex: string;
  birth_year: number;
  languages: { name: string }[];
  certifications: string[];
  inferred_salary?: string;
  profile_pic_url?: string;
  inferred_years_experience?: number;
}

function formatSalary(salary: string | null | undefined): string | null {
  if (!salary) return null;
  if (salary.startsWith(">")) return "$250K+";
  if (salary.startsWith("<")) return "< $20K";
  const parts = salary.split("-").map(s => s.trim().replace(/,/g, ""));
  if (parts.length === 2) {
    const low = Math.round(parseInt(parts[0]) / 1000);
    const high = Math.round(parseInt(parts[1]) / 1000);
    if (!isNaN(low) && !isNaN(high)) return `$${low}K – $${high}K`;
  }
  return salary;
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function InfoRow({ icon: Icon, label, value, href }: { icon: any; label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
            {value}
          </a>
        ) : (
          <p className="text-sm break-all">{value}</p>
        )}
      </div>
    </div>
  );
}

function isMedicalEducation(edu: { school?: { name: string } | null; degrees?: string[]; majors?: string[] }): boolean {
  const terms = ["medicine", "medical school", "md", "do", "osteopathic"];
  const schoolName = (edu.school?.name || "").toLowerCase();
  const degrees = (edu.degrees || []).map(d => d.toLowerCase());
  const majors = (edu.majors || []).map(m => m.toLowerCase());
  return [...[schoolName], ...degrees, ...majors].some(t => terms.some(term => t.includes(term)));
}

export function CandidateDrawer({ open, onOpenChange, candidate, projectId }: CandidateDrawerProps) {
  const [enriched, setEnriched] = useState<EnrichedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [contactUnlocked, setContactUnlocked] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const summaryCache = useRef<Map<string, string>>(new Map());
  const updateNotes = useUpdateCandidateNotes();

  useEffect(() => {
    if (!open || !candidate) {
      setEnriched(null);
      setError(null);
      setContactUnlocked(false);
      setShowAllSkills(false);
      return;
    }
    setNotes(candidate.notes || "");

    // Check AI summary cache
    const cached = summaryCache.current.get(candidate.id);
    if (cached) {
      setAiSummary(cached);
    } else {
      setAiSummary(null);
    }

    const fetchEnriched = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: any = { action: "enrich_person" };
        if (candidate.linkedin_url) params.linkedin_url = candidate.linkedin_url;
        else if (candidate.email) params.email = candidate.email;
        else {
          setLoading(false);
          return;
        }

        const { data, error: fnErr } = await supabase.functions.invoke("pdl-search", {
          body: params,
        });

        if (fnErr) throw fnErr;
        if (data?.status === 200 || data?.data) {
          setEnriched(data.data || data);
        } else if (data?.error) {
          setError("Could not enrich this profile");
        }
      } catch (err: any) {
        console.error("Enrich error:", err);
        setError("Failed to load enriched data");
      } finally {
        setLoading(false);
      }
    };

    fetchEnriched();
  }, [open, candidate?.id]);

  // Auto-generate AI summary when panel opens
  useEffect(() => {
    if (!open || !candidate || aiSummary || summaryCache.current.has(candidate.id)) return;

    const generateSummary = async () => {
      setAiSummaryLoading(true);
      try {
        const prompt = `Write a 3-4 sentence professional summary for a healthcare recruiting context. Be factual and concise.

Name: ${candidate.full_name}
Current Role: ${candidate.title || "Unknown"} at ${candidate.current_employer || "Unknown"}
Location: ${candidate.location || "Unknown"}
Years of Experience: ${candidate.years_experience || "Unknown"}
Skills: ${(candidate.clinical_skills || candidate.skills || []).slice(0, 10).join(", ")}

Write the summary as a paragraph, not bullet points. Focus on what makes this person relevant to a healthcare recruiter.`;

        const { data, error } = await supabase.functions.invoke("pdl-search", {
          body: { action: "ai_summary", prompt },
        });

        if (!error && data?.summary) {
          setAiSummary(data.summary);
          summaryCache.current.set(candidate.id, data.summary);
        } else {
          // Fallback: construct a basic summary
          const fallback = `${candidate.full_name} is ${candidate.title ? `a ${candidate.title}` : "a healthcare professional"} ${candidate.current_employer ? `at ${candidate.current_employer}` : ""}${candidate.location ? ` based in ${candidate.location}` : ""}.${(candidate.years_experience ?? 0) > 0 ? ` They have approximately ${candidate.years_experience} years of experience in the field.` : ""}`;
          setAiSummary(fallback);
          summaryCache.current.set(candidate.id, fallback);
        }
      } catch {
        // Silent fail — summary is optional
      } finally {
        setAiSummaryLoading(false);
      }
    };

    const timer = setTimeout(generateSummary, 500);
    return () => clearTimeout(timer);
  }, [open, candidate?.id]);

  const handleSaveNotes = async () => {
    if (!candidate || !projectId) return;
    setNotesSaving(true);
    try {
      await updateNotes.mutateAsync({ id: candidate.id, notes, projectId });
      toast.success("Notes saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save notes");
    } finally {
      setNotesSaving(false);
    }
  };

  if (!candidate) return null;

  const formatDate = (d: string | null) => {
    if (!d) return "Present";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const source = enriched || candidate;
  const skills = enriched?.skills || candidate.clinical_skills || candidate.skills || [];
  const allSkills = enriched?.skills || candidate.skills || [];
  const salary = formatSalary(enriched?.inferred_salary || candidate.inferred_salary);
  const yearsExp = enriched?.inferred_years_experience || candidate.years_experience;
  const profilePic = enriched?.profile_pic_url || candidate.profile_pic_url;
  const contactEmail = enriched?.work_email || enriched?.personal_emails?.[0] || candidate.email;
  const contactPhone = enriched?.mobile_phone || enriched?.phone_numbers?.[0] || candidate.phone;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-[520px] w-full p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            {/* Header */}
            <SheetHeader className="mb-5">
              <div className="flex items-start gap-4">
                {/* Profile photo */}
                {profilePic ? (
                  <img
                    src={profilePic}
                    alt={candidate.full_name}
                    className="h-16 w-16 rounded-full object-cover border-2 border-border shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className={`h-16 w-16 rounded-full shrink-0 flex items-center justify-center text-lg font-bold ${getAvatarColor(candidate.full_name)}`}>
                    {getInitials(candidate.full_name)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <SheetTitle className="font-display text-xl leading-tight">{source.full_name || candidate.full_name}</SheetTitle>
                  <SheetDescription className="text-sm mt-1">
                    {(enriched?.job_title || candidate.title) && (
                      <span className="font-medium text-foreground/80">{enriched?.job_title || candidate.title}</span>
                    )}
                    {(enriched?.job_company_name || candidate.current_employer) && (
                      <span className="text-muted-foreground"> at {enriched?.job_company_name || candidate.current_employer}</span>
                    )}
                  </SheetDescription>

                  {/* Badge row */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {candidate.location && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                        <MapPin className="h-2.5 w-2.5 mr-1" />
                        {enriched ? [enriched.location_locality, enriched.location_region].filter(Boolean).join(", ") : candidate.location}
                      </Badge>
                    )}
                    {salary && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                        <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                        {salary}
                      </Badge>
                    )}
                    {(yearsExp ?? 0) > 0 && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-normal">
                        <Clock className="h-2.5 w-2.5 mr-1" />
                        {yearsExp} yrs exp
                      </Badge>
                    )}
                    {candidate.linkedin_url && (
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-sky-50 text-[#0A66C2] border-sky-200 font-medium cursor-pointer hover:bg-sky-100 transition-colors">
                          <Linkedin className="h-2.5 w-2.5 mr-1" />
                          LinkedIn
                        </Badge>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Enriching profile…</span>
              </div>
            )}

            {!loading && (
              <div className="space-y-5">
                {/* AI Summary */}
                <div className="rounded-lg bg-muted/50 border border-border p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI Summary
                  </h3>
                  {aiSummaryLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded animate-pulse w-full" />
                      <div className="h-3 bg-muted rounded animate-pulse w-4/5" />
                      <div className="h-3 bg-muted rounded animate-pulse w-3/5" />
                    </div>
                  ) : aiSummary ? (
                    <p className="text-sm text-foreground/80 leading-relaxed">{aiSummary}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Summary not available</p>
                  )}
                </div>

                <Separator />

                {/* Contact Info — Gated */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Contact Information
                  </h3>
                  {contactUnlocked ? (
                    <div className="space-y-0.5">
                      <InfoRow
                        icon={Mail}
                        label="Email"
                        value={contactEmail}
                        href={contactEmail ? `mailto:${contactEmail}` : undefined}
                      />
                      <InfoRow
                        icon={Phone}
                        label="Phone"
                        value={contactPhone}
                        href={contactPhone ? `tel:${contactPhone}` : undefined}
                      />
                      {enriched?.mobile_phone && enriched.mobile_phone !== contactPhone && (
                        <InfoRow
                          icon={Smartphone}
                          label="Mobile"
                          value={enriched.mobile_phone}
                          href={`tel:${enriched.mobile_phone}`}
                        />
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      onClick={() => setContactUnlocked(true)}
                    >
                      <Lock className="h-3.5 w-3.5 mr-2" />
                      Unlock Contact Info
                    </Button>
                  )}
                </div>

                <Separator />

                {/* Notes */}
                {projectId && (
                  <>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                        <StickyNote className="h-3.5 w-3.5" />
                        Notes
                      </h3>
                      <Textarea
                        placeholder="Add private notes about this candidate..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={handleSaveNotes}
                        disabled={notesSaving || notes === (candidate.notes || "")}
                      >
                        {notesSaving ? "Saving..." : "Save Notes"}
                      </Button>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Current Role */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Current Role</h3>
                  <div className="space-y-0.5">
                    <InfoRow icon={Briefcase} label="Title" value={enriched?.job_title || candidate.title} />
                    <InfoRow icon={Building2} label="Company" value={enriched?.job_company_name || candidate.current_employer} />
                    <InfoRow icon={Globe} label="Industry" value={enriched?.job_company_industry || enriched?.industry} />
                    <InfoRow icon={Users} label="Company Size" value={enriched?.job_company_size} />
                    <InfoRow icon={MapPin} label="Location" value={
                      enriched ? [enriched.location_locality, enriched.location_region, enriched.location_country].filter(Boolean).join(", ") : candidate.location
                    } />
                  </div>
                </div>

                {/* Skills */}
                {skills.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(showAllSkills ? allSkills : skills).slice(0, showAllSkills ? 50 : 15).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                      {allSkills.length > 15 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs mt-2 h-6 px-2"
                          onClick={() => setShowAllSkills(!showAllSkills)}
                        >
                          <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${showAllSkills ? "rotate-180" : ""}`} />
                          {showAllSkills ? "Show less" : `View all ${allSkills.length} skills`}
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Experience Timeline */}
                {enriched?.experience && enriched.experience.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Experience</h3>
                      <div className="space-y-0">
                        {enriched.experience.slice(0, 10).map((exp, i) => {
                          const isCurrent = !exp.end_date || exp.is_primary;
                          return (
                            <div key={i} className="relative pl-5 pb-4 last:pb-0 border-l-2 border-border ml-1">
                              <div className={`absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 ${isCurrent ? "bg-primary border-primary" : "bg-card border-muted-foreground/30"}`} />
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium leading-tight">{exp.title?.name || "Unknown Role"}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">{exp.company?.name || "Unknown Company"}</p>
                                  {exp.company?.industry && (
                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{exp.company.industry}</p>
                                  )}
                                </div>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20 shrink-0">
                                    Current
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground/70 mt-1">
                                {formatDate(exp.start_date)} — {formatDate(exp.end_date)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Education */}
                {enriched?.education && enriched.education.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Education</h3>
                      <div className="space-y-3">
                        {enriched.education.map((edu, i) => {
                          const isMedical = isMedicalEducation(edu);
                          return (
                            <div key={i} className="flex items-start gap-2.5">
                              <GraduationCap className={`h-4 w-4 mt-0.5 shrink-0 ${isMedical ? "text-primary" : "text-muted-foreground"}`} />
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="text-sm font-medium">{edu.school?.name || "Unknown School"}</p>
                                  {isMedical && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5 text-primary border-primary/20">
                                      Medical
                                    </Badge>
                                  )}
                                </div>
                                {edu.degrees?.length > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {edu.degrees.join(", ")}
                                    {edu.majors?.length > 0 && ` in ${edu.majors.join(", ")}`}
                                  </p>
                                )}
                                {edu.start_date && (
                                  <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                    {formatDate(edu.start_date)} — {formatDate(edu.end_date)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Summary from PDL */}
                {enriched?.summary && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bio</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{enriched.summary}</p>
                    </div>
                  </>
                )}

                {error && (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">{error}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions Bar */}
          <div className="sticky bottom-0 bg-card border-t border-border p-3 flex items-center gap-2">
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled>
              <FolderPlus className="h-3 w-3 mr-1.5" />
              Save to List
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" disabled>
              <Download className="h-3 w-3 mr-1.5" />
              Export
            </Button>
            {candidate.linkedin_url && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs px-3"
                onClick={() => {
                  navigator.clipboard.writeText(candidate.linkedin_url!);
                  toast.success("LinkedIn URL copied");
                }}
              >
                <Copy className="h-3 w-3 mr-1.5" />
                Copy LinkedIn
              </Button>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
