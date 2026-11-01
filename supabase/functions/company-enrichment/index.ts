/**
 * company-enrichment edge function: the data behind the company panel.
 *
 * Four actions, so nothing is paid for until a user asks for it:
 *
 *   action "base"      (default) Opening a company. Identify (free) and the
 *                      company enrich call: name, pages, HQ, founded, industry,
 *                      description, headcount and its history, where staff
 *                      work, ownership. Cached 7 days.
 *   action "preview"   One count per people group plus joined/left counts.
 *                      1-row queries, 0.03 credits each, about 0.27 for all
 *                      nine. Cached 30 days. With `group` (+ `specialty`)
 *                      it counts that one group only.
 *   action "pull"      One group's people, 50 a page, 0.03 credits a profile
 *                      returned. `cursor` gets the next page. Cached 30 days.
 *   action "movement"  Who joined and who left in the last 24 months, up to
 *                      100 each way. Cached 90 days.
 *
 * Every cache entry is shared by all users: a company pulled once is free
 * for everyone until it expires.
 *
 * Data rules (live-probed 2026-10-18; tests beside each module):
 *  - A practice is matched on its company ids AND its written name, because
 *    most staff at a private practice name it without linking its page
 *    (Dallas Plastic Surgery Institute: 6 linked, 49 named). matching.ts
 *  - A practice split across a management entity and doctor-named pages is
 *    one company; look-alike practices are not. matching.ts
 *  - People are cleaned before they are shown: students and observers, old
 *    training entries, people in another state, side jobs. roster.ts
 *  - Movement drops promotions, side roles, students and duplicates and
 *    finds the real previous employer and destination. talent-flow.ts
 */

import { buildMatcher, type EntityMatcher, pickBestCandidate, selectRelatedEntityIds } from "./matching.ts";
import { cdPostV2, ENRICH_FIELDS, firstResult, identifyCandidates, type IdentifyCandidate, mapEnrichment, matchesOf } from "./v2.ts";
import { classifyAll, type ExclusionCounts, type TalentFlowPerson } from "./talent-flow.ts";
import { buildRoster, type RosterExclusion, type RosterPerson, sitesFromRegions } from "./roster.ts";
import { GROUP_DEFS, groupFilter, isPullGroup, movementFilters, PULL_GROUPS, PULL_PAGE_SIZE, type PullGroup } from "./groups.ts";
import { classifyEmploymentModel } from "../_shared/clinician-engine/employment-model.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCHEMA_VERSION = 18;
/** CrustData credits per profile returned by /person/search (verified on every call's credits line, 2026-10-18). */
const CREDITS_PER_PROFILE = 0.03;
const DAY = 24 * 60 * 60 * 1000;
/** Everything is shared and kept a full quarter: a company opened once is free for everyone for 90 days. */
const QUARTER = 90 * DAY;
const TTL = { base: QUARTER, preview: QUARTER, pull: QUARTER, movement: QUARTER } as const;
const MOVEMENT_MONTHS = 24;
const MOVEMENT_LIMIT = 100;

// deno-lint-ignore no-explicit-any
type Any = any;

/* ------------------------------------------------------------------ */
/* Pre-mapped health systems (parity with the legacy company resolver)  */
/* ------------------------------------------------------------------ */

const COMPANY_ALIASES: Record<string, string> = {
  "uc health": "uchealth",
  "uchealth": "uchealth",
  "university of colorado health": "uchealth",
  "uch": "uchealth",
  "university of colorado hospital": "uchealth",
  "university of colorado anschutz": "uchealth",
  "university of colorado anschutz medical campus": "uchealth",
  "university of colorado school of medicine": "uchealth",
};

const PREMAPPED_ENTITY_IDS: Record<string, number[]> = {
  uchealth: [1304813, 6259524, 6524064, 9255529, 12929305, 10791937, 9819138, 6644127, 670107, 6041104, 2056710],
  // HSS Florida (10584373) is a separate page; the main HSS page's region data has no Florida at all.
  "hospital for special surgery": [10584373],
};

function resolveCanonical(name: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  return COMPANY_ALIASES[lower] ?? lower;
}

const cleanDomain = (d: string | null | undefined) =>
  d ? d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] : null;

/* ------------------------------------------------------------------ */
/* Identify (free)                                                      */
/* ------------------------------------------------------------------ */

interface EntityPage {
  company_id: number;
  name: string;
  linkedin_url: string | null;
}

interface Identified {
  company_id: number;
  company_name: string;
  linkedin_profile_url: string | null;
  company_website_domain: string | null;
  employee_count_range: string | null;
  all_ids: number[];
  pages: EntityPage[];
  /** True when a hand-maintained entity map (UCHealth, HSS) is involved: the base call enriches those pages too and merges where staff work. */
  premapped: boolean;
}

function siblingsOf(list: IdentifyCandidate[], primary: IdentifyCandidate | null, primaryId: number, canonical: string, premapped: number[] | null): Identified {
  const liveIds = selectRelatedEntityIds(list, primaryId, canonical);
  const allIds = Array.from(new Set<number>([primaryId, ...(premapped ?? []), ...liveIds]));
  const pages = allIds
    .map((id) => list.find((c) => c.company_id === id))
    .filter((c): c is IdentifyCandidate => !!c)
    .map((c) => ({ company_id: c.company_id, name: c.company_name, linkedin_url: c.linkedin_profile_url }));
  return {
    company_id: primaryId,
    company_name: primary?.company_name || canonical,
    linkedin_profile_url: primary?.linkedin_profile_url ?? null,
    company_website_domain: primary?.company_website_domain ?? null,
    employee_count_range: primary?.employee_count_range ?? null,
    all_ids: allIds,
    pages,
    premapped: !!premapped,
  };
}

async function identifyByName(name: string, domain?: string | null): Promise<Identified | null> {
  const canonical = resolveCanonical(name);
  const premapped = canonical ? PREMAPPED_ENTITY_IDS[canonical] ?? null : null;
  const wantDomain = cleanDomain(domain);
  let list = wantDomain ? identifyCandidates(firstResult(await cdPostV2("/company/identify", { domains: [wantDomain] })), wantDomain) : [];
  if (list.length === 0 && name) list = identifyCandidates(firstResult(await cdPostV2("/company/identify", { names: [name] })), wantDomain);
  if (list.length === 0 && !premapped) return null;
  const best = pickBestCandidate(list, name, domain ?? null) ?? null;
  const primaryId = best?.company_id ?? premapped?.[0] ?? null;
  if (!primaryId) return null;
  return siblingsOf(list, best, primaryId, best?.company_name || canonical || name, premapped);
}

/** The client already knows the id (job_company_id). Resolve its name, then its siblings by that name and its domain. All free. */
async function identifyById(id: number): Promise<Identified | null> {
  const self = identifyCandidates(firstResult(await cdPostV2("/company/identify", { crustdata_company_ids: [id] })));
  const primary = self.find((c) => c.company_id === id) ?? self[0] ?? null;
  if (!primary) return null;
  const list = [primary];
  const add = (more: IdentifyCandidate[]) => { for (const c of more) if (!list.some((x) => x.company_id === c.company_id)) list.push(c); };
  add(identifyCandidates(firstResult(await cdPostV2("/company/identify", { names: [primary.company_name] }))));
  if (primary.company_website_domain) {
    add(identifyCandidates(firstResult(await cdPostV2("/company/identify", { domains: [primary.company_website_domain] }))));
  }
  // Hand-mapped sibling pages (HSS Florida) apply on this path too.
  const canonical = resolveCanonical(primary.company_name);
  const premapped = canonical ? PREMAPPED_ENTITY_IDS[canonical] ?? null : null;
  return siblingsOf(list, primary, id, primary.company_name, premapped);
}

/* ------------------------------------------------------------------ */
/* Base                                                                 */
/* ------------------------------------------------------------------ */

const SMALL_WORDS = new Set(["and", "of", "the", "for", "at", "in", "on"]);
const KEEP_UPPER = new Set(["md", "pa", "pc", "ent", "ob", "gyn", "usa", "va", "hca", "uc", "ii", "iii"]);
const LEGAL_TAIL = /[,\s]+(management,?\s*)?(p\.?\s?a\.?|pllc|llc|inc\.?|p\.?\s?c\.?|ltd\.?)$/i;

/** "DALLAS PLASTIC SURGERY INSTITUTE MANAGEMENT, PA" → "Dallas Plastic Surgery Institute". Mixed-case names keep their casing. */
export function displayName(name: string): string {
  const trimmed = name.trim();
  const noTail = trimmed.replace(LEGAL_TAIL, "").trim() || trimmed;
  const shouting = noTail === noTail.toUpperCase() && /[A-Z]{3}/.test(noTail);
  if (!shouting) return noTail;
  return noTail.toLowerCase().split(/\s+/).map((w, i) =>
    KEEP_UPPER.has(w.replace(/[^a-z]/g, "")) ? w.toUpperCase() : i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)
  ).join(" ");
}

function headcountFromRange(r: string | null | undefined): number | null {
  if (!r) return null;
  const m = r.match(/(\d[\d,]*)/g);
  return m ? parseInt(m[m.length - 1].replace(/,/g, ""), 10) : null;
}

function dedupeLeaders(list: Array<{ name: string; title: string; linkedin_url: string | null; profile_picture_url: string | null }>) {
  const seen = new Set<string>();
  return list.filter((l) => {
    const k = l.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Headcount by job function, largest first, top 8. */
function functionBreakdown(raw: unknown): { label: string; count: number }[] {
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([, v]) => typeof v === "number" && (v as number) > 0)
    .map(([k, v]) => ({ label: k.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()), count: v as number }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

/** Sum two LinkedIn region maps ("New York, NY": 2649 + "West Palm Beach, FL": 4 from a sibling page). */
function mergeRegions(a: unknown, b: unknown): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const src of [a, b]) {
    if (!src || typeof src !== "object") continue;
    for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
      if (typeof v === "number" && v > 0) out[k] = (out[k] ?? 0) + v;
    }
  }
  return Object.keys(out).length ? out : null;
}

async function buildBase(identified: Identified, preferDomain: string | null) {
  const raw = await cdPostV2("/company/enrich", { crustdata_company_ids: [identified.company_id], fields: [...ENRICH_FIELDS] });
  const match = matchesOf(firstResult(raw))[0];
  const e = match ? mapEnrichment(match.company_data, preferDomain) : null;
  // Hand-mapped sibling pages (HSS Florida, UCHealth arms) carry their own
  // region footprint; enrich them once and merge so "where staff work" is complete.
  let siblingRegions: Record<string, number> | null = null;
  let siblingOffices: string[] = [];
  if (identified.premapped) {
    const extraIds = identified.all_ids.filter((id) => id !== identified.company_id).slice(0, 6);
    if (extraIds.length) {
      const sibRaw = await cdPostV2("/company/enrich", { crustdata_company_ids: extraIds, fields: ["headcount", "locations"] });
      for (const m of matchesOf(firstResult(sibRaw))) {
        const se = mapEnrichment(m.company_data, preferDomain);
        const shc = (se?.headcount ?? null) as Any;
        siblingRegions = mergeRegions(siblingRegions, shc?.linkedin_headcount_by_region_absolute);
        siblingOffices.push(...(se?.office_addresses ?? []));
      }
    }
  }
  const mergedRegions = mergeRegions((e?.headcount as Any)?.linkedin_headcount_by_region_absolute, siblingRegions);
  const hc = (e?.headcount ?? null) as Any;
  const legal = e?.company_name || identified.company_name;
  const total: number | null = hc?.linkedin_headcount ?? headcountFromRange(e?.employee_count_range ?? identified.employee_count_range);
  const ownership = classifyEmploymentModel(legal, { headcount: total });
  const matcher = buildMatcher(identified.all_ids, legal, e?.hq_state ?? null);
  return {
    schema_version: SCHEMA_VERSION,
    company_id: identified.company_id,
    crustdata_entity_ids: identified.all_ids,
    legal_name: legal,
    display_name: displayName(legal),
    pages: identified.pages.length ? identified.pages : [{ company_id: identified.company_id, name: legal, linkedin_url: identified.linkedin_profile_url }],
    matched_name: matcher.phrase,
    company_website_domain: e?.company_website_domain || identified.company_website_domain || preferDomain || null,
    linkedin_profile_url: e?.linkedin_profile_url || identified.linkedin_profile_url || null,
    logo_url: e?.linkedin_logo_url ?? null,
    hq_city: e?.hq_city ?? null,
    hq_state: e?.hq_state ?? null,
    hq_country: e?.hq_country ?? null,
    industry: e?.industry ?? null,
    description: e?.description ?? null,
    year_founded: e?.year_founded ?? null,
    employee_count_range: e?.employee_count_range ?? identified.employee_count_range ?? null,
    ownership: { model: ownership.model, evidence: ownership.evidence },
    headcount: {
      total,
      yoy_percent: hc?.linkedin_headcount_total_growth_percent?.yoy ?? null,
      yoy_absolute: hc?.linkedin_headcount_total_growth_absolute?.yoy ?? null,
      timeseries: Array.isArray(hc?.linkedin_headcount_timeseries) ? hc.linkedin_headcount_timeseries : [],
      /** Raw region breakdown (main page + hand-mapped siblings), kept so the panel can chart every place staff work without a new call. */
      by_region: mergedRegions,
    },
    sites: sitesFromRegions(mergedRegions),
    /** Street addresses of every office the company lists (its own website footprint, e.g. HSS Florida). */
    offices: [...new Set([...(e?.office_addresses ?? []), ...siblingOffices])],
    leaders: dedupeLeaders([...(e?.founders ?? []), ...(e?.cxos ?? []), ...(e?.decision_makers ?? [])]).slice(0, 12),
    headcount_by_function: functionBreakdown(hc?.linkedin_headcount_by_role_absolute),
    enriched_at: new Date().toISOString(),
  };
}

type Base = Awaited<ReturnType<typeof buildBase>>;

function matcherOf(base: Base): EntityMatcher {
  return buildMatcher(base.crustdata_entity_ids, base.legal_name, base.hq_state);
}

/* ------------------------------------------------------------------ */
/* People search                                                        */
/* ------------------------------------------------------------------ */

const PERSON_FIELDS = [
  "basic_profile.name",
  "basic_profile.first_name",
  "basic_profile.last_name",
  "basic_profile.headline",
  "basic_profile.profile_picture_permalink",
  "basic_profile.location",
  "experience.employment_details.current",
  "experience.employment_details.past",
  "social_handles.professional_network_identifier.profile_url",
  "crustdata_person_id",
];

async function personSearch(body: Record<string, unknown>): Promise<{ rows: Any[]; total: number | null; next_cursor: string | null }> {
  const raw = await cdPostV2("/person/search", body);
  return {
    rows: raw?.profiles ?? raw?.data ?? raw?.results ?? [],
    total: typeof raw?.total_count === "number" ? raw.total_count : null,
    next_cursor: typeof raw?.next_cursor === "string" && raw.next_cursor ? raw.next_cursor : null,
  };
}

async function countOf(filters: Any): Promise<number | null> {
  const r = await personSearch({ filters, limit: 1, fields: ["crustdata_person_id"] });
  return r.total;
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

async function buildPreview(base: Base) {
  const m = matcherOf(base);
  const since = isoMonthsAgo(MOVEMENT_MONTHS);
  const mv = movementFilters(m, since);
  const [counts, hires, departures] = await Promise.all([
    Promise.all(PULL_GROUPS.map(async (g) => ({ group: g, label: GROUP_DEFS[g].label, hint: GROUP_DEFS[g].hint, count: await countOf(groupFilter(m, g)) }))),
    countOf(mv.hires),
    countOf(mv.departures),
  ]);
  return {
    groups: counts,
    movement: { hires, departures, window_months: MOVEMENT_MONTHS },
    credits_per_profile: CREDITS_PER_PROFILE,
    counted_at: new Date().toISOString(),
  };
}

async function buildPull(base: Base, group: PullGroup, specialty: string | null, cursor: string | null) {
  const m = matcherOf(base);
  const r = await personSearch({
    filters: groupFilter(m, group, specialty),
    limit: PULL_PAGE_SIZE,
    fields: PERSON_FIELDS,
    ...(cursor ? { cursor } : {}),
  });
  const roster = buildRoster(r.rows, m, new Date().toISOString(), group);
  return {
    group,
    specialty,
    people: roster.people as RosterPerson[],
    excluded: roster.excluded as Record<RosterExclusion, number>,
    matched_by_name: roster.matched_by_name,
    returned: r.rows.length,
    total: r.total,
    next_cursor: r.next_cursor,
    pulled_at: new Date().toISOString(),
  };
}

async function buildMovement(base: Base) {
  const m = matcherOf(base);
  const since = isoMonthsAgo(MOVEMENT_MONTHS);
  const mv = movementFilters(m, since);
  const [h, d] = await Promise.all([
    personSearch({ filters: mv.hires, sorts: [{ field: "experience.employment_details.start_date", order: "desc" }], limit: MOVEMENT_LIMIT, fields: PERSON_FIELDS }),
    personSearch({ filters: mv.departures, limit: MOVEMENT_LIMIT, fields: PERSON_FIELDS }),
  ]);
  const hires = classifyAll(h.rows, m, since, "hires");
  const deps = classifyAll(d.rows, m, since, "departures");
  return {
    window_months: MOVEMENT_MONTHS,
    hires: hires.people as TalentFlowPerson[],
    departures: deps.people as TalentFlowPerson[],
    hires_returned: h.rows.length,
    departures_returned: d.rows.length,
    hire_total_matched: h.total,
    departure_total_matched: d.total,
    excluded: { hires: hires.excluded as ExclusionCounts, departures: deps.excluded as ExclusionCounts },
    pulled_at: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Cache (shared by all users)                                          */
/* ------------------------------------------------------------------ */

// deno-lint-ignore no-explicit-any
async function cached<T>(supabase: any, key: string, ttl: number, companyId: number, build: () => Promise<T>): Promise<T & { cached: boolean }> {
  try {
    const { data } = await supabase.from("company_enrichment_cache").select("data, created_at").eq("cache_key", key).maybeSingle();
    if (data?.data && Date.now() - new Date(data.created_at as string).getTime() < ttl) {
      return { ...(data.data as T), cached: true };
    }
  } catch { /* miss */ }
  const fresh = await build();
  try {
    await supabase.from("company_enrichment_cache").upsert({ cache_key: key, company_id: companyId, data: fresh, created_at: new Date().toISOString() });
  } catch { /* non-fatal */ }
  return { ...fresh, cached: false };
}

const idsKey = (ids: number[]) => [...ids].sort((a, b) => a - b).join(",");

/* ------------------------------------------------------------------ */
/* Handler                                                              */
/* ------------------------------------------------------------------ */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action: string = typeof body?.action === "string" ? body.action : "base";
    const company_name: string | null = typeof body?.company_name === "string" ? body.company_name : null;
    const company_domain: string | null = typeof body?.company_domain === "string" ? body.company_domain : null;
    const company_id: number | null = typeof body?.company_id === "number" && body.company_id > 0 ? body.company_id : null;
    const entity_ids: number[] = Array.isArray(body?.entity_ids)
      ? (body.entity_ids as unknown[]).filter((n): n is number => typeof n === "number" && n > 0)
      : [];

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Base first: every other action reads the company's ids, name and state from it.
    let base: (Base & { cached: boolean }) | null = null;
    if (entity_ids.length) {
      try {
        const { data } = await supabase.from("company_enrichment_cache").select("data").eq("cache_key", `v${SCHEMA_VERSION}:base:${idsKey(entity_ids)}`).maybeSingle();
        if (data?.data) base = { ...(data.data as Base), cached: true };
      } catch { /* rebuild below */ }
    }
    if (!base) {
      const identified = company_id
        ? (await identifyById(company_id)) ?? (company_name ? await identifyByName(company_name, company_domain) : null)
        : company_name ? await identifyByName(company_name, company_domain) : null;
      if (!identified) return json({ company: null, error: "Company not found" });
      base = await cached(supabase, `v${SCHEMA_VERSION}:base:${idsKey(identified.all_ids)}`, TTL.base, identified.company_id, () => buildBase(identified, cleanDomain(company_domain)));
    }
    const key = idsKey(base.crustdata_entity_ids);

    if (action === "base") return json({ company: base });

    if (action === "preview") {
      if (isPullGroup(body?.group)) {
        const specialty = typeof body?.specialty === "string" && body.specialty.trim() ? body.specialty.trim().toLowerCase() : null;
        const one = await cached(supabase, `v${SCHEMA_VERSION}:count:${key}:${body.group}:${specialty ?? ""}`, TTL.preview, base!.company_id, async () => ({
          group: body.group as PullGroup,
          specialty,
          count: await countOf(groupFilter(matcherOf(base!), body.group, specialty)),
        }));
        return json({ count: one });
      }
      const preview = await cached(supabase, `v${SCHEMA_VERSION}:preview:${key}`, TTL.preview, base!.company_id, () => buildPreview(base!));
      // Which groups someone already pulled (first page, no specialty): the
      // panel loads those for free and marks them "Already pulled".
      const keys = [...PULL_GROUPS.map((g) => `v${SCHEMA_VERSION}:pull:${key}:${g}::1`), `v${SCHEMA_VERSION}:movement:${key}`];
      const available: Record<string, boolean> = {};
      try {
        const { data } = await supabase.from("company_enrichment_cache").select("cache_key, created_at").in("cache_key", keys);
        for (const row of (data ?? []) as Array<{ cache_key: string; created_at: string }>) {
          const isMovement = row.cache_key.includes(":movement:");
          const fresh = Date.now() - new Date(row.created_at).getTime() < (isMovement ? TTL.movement : TTL.pull);
          if (fresh) available[isMovement ? "movement" : row.cache_key.split(":")[3]] = true;
        }
      } catch { /* none known */ }
      return json({ preview: { ...preview, available } });
    }

    if (action === "pull") {
      if (!isPullGroup(body?.group)) return json({ error: `group must be one of ${PULL_GROUPS.join(", ")}` }, 400);
      const specialty = typeof body?.specialty === "string" && body.specialty.trim() ? body.specialty.trim().toLowerCase() : null;
      const cursor = typeof body?.cursor === "string" && body.cursor ? body.cursor : null;
      const page = typeof body?.page === "number" && body.page > 0 ? Math.floor(body.page) : 1;
      const pull = await cached(supabase, `v${SCHEMA_VERSION}:pull:${key}:${body.group}:${specialty ?? ""}:${page}`, TTL.pull, base!.company_id, () => buildPull(base!, body.group, specialty, cursor));
      return json({ pull: { ...pull, page } });
    }

    if (action === "movement") {
      const movement = await cached(supabase, `v${SCHEMA_VERSION}:movement:${key}`, TTL.movement, base!.company_id, () => buildMovement(base!));
      return json({ movement });
    }

    return json({ error: `unknown action "${action}"` }, 400);
  } catch (err) {
    console.error("[company-enrichment] Error:", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
