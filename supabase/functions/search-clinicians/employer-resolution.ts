/**
 * employer-resolution.ts — dynamic multi-entity employer resolution.
 *
 * The University of Miami problem (live-probed 2026-09-15): one stated
 * employer fans out across many Crustdata entities — "University of Miami"
 * resolves to two UM entities, University of Miami Health System (UHealth),
 * the Miller School of Medicine, University of Miami Hospital, the School of
 * Nursing — AND a pile of same-name noise (a TV station, a law review, clubs).
 * A single company_id filter silently drops most of the real clinical
 * population; a bare name substring admits the noise.
 *
 * Resolution pipeline (all FREE calls, cached 30 days):
 *   1. /company/identify by stated name → candidate entities with
 *      confidence, industries, domains.
 *   2. Health-relatedness filter: keep the top-confidence anchors plus
 *      siblings that are clinically relevant (health industry / health
 *      keywords / shared brand token) — the TV station and the law review
 *      never survive.
 *   3. Brand-token fanout: known brand seeds (uhealth, miller school,
 *      sylvester, bascom palmer …) + tokens harvested from the surviving
 *      entity names run through the PERSON-index employer autocomplete, so
 *      the name variants people actually list as employers join the group.
 *   4. The result is an EmployerGroupValue-shaped bundle: ids + clinical
 *      domains + name variants. ≥2 surviving entities upgrades the criterion
 *      from `company` to `employer_group`; exactly 1 sets company_id as
 *      before. Curated groups (the VA, HCA) in EMPLOYER_GROUPS still win —
 *      this module handles everything the static table doesn't know.
 */

import { companyIdentifyRawV2, personSearchAutocomplete } from "./lib/crustdata-v2.ts";
import { getCrustDataCache, setCrustDataCache, ENRICHMENT_TTL_MS } from "./cache.ts";

export interface ResolvedEmployerGroup {
  name: string;
  company_ids: number[];
  domains: string[];
  name_variants: string[];
  /** Number of distinct clinical entities the name resolved to. */
  entity_count: number;
}

/** Health-relatedness vocabulary (ported from the pdl-search resolver's
 *  HEALTH_NAME_KEYWORDS — the part of that engine worth keeping). */
const HEALTH_NAME_KEYWORDS = [
  "medical", "medicine", "hospital", "health", "clinic", "nursing",
  "physician", "surgery", "surgical", "doctor", "dental", "pharma",
  "rehab", "rehabilitation", "cancer", "heart", "children", "memorial",
  "mercy", "presbyterian", "baptist", "methodist", "saint", "st.",
  "eye institute", "care",
];

const HEALTH_INDUSTRIES = new Set([
  "Hospitals and Health Care",
  "Medical Practices",
  "Mental Health Care",
  "Home Health Care Services",
]);

/** Brand siblings that don't share the parent's name at all. Extend as
 *  systems are probed; unknown parents still get the generic harvest. */
const BRAND_SEEDS: Record<string, string[]> = {
  "university of miami": ["uhealth", "miller school of medicine", "sylvester comprehensive cancer center", "bascom palmer"],
  "university of pennsylvania": ["penn medicine"],
  "university of pittsburgh": ["upmc"],
  "university of colorado": ["uchealth", "anschutz"],
  "harvard": ["mass general", "brigham and women", "massachusetts general"],
  "johns hopkins": ["johns hopkins medicine", "johns hopkins hospital"],
  "stanford": ["stanford health care", "stanford medicine"],
  "university of texas": ["ut health", "md anderson", "ut southwestern"],
};

const STOP_TOKENS = new Set([
  "the", "of", "and", "for", "at", "school", "college", "university",
  "system", "health", "healthcare", "medical", "medicine", "center",
  "centre", "hospital", "clinic", "department", "institute", "faculty",
]);

function isHealthRelated(name: string, industries: string[], brandTokens: string[]): boolean {
  const lower = name.toLowerCase();
  if (industries.some((i) => HEALTH_INDUSTRIES.has(i))) return true;
  if (HEALTH_NAME_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  for (const tok of brandTokens) {
    const t = tok.toLowerCase().trim();
    if (t.length >= 4 && lower.includes(t)) return true;
  }
  return false;
}

interface CandidateEntity {
  id: number | null;
  name: string;
  confidence: number;
  industries: string[];
  domains: string[];
}

/** Distinctive brand tokens harvested from surviving entity names. */
function harvestBrandTokens(names: string[], stated: string): string[] {
  const out = new Set<string>();
  for (const name of names) {
    const tokens = name.toLowerCase().split(/[\s,&\-\/()]+/).filter(Boolean);
    for (const tok of tokens) {
      if (tok.length >= 5 && !STOP_TOKENS.has(tok) && !stated.includes(tok) && /^[a-z][a-z0-9]+$/.test(tok)) {
        out.add(tok);
      }
    }
  }
  return [...out].slice(0, 4);
}

/** Cap the group so the filter tree stays sane. */
const MAX_GROUP_IDS = 15;
const MAX_GROUP_VARIANTS = 12;
const MAX_GROUP_DOMAINS = 6;

/**
 * Resolve one stated employer name to its clinical entity group.
 * Fail-soft: any provider failure returns null and the caller keeps the
 * plain company criterion (identify-by-single-id path).
 */
export async function resolveEmployerGroup(
  statedName: string,
): Promise<ResolvedEmployerGroup | null> {
  const stated = statedName.toLowerCase().trim();
  if (!stated) return null;

  const cacheKey = "clin:egroup:" + stated;
  const cached = await getCrustDataCache(cacheKey, ENRICHMENT_TTL_MS);
  if (cached && cached.profiles[0]) {
    return cached.profiles[0] as unknown as ResolvedEmployerGroup;
  }

  const idRes = await companyIdentifyRawV2([statedName]);
  if (!idRes.ok) {
    console.warn(`[employer-resolution] identify failed (${idRes.status}) — plain company criterion stands`);
    return null;
  }
  const row = idRes.data[0];
  const matches = Array.isArray(row?.matches) ? row!.matches! : [];
  if (matches.length === 0) return null;

  const seedTokens = BRAND_SEEDS[stated] ?? [];
  const candidates: CandidateEntity[] = matches.map((m) => {
    const info = (m.company_data?.basic_info ?? {}) as Record<string, unknown>;
    const rawId = info.crustdata_company_id ?? info.company_id;
    return {
      id: typeof rawId === "number" ? rawId : null,
      name: typeof info.name === "string" ? info.name : "",
      confidence: typeof m.confidence_score === "number" ? m.confidence_score : 0,
      industries: Array.isArray(info.industries)
        ? (info.industries as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
      domains: Array.isArray(info.all_domains)
        ? (info.all_domains as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    };
  }).filter((c) => c.id !== null && c.name);

  // Anchor = highest-confidence candidate. Siblings survive only when
  // clinically relevant (industry / health keyword / brand token) — this is
  // what keeps the law review and the TV station out of the group.
  const anchor = candidates[0];
  if (!anchor) return null;
  const survivors = candidates.filter((c, i) =>
    i === 0 || isHealthRelated(c.name, c.industries, [...seedTokens, stated])
  ).slice(0, MAX_GROUP_IDS);

  // Brand-token fanout through the PERSON-index employer autocomplete: the
  // variants people actually list as their employer ("UHealth - University
  // of Miami Health System", "UHEALTH UNIVERSITY OF MIAMI"). Only
  // health-related hits that carry the brand join the variant list.
  const brandTokens = [...new Set([...seedTokens, ...harvestBrandTokens(survivors.map((s) => s.name), stated)])];
  const nameVariants = new Set<string>(survivors.map((s) => s.name.toLowerCase()));
  nameVariants.add(stated);
  const probes = [stated, ...brandTokens.slice(0, 3)];
  for (const probe of probes) {
    try {
      const hits = await personSearchAutocomplete(
        "experience.employment_details.current.name",
        probe,
      );
      for (const h of hits) {
        const v = h.toLowerCase().trim();
        if (!v || nameVariants.has(v)) continue;
        if (!isHealthRelated(v, [], [...brandTokens, stated])) continue;
        // A variant must carry the stated name or a brand token — pure
        // prefix drift ("University of Miami PRSSA" passes the brand test
        // only via the stated name, and the health filter already cut it).
        if (!v.includes(stated) && !brandTokens.some((t) => v.includes(t.toLowerCase()))) continue;
        nameVariants.add(v);
        if (nameVariants.size >= MAX_GROUP_VARIANTS) break;
      }
    } catch (err) {
      console.warn(`[employer-resolution] autocomplete probe "${probe}" failed (non-fatal)`, err);
    }
    if (nameVariants.size >= MAX_GROUP_VARIANTS) break;
  }

  // Clinical domains only: a university's root domain (miami.edu) spans the
  // whole institution; that is acceptable recall because role/specialty
  // criteria still AND against the group, but domains from clearly
  // non-clinical siblings never join.
  const domains = new Set<string>();
  for (const s of survivors) {
    for (const d of s.domains) {
      const dl = d.toLowerCase().trim();
      if (dl && !dl.includes("campuslabs") && !dl.includes("lnk.bio")) domains.add(dl);
      if (domains.size >= MAX_GROUP_DOMAINS) break;
    }
  }

  const resolved: ResolvedEmployerGroup = {
    name: anchor.name,
    company_ids: survivors.map((s) => s.id as number),
    domains: [...domains],
    name_variants: [...nameVariants],
    entity_count: survivors.length,
  };

  await setCrustDataCache(cacheKey, resolved.entity_count, [resolved as unknown as Record<string, unknown>], null);
  console.log(JSON.stringify({
    event: "employer_group_resolved",
    stated,
    entities: resolved.entity_count,
    ids: resolved.company_ids,
    variants: resolved.name_variants.length,
    domains: resolved.domains,
  }));
  return resolved;
}
