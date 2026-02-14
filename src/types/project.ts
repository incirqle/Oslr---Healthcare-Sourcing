export interface ProjectCandidate {
  id: string;
  full_name: string;
  title: string | null;
  current_employer: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  avg_tenure_months: number | null;
  industry: string | null;
  company_size: string | null;
  status: "new" | "contacted" | "interested" | "hired";
  notes: string | null;
  tags: string[];
  added_at: string;
  pdl_id: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  candidates: ProjectCandidate[];
}

export type CandidateStatus = "new" | "contacted" | "interested" | "hired";

export const STATUS_CONFIG: Record<CandidateStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-secondary text-secondary-foreground" },
  contacted: { label: "Contacted", color: "bg-primary/10 text-primary" },
  interested: { label: "Interested", color: "bg-warning/10 text-warning" },
  hired: { label: "Hired", color: "bg-success/10 text-success" },
};
