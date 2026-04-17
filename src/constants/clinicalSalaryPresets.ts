/**
 * Clinical salary presets — map role tiers to PDL inferred_salary keyword buckets
 * and job_title_class values.
 *
 * inferred_salary is a KEYWORD field — must use exact bucket strings via terms query.
 * inferred_years_experience is numeric and opt-in (lower fill rate on nursing profiles).
 */

export type RoleGroup = "physician" | "nursing";

export interface SalaryPreset {
  id: string;
  label: string;
  sublabel: string;
  /** Human-readable salary range (e.g. "$150K–$250K+") */
  rangeLabel: string;
  salaryBuckets: string[];
  jobTitleClasses: string[];
  experienceHint?: { gte?: number; lte?: number };
}

export const PHYSICIAN_PRESETS: SalaryPreset[] = [
  {
    id: "resident_fellow",
    label: "Resident / Fellow",
    sublabel: "Training-stage physicians",
    rangeLabel: "$55K–$85K",
    salaryBuckets: ["55,000-70,000", "70,000-85,000"],
    jobTitleClasses: ["physicians and surgeons", "medical residents", "medical fellows"],
    experienceHint: { gte: 0, lte: 4 },
  },
  {
    id: "early_attending",
    label: "Early Attending",
    sublabel: "1–3 yrs post-training",
    rangeLabel: "$100K–$250K",
    salaryBuckets: ["100,000-150,000", "150,000-250,000"],
    jobTitleClasses: ["physicians and surgeons"],
    experienceHint: { gte: 1, lte: 5 },
  },
  {
    id: "established_attending",
    label: "Established Attending",
    sublabel: "Most practicing physicians",
    rangeLabel: "$150K–$250K+",
    salaryBuckets: ["150,000-250,000", "> 250,000"],
    jobTitleClasses: ["physicians and surgeons"],
    experienceHint: { gte: 5 },
  },
  {
    id: "high_earner_surgical",
    label: "Surgical / High-Earning Specialist",
    sublabel: "Ortho, spine, cards, neuro, etc.",
    rangeLabel: "$250K+",
    salaryBuckets: ["> 250,000"],
    jobTitleClasses: ["physicians and surgeons"],
    experienceHint: { gte: 5 },
  },
];

export const NURSING_PRESETS: SalaryPreset[] = [
  {
    id: "staff_rn",
    label: "Staff RN",
    sublabel: "Bedside / floor nursing",
    rangeLabel: "$55K–$100K",
    salaryBuckets: ["55,000-70,000", "70,000-85,000", "85,000-100,000"],
    jobTitleClasses: ["registered nurses"],
    experienceHint: { gte: 0, lte: 15 },
  },
  {
    id: "senior_rn",
    label: "Senior / Charge RN",
    sublabel: "Experienced floor leadership",
    rangeLabel: "$85K–$150K",
    salaryBuckets: ["85,000-100,000", "100,000-150,000"],
    jobTitleClasses: ["registered nurses"],
    experienceHint: { gte: 5 },
  },
  {
    id: "np_pa",
    label: "NP / PA",
    sublabel: "Advanced practice providers",
    rangeLabel: "$100K–$250K",
    salaryBuckets: ["100,000-150,000", "150,000-250,000"],
    jobTitleClasses: ["nurse practitioners", "physician assistants"],
    experienceHint: { gte: 2 },
  },
  {
    id: "crna",
    label: "CRNA",
    sublabel: "Certified Registered Nurse Anesthetist",
    rangeLabel: "$150K–$250K+",
    salaryBuckets: ["150,000-250,000", "> 250,000"],
    jobTitleClasses: ["nurse anesthetists"],
    experienceHint: { gte: 3 },
  },
  {
    id: "nurse_leadership",
    label: "Nurse Leadership",
    sublabel: "CNO, Director, Nurse Manager",
    rangeLabel: "$100K–$250K",
    salaryBuckets: ["100,000-150,000", "150,000-250,000"],
    jobTitleClasses: ["nursing directors", "chief nursing officers", "nurse managers"],
    experienceHint: { gte: 8 },
  },
];

export const ALL_PRESETS: SalaryPreset[] = [...PHYSICIAN_PRESETS, ...NURSING_PRESETS];

export function findPresetById(id: string | undefined | null): SalaryPreset | null {
  if (!id) return null;
  return ALL_PRESETS.find((p) => p.id === id) ?? null;
}

/**
 * Format a raw PDL inferred_salary bucket string ("85,000-100,000", "> 250,000")
 * into a compact human-readable label like "$85K–$100K" or "$250K+".
 */
export function formatSalaryBucket(bucket: string | null | undefined): string | null {
  if (!bucket) return null;
  const trimmed = bucket.trim();
  if (trimmed.startsWith(">")) {
    const num = parseInt(trimmed.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(num)) return null;
    return `$${Math.round(num / 1000)}K+`;
  }
  if (trimmed.startsWith("<")) {
    const num = parseInt(trimmed.replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(num)) return null;
    return `<$${Math.round(num / 1000)}K`;
  }
  const parts = trimmed.split("-").map((p) => parseInt(p.replace(/[^\d]/g, ""), 10));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  return `$${Math.round(parts[0] / 1000)}K–$${Math.round(parts[1] / 1000)}K`;
}
