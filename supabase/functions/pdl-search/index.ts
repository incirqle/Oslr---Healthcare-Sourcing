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
import { mapPerson, deriveParsedCategories, deriveParsedKeywords } from "./format-results.ts";
import { callClaude } from "./ai-router.ts";

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

ORDERING RULE: Always try geographic expansion BEFORE dropping titles or employers.

RETURN: { "cascade_plan": string[], "reasoning": string }`;

const DEFAULT_CASCADE: CascadeStep[] = [
  CascadeStep.EXPAND_TO_METRO,
  CascadeStep.EXPAND_TO_STATE,
  CascadeStep.DROP_COMPANY,
  CascadeStep.DROP_TITLES,
  CascadeStep.DROP_SPECIALTY,
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
): Promise<{ profiles: Record<string, unknown>[]; stepsUsed: number; plan: CascadeStep[] }> {
  const cascadePlan = await planCascade(payload, queryType, previewTotal);

  const boolBlock = (basePdlQuery as { bool?: { filter?: unknown[]; must?: unknown[]; must_not?: unknown[] } }).bool || {};
  let current = {
    filter: (boolBlock.filter || []) as Clause[],
    must: (boolBlock.must || []) as Clause[],
    must_not: (boolBlock.must_not || []) as Clause[],
  };

  let stepsUsed = 0;

  for (const step of cascadePlan) {
    current = applyStep(current, payload, step);
    stepsUsed++;

    const stepHash = queryHash + "_" + step;
    const cached = await getDBCache(adminClient, stepHash);
    if (cached && cached.data.length > 0) {
      return { profiles: cached.data as Record<string, unknown>[], stepsUsed, plan: cascadePlan };
    }

    const stepQuery = {
      bool: {
        filter: current.filter,
        ...(current.must.length > 0 ? { must: current.must } : {}),
        ...(current.must_not.length > 0 ? { must_not: current.must_not } : {}),
      },
    };

    const total = await runPreview(stepQuery);
    console.log(`[CASCADE] step=${step}, preview_total=${total}`);

    if (total >= 3) {
      const profiles = await fetchProfiles(stepQuery, Math.min(size, 100));
      setDBCache(adminClient, stepHash, total, profiles, null);
      return { profiles: profiles as unknown as Record<string, unknown>[], stepsUsed, plan: cascadePlan };
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
  return { profiles: profiles as unknown as Record<string, unknown>[], stepsUsed, plan: cascadePlan };
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

/** Health-related keywords for filtering Autocomplete results */
const HEALTH_NAME_KEYWORDS = [
  "medical", "medicine", "hospital", "health", "clinic", "anschutz",
  "surgery", "surgical", "nursing", "physician", "doctor", "dental",
  "pharma", "rehab", "rehabilitation", "cancer", "heart", "children",
  "memorial", "mercy", "presbyterian", "baptist", "methodist", "lutheran",
  "saint", "st.", "mount sinai", "cedars", "kaiser", "mayo",
];

function nameIsHealthRelated(name: string): boolean {
  const lower = name.toLowerCase();
  return HEALTH_NAME_KEYWORDS.some(kw => lower.includes(kw));
}

/** Extract root organizational name from alternative names. */
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
      const cleanUrl = `${pdlBaseUrl}/v5/company/clean?name=${encodeURIComponent(name)}&pretty=false`;
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
          console.log(`[COMPANY RESOLVE] Step 1 Cleaner: "${name}" -> "${pdlName}", ID: ${pdlId}`);
        }
      }

      // If Cleaner failed, try Company Search as fallback
      if (!pdlName) {
        const searchResp = await fetch(`${pdlBaseUrl}/v5/company/search`, {
          method: "POST",
          headers: { "X-Api-Key": pdlApiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: { bool: { must: [{ match: { name: name.toLowerCase() } }] } },
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
            console.log(`[COMPANY RESOLVE] Step 1 Search fallback: "${name}" -> "${pdlName}"`);
          }
        }
      }

      if (!pdlName) {
        console.log(`[COMPANY RESOLVE] "${name}" -> not resolved, using original`);
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
      const rootNames = extractRootNames(altNames, pdlName);
      for (const rootName of rootNames.slice(0, 3)) {
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
                if (itemName && nameIsHealthRelated(itemName)) {
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
      console.log(`[COMPANY RESOLVE] Step 3 Autocomplete: total ${altNames.length} alt names after discovery`);

      // ── Step 4: Resolve affiliated company IDs to names ──
      for (const affId of affiliatedIds.slice(0, 5)) {
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
      size = 25,
      scroll_token = null,
      parsed: clientParsed = null,
    } = body;

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

    // Step 1.5: Resolve company names via PDL Company API
    const pdlApiKey = Deno.env.get("PDL_API_KEY");
    const pdlBaseUrl = "https://api.peopledatalabs.com";
    const rawCompanies: string[] = (() => {
      const co = parsed.companies || parsed.company || parsed.current_company || parsed.current_companies || [];
      return Array.isArray(co)
        ? co.map((c: string) => c.trim()).filter(Boolean)
        : typeof co === "string" && co
          ? co.split(",").map((c: string) => c.trim()).filter(Boolean)
          : [];
    })();
    if (rawCompanies.length > 0 && pdlApiKey) {
      const resolved = await resolveCompanyNames(rawCompanies, pdlApiKey, pdlBaseUrl);
      const resolvedIds = resolved.filter(r => r.pdl_id).map(r => r.pdl_id!);
      const resolvedNames = resolved.filter(r => r.pdl_name).map(r => r.pdl_name!);
      const resolvedWebsites = resolved.filter(r => r.website).map(r => r.website!);
      const resolvedLinkedinUrls = resolved.filter(r => r.linkedin_url).map(r => r.linkedin_url!);

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
      console.log("[COMPANY] Resolved IDs:", resolvedIds, "Names:", resolvedNames, "Websites:", resolvedWebsites);
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

    // Step 4: Full search
    const fullCacheKey = await getPDLCacheKey(pdlQuery, size, scroll_token);
    const cached = await getDBCache(adminClient, fullCacheKey);

    let results: Record<string, unknown>[];
    let total: number;
    let returnScrollToken: string | null = null;
    let cascadeUsed = false;
    let cascadePlan: CascadeStep[] = [];

    if (cached && cached.data.length > 0) {
      console.log(`[SEARCH] Cache hit: ${cached.total} total, ${cached.data.length} results`);
      results = cached.data as Record<string, unknown>[];
      total = cached.total;
      returnScrollToken = cached.scroll_token;
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

      // Cascade if too few results
      if (results.length < 3 && page === 0) {
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
          console.log(`[CASCADE] Improved to ${results.length} results after ${cascadeResult.stepsUsed} steps`);
        }
      }
    }

    // Step 5: Format results
    const formattedResults = results.map(mapPerson);
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

    return new Response(
      JSON.stringify({
        results: formattedResults,
        total,
        parsed,
        parsed_categories: categories,
        parsed_keywords: keywords,
        scroll_token: returnScrollToken,
        hasMore: total > (page + 1) * size,
        cascade_used: cascadeUsed,
        cascade_plan: cascadePlan,
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
