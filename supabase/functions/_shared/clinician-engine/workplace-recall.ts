/**
 * Workplace-based recall for current trainees.
 *
 * A resident or fellow often updates their program before their home city.
 * The ordinary local search therefore teaches us which employers operate in
 * the requested market; a second pass searches those same employers without
 * a personal-location gate. Role, specialty and every other hard criterion
 * stay intact, and the normal market/year checks still run downstream.
 *
 * Pure helpers only: the handler owns provider calls and credit ceilings.
 */
import type { LocationValue, SearchCriteria } from "./clinician-criteria.ts";

type Row = Record<string, unknown>;

export interface WorkplaceAnchors {
  company_ids: number[];
  name_variants: string[];
}

const CURRENT_TRAINEE = /\b(?:resident|residency|fellow|fellowship|intern|internship|medical\s+student|nursing\s+student|house\s+(?:officer|staff)|pgy[\s-]*\d)\b/i;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function currentTraineeLocation(criteria: SearchCriteria[]): boolean {
  const training = criteria.some((c) => c.kind === "training_stage" && c.enforcement === "hard");
  if (!training) return false;
  return criteria.some((c) => {
    if (c.kind !== "location" || c.enforcement !== "hard") return false;
    const value = c.value as LocationValue;
    return value.level === "city" || value.level === "region";
  });
}

/**
 * Frequent current training employers in the local pool become recall
 * anchors. IDs preserve the exact employer entity; names cover profiles that
 * did not resolve an ID. At most eight employers keep the filter tree small.
 */
export function collectWorkplaceAnchors(rows: Row[], limit = 8): WorkplaceAnchors {
  const counts = new Map<string, { name: string; id: number | null; count: number; first: number }>();
  rows.forEach((row, rowIndex) => {
    const employers = Array.isArray(row.current_employers) ? row.current_employers as Row[] : [];
    const seenInRow = new Set<string>();
    for (const employer of employers) {
      if (!CURRENT_TRAINEE.test(text(employer.title))) continue;
      const name = text(employer.name ?? employer.company_name ?? employer.company);
      if (name.length < 3) continue;
      const key = name.toLowerCase();
      if (seenInRow.has(key)) continue;
      seenInRow.add(key);
      const rawId = employer.crustdata_company_id ?? employer.company_id;
      const id = typeof rawId === "number" && Number.isFinite(rawId) ? rawId : null;
      const prior = counts.get(key);
      counts.set(key, {
        name,
        id: prior?.id ?? id,
        count: (prior?.count ?? 0) + 1,
        first: prior?.first ?? rowIndex,
      });
    }
  });
  const selected = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit));
  return {
    company_ids: [...new Set(selected.map((x) => x.id).filter((x): x is number => x !== null))],
    name_variants: selected.map((x) => x.name.toLowerCase()),
  };
}

/**
 * Build the location-free workplace pass. A user-named current employer is
 * already the anchor; otherwise use employers learned from the local pool,
 * plus any curated residency-program variants supplied by the caller.
 */
export function buildWorkplaceRecallCriteria(
  criteria: SearchCriteria[],
  localRows: Row[],
  curatedVariants: readonly string[] = [],
): SearchCriteria[] | null {
  if (!currentTraineeLocation(criteria)) return null;
  const withoutMarket = criteria.filter((c) => {
    if (c.kind !== "location") return true;
    // A country remains a useful hard boundary if one was explicitly given.
    return (c.value as LocationValue).level === "country";
  });
  const namedEmployer = criteria.some((c) =>
    (c.kind === "company" || c.kind === "employer_group") && c.enforcement === "hard"
  );
  if (namedEmployer) return withoutMarket;

  const anchors = collectWorkplaceAnchors(localRows);
  const names = [...new Set([...curatedVariants, ...anchors.name_variants]
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean))];
  if (anchors.company_ids.length === 0 && names.length === 0) return null;
  return [
    ...withoutMarket,
    {
      id: "workplace_recall",
      kind: "employer_group",
      label: "Local training workplaces",
      enforcement: "hard",
      source: "inferred",
      evidenceSource: "search",
      value: {
        group_key: "local_training_workplaces",
        name: "Local training workplaces",
        company_ids: anchors.company_ids,
        domains: [],
        name_variants: names,
      },
    } as SearchCriteria,
  ];
}

const normalizedName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Split workplace recall into one query per program, with separate queries
 * for local employers not represented by the curated directory. This keeps a
 * large health system from consuming every row before smaller programs are
 * searched. The handler gives each pass the same page limit and credit rules.
 */
export function buildWorkplaceRecallPasses(
  criteria: SearchCriteria[],
  localRows: Row[],
  curatedPrograms: readonly (readonly string[])[] = [],
): SearchCriteria[][] {
  const curatedVariants = curatedPrograms.flat();
  const combined = buildWorkplaceRecallCriteria(criteria, localRows, curatedVariants);
  if (!combined) return [];
  if (!combined.some((c) => c.id === "workplace_recall")) return [combined];

  const withoutMarket = combined.filter((c) => c.id !== "workplace_recall");
  const anchors = collectWorkplaceAnchors(localRows);
  const curatedNames = curatedVariants.map(normalizedName).filter(Boolean);
  const uncovered = anchors.name_variants.filter((name) => {
    const n = normalizedName(name);
    return !curatedNames.some((v) => n.includes(v) || v.includes(n));
  });
  const groups = [
    ...curatedPrograms.map((group) => [...group]),
    ...uncovered.map((name) => [name]),
  ].map((group) => [...new Set(group.map((x) => x.trim().toLowerCase()).filter(Boolean))])
    .filter((group) => group.length > 0);

  return groups.map((names, index) => [
    ...withoutMarket,
    {
      id: `workplace_recall_${index}`,
      kind: "employer_group",
      label: "Local training workplace",
      enforcement: "hard",
      source: "inferred",
      evidenceSource: "search",
      value: {
        group_key: "local_training_workplace",
        name: names[0],
        company_ids: [],
        domains: [],
        name_variants: names,
      },
    } as SearchCriteria,
  ]);
}

/** Explicit PGY wording searched on profile text after broad program recall. */
export function statedResidentYearTextFilter(years: readonly number[]): Record<string, unknown> | null {
  const terms = [...new Set(years.filter((year) => Number.isInteger(year) && year > 0 && year <= 10))]
    .flatMap((year) => [`pgy-${year}`, `pgy ${year}`, `pgy${year}`]);
  if (terms.length === 0) return null;
  return {
    op: "or",
    conditions: terms.flatMap((term) => [
      { field: "basic_profile.headline", type: "[.]", value: term },
      { field: "basic_profile.summary", type: "[.]", value: term },
      { field: "experience.employment_details.current.title", type: "[.]", value: term },
    ]),
  };
}
