/**
 * hybrid-orchestrator.ts — Runs PDL + CrustData and merges.
 *
 * FEATURE FLAG: Set CRUSTDATA_ENABLED=true in env to activate.
 * When disabled (or no CRUSTDATA_API_KEY), this is a passthrough.
 */

import { buildCrustDataQuery, type CrustDataQuery } from "./build-crustdata-query.ts";
import {
  runCrustDataPreview,
  fetchCrustDataProfiles,
  mapCrustDataResults,
  enrichPhoneNumbers,
} from "./fetch-crustdata-results.ts";
import { mergeResults, type MergeResult } from "./hybrid-merge.ts";
import type { FormattedCandidate } from "./format-results.ts";

export interface HybridSearchResult {
  candidates: FormattedCandidate[];
  total: number;
  hybrid_meta: {
    crustdata_enabled: boolean;
    crustdata_preview_total: number;
    crustdata_fetched: number;
    crustdata_net_new: number;
    crustdata_duplicates_merged: number;
    crustdata_ms: number;
    pdl_count: number;
    pdl_ms: number;
    phone_enrichment_attempted: number;
    phone_enrichment_found: number;
  };
}

interface HybridOrchestratorInput {
  parsed: Record<string, unknown>;
  pdlCandidates: FormattedCandidate[];
  pdlTotal: number;
  pdlMs: number;
  size: number;
}

function isCrustDataEnabled(): boolean {
  const flag = Deno.env.get("CRUSTDATA_ENABLED");
  // Default ON when CRUSTDATA_API_KEY exists. Only explicit "off"/"disabled" disables it.
  return !flag || !["off", "disabled"].includes(flag.toLowerCase().trim());
}

function hasCrustDataKey(): boolean {
  return !!Deno.env.get("CRUSTDATA_API_KEY");
}

export async function runHybridSearch(input: HybridOrchestratorInput): Promise<HybridSearchResult> {
  const { parsed, pdlCandidates, pdlTotal, pdlMs, size } = input;

  const enabled = isCrustDataEnabled();
  const hasKey = hasCrustDataKey();
  console.log(`[hybrid] config: enabled=${enabled}, has_crustdata_key=${hasKey}, pdl_count=${pdlCandidates.length}, pdl_total=${pdlTotal}, size=${size}`);

  if (!enabled || !hasKey) {
    // Even when CrustData search is off, we can still attempt phone backfill
    // ONLY if a key exists — but if the flag is off entirely, passthrough.
    return {
      candidates: pdlCandidates,
      total: pdlTotal,
      hybrid_meta: {
        crustdata_enabled: false,
        crustdata_preview_total: 0,
        crustdata_fetched: 0,
        crustdata_net_new: 0,
        crustdata_duplicates_merged: 0,
        crustdata_ms: 0,
        pdl_count: pdlCandidates.length,
        pdl_ms: pdlMs,
        phone_enrichment_attempted: 0,
        phone_enrichment_found: 0,
      },
    };
  }

  const crustStart = Date.now();

  const pdlLinkedInUrls = pdlCandidates
    .map(c => c.linkedin_url)
    .filter((url): url is string => !!url);

  const crustQuery = buildCrustDataQuery(parsed, {
    size: 100,
    preview: false,
    excludeLinkedInUrls: pdlLinkedInUrls,
  });

  const previewQuery: CrustDataQuery = { ...crustQuery, preview: true, count: 1 };
  const previewTotal = await runCrustDataPreview(previewQuery);

  console.log(
    `[hybrid] CrustData preview: ${previewTotal} potential results (PDL returned ${pdlCandidates.length})`
  );

  const shouldFetch = previewTotal >= 5 || pdlCandidates.length < 20;
  console.log(`[hybrid] fetch decision: should_fetch=${shouldFetch}, preview_total=${previewTotal}, pdl_page_count=${pdlCandidates.length}`);

  let mergedCandidates: FormattedCandidate[] = pdlCandidates;
  let mergeStats = {
    net_new_from_crustdata: 0,
    duplicates_merged: 0,
  };
  let fetchedCount = 0;

  if (shouldFetch) {
    const { profiles } = await fetchCrustDataProfiles(crustQuery);
    fetchedCount = profiles.length;
    const crustCandidates = mapCrustDataResults(profiles);
    const mergeResult: MergeResult = mergeResults(pdlCandidates, crustCandidates);
    mergedCandidates = mergeResult.candidates;
    mergeStats = {
      net_new_from_crustdata: mergeResult.stats.net_new_from_crustdata,
      duplicates_merged: mergeResult.stats.duplicates_merged,
    };
  }

  // Phone enrichment DISABLED — account currently has no access, was returning 0/25
  // and adding ~12s per search. Re-enable once phone enrichment is provisioned.
  const phoneEnrichAttempted = 0;
  const phoneEnrichFound = 0;

  const crustMs = Date.now() - crustStart;
  console.log(
    `[hybrid] CrustData: ${fetchedCount} fetched, ${mergeStats.net_new_from_crustdata} net new, ` +
    `${mergeStats.duplicates_merged} enriched dupes, phones backfilled: ${phoneEnrichFound}, ${crustMs}ms`
  );

  return {
    candidates: mergedCandidates,
    total: pdlTotal + mergeStats.net_new_from_crustdata,
    hybrid_meta: {
      crustdata_enabled: true,
      crustdata_preview_total: previewTotal,
      crustdata_fetched: fetchedCount,
      crustdata_net_new: mergeStats.net_new_from_crustdata,
      crustdata_duplicates_merged: mergeStats.duplicates_merged,
      crustdata_ms: crustMs,
      pdl_count: pdlCandidates.length,
      pdl_ms: pdlMs,
      phone_enrichment_attempted: phoneEnrichAttempted,
      phone_enrichment_found: phoneEnrichFound,
    },
  };
}
