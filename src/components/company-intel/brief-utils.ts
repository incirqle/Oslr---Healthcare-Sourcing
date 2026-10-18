import type { MovementPerson, PullGroup, RoleGroup } from "@/hooks/useCompanyBrief";

export const ROLE_SHORT: Record<RoleGroup, string> = {
  physician: "Doctor",
  app: "PA or NP",
  crna: "CRNA",
  trainee: "Resident or fellow",
  nursing: "Nurse",
  therapy: "Therapy",
  clinical_support: "Clinical staff",
  admin: "Admin",
  other: "Other",
};

export const GROUP_ORDER: PullGroup[] = ["doctors", "trainees", "apps", "nurses", "clinical", "executive", "admin"];

export const GROUP_LABEL: Record<PullGroup, string> = {
  doctors: "Doctors",
  trainees: "Residents and fellows",
  apps: "PAs, NPs and CRNAs",
  nurses: "Nurses",
  clinical: "Clinical staff",
  executive: "Executive staff",
  admin: "Admin and front office",
};

/** Movement filter buckets. */
export type MoveFilter = "all" | "doctors" | "apps" | "clinical" | "staff";
export const MOVE_FILTERS: { key: MoveFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "doctors", label: "Doctors" },
  { key: "apps", label: "PAs and NPs" },
  { key: "clinical", label: "Nurses and clinical" },
  { key: "staff", label: "Staff" },
];
export function inMoveFilter(p: MovementPerson, f: MoveFilter): boolean {
  const g = p.role_group;
  if (f === "all") return true;
  if (f === "doctors") return g === "physician";
  if (f === "apps") return g === "app" || g === "crna";
  if (f === "clinical") return g === "trainee" || g === "nursing" || g === "therapy" || g === "clinical_support";
  return g === "admin" || g === "other";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2022-07-01T00:00:00" → "Jul 2022". Parsed by hand so time zones never shift the month. */
export function fmtMonth(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})/);
  if (!m) return iso.slice(0, 4);
  return `${MONTHS[Number(m[2]) - 1] ?? ""} ${m[1]}`.trim();
}

/** Time since a start date: "4 yr", "8 mo". */
export function tenure(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const months = Math.max(0, Math.round((now - t) / (30.44 * 86_400_000)));
  return months < 12 ? `${months} mo` : `${Math.floor(months / 12)} yr`;
}

export function fmtCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "–";
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString();
}

/** Credits with two decimals, trailing zeros trimmed: 0.36, 1.5, 3. */
export function fmtCredits(n: number): string {
  if (n > 0 && n < 0.01) return "<0.01";
  return String(Math.round(n * 100) / 100);
}

export interface NetFlowRow {
  company: string;
  linkedin_url: string | null;
  joined_from: number;
  left_to: number;
}

/** Companies that trade staff with this one: hires who came from them, departures who went to them. */
export function netFlow(hires: MovementPerson[], departures: MovementPerson[], limit = 8): NetFlowRow[] {
  const m = new Map<string, NetFlowRow>();
  const add = (name: string | null, url: string | null, key: "joined_from" | "left_to") => {
    if (!name || !name.trim()) return;
    const k = name.trim().toLowerCase();
    const row = m.get(k) ?? { company: name.trim(), linkedin_url: url, joined_from: 0, left_to: 0 };
    row[key]++;
    if (!row.linkedin_url) row.linkedin_url = url;
    m.set(k, row);
  };
  for (const h of hires) add(h.previous_company, h.previous_company_linkedin_url, "joined_from");
  for (const d of departures) add(d.current_company, d.current_company_linkedin_url, "left_to");
  return [...m.values()]
    .sort((a, b) => b.joined_from + b.left_to - (a.joined_from + a.left_to) || a.company.localeCompare(b.company))
    .slice(0, limit);
}

export const OWNERSHIP_LABEL: Record<string, string> = {
  private_practice: "Independent practice",
  hospital_employed: "Health system",
};
