import { useState, useEffect } from "react";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CandidateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    full_name: string;
    title: string | null;
    current_employer: string | null;
    location: string | null;
    linkedin_url: string | null;
    email: string | null;
    phone?: string | null;
    skills: string[];
    avg_tenure_months: number | null;
    industry: string | null;
    company_size: string | null;
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

export function CandidateDrawer({ open, onOpenChange, candidate }: CandidateDrawerProps) {
  const [enriched, setEnriched] = useState<EnrichedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !candidate) {
      setEnriched(null);
      setError(null);
      return;
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

  if (!candidate) return null;

  const formatTenure = (months: number | null) => {
    if (!months) return null;
    if (months < 12) return `${months} months`;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    return remaining > 0 ? `${years}y ${remaining}mo` : `${years} years`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "Present";
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const source = enriched || candidate;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full p-0">
        <ScrollArea className="h-full">
          <div className="p-6">
            <SheetHeader className="mb-5">
              <SheetTitle className="font-display text-xl">{source.full_name || candidate.full_name}</SheetTitle>
              <SheetDescription className="text-sm">
                {(enriched?.job_title || candidate.title) && (
                  <span>{enriched?.job_title || candidate.title}</span>
                )}
                {(enriched?.job_company_name || candidate.current_employer) && (
                  <span> at {enriched?.job_company_name || candidate.current_employer}</span>
                )}
              </SheetDescription>
            </SheetHeader>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Enriching profile…</span>
              </div>
            )}

            {!loading && (
              <div className="space-y-5">
                {/* Contact Info */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact</h3>
                  <div className="space-y-0.5">
                    <InfoRow
                      icon={Mail}
                      label="Email"
                      value={enriched?.work_email || enriched?.personal_emails?.[0] || candidate.email}
                      href={`mailto:${enriched?.work_email || candidate.email}`}
                    />
                    <InfoRow
                      icon={Phone}
                      label="Phone"
                      value={enriched?.mobile_phone || enriched?.phone_numbers?.[0] || candidate.phone}
                    />
                    <InfoRow
                      icon={MapPin}
                      label="Location"
                      value={
                        enriched
                          ? [enriched.location_locality, enriched.location_region, enriched.location_country].filter(Boolean).join(", ")
                          : candidate.location
                      }
                    />
                    <InfoRow
                      icon={ExternalLink}
                      label="LinkedIn"
                      value={enriched?.linkedin_url || candidate.linkedin_url}
                      href={enriched?.linkedin_url || candidate.linkedin_url || undefined}
                    />
                  </div>
                </div>

                <Separator />

                {/* Current Role */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Current Role</h3>
                  <div className="space-y-0.5">
                    <InfoRow icon={Briefcase} label="Title" value={enriched?.job_title || candidate.title} />
                    <InfoRow icon={Building2} label="Company" value={enriched?.job_company_name || candidate.current_employer} />
                    <InfoRow icon={Globe} label="Industry" value={enriched?.job_company_industry || enriched?.industry || candidate.industry} />
                    <InfoRow icon={Users} label="Company Size" value={enriched?.job_company_size || candidate.company_size} />
                    {candidate.avg_tenure_months && (
                      <InfoRow icon={Clock} label="Avg Tenure" value={formatTenure(candidate.avg_tenure_months)} />
                    )}
                  </div>
                </div>

                {/* Skills */}
                {((enriched?.skills && enriched.skills.length > 0) || candidate.skills.length > 0) && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {(enriched?.skills || candidate.skills).slice(0, 20).map((skill) => (
                          <Badge key={skill} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Experience */}
                {enriched?.experience && enriched.experience.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Experience</h3>
                      <div className="space-y-3">
                        {enriched.experience.slice(0, 8).map((exp, i) => (
                          <div key={i} className="relative pl-4 border-l-2 border-border">
                            <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                            <p className="text-sm font-medium">{exp.title?.name || "Unknown Role"}</p>
                            <p className="text-xs text-muted-foreground">
                              {exp.company?.name || "Unknown Company"}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                              {formatDate(exp.start_date)} — {formatDate(exp.end_date)}
                            </p>
                          </div>
                        ))}
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
                        {enriched.education.map((edu, i) => (
                          <div key={i} className="flex items-start gap-2.5">
                            <GraduationCap className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{edu.school?.name || "Unknown School"}</p>
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
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Summary */}
                {enriched?.summary && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Summary</h3>
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
