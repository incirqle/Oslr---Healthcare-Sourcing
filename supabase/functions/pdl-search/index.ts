/**
 * pdl-search/index.ts — Thin orchestrator for Oslr clinical healthcare search.
 *
 * Flow: Auth → Parse → Build ES DSL → Preview/Fetch → Cascade → Format → Respond
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseQuery } from "./parse-query.ts";
import { buildPDLQuery, CascadeStep, applyStep } from "./build-pdl-query.ts";
import {
  getPDLCacheKey,
  getDBCache,
  setDBCache,
  cleanExpiredCache,
  fetchPDLWithRetry,
  runPreview,
  fetchProfiles,
} from "./fetch-pdl-results.ts";
import { mapPerson, deriveParsedCategories, deriveParsedKeywords, scoreAndRankResults } from "./format-results.ts";
import { callClaude } from "./ai-router.ts";
import { rerankWithAI } from "./ai-rerank.ts";
import { enrichJobTitles } from "./enrich-job-titles.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Clause = Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* L5 — Claude cascade planner                                          */
/* ------------------------------------------------------------------ */

const L5_SYSTEM_PROMPT = `You are a clinical healthcare search strategist. A PDL search returned too few results. Choose the best filter relaxation order. Return ONLY valid JSON — no markdown.

AVAILABLE STEPS (use exact strings only):
"drop_titles" — remove title soft filters
"expand_to_metro" — widen city to metro area
"expand_to_state" — widen metro/city to full state
"drop_company" — remove employer filters
"drop_specialty" — remove clinical specialty filter
"role_only" — keep only job_title_role="health" (last resort)

ORDERING RULE (April 2026 v2): Try LOCAL semantic relaxation first
("drop_specialty", then "drop_titles") so the candidate stays inside the
user's requested city/corridor. Only AFTER that try geographic expansion
("expand_to_metro", then "expand_to_state"). Drop_company and role_only
are last-resort. Never widen geography before trying local semantics.

RETURN: { "cascade_plan": string[], "reasoning": string }`;

// FIX (April 2026 v2): Try SEMANTIC relaxation inside the existing local
// geography BEFORE widening to metro/state. Geography only widens after the
// local-semantic pass still produces too few results.
const DEFAULT_CASCADE: CascadeStep[] = [
  CascadeStep.DROP_SPECIALTY,   // local + role intent, drop specialty hard gate
  CascadeStep.DROP_TITLES,      // local + role intent only, drop title soft gate
  CascadeStep.EXPAND_TO_METRO,  // then start widening geography
  CascadeStep.EXPAND_TO_STATE,
  CascadeStep.DROP_COMPANY,
  CascadeStep.ROLE_ONLY,
];

interface CascadePayload {
  location: { state?: string | null; state_confidence?: number; city?: string | null; city_confidence?: number; metro?: string | null };
  job_titles?: string[];
  title_confidence?: number;
  specialty?: string | null;
  specialty_confidence?: number;
}

async function planCascade(payload: CascadePayload, queryType: string, previewTotal: number): Promise<CascadeStep[]> {
  const ctx = JSON.stringify({
    query_type: queryType,
    state: payload.location?.state,
    state_conf: payload.location?.state_confidence,
    city: payload.location?.city,
    city_conf: payload.location?.city_confidence,
    metro: payload.location?.metro,
    titles: payload.job_titles,
    title_conf: payload.title_confidence,
    specialty: payload.specialty,
    spec_conf: payload.specialty_confidence,
    preview_total: previewTotal,
  });

  const result = await callClaude<{ cascade_plan: string[]; reasoning: string }>(
    L5_SYSTEM_PROMPT,
    ctx,
    { cascade_plan: DEFAULT_CASCADE as unknown as string[], reasoning: "fallback" },
    "L5-Cascade",
    { timeoutMs: 15000 }
  );

  const valid = new Set(Object.values(CascadeStep) as string[]);
  const plan = (result.cascade_plan ?? []).filter(s => valid.has(s)) as CascadeStep[];
  console.log(`[L5] ${plan.join(" -> ")} | ${result.reasoning}`);
  return plan.length > 0 ? plan : DEFAULT_CASCADE;
}

async function runCascade(
  basePdlQuery: Record<string, unknown>,
  payload: CascadePayload,
  queryType: string,
  previewTotal: number,
  queryHash: string,
  adminClient: ReturnType<typeof createClient>,
  size: number
): Promise<{ profiles: Record<string, unknown>[]; stepsUsed: number; plan: CascadeStep[]; winningStep: CascadeStep | null; total: number }> {
  const cascadePlan = await planCascade(payload, queryType, previewTotal);

  const boolBlock = (basePdlQuery as { bool?: { filter?: unknown[]; must?: unknown[]; must_not?: unknown[] } }).bool || {};
  let current = {
    filter: (boolBlock.filter || []) as Clause[],
    must: (boolBlock.must || []) as Clause[],
    must_not: (boolBlock.must_not || []) as Clause[],
  };

  let stepsUsed = 0;
  let lastTotal = previewTotal;

  for (const step of cascadePlan) {
    current = applyStep(current, payload, step);
    stepsUsed++;

    const stepHash = queryHash + "_" + step;
    const cached = await getDBCache(adminClient, stepHash);
    if (cached && cached.data.length > 0) {
      return { profiles: cached.data as Record<string, unknown>[], stepsUsed, plan: cascadePlan, winningStep: step, total: cached.total };
    }

    const stepQuery = {
      bool: {
        filter: current.filter,
        ...(current.must.length > 0 ? { must: current.must } : {}),
        ...(current.must_not.length > 0 ? { must_not: current.must_not } : {}),
      },
    };

    const total = await runPreview(stepQuery);
    lastTotal = total;
    console.log(`[CASCADE] step=${step}, preview_total=${total}`);

    if (total >= 3) {
      const profiles = await fetchProfiles(stepQuery, Math.min(size, 100));
      setDBCache(adminClient, stepHash, total, profiles, null);
      return { profiles: profiles as unknown as Record<string, unknown>[], stepsUsed, plan: cascadePlan, winningStep: step, total };
    }
  }

  const finalQuery = {
    bool: {
      filter: current.filter,
      ...(current.must.length > 0 ? { must: current.must } : {}),
      ...(current.must_not.length > 0 ? { must_not: current.must_not } : {}),
    },
  };
  const profiles = await fetchProfiles(finalQuery, Math.min(size, 100));
  return { profiles: profiles as unknown as Record<string, unknown>[], stepsUsed, plan: cascadePlan, winningStep: cascadePlan[cascadePlan.length - 1] ?? null, total: lastTotal };
}

/* ------------------------------------------------------------------ */
/* Full search fetch helper                                             */
/* ------------------------------------------------------------------ */

async function fetchPDLForFullSearch(
  pdlQuery: Record<string, unknown>,
  pdlSearchKey: string,
  page: number,
  size: number,
  incomingScrollToken: string | null,
  fullCacheKey: string,
  adminClient: ReturnType<typeof createClient>,
  pdlBaseUrl = "https://api.peopledatalabs.com"
): Promise<Record<string, unknown>> {
  const pdlBody: Record<string, unknown> = {
    query: pdlQuery,
    dataset: "all",
    size: Math.min(size, 100),
    // Only charge a credit when the profile has at least one email.
    // Lou Tarabocchia (PDL) recommendation — April 2026 discovery call.
    required_fields: ["emails"],
  };

  if (page > 0 && incomingScrollToken) {
    pdlBody.scroll_token = incomingScrollToken;
  } else if (page > 0) {
    const offset = page * Math.min(size, 100);
    if (offset < 10000) {
      pdlBody.from = offset;
    } else {
      return { total: 0, data: [], scroll_token: null, _empty: true };
    }
  }

  const queryHash = fullCacheKey.slice(0, 16);
  const pdlResult = await fetchPDLWithRetry(
    `${pdlBaseUrl}/v5/person/search`,
    {
      method: "POST",
      headers: { "X-Api-Key": pdlSearchKey, "Content-Type": "application/json" },
      body: JSON.stringify(pdlBody),
    },
    queryHash
  );

  if (!pdlResult.ok) return { _error: true, _errorPayload: pdlResult.error };

  const pdlData = pdlResult.data;
  const returnedScrollToken = pdlData.scroll_token as string | null;
  setDBCache(adminClient, fullCacheKey, (pdlData.total as number) || 0, (pdlData.data as unknown[]) || [], returnedScrollToken);
  return pdlData;
}

/* ------------------------------------------------------------------ */
/* Company name resolution via PDL Company API                          */
/* ENHANCED: Cleaner → Enrichment → Autocomplete → Root Extraction     */
/* Discovers affiliated entities to solve health system fragmentation   */
/* ------------------------------------------------------------------ */

interface ResolvedCompany {
  original: string;
  pdl_name: string | null;
  pdl_id: string | null;
  website: string | null;
  linkedin_url: string | null;
  alt_names: string[];
  affiliated_ids: string[];
  affiliated_names: string[];
  wildcards: string[];
}

/** Strip trailing city/state names that the parser may have accidentally merged
 *  e.g. "uc health denver" → "uc health", "hca dallas texas" → "hca"
 */
const US_CITIES_COMMON = new Set([
  "denver", "aurora", "boulder", "colorado springs", "fort collins",
  "dallas", "houston", "austin", "san antonio", "fort worth",
  "phoenix", "tucson", "scottsdale", "mesa",
  "atlanta", "savannah", "marietta",
  "miami", "orlando", "tampa", "jacksonville",
  "chicago", "springfield", "naperville",
  "new york", "brooklyn", "manhattan",
  "los angeles", "san francisco", "san diego", "san jose", "sacramento",
  "seattle", "portland", "boston", "philadelphia", "pittsburgh",
  "rochester", "minneapolis", "st. louis", "nashville", "memphis",
  "charlotte", "raleigh", "durham", "chapel hill",
  "detroit", "cleveland", "columbus", "cincinnati",
  "baltimore", "indianapolis", "milwaukee", "kansas city",
  "salt lake city", "las vegas", "richmond", "norfolk",
]);

const US_STATES_COMMON = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado",
  "connecticut", "delaware", "florida", "georgia", "hawaii", "idaho",
  "illinois", "indiana", "iowa", "kansas", "kentucky", "louisiana",
  "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york", "north carolina",
  "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
  "rhode island", "south carolina", "south dakota", "tennessee", "texas",
  "utah", "vermont", "virginia", "washington", "west virginia",
  "wisconsin", "wyoming",
  "al", "ak", "az", "ar", "ca", "co", "ct", "de", "fl", "ga",
  "hi", "id", "il", "in", "ia", "ks", "ky", "la", "me", "md",
  "ma", "mi", "mn", "ms", "mo", "mt", "ne", "nv", "nh", "nj",
  "nm", "ny", "nc", "nd", "oh", "ok", "or", "pa", "ri", "sc",
  "sd", "tn", "tx", "ut", "vt", "va", "wa", "wv", "wi", "wy",
]);

function stripLocationFromCompanyName(name: string): string {
  const lower = name.toLowerCase().trim();
  const words = lower.split(/\s+/);

  let stripped = words.slice();
  for (let i = words.length - 1; i >= 1; i--) {
    if (US_CITIES_COMMON.has(stripped[i]) || US_STATES_COMMON.has(stripped[i])) {
      stripped = stripped.slice(0, i);
      continue;
    }
    if (i >= 2) {
      const twoWord = `${stripped[i - 1]} ${stripped[i]}`;
      if (US_CITIES_COMMON.has(twoWord) || US_STATES_COMMON.has(twoWord)) {
        stripped = stripped.slice(0, i - 1);
        continue;
      }
    }
    break;
  }

  const result = stripped.join(" ").trim();
  if (result.length > 0 && result !== lower) {
    console.log(`[COMPANY RESOLVE] Stripped location: "${lower}" → "${result}"`);
    return result;
  }
  return lower;
}

/** Health-related keywords for filtering Autocomplete results */
const HEALTH_NAME_KEYWORDS = [
  "medical", "medicine", "hospital", "health", "clinic", "anschutz",
  "surgery", "surgical", "nursing", "physician", "doctor", "dental",
  "pharma", "rehab", "rehabilitation", "cancer", "heart", "children",
  "memorial", "mercy", "presbyterian", "baptist", "methodist", "lutheran",
  "saint", "st.", "mount sinai", "cedars", "kaiser", "mayo",
];

/** Indicates the anchor is a multi-entity health system (university hospital,
 *  IDN, academic medical center). Triggers wider affiliate discovery. */
const HEALTH_SYSTEM_PARENT_KEYWORDS = [
  "university of", "health system", "healthcare system", "medical center",
  "school of medicine", "miller school", "uhealth", "uchealth",
  "academic medical", "health sciences",
];

function isHealthSystemParent(name: string): boolean {
  const lower = name.toLowerCase();
  return HEALTH_SYSTEM_PARENT_KEYWORDS.some(kw => lower.includes(kw));
}

function nameIsHealthRelated(name: string, brandTokens: string[] = []): boolean {
  const lower = name.toLowerCase();
  if (HEALTH_NAME_KEYWORDS.some(kw => lower.includes(kw))) return true;
  // Also keep affiliates that share a brand token with the parent (e.g. "umiami",
  // "miller school", "sylvester") even when no health keyword is present.
  for (const tok of brandTokens) {
    const t = tok.toLowerCase().trim();
    if (t.length >= 4 && lower.includes(t)) return true;
  }
  return false;
}

/** Extract root organizational name from alternative names.
 *  Health systems get extra "brand sibling" tokens harvested from alt_names so
 *  we surface entities like "uhealth", "miller school", "sylvester" that don't
 *  share the parent's "university of" prefix. */
function extractRootNames(altNames: string[], canonicalName: string): string[] {
  const roots = new Set<string>();
  const uniPattern = /^(university of [a-z]+)/i;
  for (const name of altNames) {
    const uniMatch = name.match(uniPattern);
    if (uniMatch) {
      roots.add(uniMatch[1].toLowerCase());
    }
  }
  if (canonicalName) {
    roots.add(canonicalName.toLowerCase());
  }
  // Brand-sibling token harvest for health-system parents.
  // Pull short distinctive tokens (uhealth, sylvester, anschutz, miller) from
  // alt_names so we can run a second autocomplete pass keyed off the brand.
  const isParent = canonicalName && isHealthSystemParent(canonicalName);
  if (isParent) {
    const STOP = new Set([
      "the", "of", "and", "for", "school", "college", "university", "system",
      "health", "healthcare", "medical", "medicine", "center", "hospital",
      "clinic", "department", "division", "institute", "faculty", "campus",
    ]);
    for (const name of altNames) {
      const tokens = name.toLowerCase().split(/[\s,&\-\/]+/).filter(Boolean);
      for (const tok of tokens) {
        if (tok.length >= 5 && !STOP.has(tok) && /^[a-z][a-z0-9]+$/.test(tok)) {
          roots.add(tok);
        }
      }
      // 2-grams that often denote a sibling brand: "miller school", "bascom palmer"
      for (let i = 0; i < tokens.length - 1; i++) {
        const a = tokens[i], b = tokens[i + 1];
        if (a.length >= 4 && b.length >= 4 && !STOP.has(a) && !STOP.has(b)) {
          roots.add(`${a} ${b}`);
        }
      }
    }
  }
  return [...roots];
}

async function resolveCompanyNames(
  companyNames: string[],
  pdlApiKey: string,
  pdlBaseUrl: string
): Promise<ResolvedCompany[]> {
  const results: ResolvedCompany[] = [];

  for (const name of companyNames.slice(0, 5)) {
    let pdlName: string | null = null;
    let pdlId: string | null = null;
    let website: string | null = null;
    let linkedinUrl: string | null = null;
    const altNames: string[] = [];
    const affiliatedIds: string[] = [];
    const affiliatedNames: string[] = [];
    const wildcards: string[] = [];

    try {
      // ── Step 1: Company Cleaner (free) ──
      // Try the raw name first, then try with location words stripped
      const namesToTry = [name];
      const strippedName = stripLocationFromCompanyName(name);
      if (strippedName !== name.toLowerCase().trim()) {
        namesToTry.push(strippedName);
      }

      for (const tryName of namesToTry) {
        if (pdlName) break;

        const cleanUrl = `${pdlBaseUrl}/v5/company/clean?name=${encodeURIComponent(tryName)}&pretty=false`;
        const resp = await fetch(cleanUrl, {
          method: "GET",
          headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.status === 200 && data.name) {
            pdlName = data.name?.toLowerCase() || null;
            pdlId = data.id || null;
            website = data.website || null;
            linkedinUrl = data.linkedin_url || null;
            console.log(`[COMPANY RESOLVE] Step 1 Cleaner: "${tryName}" -> "${pdlName}", ID: ${pdlId}`);
          }
        }

        if (!pdlName) {
          const searchResp = await fetch(`${pdlBaseUrl}/v5/company/search`, {
            method: "POST",
            headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              query: { bool: { must: [{ match: { name: tryName.toLowerCase() } }] } },
              size: 1,
            }),
          });
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            if (searchData.data && searchData.data.length > 0) {
              const co = searchData.data[0];
              pdlName = co.name?.toLowerCase() || null;
              pdlId = co.id || null;
              website = co.website || null;
              linkedinUrl = co.linkedin_url || null;
              console.log(`[COMPANY RESOLVE] Step 1 Search fallback: "${tryName}" -> "${pdlName}"`);
            }
          }
        }
      }

      // ── Step 1b: Enrich-by-name fallback (fuzzy match) ──
      // /v5/company/clean is strict and 404s on shortened names like "panorama orthopedics".
      // /v5/company/enrich?name=... is much fuzzier and resolves the canonical entity.
      if (!pdlName) {
        for (const tryName of namesToTry) {
          if (pdlName) break;
          try {
            const enrichByNameUrl = `${pdlBaseUrl}/v5/company/enrich?name=${encodeURIComponent(tryName)}&pretty=false`;
            const eResp = await fetch(enrichByNameUrl, {
              method: "GET",
              headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
            });
            if (eResp.ok) {
              const eData = await eResp.json();
              if (eData.status === 200 && eData.name) {
                pdlName = eData.name?.toLowerCase() || null;
                pdlId = eData.id || null;
                website = eData.website || null;
                linkedinUrl = eData.linkedin_url || null;
                // capture alt_names early since we already have the enrich payload
                if (Array.isArray(eData.alternative_names)) {
                  for (const altName of eData.alternative_names) {
                    if (typeof altName === "string" && altName.length > 0) {
                      altNames.push(altName.toLowerCase());
                    }
                  }
                }
                if (Array.isArray(eData.affiliated_profiles)) {
                  for (const affId of eData.affiliated_profiles) {
                    if (typeof affId === "string" && affId.length > 0) {
                      affiliatedIds.push(affId);
                    }
                  }
                }
                console.log(`[COMPANY RESOLVE] Step 1b Enrich-by-name: "${tryName}" -> "${pdlName}", ID: ${pdlId}, alt_names: ${altNames.length}`);
              }
            }
          } catch (eErr) {
            console.error(`[COMPANY RESOLVE] Enrich-by-name error for "${tryName}":`, eErr);
          }
        }
      }

      // ── Step 1c: Autocomplete fallback (free, fuzzy) ──
      // Pick the top health-related suggestion. Useful when both Cleaner and Enrich miss.
      if (!pdlName) {
        for (const tryName of namesToTry) {
          if (pdlName) break;
          try {
            const acUrl = `${pdlBaseUrl}/v5/autocomplete?field=company&text=${encodeURIComponent(tryName)}&size=10&pretty=false`;
            const acResp = await fetch(acUrl, {
              method: "GET",
              headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
            });
            if (acResp.ok) {
              const acData = await acResp.json();
              if (Array.isArray(acData.data) && acData.data.length > 0) {
                // Prefer health-related entities; fall back to top result
                const candidates = acData.data.filter((it: any) =>
                  typeof it.name === "string" && nameIsHealthRelated(it.name)
                );
                const pick = (candidates[0] || acData.data[0]) as any;
                if (pick && pick.name) {
                  const pickedName = String(pick.name).toLowerCase();
                  // Re-run enrich on the picked canonical name to grab id + alt_names
                  try {
                    const enrich2Url = `${pdlBaseUrl}/v5/company/enrich?name=${encodeURIComponent(pickedName)}&pretty=false`;
                    const e2Resp = await fetch(enrich2Url, {
                      method: "GET",
                      headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
                    });
                    if (e2Resp.ok) {
                      const e2Data = await e2Resp.json();
                      if (e2Data.status === 200 && e2Data.name) {
                        pdlName = e2Data.name?.toLowerCase() || pickedName;
                        pdlId = e2Data.id || null;
                        website = e2Data.website || null;
                        linkedinUrl = e2Data.linkedin_url || null;
                        if (Array.isArray(e2Data.alternative_names)) {
                          for (const altName of e2Data.alternative_names) {
                            if (typeof altName === "string" && altName.length > 0) {
                              altNames.push(altName.toLowerCase());
                            }
                          }
                        }
                        if (Array.isArray(e2Data.affiliated_profiles)) {
                          for (const affId of e2Data.affiliated_profiles) {
                            if (typeof affId === "string" && affId.length > 0) {
                              affiliatedIds.push(affId);
                            }
                          }
                        }
                      }
                    }
                  } catch (_) { /* ignore, fall through */ }

                  // If enrich didn't fill in, at least keep the picked name
                  if (!pdlName) pdlName = pickedName;
                  console.log(`[COMPANY RESOLVE] Step 1c Autocomplete: "${tryName}" -> "${pdlName}", ID: ${pdlId ?? "n/a"}`);
                }
              }
            }
          } catch (acErr) {
            console.error(`[COMPANY RESOLVE] Autocomplete fallback error for "${tryName}":`, acErr);
          }
        }
      }

      if (!pdlName) {
        console.log(`[COMPANY RESOLVE] "${name}" -> not resolved after Cleaner/Search/Enrich/Autocomplete, using original`);
        results.push({
          original: name, pdl_name: null, pdl_id: null, website: null,
          linkedin_url: null, alt_names: [], affiliated_ids: [], affiliated_names: [], wildcards: [],
        });
        continue;
      }

      // ── Step 2: Company Enrichment by name (1 credit) ──
      try {
        const enrichUrl = `${pdlBaseUrl}/v5/company/enrich?name=${encodeURIComponent(pdlName)}&pretty=false`;
        const enrichResp = await fetch(enrichUrl, {
          method: "GET",
          headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
        });
        if (enrichResp.ok) {
          const enrichData = await enrichResp.json();
          if (Array.isArray(enrichData.alternative_names)) {
            for (const altName of enrichData.alternative_names) {
              if (typeof altName === "string" && altName.length > 0) {
                altNames.push(altName.toLowerCase());
              }
            }
          }
          if (Array.isArray(enrichData.affiliated_profiles)) {
            for (const affId of enrichData.affiliated_profiles) {
              if (typeof affId === "string" && affId.length > 0) {
                affiliatedIds.push(affId);
              }
            }
          }
          console.log(`[COMPANY RESOLVE] Step 2 Enrich: ${altNames.length} alt names, ${affiliatedIds.length} affiliated IDs`);
        }
      } catch (enrichErr) {
        console.error(`[COMPANY RESOLVE] Enrichment error for "${pdlName}":`, enrichErr);
      }

      // ── Step 3: Autocomplete discovery (free) ──
      // For health-system parents (e.g. "university of miami") we run more passes
      // because the brand harvest in extractRootNames adds sibling tokens like
      // "uhealth", "sylvester", "miller school" that don't share the parent root.
      const rootNames = extractRootNames(altNames, pdlName);
      const isHealthSystemAnchor = isHealthSystemParent(pdlName);
      const brandTokensForFilter = rootNames.filter(r => r !== pdlName);
      const autocompletePassLimit = isHealthSystemAnchor ? 8 : 3;
      for (const rootName of rootNames.slice(0, autocompletePassLimit)) {
        try {
          const autoUrl = `${pdlBaseUrl}/v5/autocomplete?field=company&text=${encodeURIComponent(rootName)}&size=20&pretty=false`;
          const autoResp = await fetch(autoUrl, {
            method: "GET",
            headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
          });
          if (autoResp.ok) {
            const autoData = await autoResp.json();
            if (Array.isArray(autoData.data)) {
              for (const item of autoData.data) {
                const itemName = (item.name || "").toLowerCase();
                if (itemName && nameIsHealthRelated(itemName, brandTokensForFilter)) {
                  if (!altNames.includes(itemName) && itemName !== pdlName) {
                    altNames.push(itemName);
                  }
                }
              }
            }
          }
        } catch (autoErr) {
          console.error(`[COMPANY RESOLVE] Autocomplete error for "${rootName}":`, autoErr);
        }
      }
      console.log(`[COMPANY RESOLVE] Step 3 Autocomplete: total ${altNames.length} alt names after discovery (healthSystem=${isHealthSystemAnchor}, passes=${Math.min(rootNames.length, autocompletePassLimit)})`);

      // ── Step 4: Resolve affiliated company IDs to names ──
      // Lift cap from 5 → 15 for health-system parents. UMiami, Mayo, Cleveland
      // Clinic, etc. have more than 5 affiliated PDL entities; truncating at 5
      // guarantees we miss UHealth / Sylvester / Bascom Palmer style siblings.
      const affiliateCap = isHealthSystemAnchor ? 15 : 5;
      for (const affId of affiliatedIds.slice(0, affiliateCap)) {
        try {
          const affSearchResp = await fetch(`${pdlBaseUrl}/v5/company/search`, {
            method: "POST",
            headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              query: { bool: { must: [{ term: { id: affId } }] } },
              size: 1,
            }),
          });
          if (affSearchResp.ok) {
            const affData = await affSearchResp.json();
            if (affData.data && affData.data.length > 0) {
              const affName = affData.data[0].name?.toLowerCase();
              if (affName) {
                affiliatedNames.push(affName);
                if (!altNames.includes(affName)) {
                  altNames.push(affName);
                }
              }
            }
          }
        } catch (affErr) {
          console.error(`[COMPANY RESOLVE] Affiliated resolve error for ID "${affId}":`, affErr);
        }
      }

      // ── Step 5: Generate wildcards from root names ──
      for (const rootName of rootNames) {
        wildcards.push(`*${rootName}*`);
      }
      if (pdlName && !rootNames.includes(pdlName)) {
        wildcards.push(`*${pdlName}*`);
      }

      console.log(`[COMPANY RESOLVE] Final: "${name}" -> name="${pdlName}", ${altNames.length} alt names, ${affiliatedIds.length} affiliates, ${wildcards.length} wildcards`);

      results.push({
        original: name,
        pdl_name: pdlName,
        pdl_id: pdlId,
        website,
        linkedin_url: linkedinUrl,
        alt_names: [...new Set(altNames)],
        affiliated_ids: [...new Set(affiliatedIds)],
        affiliated_names: [...new Set(affiliatedNames)],
        wildcards: [...new Set(wildcards)],
      });
    } catch (err) {
      console.error(`[COMPANY RESOLVE] Error resolving "${name}":`, err);
      results.push({
        original: name, pdl_name: null, pdl_id: null, website: null,
        linkedin_url: null, alt_names: [], affiliated_ids: [], affiliated_names: [], wildcards: [],
      });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Main handler                                                         */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    const body = await req.json();
    const {
      query = "",
      filters = {},
      preview = false,
      page = 0,
      size = 10,
      scroll_token = null,
      parsed: clientParsed = null,
    } = body;
    const action = body.action ?? null;

    /* ── ACTION ROUTING — enrich_person / ai_summary ──────────────── */
    if (action === "enrich_person") {
      const pdlKey = Deno.env.get("PDL_API_KEY");
      if (!pdlKey) {
        return new Response(JSON.stringify({ error: "PDL API key not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const params = new URLSearchParams();
      if (typeof body.linkedin_url === "string" && body.linkedin_url.length > 0) {
        params.set("profile", body.linkedin_url);
      } else if (typeof body.email === "string" && body.email.length > 0) {
        params.set("email", body.email);
      } else {
        return new Response(JSON.stringify({ error: "linkedin_url or email required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      params.set("pretty", "false");
      params.set("min_likelihood", "6");
      const enrichResp = await fetch(
        `https://api.peopledatalabs.com/v5/person/enrich?${params.toString()}`,
        { headers: { "X-Api-Key": pdlKey, "Content-Type": "application/json" } }
      );
      if (!enrichResp.ok) {
        const errText = await enrichResp.text();
        console.error(`[enrich_person] PDL ${enrichResp.status}: ${errText}`);
        return new Response(JSON.stringify({ error: `Enrichment failed (${enrichResp.status})` }), {
          status: enrichResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const enrichJson = await enrichResp.json();
      return new Response(JSON.stringify({ data: enrichJson.data ?? enrichJson, likelihood: enrichJson.likelihood ?? null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ai_summary") {
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      if (!prompt) {
        return new Response(JSON.stringify({ error: "prompt required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const result = await callClaude<{ summary: string }>(
        `You are a concise healthcare-recruiting assistant. You will receive a profile brief. Write a factual 3-4 sentence professional summary. Return ONLY valid JSON: { "summary": "..." }`,
        prompt,
        { summary: "" },
        "AI-Summary",
        { timeoutMs: 15000 }
      );
      return new Response(JSON.stringify({ summary: result.summary || "" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    cleanExpiredCache(adminClient);

    // Step 1: Parse query
    const parsed = await parseQuery(query, lovableKey, clientParsed);
    console.log("Parsed:", JSON.stringify(parsed));

    // ─── Guard A: empty-intent abort ───────────────────────────────
    // If the parser produced no role/title/specialty/company/credentials AND
    // the user supplied no company filter, refuse to call PDL. A query like
    // "people in Nashville" would otherwise fall through to the generic
    // sub_role fallback and pull tens of thousands of irrelevant clinicians,
    // burning PDL credits and Anthropic rerank tokens for a useless result set.
    const _g = parsed as Record<string, unknown>;
    const _arr = (v: unknown): string[] => Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()) : [];
    const _hasIntent =
      _arr(_g.job_titles).length > 0 ||
      _arr(_g.title_synonyms).length > 0 ||
      _arr(_g.specialties).length > 0 ||
      (typeof _g.specialty === "string" && !!_g.specialty.trim()) ||
      _arr(_g.credentials).length > 0 ||
      _arr(_g.keywords).length > 0 ||
      _arr(_g.required_keywords).length > 0 ||
      _arr(_g.companies).length > 0 ||
      _arr(_g.current_companies).length > 0 ||
      _arr(_g.past_companies).length > 0 ||
      _arr(_g.any_companies).length > 0 ||
      _arr(_g.person_names).length > 0 ||
      _arr((filters as Record<string, unknown>).companies).length > 0 ||
      (typeof (filters as Record<string, unknown>).current_company === "string" && !!((filters as Record<string, unknown>).current_company as string).trim());

    if (!_hasIntent) {
      console.log("[GUARD A] Empty-intent query — refusing to call PDL");
      const categories = deriveParsedCategories(parsed, filters);
      const keywords = deriveParsedKeywords(parsed, filters);
      return new Response(
        JSON.stringify({
          preview: !!preview,
          total: 0,
          parsed,
          parsed_categories: categories,
          parsed_keywords: keywords,
          results: [],
          scroll_token: null,
          hasMore: false,
          guard: "empty_intent",
          guard_message: "Please add a clinical role, specialty, employer, or credential. Examples: 'cardiologist', 'ICU nurse', 'optometrist at LensCrafters'.",
          timing_ms: Date.now() - requestStart,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Shared PDL credentials (used by Steps 1b, 1.5, and full search)
    const pdlApiKey = Deno.env.get("PDL_API_KEY");
    const pdlBaseUrl = "https://api.peopledatalabs.com";

    // Step 1b: Job Title Enrichment — expand parsed titles via PDL Job Title Enrichment API.
    // Slots AFTER parseQuery (so we have intent) and BEFORE buildPDLQuery (so expanded titles
    // feed into the ES DSL). Falls back silently to original titles on any error/404/402.
    const rawJobTitles = (parsed.job_titles as string[]) || [];
    if (rawJobTitles.length > 0 && pdlApiKey) {
      try {
        const enrichedTitles = await enrichJobTitles(rawJobTitles, pdlApiKey);
        if (enrichedTitles.length > rawJobTitles.length) {
          (parsed as Record<string, unknown>).job_titles = enrichedTitles;
          console.log(`[JobTitleEnrich] Titles expanded: ${rawJobTitles.length} → ${enrichedTitles.length}`);
        }
      } catch (enrichErr) {
        console.warn(
          `[JobTitleEnrich] Enrichment failed, using original titles: ${enrichErr instanceof Error ? enrichErr.message : String(enrichErr)}`
        );
      }
    }

    // Step 1.5: Resolve company names via PDL Company API
    const rawCompanies: string[] = (() => {
      // Bug fix: empty arrays are truthy, so `parsed.companies || parsed.current_companies`
      // would stop at `[]` and never fall through. Merge all company fields instead.
      const buckets = [
        parsed.companies,
        (parsed as any).company,
        (parsed as any).current_company,
        (parsed as any).current_companies,
        (parsed as any).any_companies,
        (parsed as any).past_companies,
      ];
      const merged: string[] = [];
      for (const b of buckets) {
        if (Array.isArray(b)) {
          for (const c of b) {
            if (typeof c === "string" && c.trim()) merged.push(c.trim());
          }
        } else if (typeof b === "string" && b.trim()) {
          for (const c of b.split(",")) {
            const t = c.trim();
            if (t) merged.push(t);
          }
        }
      }
      return [...new Set(merged.map(s => s.toLowerCase()))];
    })();
    console.log(`[COMPANY RESOLVE] rawCompanies extracted: ${JSON.stringify(rawCompanies)}`);
    let companyScope: Record<string, unknown> | null = null;
    if (rawCompanies.length > 0 && pdlApiKey) {
      const resolved = await resolveCompanyNames(rawCompanies, pdlApiKey, pdlBaseUrl);
      const resolvedIds = resolved.filter(r => r.pdl_id).map(r => r.pdl_id!);
      const resolvedNames = resolved.filter(r => r.pdl_name).map(r => r.pdl_name!);
      const resolvedWebsites = resolved.filter(r => r.website).map(r => r.website!);
      const resolvedLinkedinUrls = resolved.filter(r => r.linkedin_url).map(r => r.linkedin_url!);
      const resolvedAltNames = resolved.flatMap(r => r.alt_names);
      const resolvedAffiliatedIds = resolved.flatMap(r => r.affiliated_ids);
      const resolvedAffiliatedNames = resolved.flatMap(r => r.affiliated_names);
      const resolvedWildcards = resolved.flatMap(r => r.wildcards);

      if (resolvedIds.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_ids = resolvedIds;
      }
      if (resolvedNames.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_names = resolvedNames;
      }
      if (resolvedWebsites.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_websites = resolvedWebsites;
      }
      if (resolvedLinkedinUrls.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_linkedin_urls = resolvedLinkedinUrls;
      }
      if (resolvedAltNames.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_alt_names = resolvedAltNames;
      }
      if (resolvedAffiliatedIds.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_affiliated_ids = resolvedAffiliatedIds;
      }
      if (resolvedAffiliatedNames.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_affiliated_names = resolvedAffiliatedNames;
      }
      if (resolvedWildcards.length > 0) {
        (parsed as Record<string, unknown>)._resolved_company_wildcards = resolvedWildcards;
      }

      // Multi-entity scope detection — used by frontend to surface a banner.
      const isHealthSystem = resolved.some(r => r.pdl_name && isHealthSystemParent(r.pdl_name));
      const uniqueAffiliates = [...new Set(resolvedAffiliatedNames)];
      // Fall back to alt-names when PDL didn't return affiliated_profiles but
      // autocomplete + brand-token harvesting surfaced sibling entities (e.g. UHealth, Miller School).
      const anchorLower = (resolved[0]?.pdl_name ?? "").toLowerCase();
      const siblingAltNames = [...new Set(resolvedAltNames)].filter(
        (n) => n.toLowerCase() !== anchorLower,
      );
      const displayAffiliates = uniqueAffiliates.length > 0 ? uniqueAffiliates : siblingAltNames;
      const effectiveAffiliateCount = Math.max(uniqueAffiliates.length, siblingAltNames.length);
      if (isHealthSystem || effectiveAffiliateCount > 3) {
        (parsed as Record<string, unknown>)._is_health_system = true;
      }

      // Small specialty practice detection — when the anchor resolved cleanly
      // but to a single (or near-single) entity AND it's clearly NOT a health
      // system, we know the company filter alone is a very tight constraint.
      // For these practices, PDL has near-zero role/ONET enrichment (verified
      // diagnostically against Panorama Orthopedics, OrthoSouth Memphis), so a
      // hard specialty must-clause collapses the clinical pool by 50–70%.
      // Demote specialty to a soft scoring boost — the specialty-aware ranker
      // in format-results.ts (Tier 1 +30 ONET, Tier 2 +20 title) still keeps
      // real specialists on page 1.
      const hasAnyResolvedAnchor = resolvedIds.length > 0 || resolvedNames.length > 0 || resolvedWebsites.length > 0;
      const isSmallPractice =
        hasAnyResolvedAnchor &&
        !isHealthSystem &&
        effectiveAffiliateCount <= 2 &&
        resolvedIds.length <= 2;
      if (isSmallPractice) {
        (parsed as Record<string, unknown>)._is_small_practice = true;
      }

      companyScope = {
        anchor_name: resolved[0]?.pdl_name ?? rawCompanies[0] ?? null,
        is_health_system: isHealthSystem,
        is_small_practice: isSmallPractice,
        affiliated_count: effectiveAffiliateCount,
        sample_affiliates: displayAffiliates.slice(0, 5),
        multi_entity: isHealthSystem || effectiveAffiliateCount > 3,
      };

      console.log("[COMPANY] Enhanced resolution:", {
        ids: resolvedIds,
        names: resolvedNames,
        altNames: resolvedAltNames.length,
        affiliatedIds: resolvedAffiliatedIds,
        affiliatedNames: uniqueAffiliates.length,
        wildcards: resolvedWildcards,
        isHealthSystem,
        isSmallPractice,
      });
    }

    // Step 2: Build ES DSL query
    const pdlQuery = buildPDLQuery(parsed, filters);
    console.log("PDL Query built:", JSON.stringify(pdlQuery).slice(0, 500));

    // Step 3: Preview mode
    if (preview) {
      const cacheKey = await getPDLCacheKey(pdlQuery, 1);
      const cached = await getDBCache(adminClient, cacheKey);

      let total: number;
      if (cached && cached.total > 0) {
        total = cached.total;
        console.log(`[PREVIEW] Cache hit: ${total} results`);
      } else {
        total = await runPreview(pdlQuery);
        // Only cache positive results to avoid poisoning cache with transient failures
        if (total > 0) {
          setDBCache(adminClient, cacheKey, total, [], null);
        }
        console.log(`[PREVIEW] PDL returned: ${total} results`);
      }

      const categories = deriveParsedCategories(parsed, filters);
      const keywords = deriveParsedKeywords(parsed, filters);

      // ─── Guard C: broad-pull abort ────────────────────────────────
      // If PDL returned a huge result set AND the query has no positive must
      // clause (i.e. only filters + exclusions, no role/title/specialty/company
      // anchor), the rerank will only sort noise. Skip the full fetch + rerank,
      // surface a clear warning, and let the user refine.
      const BROAD_PULL_THRESHOLD = 5000;
      const _bool = (pdlQuery as { bool?: { must?: unknown[] } }).bool ?? {};
      const _mustCount = Array.isArray(_bool.must) ? _bool.must.length : 0;
      if (total > BROAD_PULL_THRESHOLD && _mustCount === 0) {
        console.log(`[GUARD C] Broad-pull abort: total=${total} with must:0 — refusing rerank`);
        return new Response(
          JSON.stringify({
            preview: true,
            total,
            parsed,
            parsed_categories: categories,
            parsed_keywords: keywords,
            results: [],
            scroll_token: null,
            hasMore: false,
            guard: "too_broad",
            guard_message: `Found ${total.toLocaleString()} candidates — that's too broad to rank meaningfully. Add a specialty, title, or employer to narrow this down.`,
            timing_ms: Date.now() - requestStart,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          preview: true,
          total,
          parsed,
          parsed_categories: categories,
          parsed_keywords: keywords,
          results: [],
          scroll_token: null,
          hasMore: total > size,
          timing_ms: Date.now() - requestStart,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 4: Full search — fetch exactly one page at a time.
    // The preview request (preview=true) already returned the total count to the UI.
    // Each page fetch costs `size` credits. Users browse via pagination without
    // burning credits they don't need. No pool logic, no special-casing by practice type.
    const fullCacheKey = await getPDLCacheKey(pdlQuery, size, scroll_token);
    const cached = await getDBCache(adminClient, fullCacheKey);

    let results: Record<string, unknown>[];
    let total: number;
    let returnScrollToken: string | null = null;
    let cascadeUsed = false;
    let cascadePlan: CascadeStep[] = [];
    let cascadeWinningStep: CascadeStep | null = null;

    if (cached && cached.data.length > 0) {
      console.log(`[SEARCH] Cache hit: ${cached.total} total, ${cached.data.length} results`);
      total = cached.total;
      returnScrollToken = cached.scroll_token;
      results = cached.data as Record<string, unknown>[];
    } else {
      const liveKey = Deno.env.get("PDL_API_KEY");
      if (!liveKey) {
        return new Response(
          JSON.stringify({ error: "PDL_API_KEY not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pdlData = await fetchPDLForFullSearch(
        pdlQuery, liveKey, page, size, scroll_token, fullCacheKey, adminClient
      );

      if ((pdlData as Record<string, unknown>)._error) {
        return new Response(
          JSON.stringify({ error: "PDL search failed", details: (pdlData as Record<string, unknown>)._errorPayload }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      results = (pdlData.data as Record<string, unknown>[]) || [];
      total = (pdlData.total as number) || 0;
      returnScrollToken = (pdlData.scroll_token as string) || null;

      // Cascade — only fires when the initial query returned almost nothing (<2 results).
      // Progressively relaxes filters (specialty → titles → metro → state) until
      // enough results are found. Each cascade step runs its own preview before fetching.
      if (total < 2 && !cascadeUsed) {
        console.log(`[CASCADE] Only ${results.length} results, initiating cascade...`);
        const cascadePayload: CascadePayload = {
          location: (parsed.location as CascadePayload["location"]) || {},
          job_titles: (parsed.job_titles as string[]) || [],
          title_confidence: (parsed.title_confidence as number) || 0.5,
          specialty: (parsed.specialty as string) || null,
          specialty_confidence: (parsed.specialty_confidence as number) || 0.5,
        };

        const cascadeResult = await runCascade(
          pdlQuery, cascadePayload, "clinical_search", total, fullCacheKey, adminClient, size
        );

        if (cascadeResult.profiles.length > results.length) {
          results = cascadeResult.profiles;
          cascadeUsed = true;
          cascadePlan = cascadeResult.plan;
          cascadeWinningStep = cascadeResult.winningStep;
          if (cascadeResult.total > total) total = cascadeResult.total;
          console.log(`[CASCADE] Improved to ${results.length} results after ${cascadeResult.stepsUsed} steps (winning step: ${cascadeWinningStep})`);
        }
      }
    }

    // Step 5: Format + AI rerank the current page.
    // Reranking runs on whatever was fetched (one page). Results are cached so
    // repeat views of the same page don't re-burn credits or LLM tokens.
    let formattedResults: Record<string, unknown>[];
    let aiRerankMeta: Record<string, unknown> = { ai_reranked: false };

    // If cached data is already formatted (has relevance_score), serve it directly
    const firstResult = results[0] as Record<string, unknown> | undefined;
    if (firstResult && typeof firstResult.relevance_score === "number") {
      formattedResults = results;
      aiRerankMeta = { ai_reranked: true, ai_rerank_cached: true };
    } else {
      const deterministicResults = scoreAndRankResults(results.map(mapPerson), parsed);
      formattedResults = deterministicResults;

      if (deterministicResults.length > 0) {
        const rerank = await rerankWithAI(deterministicResults, parsed, query, lovableKey);
        formattedResults = rerank.candidates as unknown as Record<string, unknown>[];
        aiRerankMeta = {
          ai_reranked: rerank.ai_reranked,
          ai_rerank_count: rerank.ai_rerank_count ?? null,
          ai_rerank_ms: rerank.ai_rerank_ms ?? null,
          ai_rerank_error: rerank.ai_rerank_error ?? null,
        };

        // Cache the formatted page to avoid re-burning credits on repeat views
        if (rerank.ai_reranked) {
          setDBCache(adminClient, fullCacheKey, total, formattedResults, returnScrollToken);
        }
      }
    }

    const pagedResults = formattedResults;

    const categories = deriveParsedCategories(parsed, filters);
    const keywords = deriveParsedKeywords(parsed, filters);

    // Log search
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user } } = await userClient.auth.getUser();
        if (user) {
          await adminClient.from("oslr_searches").insert({
            user_id: user.id,
            query,
            filters,
            result_count: total,
          });
        }
      }
    } catch (e) {
      console.error("Failed to log search:", e);
    }

    // Build geo scope metadata for frontend transparency.
    // Use the WINNING step (what actually produced results), not the planned cascade list.
    // Distinguishes semantic relaxation (still local) from real geographic widening.
    const requestedLocation = (parsed.location as Record<string, unknown>) || {};
    const effectiveScope: "local" | "semantic" | "metro" | "state" = !cascadeUsed
      ? "local"
      : cascadeWinningStep === CascadeStep.EXPAND_TO_STATE
        ? "state"
        : cascadeWinningStep === CascadeStep.EXPAND_TO_METRO
          ? "metro"
          : (cascadeWinningStep === CascadeStep.DROP_SPECIALTY ||
             cascadeWinningStep === CascadeStep.DROP_TITLES ||
             cascadeWinningStep === CascadeStep.DROP_COMPANY)
            ? "semantic"
            : "local";
    const geoExpanded = effectiveScope === "metro" || effectiveScope === "state";
    const geoScope: Record<string, unknown> = {
      requested_city: requestedLocation.city || null,
      requested_state: requestedLocation.state || null,
      geo_expanded: geoExpanded,
      semantic_relaxed: effectiveScope === "semantic",
      effective_scope: effectiveScope,
      winning_step: cascadeWinningStep,
      cascade_steps_used: cascadeUsed ? cascadePlan : [],
    };

    return new Response(
      JSON.stringify({
        results: pagedResults,
        total,
        parsed,
        parsed_categories: categories,
        parsed_keywords: keywords,
        scroll_token: returnScrollToken,
        hasMore: total > (page + 1) * size,
        cascade_used: cascadeUsed,
        cascade_plan: cascadePlan,
        geo_scope: geoScope,
        company_scope: companyScope,
        ...aiRerankMeta,
        timing_ms: Date.now() - requestStart,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Handler error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
