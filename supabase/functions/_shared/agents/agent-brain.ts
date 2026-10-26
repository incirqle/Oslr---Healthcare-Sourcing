// Pure learning model for clinician agents. No I/O.
// Approvals boost the decided person's features (+15% to +40%), passes cut
// them (-30% to -80%), city skips become hard rules. Unreviewed people are
// re-ranked as base_score x product(feature weights).

export interface AgentPreferences {
  weights: Record<string, number>;
  skip: { cities: string[]; employers: string[] };
}

export interface PoolRowLike {
  id: string;
  features: string[];
  base_score: number;
  city?: string | null;
  employer?: string | null;
}

export const APPROVE_TAGS = [
  { id: "specialty_fit", label: "Specialty fit" },
  { id: "practice_owner", label: "Practice owner or partner" },
  { id: "leadership", label: "Leadership role" },
  { id: "right_area", label: "Right area" },
  { id: "career_stage", label: "Right career stage" },
] as const;

export const PASS_TAGS = [
  { id: "wrong_area", label: "Wrong area" },
  { id: "wrong_specialty", label: "Wrong specialty" },
  { id: "too_junior", label: "Too junior" },
  { id: "in_training", label: "In training" },
  { id: "wrong_setting", label: "Wrong practice setting" },
] as const;

export const MIN_WEIGHT = 0.05;
export const MAX_WEIGHT = 3;

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function emptyPreferences(): AgentPreferences {
  return { weights: {}, skip: { cities: [], employers: [] } };
}

/** Feature keys for one profile row from the search engine. */
export function featuresFor(row: Record<string, unknown>): string[] {
  const out: string[] = [];
  const title = String(row.title ?? "").toLowerCase();
  const employer = String(row.current_employer ?? "");
  const loc = String(row.location ?? "");
  let role = "clinician";
  if (/\b(resident|fellow|intern|student|trainee)\b/.test(title)) role = "trainee";
  else if (/\b(owner|founder|co-founder|partner|principal|president)\b/.test(title)) role = "owner";
  else if (/\b(chief|director|chair|head|vp|vice president|lead|medical director)\b/.test(title)) role = "leadership";
  out.push("role:" + role);
  const e = employer.toLowerCase();
  if (e) {
    out.push("employer:" + norm(employer));
    const setting = /universit|college|school of medicine|academic/.test(e)
      ? "academic"
      : /hospital|health system|medical center|healthcare system|health$/.test(e)
      ? "hospital"
      : "private";
    out.push("setting:" + setting);
  }
  const parts = loc.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts[0]) out.push("city:" + norm(parts[0]));
  if (parts[1]) out.push("state:" + norm(parts[1]));
  return out;
}

const pick = (features: string[], prefix: string) => features.filter((f) => f.startsWith(prefix));

/** Multiplier deltas for one decision. Every value is within the documented ranges. */
export function decisionDeltas(
  decision: "approved" | "passed",
  tags: string[],
  features: string[],
): Record<string, number> {
  const d: Record<string, number> = {};
  const set = (keys: string[], m: number) => keys.forEach((k) => { d[k] = m; });
  if (decision === "approved") {
    if (tags.length === 0) set(features, 1.15);
    for (const t of tags) {
      if (t === "practice_owner") set(["role:owner"], 1.4);
      if (t === "leadership") set(["role:leadership"], 1.3);
      if (t === "right_area") { set(pick(features, "city:"), 1.25); set(pick(features, "state:"), 1.15); }
      if (t === "career_stage") set(pick(features, "role:"), 1.2);
      if (t === "specialty_fit") { set(pick(features, "setting:"), 1.15); set(pick(features, "employer:"), 1.2); }
    }
  } else {
    if (tags.length === 0) set(features, 0.7);
    for (const t of tags) {
      if (t === "wrong_area") { set(pick(features, "city:"), 0.4); set(pick(features, "state:"), 0.7); }
      if (t === "wrong_specialty") set(pick(features, "employer:"), 0.5);
      if (t === "too_junior") set(pick(features, "role:"), 0.5);
      if (t === "in_training") set(["role:trainee"], 0.2);
      if (t === "wrong_setting") set(pick(features, "setting:"), 0.4);
    }
  }
  return d;
}

export function applyDecision(
  prefs: AgentPreferences,
  decision: "approved" | "passed",
  tags: string[],
  features: string[],
  skipCity?: string | null,
): AgentPreferences {
  const weights = { ...prefs.weights };
  for (const [k, m] of Object.entries(decisionDeltas(decision, tags, features))) {
    weights[k] = Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, (weights[k] ?? 1) * m));
  }
  const cities = [...prefs.skip.cities];
  if (skipCity && !cities.some((c) => norm(c) === norm(skipCity))) cities.push(skipCity.trim());
  return { weights, skip: { cities, employers: [...prefs.skip.employers] } };
}

export function boostFor(prefs: AgentPreferences, features: string[]): number {
  return features.reduce((acc, f) => acc * (prefs.weights[f] ?? 1), 1);
}

export function isSkipped(prefs: AgentPreferences, features: string[]): boolean {
  const cities = prefs.skip.cities.map((c) => "city:" + norm(c));
  const emps = prefs.skip.employers.map((c) => "employer:" + norm(c));
  return features.some((f) => cities.includes(f) || emps.includes(f));
}

/** Re-score rows; skipped rows are flagged pruned and sorted last. */
export function rerank<T extends PoolRowLike>(prefs: AgentPreferences, rows: T[]) {
  return rows
    .map((r) => {
      const boost = boostFor(prefs, r.features);
      const pruned = isSkipped(prefs, r.features);
      return { ...r, boost, final_score: r.base_score * boost, pruned };
    })
    .sort((a, b) => Number(a.pruned) - Number(b.pruned) || b.final_score - a.final_score);
}

/** Share of approvals carrying each feature, for the "Ranks higher" list. */
export function approvalSignals(
  decisions: { decision: string; features: string[] }[],
): { feature: string; share: number }[] {
  const approved = decisions.filter((d) => d.decision === "approved");
  if (approved.length === 0) return [];
  const counts: Record<string, number> = {};
  for (const d of approved) for (const f of new Set(d.features)) counts[f] = (counts[f] ?? 0) + 1;
  return Object.entries(counts)
    .filter(([f]) => !f.startsWith("employer:"))
    .map(([feature, n]) => ({ feature, share: n / approved.length }))
    .filter((s) => s.share >= 0.5)
    .sort((a, b) => b.share - a.share)
    .slice(0, 6);
}
