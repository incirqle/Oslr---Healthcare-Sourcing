export type RoleGroup = "physician" | "nursing";

export interface SalaryPreset {
  id: string;
  label: string;
  sublabel: string;
  salaryBuckets: string[];
  jobTitleClasses: string[];
  experienceHint?: { gte?: number; lte?: number };
}

export const PHYSICIAN_PRESETS: SalaryPreset[] = [
  {
    id: "resident_fellow",
    label: "Resident / Fellow",
    sublabel: "Training-stage physicians",
    salaryBuckets: ["55,000-70,000", "70,000-85,000"],
    jobTitleClasses: ["physicians and surgeons", "medical residents", "medical fellows"],
    experienceHint: { gte: 0, lte: 4 },
  },
  {
    id: "early_attending",
    label: "Early Attending",
    sublabel: "1–3 yrs post-training",
    salaryBuckets: ["100,000-150,000", "150,000-250,000"],
    jobTitleClasses: ["physicians and surgeons"],
    experienceHint: { gte: 1, lte: 5 },
  },
  {
    id: "established_attending",
    label: "Established Attending",
    sublabel: "Most practicing physicians",
    salaryBuckets: ["150,000-250,000", "> 250,000"],
    jobTitleClasses: ["physicians and surgeons"],
    experienceHint: { gte: 5 },
  },
  {
    id: "high_earner_surgical",
    label: "Surgical / High-Earning Specialist",
    sublabel: "Ortho, spine, cards, neuro, etc.",
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
    salaryBuckets: ["55,000-70,000", "70,000-85,000", "85,000-100,000"],
    jobTitleClasses: ["registered nurses"],
    experienceHint: { gte: 0, lte: 15 },
  },
  {
    id: "senior_rn",
    label: "Senior / Charge RN",
    sublabel: "Experienced floor leadership",
    salaryBuckets: ["85,000-100,000", "100,000-150,000"],
    jobTitleClasses: ["registered nurses"],
    experienceHint: { gte: 5 },
  },
  {
    id: "np_pa",
    label: "NP / PA",
    sublabel: "Advanced practice providers",
    salaryBuckets: ["100,000-150,000", "150,000-250,000"],
    jobTitleClasses: ["nurse practitioners", "physician assistants"],
    experienceHint: { gte: 2 },
  },
  {
    id: "crna",
    label: "CRNA",
    sublabel: "Certified Registered Nurse Anesthetist",
    salaryBuckets: ["150,000-250,000", "> 250,000"],
    jobTitleClasses: ["nurse anesthetists"],
    experienceHint: { gte: 3 },
  },
  {
    id: "nurse_leadership",
    label: "Nurse Leadership",
    sublabel: "CNO, Director, Nurse Manager",
    salaryBuckets: ["100,000-150,000", "150,000-250,000"],
    jobTitleClasses: ["nursing directors", "chief nursing officers", "nurse managers"],
    experienceHint: { gte: 8 },
  },
];

/** Format a PDL salary bucket string to human-readable form */
export function formatBucketLabel(bucket: string): string {
  if (bucket.startsWith(">")) return "$250K+";
  if (bucket.startsWith("<")) return "< $20K";
  const parts = bucket.split("-").map((p) => p.trim().replace(/,/g, ""));
  if (parts.length === 2) {
    const low = Math.round(parseInt(parts[0], 10) / 1000);
    const high = Math.round(parseInt(parts[1], 10) / 1000);
    if (!isNaN(low) && !isNaN(high)) return `$${low}K–$${high}K`;
  }
  return bucket;
}

/** Get human-readable salary range for a preset */
export function presetSalaryRange(preset: SalaryPreset): string {
  if (preset.salaryBuckets.length === 0) return "";
  const first = preset.salaryBuckets[0];
  const last = preset.salaryBuckets[preset.salaryBuckets.length - 1];

  if (last.startsWith(">")) {
    const firstParts = first.split("-").map((p) => p.trim().replace(/,/g, ""));
    const low = Math.round(parseInt(firstParts[0], 10) / 1000);
    return isNaN(low) ? "$250K+" : `$${low}K–$250K+`;
  }

  const firstParts = first.split("-").map((p) => p.trim().replace(/,/g, ""));
  const lastParts = last.split("-").map((p) => p.trim().replace(/,/g, ""));
  const low = Math.round(parseInt(firstParts[0], 10) / 1000);
  const high = Math.round(parseInt(lastParts[lastParts.length - 1], 10) / 1000);

  if (!isNaN(low) && !isNaN(high)) return `$${low}K–$${high}K`;
  return "";
}
