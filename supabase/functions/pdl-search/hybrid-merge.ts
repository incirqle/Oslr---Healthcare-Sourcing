/**
 * hybrid-merge.ts — Deduplicates and merges PDL + CrustData results into a
 * unified candidate pool for the AI reranker.
 */

import type { FormattedCandidate } from "./format-results.ts";

export interface MergeResult {
  candidates: FormattedCandidate[];
  stats: {
    pdl_count: number;
    crustdata_count: number;
    duplicates_merged: number;
    net_new_from_crustdata: number;
    total_after_merge: number;
  };
}

function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let normalized = url.toLowerCase().trim();
  normalized = normalized.replace(/^https?:\/\//, "").replace(/^www\./, "");
  normalized = normalized.replace(/\/$/, "");
  if (!normalized.startsWith("linkedin.com/in/") && !normalized.startsWith("linkedin.com/")) {
    return null;
  }
  const match = normalized.match(/linkedin\.com\/in\/([^/?#]+)/);
  if (match) return `linkedin.com/in/${match[1]}`;
  return null;
}

function nameFuzzyKey(name: string, company: string): string {
  const normName = name.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  const normCompany = company.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  return `${normName}::${normCompany}`;
}

function enrichPDLWithCrustData(
  pdl: FormattedCandidate,
  crust: FormattedCandidate
): FormattedCandidate {
  const merged = { ...pdl };

  if (!merged.profile_pic_url && crust.profile_pic_url) {
    merged.profile_pic_url = crust.profile_pic_url;
  }

  if (!merged.work_email && crust.work_email) {
    merged.work_email = crust.work_email;
    if (!merged.emails.includes(crust.work_email)) {
      merged.emails = [...merged.emails, crust.work_email];
    }
    merged.has_contact_info = true;
  }

  if (!merged.job_company_size && crust.job_company_size) {
    merged.job_company_size = crust.job_company_size;
  }

  if (merged.job_title_levels.length === 0 && crust.job_title_levels.length > 0) {
    merged.job_title_levels = crust.job_title_levels;
  }

  if (!merged.twitter_url && crust.twitter_url) {
    merged.twitter_url = crust.twitter_url;
  }

  return merged;
}

export function mergeResults(
  pdlCandidates: FormattedCandidate[],
  crustDataCandidates: FormattedCandidate[]
): MergeResult {
  const byLinkedIn = new Map<string, number>();
  const byNameCompany = new Map<string, number>();
  const merged: FormattedCandidate[] = [];

  for (let i = 0; i < pdlCandidates.length; i++) {
    const candidate = { ...pdlCandidates[i] };
    merged.push(candidate);
    const liUrl = normalizeLinkedInUrl(candidate.linkedin_url);
    if (liUrl) byLinkedIn.set(liUrl, i);
    const nameKey = nameFuzzyKey(candidate.full_name, candidate.job_company_name);
    if (nameKey !== "::") byNameCompany.set(nameKey, i);
  }

  let duplicatesMerged = 0;
  let netNew = 0;

  for (const crustCandidate of crustDataCandidates) {
    const liUrl = normalizeLinkedInUrl(crustCandidate.linkedin_url);
    const nameKey = nameFuzzyKey(crustCandidate.full_name, crustCandidate.job_company_name);

    let existingIdx: number | undefined;
    if (liUrl) existingIdx = byLinkedIn.get(liUrl);
    if (existingIdx === undefined && nameKey !== "::") {
      existingIdx = byNameCompany.get(nameKey);
    }

    if (existingIdx !== undefined) {
      merged[existingIdx] = enrichPDLWithCrustData(merged[existingIdx], crustCandidate);
      duplicatesMerged++;
    } else {
      const newIdx = merged.length;
      merged.push(crustCandidate);
      netNew++;
      if (liUrl) byLinkedIn.set(liUrl, newIdx);
      if (nameKey !== "::") byNameCompany.set(nameKey, newIdx);
    }
  }

  console.log(
    `[hybrid-merge] PDL: ${pdlCandidates.length}, CrustData: ${crustDataCandidates.length}, ` +
    `duplicates enriched: ${duplicatesMerged}, net new: ${netNew}, total: ${merged.length}`
  );

  return {
    candidates: merged,
    stats: {
      pdl_count: pdlCandidates.length,
      crustdata_count: crustDataCandidates.length,
      duplicates_merged: duplicatesMerged,
      net_new_from_crustdata: netNew,
      total_after_merge: merged.length,
    },
  };
}
