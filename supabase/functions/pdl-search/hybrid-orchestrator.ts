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
  return flag === "true" || flag === "1";
}

function hasCrustDataKey(): boolean {
  return !!Deno.env.get("CRUSTDATA_API_KEY");
}

export async function runHybridSearch(input: HybridOrchestratorInput): Promise<HybridSearchResult> {
  const { parsed, pdlCandidates, pdlTotal, pdlMs, size } = input;

  if (!isCrustDataEnabled() || !hasCrustDataKey()) {
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
      },
    };
  }

  const crustStart = Date.now();

  const pdlLinkedInUrls = pdlCandidates
    .map(c => c.linkedin_url)
    .filter((url): url is string => !!url);

  const crustQuery = buildCrustDataQuery(parsed, {
    size: Math.min(size, 100),
    preview: false,
    excludeLinkedInUrls: pdlLinkedInUrls,
  });

  const previewQuery: CrustDataQuery = { ...crustQuery, preview: true, count: 1 };
  const previewTotal = await runCrustDataPreview(previewQuery);

  console.log(
    `[hybrid] CrustData preview: ${previewTotal} potential results (PDL returned ${pdlCandidates.length})`
  );

  const shouldFetch = previewTotal >= 5 || pdlCandidates.length < 20;

  if (!shouldFetch) {
    const crustMs = Date.now() - crustStart;
    return {
      candidates: pdlCandidates,
      total: pdlTotal,
      hybrid_meta: {
        crustdata_enabled: true,
        crustdata_preview_total: previewTotal,
        crustdata_fetched: 0,
        crustdata_net_new: 0,
        crustdata_duplicates_merged: 0,
        crustdata_ms: crustMs,
        pdl_count: pdlCandidates.length,
        pdl_ms: pdlMs,
      },
    };
  }

  const { profiles } = await fetchCrustDataProfiles(crustQuery);
  const crustCandidates = mapCrustDataResults(profiles);
  const mergeResult: MergeResult = mergeResults(pdlCandidates, crustCandidates);

  const crustMs = Date.now() - crustStart;
  console.log(
    `[hybrid] CrustData: ${profiles.length} fetched, ${mergeResult.stats.net_new_from_crustdata} net new, ` +
    `${mergeResult.stats.duplicates_merged} enriched dupes, ${crustMs}ms`
  );

  return {
    candidates: mergeResult.candidates,
    total: pdlTotal + mergeResult.stats.net_new_from_crustdata,
    hybrid_meta: {
      crustdata_enabled: true,
      crustdata_preview_total: previewTotal,
      crustdata_fetched: profiles.length,
      crustdata_net_new: mergeResult.stats.net_new_from_crustdata,
      crustdata_duplicates_merged: mergeResult.stats.duplicates_merged,
      crustdata_ms: crustMs,
      pdl_count: pdlCandidates.length,
      pdl_ms: pdlMs,
    },
  };
}
