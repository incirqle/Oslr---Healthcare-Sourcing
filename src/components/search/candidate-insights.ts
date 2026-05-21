/**
 * candidate-insights.ts — derive Juicebox-style achievement signals and
 * group experience entries by parent company. Pure functions, no PDL call.
 */

import { toTitleCase } from "./candidate-ui";

export interface ExperienceEntryLike {
  title: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  logoDomain: string | null;
  location?: string | null;
  summary?: string | null;
  salary?: string | null;
}

export interface EducationEntryLike {
  school: string | null;
}

export type AchievementId =
  | "promoted"
  | "high_tenure"
  | "long_tenure"
  | "international"
  | "top_school"
  | "career_switcher";

export interface Achievement {
  id: AchievementId;
  label: string;
  reason: string;
}

const SENIORITY_RANK: Array<[RegExp, number]> = [
  [/\bchief\b|\bcco\b|\bceo\b|\bcfo\b|\bcoo\b|\bcmo\b|\bcto\b/i, 100],
  [/\bpresident\b|\bevp\b|\bsvp\b/i, 90],
  [/\bvice president\b|\bvp\b/i, 80],
  [/\bsr\.?\s|senior\s/i, 70],
  [/\bdirector\b/i, 65],
  [/\bhead of\b/i, 60],
  [/\bmanager\b/i, 50],
  [/\blead\b|\bprincipal\b/i, 45],
  [/\bspecialist\b|\bconsultant\b/i, 40],
  [/\bassociate\b|\bcoordinator\b/i, 30],
  [/\bassistant\b|\bjunior\b|\bjr\.?\s/i, 20],
  [/\bintern\b|\btrainee\b/i, 10],
];

export function inferSeniority(title: string | null): number {
  if (!title) return 0;
  for (const [pattern, rank] of SENIORITY_RANK) if (pattern.test(title)) return rank;
  return 35;
}

function monthsBetween(start: string | null, end: string | null): number {
  if (!start) return 0;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
}

// Small curated top-school list — recognizable US programs across med/nursing/general.
const TOP_SCHOOLS = [
  "harvard", "stanford", "yale", "princeton", "mit", "columbia", "cornell",
  "university of pennsylvania", "duke", "johns hopkins", "northwestern",
  "university of chicago", "dartmouth", "brown", "berkeley", "ucla", "ucsf",
  "university of michigan", "university of north carolina", "vanderbilt",
  "washington university", "emory", "mayo clinic", "baylor", "case western",
  "university of washington", "university of pittsburgh", "ohio state",
  "university of virginia", "georgetown", "university of texas", "nyu",
  "university of illinois", "university of wisconsin", "boston university",
];

function isTopSchool(name: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return TOP_SCHOOLS.some((s) => lower.includes(s));
}

function trailingCountry(location: string | null | undefined): string | null {
  if (!location) return null;
  const parts = location.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return parts[parts.length - 1].toLowerCase();
}

export function deriveAchievements(
  experience: ExperienceEntryLike[],
  education: EducationEntryLike[],
): Achievement[] {
  const out: Achievement[] = [];

  // Group consecutive same-company entries to detect promotions
  const groups = groupExperienceByCompany(experience);
  let promotions = 0;
  for (const g of groups) {
    if (g.roles.length < 2) continue;
    // Roles in PDL are typically newest-first. Walk newer→older and count ascending seniority.
    for (let i = 0; i < g.roles.length - 1; i += 1) {
      const newer = g.roles[i];
      const older = g.roles[i + 1];
      if (inferSeniority(newer.title) > inferSeniority(older.title)) promotions += 1;
    }
  }
  if (promotions >= 1) {
    const label = promotions === 1 ? "Promoted" : promotions === 2 ? "Promoted Twice" : `Promoted ${promotions}x`;
    out.push({ id: "promoted", label, reason: `Title progression at the same employer (${promotions} step${promotions === 1 ? "" : "s"})` });
  }

  // Tenure stats
  const tenures = experience
    .map((e) => monthsBetween(e.startDate, e.endDate))
    .filter((m) => m > 0);
  if (tenures.length >= 2) {
    const avg = tenures.reduce((a, b) => a + b, 0) / tenures.length;
    if (avg >= 48) {
      out.push({ id: "high_tenure", label: "High Avg. Tenure", reason: `Average role length ${(avg / 12).toFixed(1)} years` });
    }
  }
  const longest = Math.max(0, ...tenures);
  if (longest >= 96) {
    out.push({ id: "long_tenure", label: "Long Tenure", reason: `One role ≥ ${Math.floor(longest / 12)} years` });
  }

  // International experience — distinct trailing countries across roles
  const countries = new Set<string>();
  for (const e of experience) {
    const c = trailingCountry(e.location);
    if (c) countries.add(c);
  }
  if (countries.size >= 2) {
    out.push({ id: "international", label: "International Exp.", reason: `Worked across ${countries.size} countries` });
  }

  // Top school
  const matchedSchool = education.find((e) => isTopSchool(e.school));
  if (matchedSchool && matchedSchool.school) {
    out.push({ id: "top_school", label: "Top US University", reason: `Educated at ${toTitleCase(matchedSchool.school)}` });
  }

  // Career switcher — distinct companies across many years
  const companies = new Set(experience.map((e) => (e.company || "").toLowerCase().trim()).filter(Boolean));
  if (companies.size >= 5 && experience.length >= 5) {
    out.push({ id: "career_switcher", label: "Diverse Background", reason: `${companies.size} different employers across career` });
  }

  return out.slice(0, 6);
}

export interface CompanyGroup {
  company: string | null;
  logoDomain: string | null;
  totalMonths: number;
  roles: ExperienceEntryLike[];
}

/**
 * Group consecutive same-company entries into a single block. Preserves
 * original order so PDL's newest-first ordering is maintained.
 */
export function groupExperienceByCompany(entries: ExperienceEntryLike[]): CompanyGroup[] {
  const groups: CompanyGroup[] = [];
  for (const entry of entries) {
    const key = (entry.company || "").toLowerCase().trim();
    const last = groups[groups.length - 1];
    if (last && (last.company || "").toLowerCase().trim() === key) {
      last.roles.push(entry);
      last.logoDomain = last.logoDomain || entry.logoDomain;
    } else {
      groups.push({
        company: entry.company,
        logoDomain: entry.logoDomain,
        totalMonths: 0,
        roles: [entry],
      });
    }
  }
  // Compute total tenure per company across min(start) → max(end)
  for (const g of groups) {
    const starts = g.roles.map((r) => r.startDate).filter(Boolean) as string[];
    const ends = g.roles.map((r) => r.endDate);
    const minStart = starts.sort()[0] || null;
    const hasOpen = ends.some((e) => !e);
    const maxEnd = hasOpen ? null : (ends.filter(Boolean) as string[]).sort().slice(-1)[0] || null;
    g.totalMonths = monthsBetween(minStart, maxEnd);
  }
  return groups;
}

export function formatMonths(months: number): string {
  if (months <= 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo${m === 1 ? "" : "s"}`;
  if (m === 0) return `${y} yr${y === 1 ? "" : "s"}`;
  return `${y} yr${y === 1 ? "" : "s"} ${m} mo${m === 1 ? "" : "s"}`;
}

export function isPromotion(newer: ExperienceEntryLike, older: ExperienceEntryLike): boolean {
  return inferSeniority(newer.title) > inferSeniority(older.title);
}
