/**
 * search-clinicians/handler.ts — Oslr's clinical people-search engine (request handler).
 *
 * Crustdata v2 only. Ported from the RepGPT hiring engine
 * (incirqle-ai/supabase/functions/search-talent) per the fork doctrine
 * (blueprint §10): every dependency lives inside this folder — nothing here
 * imports from ../search-people, ../_shared, or any other engine. The one
 * sanctioned outside consumer is the search-people ADAPTER (a contract shim,
 * not an engine): it imports handleClinicianSearch and translates the
 * legacy SearchPage wire shape onto this pipeline.
 *
 * Pipeline: parse → criteria contract → resolve → build → search →
 * recall (semantic + company graph) → deterministic rank → one-pass AI
 * audit → honest zero (labelled fallback + auto-widen ladder) → respond.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseQuery } from "./parse-query.ts";
import { callClaude, CLAUDE_OPUS } from "./ai-router.ts";
import {
  ENRICHMENT_TTL_MS,
  getCrustDataCache,
  normalizeCrustDataV2Profile,
  SEARCH_TTL_MS,
  setCrustDataCache,
} from "./cache.ts";
import { auditTier, runClinicianAudit, type AuditableResult, type AuditVerdict } from "./audit.ts";
import {
  buildSearchCacheKey,
  checkCeiling,
  CREDIT_CEILING,
  creditLedger,
  creditsForResults,
  getSessionSpend,
  recordSessionSpend,
  SEARCH_LIMIT,
} from "./credit-budget.ts";
import {
  mapParsedToCriteria,
  reconcileParsedClinicianIntent,
} from "./clinician-criteria.ts";
import type { CompanyValue, SearchCriteria } from "./clinician-criteria.ts";
import { applyRelaxations, reorderLadderByRemarks, widenOptions } from "./widen-criteria.ts";
import { classifySearchError, searchErrorFields } from "./errors.ts";
import { buildClinicianQuery, CARD_FIELDS, safeTitleTerms } from "./build-clinician-query.ts";
import { rankByMatchScope, rankByStageFit } from "./match-scope.ts";
import { rankDeterministic } from "./soft-rank.ts";
import { classifyEmployer } from "./employer-class.ts";
import { mergeSemanticRows, SEMANTIC_LIMIT, semanticRecall, semanticWorthRunning } from "./semantic-recall.ts";
import { expandStatedTitles } from "./title-vocabulary.ts";
import { resolveSpecialtyCompanyIds } from "./specialty-companies.ts";
import { companyIdentifyV2, personEnrichV2, personSearchV2 } from "./lib/crustdata-v2.ts";
import { resolveEmployerGroup } from "./employer-resolution.ts";
import { resolveCaller } from "./lib/auth.ts";
import {
  CLINICIAN_ENGINE_VERSION,
  logClinicianRun,
  logClinicianSearch,
  newRunId,
} from "./lib/run-log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Identity of a result row for de-duplicating recall rows. */
function rowKey(row: Record<string, unknown>): string | null {
  const li = row.linkedin_url ?? row.linkedin_profile_url;
  if (typeof li === "string" && li.trim()) return `li:${li.trim().toLowerCase()}`;
  const id = row.id ?? row.crustdata_person_id ?? row.person_id;
  if (typeof id === "string" && id.trim()) return `id:${id.trim()}`;
  if (typeof id === "number") return `id:${id}`;
  const name = typeof row.full_name === "string"
    ? row.full_name.toLowerCase().trim()
    : typeof row.name === "string"
    ? row.name.toLowerCase().trim()
    : "";
  const co = typeof row.job_company_name === "string" ? row.job_company_name.toLowerCase().trim() : "";
  return name ? `nc:${name}|${co}` : null;
}

export async function handleClinicianSearch(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestStart = Date.now();
  const runId = newRunId();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json();
    const {
      query,
      filters = {},
      page = 0,
      size = 15,
      preview = false,
      bypass_cache: bypassCacheRaw = false,
    } = body;

    const caller = await resolveCaller(adminClient, req);
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized — sign in to search" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const user = { id: caller.userId, email: caller.email };
    const bypassCache = bypassCacheRaw === true && caller.isAdmin === true;

    /* ── ACTION: profile_evidence — enrich-on-expand (30d cache) ─────
       Fires ONLY on an explicit card expand. Never called by the search
       pipeline (blueprint §5.5). */
    if (body.action === "profile_evidence") {
      const evidenceUrl = String(body.linkedin_url ?? "").trim();
      if (!evidenceUrl) {
        return new Response(JSON.stringify({ error: "linkedin_url required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const evidenceKey = "clin:evidence:" + evidenceUrl.toLowerCase();
      const cached = bypassCache ? null : await getCrustDataCache(evidenceKey, ENRICHMENT_TTL_MS);
      if (cached) {
        return new Response(JSON.stringify({ ...(cached.profiles[0] ?? {}), credits: 0, cached: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const enrichRes = await personEnrichV2(evidenceUrl, [
        "basic_profile.name",
        "basic_profile.summary",
        "experience.employment_details.current.description",
        "experience.employment_details.past.description",
        "honors",
        "skills",
        "certifications",
      ]);
      if (!enrichRes.ok) {
        if (enrichRes.busy) {
          return new Response(JSON.stringify({
            state: "busy_retrying", busy: true,
            error: "Crustdata is busy — retrying shortly",
            retry_after_ms: enrichRes.retryAfterMs ?? 2000,
          }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        return new Response(JSON.stringify({
          error: "Profile evidence lookup failed",
          detail: enrichRes.detail.slice(0, 300),
          insufficient_credits: enrichRes.insufficientCredits,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const personData = enrichRes.data[0]?.matches?.[0]?.person_data ?? {};
      const shaped = {
        summary: (personData as Record<string, unknown>).summary ??
          ((personData as Record<string, unknown>).basic_profile as Record<string, unknown> | undefined)?.summary ?? "",
        honors: (personData as Record<string, unknown>).honors ?? [],
        skills: (personData as Record<string, unknown>).skills ?? [],
        certifications: (personData as Record<string, unknown>).certifications ?? [],
      };
      await setCrustDataCache(evidenceKey, 1, [shaped], null);
      return new Response(JSON.stringify({ ...shaped, credits: 1, cached: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (query.trim().length > 500) {
      return new Response(
        JSON.stringify({ error: "Query is too long. Please keep it under 500 characters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limit: 100 searches/hour per user on this engine's own table.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentSearchCount } = await adminClient
      .from("clinician_searches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);
    if (recentSearchCount !== null && recentSearchCount >= 100) {
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. 100 searches/hour max." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // STEP 1: Parse (skipped entirely on cached_parsed follow-ups so widen
    // targetIds stay positionally stable).
    const clientParsed = body.cached_parsed;
    const hasClientParsed = !!(clientParsed && typeof clientParsed === "object" && Object.keys(clientParsed).length > 0);
    const parsed = await parseQuery(query.trim(), hasClientParsed ? clientParsed : null);

    let resolvedCriteria: SearchCriteria[] = [];
    try {
      // 1b. User-initiated widen actions — labelled, never silent.
      const removeIds: string[] = Array.isArray(body.removeIds)
        ? (body.removeIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
      const cityToState = body.cityToState === true;
      const unmappedConcepts: string[] = Array.isArray(
        (parsed as Record<string, unknown>).unmapped_concepts,
      )
        ? ((parsed as Record<string, unknown>).unmapped_concepts as unknown[])
          .filter((x): x is string => typeof x === "string")
        : [];
      const reconciledParsed = reconcileParsedClinicianIntent(
        parsed as Record<string, unknown>,
        query,
      );
      const baseCriteria = mapParsedToCriteria(reconciledParsed, unmappedConcepts);

      // Ground STATED titles in the titles that actually exist (free
      // autocomplete). Only ever runs on titles the user named.
      for (const c of baseCriteria) {
        if (c.kind !== "title" || c.enforcement !== "hard") continue;
        const raw = c.value as { terms?: string[] } | string[] | null;
        const stated = Array.isArray(raw) ? raw : (raw?.terms ?? []);
        if (stated.length === 0) continue;
        try {
          const expanded = await expandStatedTitles(stated);
          if (expanded.length > stated.length) {
            c.value = { terms: expanded };
            console.log(`[title-vocab] "${stated.join(", ")}" -> ${expanded.length} real titles`);
          }
        } catch (err) {
          console.warn("[title-vocab] expansion failed — stated titles stand", err);
        }
      }

      // Session budget key: user id + PRE-relaxation criteria hash, so the
      // original query and all its widen rounds share ONE ceiling.
      const sessionKey = `${user.id}:${await buildSearchCacheKey(baseCriteria, SEARCH_LIMIT)}`;

      const { criteria, relaxed } = applyRelaxations(baseCriteria, removeIds, cityToState);
      resolvedCriteria = criteria;

      // 2. Resolve named employers. Curated employer_group criteria (the VA,
      //    HCA) already carry their id sets. Every other CURRENT employer
      //    runs through the dynamic multi-entity resolver: identify →
      //    health-relatedness filter → brand-token autocomplete fanout
      //    (the University-of-Miami problem — one brand, many entities).
      //    ≥2 clinical entities upgrades the criterion to employer_group in
      //    place (id preserved, so widen targetIds stay stable); exactly 1
      //    sets company_id. Descriptor companies never resolve.
      for (const c of criteria) {
        if (c.kind !== "company" || (c.value as CompanyValue).descriptor === true) continue;
        const v = c.value as CompanyValue;
        try {
          const group = await resolveEmployerGroup(v.name);
          if (group && group.entity_count >= 2) {
            (c as SearchCriteria).kind = "employer_group";
            c.value = {
              group_key: `resolved:${v.name}`,
              name: group.name,
              company_ids: group.company_ids,
              domains: group.domains,
              name_variants: group.name_variants,
            };
            c.note = `Matched across ${group.entity_count} related entities (${group.name}), shared domains, and ${group.name_variants.length} employer-name variants.`;
            continue;
          }
          if (group && group.company_ids.length === 1) {
            v.company_id = group.company_ids[0];
            continue;
          }
        } catch (err) {
          console.warn(`[clinician] employer resolution failed for "${v.name}" (non-fatal)`, err);
        }
      }
      // Past employers keep single-anchor id resolution (career-chain
      // matching wants the canonical entity, not the whole family).
      const pastCompanyCriteria = criteria.filter(
        (c) => c.kind === "past_company" && (c.value as CompanyValue).descriptor !== true,
      );
      if (pastCompanyCriteria.length > 0) {
        const idRes = await companyIdentifyV2(
          pastCompanyCriteria.map((c) => (c.value as CompanyValue).name),
        );
        if (idRes.ok) {
          idRes.data.forEach((hit, i) => {
            (pastCompanyCriteria[i].value as CompanyValue).company_id = hit.company_id;
          });
        } else {
          console.warn(`[clinician] past-company identify HTTP ${idRes.status}: ${idRes.detail.slice(0, 200)}`);
        }
      }

      // 3. Criteria → v2 filter tree (hard criteria only).
      const treeFilters = buildClinicianQuery(criteria);
      if (!treeFilters) {
        const err = classifySearchError("malformed_query");
        console.error(JSON.stringify({ event: "clinician_error", error_code: err.code, criteria, relaxed }));
        return new Response(JSON.stringify({
          results: [], total: 0, page, size,
          hasMore: false, scroll_token: null,
          engine: "clinician",
          engine_version: CLINICIAN_ENGINE_VERSION,
          run_id: runId,
          provider: "crustdata-v2",
          parsed, criteria, relaxed,
          exact: relaxed.length === 0,
          widen_options: widenOptions(criteria),
          credits: 0,
          credits_session: getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS),
          credit_ceiling: CREDIT_CEILING,
          cache_hit: false,
          ...searchErrorFields(err),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 4. ONE v2 person search per resolved criteria set — cached 4h,
      //    preview folded into the same limit-N call, credit-ceilinged.
      const cacheKey = await buildSearchCacheKey(criteria, SEARCH_LIMIT, CARD_FIELDS);
      // deno-lint-ignore no-explicit-any
      let normalized: any[];
      let totalCount: number;
      let credits = 0;
      let cacheHit = false;
      // Deep-pagination cursor + the provider's zero-result diagnostics.
      let nextCursor: string | null = null;
      let zeroRemarks: Array<Record<string, unknown>> = [];

      const cachedSearch = bypassCache ? null : await getCrustDataCache(cacheKey);
      if (cachedSearch) {
        normalized = cachedSearch.profiles;
        totalCount = cachedSearch.total_count;
        nextCursor = cachedSearch.next_cursor;
        cacheHit = true;
        console.log(`[clinician] cache hit key=${cacheKey.slice(0, 16)}… (0 credits)`);
      } else {
        const spentSoFar = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);
        const ceiling = checkCeiling(spentSoFar, SEARCH_LIMIT);
        if (!ceiling.allow) {
          const err = classifySearchError("credit_ceiling");
          console.error(JSON.stringify({
            event: "credit_ceiling_breach",
            spent: ceiling.spent, projected: ceiling.projected, ceiling: CREDIT_CEILING,
          }));
          return new Response(JSON.stringify({
            ...(preview ? { preview: true, parsed } : {}),
            results: [], total: 0, page, size,
            hasMore: false, scroll_token: null,
            engine: "clinician",
            engine_version: CLINICIAN_ENGINE_VERSION,
            run_id: runId,
            provider: "crustdata-v2",
            criteria, relaxed,
            exact: relaxed.length === 0,
            widen_options: [],
            credits: 0,
            credits_session: ceiling.spent,
            credit_ceiling: CREDIT_CEILING,
            cache_hit: false,
            ...searchErrorFields(err),
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const searchRes = await personSearchV2({
          filters: treeFilters as unknown as Record<string, unknown>,
          limit: SEARCH_LIMIT,
          fields: CARD_FIELDS,
        });
        if (!searchRes.ok) {
          const err = classifySearchError(searchRes);
          console.error(JSON.stringify({
            event: "clinician_error", error_code: err.code,
            upstream_status: searchRes.status, detail: searchRes.detail.slice(0, 300),
          }));
          if (searchRes.busy) {
            return new Response(JSON.stringify({
              ...(preview ? { preview: true, parsed } : {}),
              state: "busy_retrying", busy: true,
              error: err.userMessage,
              ...searchErrorFields(err),
              retry_after_ms: searchRes.retryAfterMs ?? 2000,
              results: [], total: 0, page, size,
              hasMore: false, scroll_token: null,
              engine: "clinician",
              engine_version: CLINICIAN_ENGINE_VERSION,
              run_id: runId,
              provider: "crustdata-v2",
              criteria, relaxed,
              exact: relaxed.length === 0,
              widen_options: [],
              credits: 0,
              credits_session: getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS),
              credit_ceiling: CREDIT_CEILING,
              cache_hit: false,
            }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          return new Response(JSON.stringify({
            error: err.userMessage,
            ...searchErrorFields(err),
            detail: `[crustdata.v2] search HTTP ${searchRes.status}: ${searchRes.detail.slice(0, 500)}`,
            engine: "clinician",
            engine_version: CLINICIAN_ENGINE_VERSION,
            run_id: runId,
            provider: "crustdata-v2",
            results: [], total: 0, page, size,
            hasMore: false, scroll_token: null,
            criteria, relaxed,
            exact: relaxed.length === 0,
            widen_options: [],
            credits: 0,
            credits_session: getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS),
            credit_ceiling: CREDIT_CEILING,
            cache_hit: false,
          }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        normalized = searchRes.data.profiles.map(normalizeCrustDataV2Profile);
        totalCount = searchRes.data.total_count;
        nextCursor = searchRes.data.next_cursor;
        zeroRemarks = searchRes.data.remarks;
        credits = creditsForResults(normalized.length);
        recordSessionSpend(creditLedger, sessionKey, credits, SEARCH_TTL_MS);
        // Zero-result responses are NOT cached (transient empties observed
        // upstream; empty searches bill 0 anyway).
        if (normalized.length > 0) {
          await setCrustDataCache(cacheKey, totalCount, normalized, searchRes.data.next_cursor);
        }
      }

      // ── Deep pagination (cursor continuation) ───────────────────────
      // One 50-row fetch used to be the hard ceiling on how far a recruiter
      // could browse a 19,000-person pool. When the requested page reaches
      // past what is fetched and the provider handed back a cursor, follow
      // it — ceiling-checked per hop, deduped, capped at 200 rows (exactly
      // the 6-credit session ceiling), cache updated so the next page is
      // free.
      const DEEP_PAGE_CAP = 200;
      {
        const needed = (Number(page) + 1) * Number(size);
        const seen = new Set<string>();
        for (const row of normalized) {
          const k = rowKey(row);
          if (k) seen.add(k);
        }
        while (
          !preview && nextCursor &&
          normalized.length < Math.min(needed + Number(size), DEEP_PAGE_CAP)
        ) {
          const spent = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);
          if (!checkCeiling(spent, SEARCH_LIMIT).allow) break;
          const more = await personSearchV2({
            filters: treeFilters as unknown as Record<string, unknown>,
            limit: SEARCH_LIMIT,
            fields: CARD_FIELDS,
            cursor: nextCursor,
          });
          if (!more.ok || more.data.profiles.length === 0) break;
          const fresh = more.data.profiles
            .map(normalizeCrustDataV2Profile)
            .filter((row: Record<string, unknown>) => {
              const k = rowKey(row);
              if (!k || seen.has(k)) return false;
              seen.add(k);
              return true;
            });
          normalized = [...normalized, ...fresh];
          const hopCredits = creditsForResults(more.data.profiles.length);
          credits += hopCredits;
          recordSessionSpend(creditLedger, sessionKey, hopCredits, SEARCH_TTL_MS);
          nextCursor = more.data.next_cursor;
          await setCrustDataCache(cacheKey, totalCount, normalized, nextCursor);
          console.log(JSON.stringify({
            event: "deep_page", fetched: fresh.length, pool: normalized.length,
          }));
          if (fresh.length === 0) break;
        }
      }

      // ── Recall trio, passes b + c (additive, fail-soft, ceilinged) ──
      let semanticAdded = 0;
      let semanticRan = false;
      let companyGraphAdded = 0;
      const recallFilters = buildClinicianQuery(
        criteria.filter((c) => c.kind !== "specialty"),
      ) ?? treeFilters;
      if (!cacheHit && semanticWorthRunning(criteria)) {
        const spent = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);
        if (checkCeiling(spent, SEMANTIC_LIMIT).allow) {
          const sem = await semanticRecall({
            query: String(query ?? "").trim(),
            filters: recallFilters as unknown as Record<string, unknown>,
            fields: CARD_FIELDS,
            limit: SEMANTIC_LIMIT,
          });
          semanticRan = sem.ran;
          if (sem.ran && sem.profiles.length > 0) {
            const semNormalized = sem.profiles.map(normalizeCrustDataV2Profile);
            const merged = mergeSemanticRows(normalized, semNormalized, rowKey);
            semanticAdded = merged.added;
            if (merged.added > 0) {
              normalized = merged.merged;
              const semCredits = creditsForResults(semNormalized.length);
              credits += semCredits;
              recordSessionSpend(creditLedger, sessionKey, semCredits, SEARCH_TTL_MS);
              totalCount = Math.max(totalCount, normalized.length);
            }
            console.log(JSON.stringify({ event: "semantic_recall", returned: semNormalized.length, added: merged.added }));
          }
        }
      }
      if (!cacheHit && semanticWorthRunning(criteria)) {
        const specialtyTerms = criteria
          .filter((c) => c.kind === "specialty" && c.enforcement === "hard")
          .flatMap((c) => {
            const v = c.value as { terms?: string[] } | string[];
            return Array.isArray(v) ? v : (v?.terms ?? []);
          });
        if (specialtyTerms.length > 0) {
          const graphSpent = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);
          if (checkCeiling(graphSpent, SEMANTIC_LIMIT).allow) {
            const companyIds = await resolveSpecialtyCompanyIds(specialtyTerms);
            if (companyIds.length > 0) {
              const graphFilters = {
                op: "and",
                conditions: [
                  recallFilters as unknown as Record<string, unknown>,
                  {
                    field: "experience.employment_details.current.company_id",
                    type: "in",
                    value: companyIds,
                  },
                ],
              };
              const graphRes = await personSearchV2({
                filters: graphFilters,
                limit: SEMANTIC_LIMIT,
                fields: CARD_FIELDS,
              });
              if (graphRes.ok && graphRes.data.profiles.length > 0) {
                const graphNormalized = graphRes.data.profiles.map(normalizeCrustDataV2Profile);
                const merged = mergeSemanticRows(normalized, graphNormalized, rowKey);
                companyGraphAdded = merged.added;
                if (merged.added > 0) {
                  normalized = merged.merged;
                  const graphCredits = creditsForResults(graphNormalized.length);
                  credits += graphCredits;
                  recordSessionSpend(creditLedger, sessionKey, graphCredits, SEARCH_TTL_MS);
                  totalCount = Math.max(totalCount, normalized.length);
                }
                console.log(JSON.stringify({
                  event: "company_graph_recall",
                  companies: companyIds.length,
                  returned: graphNormalized.length,
                  added: merged.added,
                }));
              }
            }
          }
        }
      }

      // ── Past-role-holders fallback (tense relaxation FIRST) ─────────
      const PAST_HOLDERS_LIMIT = 15;
      let pastHoldersFallback = false;
      if (
        totalCount === 0 && !preview && normalized.length === 0 &&
        criteria.some((c) => c.kind === "specialty" && c.enforcement === "hard")
      ) {
        const pastKey = cacheKey + ":pastrole";
        const pastCached = bypassCache ? null : await getCrustDataCache(pastKey, SEARCH_TTL_MS);
        if (pastCached && pastCached.profiles.length > 0) {
          normalized = pastCached.profiles;
          totalCount = normalized.length;
          pastHoldersFallback = true;
        } else {
          const pastFilters = buildClinicianQuery(criteria, { pastSpecialty: true });
          const spentNow = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);
          if (pastFilters && checkCeiling(spentNow, PAST_HOLDERS_LIMIT).allow) {
            const pastRes = await personSearchV2({
              filters: pastFilters as unknown as Record<string, unknown>,
              limit: PAST_HOLDERS_LIMIT,
              fields: CARD_FIELDS,
            });
            if (pastRes.ok && pastRes.data.profiles.length > 0) {
              normalized = pastRes.data.profiles.map(normalizeCrustDataV2Profile);
              for (const row of normalized) row.past_role_match = true;
              totalCount = normalized.length;
              const pastCredits = creditsForResults(normalized.length);
              credits += pastCredits;
              recordSessionSpend(creditLedger, sessionKey, pastCredits, SEARCH_TTL_MS);
              pastHoldersFallback = true;
              await setCrustDataCache(pastKey, totalCount, normalized, null);
              console.log(JSON.stringify({
                event: "past_role_fallback",
                found: normalized.length,
                provider_total: pastRes.data.total_count,
              }));
            }
          }
        }
      }

      // ── Auto-widen ladder: one requirement at a time, labelled ──────
      // specialty → credential → title → seniority → region-to-state.
      // Demote to SOFT, never delete. Empty probes bill 0.
      if (totalCount === 0 && !preview && normalized.length === 0) {
        const LADDER = [
          { kind: "fellowship", note: "fellowship training verified by the grader instead of required" },
          { kind: "specialty", note: "specialty ranked instead of required" },
          { kind: "credential", note: "credential verified by the grader instead of required" },
          { kind: "employer_size", note: "employer size ranked instead of required" },
          { kind: "care_setting", note: "care setting ranked instead of required" },
          { kind: "title", note: "title ranked instead of required" },
          { kind: "seniority", note: "seniority ranked instead of required" },
        ];
        // The provider's zero-result diagnostics name the culprit condition
        // (probe log D: "condition_eliminates_all … 77 match without it") —
        // relax that requirement FIRST instead of walking a blind order.
        const orderedLadder = reorderLadderByRemarks(LADDER, zeroRemarks);
        for (const step of [...orderedLadder, { kind: "__region__", note: "" }]) {
          let label: string | null = null;
          if (step.kind === "__region__") {
            const loc = criteria.find((c) =>
              c.kind === "location" && (c.value as { level?: string } | null)?.level === "region"
            );
            if (!loc) continue;
            const v = loc.value as { level: string; state?: string | null; states?: string[] };
            if (!v.state) continue;
            // Border-straddling metros widen to their full clipping-state set.
            if (Array.isArray(v.states) && v.states.length > 1) {
              const stateLabel = v.states.join(" / ");
              label = `${loc.label} → all of ${stateLabel}`;
              loc.value = { level: "multi_state", states: [...v.states] };
              loc.label = stateLabel;
            } else {
              label = `${loc.label} → all of ${v.state}`;
              loc.value = { level: "state", state: v.state };
              loc.label = v.state;
            }
          } else {
            const target = criteria.find((c) => c.kind === step.kind && c.enforcement === "hard");
            if (!target) continue;
            target.enforcement = "soft";
            target.note = `Auto-widened: ${step.note}. Nothing matched with it required.`;
            label = `${target.label} (auto-widened — ${step.note})`;
          }

          const widenedFilters = buildClinicianQuery(criteria);
          if (!widenedFilters) break;
          const spent = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);
          if (!checkCeiling(spent, SEARCH_LIMIT).allow) break;
          const retry = await personSearchV2({
            filters: widenedFilters as unknown as Record<string, unknown>,
            limit: SEARCH_LIMIT,
            fields: CARD_FIELDS,
          });
          if (!retry.ok) break;
          if (retry.data.profiles.length === 0) {
            relaxed.push(label);
            continue;
          }
          normalized = retry.data.profiles.map(normalizeCrustDataV2Profile);
          totalCount = retry.data.total_count;
          const widenCredits = creditsForResults(normalized.length);
          credits += widenCredits;
          recordSessionSpend(creditLedger, sessionKey, widenCredits, SEARCH_TTL_MS);
          relaxed.push(label);
          const widenedKey = await buildSearchCacheKey(criteria, SEARCH_LIMIT, CARD_FIELDS);
          await setCrustDataCache(widenedKey, totalCount, normalized, retry.data.next_cursor);
          console.log(JSON.stringify({ event: "auto_widen", tier: relaxed.length, relaxed, found: normalized.length }));
          break;
        }
      }

      const creditsSession = getSessionSpend(creditLedger, sessionKey, SEARCH_TTL_MS);

      // ── Deterministic ranking: match scope, then stage-fit ─────────
      const scoped = rankByMatchScope(normalized, criteria);
      normalized = scoped.map((r) => r.profile);
      const scopeByIndex = scoped.map((r) => r.match_scope);

      const droppedTitleTerms = criteria
        .filter((c) => c.kind === "title" && c.enforcement === "hard")
        .flatMap((c) => {
          const raw = c.value as string[] | { terms?: string[] } | null;
          const terms = Array.isArray(raw) ? raw : (raw?.terms ?? []);
          return safeTitleTerms(terms).dropped;
        });

      console.log(JSON.stringify({
        event: "search",
        provider: "crustdata-v2",
        api_version: "2025-11-01",
        criteria_count: criteria.length,
        results: normalized.length,
        total: totalCount,
        credits,
        credits_session: creditsSession,
        cache_hit: cacheHit,
        relaxed,
        dropped_title_terms: droppedTitleTerms,
        dropped_count: criteria.filter((c) => c.enforcement === "dropped").length,
      }));

      const thinWidenOptions = totalCount < 10 ? widenOptions(criteria) : [];
      const noResults = totalCount === 0 ? classifySearchError("no_results") : null;

      if (preview) {
        return new Response(JSON.stringify({
          preview: true, total: totalCount, parsed,
          engine: "clinician",
          engine_version: CLINICIAN_ENGINE_VERSION,
          run_id: runId,
          provider: "crustdata-v2",
          criteria, relaxed,
          exact: relaxed.length === 0,
          widen_options: thinWidenOptions,
          credits,
          credits_session: creditsSession,
          credit_ceiling: CREDIT_CEILING,
          cache_hit: cacheHit,
          ...(noResults ? searchErrorFields(noResults) : {}),
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // 5. Map to card rows (everything the card shows rides this response —
      //    zero extra calls on card expand, blueprint §5.8).
      // deno-lint-ignore no-explicit-any
      let allResults = normalized.map((p: any, idx: number) => {
        // deno-lint-ignore no-explicit-any
        const mapEmployer = (e: any, isPrimary: boolean) => ({
          name: e.company ?? e.name ?? null,
          title: e.title ?? null,
          industry: e.company_industries?.[0] ?? null,
          company_logo_url: e.company_logo_url ?? e.logo_url ?? null,
          company_domain: e.company_website_domain ?? e.company_website ?? null,
          company_id: e.crustdata_company_id ?? null,
          seniority_level: e.seniority_level ?? null,
          start_date: e.start_date ?? null,
          end_date: e.end_date ?? null,
          summary: e.description ?? e.summary ?? null,
          is_primary: isPrimary,
        });
        const rawCurrentList = Array.isArray(p.current_employers) ? p.current_employers : [];
        // deno-lint-ignore no-explicit-any
        const defaultIdx = rawCurrentList.findIndex((e: any) => e?.is_default === true);
        const primaryIdx = defaultIdx >= 0 ? defaultIdx : 0;
        // deno-lint-ignore no-explicit-any
        const currentEmployers = rawCurrentList.map((e: any, i: number) => mapEmployer(e, i === primaryIdx));
        const pastEmployers = (Array.isArray(p.past_employers) ? p.past_employers : [])
          // deno-lint-ignore no-explicit-any
          .map((e: any) => mapEmployer(e, false));
        const primaryEmployer = currentEmployers[primaryIdx] ?? null;
        const education = (Array.isArray(p.education_background) ? p.education_background : [])
          // deno-lint-ignore no-explicit-any
          .map((edu: any) => ({
            school_name: edu.institute_name ?? edu.school_name ?? null,
            degrees: edu.degree_name ? [edu.degree_name] : [],
            majors: edu.field_of_study ? [edu.field_of_study] : [],
            start_date: edu.start_date ?? null,
            end_date: edu.end_date ?? null,
            school_logo_url: edu.institute_logo_url ?? null,
          }));
        return {
          id: p.person_id ?? p.linkedin_profile_url ?? null,
          full_name: p.name ?? "Unknown",
          headline: p.headline ?? null,
          summary: p.summary ?? null,
          profile_picture_url: p.basic_profile?.profile_picture_permalink ?? null,
          job_title: primaryEmployer?.title ?? null,
          job_company_name: primaryEmployer?.name ?? null,
          job_company_logo_url: primaryEmployer?.company_logo_url ?? null,
          job_company_domain: primaryEmployer?.company_domain ?? null,
          job_company_id: primaryEmployer?.company_id ?? null,
          job_seniority_level: primaryEmployer?.seniority_level ?? null,
          job_start_date: primaryEmployer?.start_date ?? null,
          // The great inversion: employer class is a TAG for chips and the
          // grader, never a filter (employer-class.ts).
          employer_class: classifyEmployer(primaryEmployer?.name ?? null),
          location_locality: p.location_city ?? null,
          location_region: p.location_state ?? null,
          linkedin_url: p.linkedin_profile_url ?? null,
          education,
          experience_history: [...currentEmployers, ...pastEmployers]
            // deno-lint-ignore no-explicit-any
            .filter((e: any) => e.name)
            // deno-lint-ignore no-explicit-any
            .map((e: any) => ({
              company_name: e.name,
              title: e.title,
              start_date: e.start_date,
              end_date: e.end_date,
              summary: e.summary,
              is_primary: e.is_primary,
              industry: e.industry,
              company_logo_url: e.company_logo_url,
              company_domain: e.company_domain,
            })),
          current_employers: currentEmployers,
          match_scope: scopeByIndex[idx] ?? "primary",
          semantic_recall: p._semantic_recall === true,
          past_role_match: p.past_role_match === true,
        };
      });

      // Deterministic ranking, one combined stable sort: primary-role scope,
      // stage-fit year math, credential/subspecialty evidence tier (verbatim
      // snippet attached), then the SOFT-criteria score — the layer that
      // makes a "ranked" chip true. Runs before the audit so a degraded
      // audit still leaves a genuinely ranked page.
      allResults = rankByStageFit(allResults, criteria); // annotates stage_fit
      allResults = rankDeterministic(allResults, criteria);

      // ── One-pass AI audit: grader + reranker in the SAME read ───────
      let auditSummary: Record<string, unknown> | null = null;
      if (body.audit !== false && (Deno.env.get("ANTHROPIC_API_KEY") ?? "") !== "") {
        const auditModel = Deno.env.get("CLINICIAN_AUDIT_MODEL") || CLAUDE_OPUS;
        const auditKey = cacheKey + (pastHoldersFallback ? ":pastrole" : "") + ":audit";
        type CachedAudit = { summary: Record<string, unknown>; rows: Array<Record<string, unknown> | null> };
        const cachedAuditRow = bypassCache ? null : await getCrustDataCache(auditKey, SEARCH_TTL_MS);
        const cachedAudit = (cachedAuditRow?.profiles?.[0] ?? null) as CachedAudit | null;
        if (cachedAudit && Array.isArray(cachedAudit.rows) && cachedAudit.rows.length === allResults.length) {
          allResults.forEach((r: Record<string, unknown>, i: number) => Object.assign(r, cachedAudit.rows[i] ?? {}));
          auditSummary = { ...cachedAudit.summary, cached: true };
        } else {
          const audit = await runClinicianAudit(
            callClaude,
            auditModel,
            query,
            criteria,
            allResults as unknown as AuditableResult[],
            pastHoldersFallback
              ? {
                contextNote:
                  "These candidates are PAST-ROLE matches by design — the recruiter was told nobody currently in this role matched, and chose to see previous holders of it. Do not reject for a current occupation outside the asked vertical; judge depth of the past role and how recently they left it.",
              }
              : {},
          );
          if (audit) {
            allResults.forEach((r: Record<string, unknown>, i: number) => {
              const v = audit.verdicts.get(i) ?? null;
              r.audit_verdict = v?.verdict ?? null;
              r.audit_reason = v?.reason ?? null;
              r.audit_evidence = v?.evidence ?? null;
              r.audit_score = v?.score ?? null;
            });
            auditSummary = audit.summary as unknown as Record<string, unknown>;
            await setCrustDataCache(auditKey, audit.verdicts.size, [{
              summary: auditSummary,
              rows: allResults.map((r: Record<string, unknown>) => ({
                audit_verdict: r.audit_verdict ?? null,
                audit_reason: r.audit_reason ?? null,
                audit_evidence: r.audit_evidence ?? null,
                audit_score: r.audit_score ?? null,
              })),
            }], null);
            console.log(JSON.stringify({ event: "clinician_audit", provider: "anthropic", ...auditSummary }));
          }
        }
        if (auditSummary) {
          allResults = allResults
            .map((r: typeof allResults[number], i: number) => ({ r, i }))
            .sort((a, b) =>
              (auditTier((a.r as Record<string, unknown>).audit_verdict as AuditVerdict | null) -
                auditTier((b.r as Record<string, unknown>).audit_verdict as AuditVerdict | null)) ||
              ((((b.r as Record<string, unknown>).audit_score as number | null) ?? -1) -
                (((a.r as Record<string, unknown>).audit_score as number | null) ?? -1)) ||
              (a.i - b.i)
            )
            .map(({ r }) => r);
        }
      }

      // Rejects are removed from the response and the count; verdicts stay
      // in the audit summary + run telemetry.
      const beforeRejectFilter = allResults.length;
      allResults = allResults.filter(
        (r: Record<string, unknown>) => r.audit_verdict !== "reject" && r.audit_verdict !== "rejected",
      );
      const rejectedFiltered = beforeRejectFilter - allResults.length;
      const displayTotal = pastHoldersFallback
        ? allResults.length
        : Math.max(totalCount - rejectedFiltered, allResults.length);

      const results = allResults.slice(page * size, (page + 1) * size);

      await logClinicianSearch(adminClient, {
        userId: user.id,
        query,
        filters,
        resultCount: allResults.length,
        skip: page > 0 || preview,
      });
      await logClinicianRun(adminClient, {
        run_id: runId,
        user_id: user.id,
        raw_query: String(query ?? "").trim(),
        parsed_payload: parsed ?? null,
        criteria: criteria ?? null,
        provider_query: {
          filters: treeFilters ?? {},
          relaxed,
          semantic_ran: semanticRan,
          semantic_added: semanticAdded,
          graph_added: companyGraphAdded,
          fallback: pastHoldersFallback ? "past_role_holders" : null,
        },
        result_count: results.length,
        total_count: displayTotal,
        page,
        size,
        widened: relaxed.length > 0,
        widen_options: thinWidenOptions ?? null,
        cache_hit: cacheHit,
        credits_charged: credits,
        credits_session: creditsSession,
        credit_ceiling: CREDIT_CEILING,
        audit_summary: auditSummary,
        latency_ms: Date.now() - requestStart,
        error_code: noResults ? String(noResults.code ?? "") : null,
        error: null,
        rejected_filtered: rejectedFiltered,
      });

      return new Response(JSON.stringify({
        results,
        total: displayTotal,
        page,
        size,
        audit: auditSummary,
        semantic: { ran: semanticRan, added: semanticAdded },
        company_graph: { added: companyGraphAdded },
        fallback: pastHoldersFallback ? "past_role_holders" : null,
        fallback_note: pastHoldersFallback
          ? "No one currently in this role matched your search. Showing people who held it before — up to 15, clearly marked."
          : null,
        rejected_filtered: rejectedFiltered,
        hasMore: (page + 1) * size < allResults.length,
        scroll_token: null,
        engine: "clinician",
        engine_version: CLINICIAN_ENGINE_VERSION,
        run_id: runId,
        provider: "crustdata-v2",
        // Echo the parsed payload: widen clicks re-send it as cached_parsed
        // so the positional criterion ids the widen targetIds point at stay
        // stable.
        parsed,
        criteria,
        relaxed,
        exact: relaxed.length === 0,
        widen_options: thinWidenOptions,
        credits,
        credits_session: creditsSession,
        credit_ceiling: CREDIT_CEILING,
        cache_hit: cacheHit,
        ...(noResults ? searchErrorFields(noResults) : {}),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (err) {
      const msg = err instanceof Error ? (err.stack ?? err.message) : String(err);
      const classified = classifySearchError(
        /time[d]?[\s-]?out|timeout|deadline exceeded/i.test(msg)
          ? "provider_timeout"
          : { ok: false, status: 500, detail: msg },
      );
      console.error(JSON.stringify({
        event: "clinician_error",
        error_code: classified.code,
        detail: msg.slice(0, 300),
        criteria: resolvedCriteria,
      }));
      await logClinicianRun(adminClient, {
        run_id: runId,
        user_id: user.id,
        raw_query: String(query ?? "").trim(),
        criteria: resolvedCriteria ?? null,
        provider_query: { filters: filters ?? {} },
        result_count: 0,
        total_count: 0,
        page,
        size,
        latency_ms: Date.now() - requestStart,
        error_code: classified.code,
        error: msg.slice(0, 1000),
      });
      return new Response(JSON.stringify({
        error: classified.userMessage,
        ...searchErrorFields(classified),
        detail: msg.slice(0, 500),
        engine: "clinician",
        engine_version: CLINICIAN_ENGINE_VERSION,
        run_id: runId,
        provider: "crustdata-v2",
        criteria: resolvedCriteria,
        results: [],
        total: 0,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (error) {
    console.error("Error in search-clinicians:", error);
    try {
      if (supabaseUrl && serviceRoleKey) {
        const errClient = createClient(supabaseUrl, serviceRoleKey);
        await logClinicianRun(errClient, {
          run_id: runId,
          raw_query: "unknown",
          error_code: "unhandled",
          error: error instanceof Error ? (error.stack ?? error.message) : String(error),
          latency_ms: Date.now() - requestStart,
        });
      }
    } catch (_) { /* silent */ }
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}
