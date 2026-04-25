/**
 * enrich-job-titles.ts — PDL Job Title Enrichment API wrapper.
 *
 * Endpoint: GET /v5/job_title/enrich?job_title=<title>
 * Response: { cleaned_job_title: string, similar_job_titles: string[], relevant_skills: string[] }
 *
 * Notes:
 * - Requires enterprise PDL account (same PDL_API_KEY used for person search)
 * - Charges 1 credit per match (404 = no match = no charge)
 * - Returns 404 for titles with fewer than ~100 occurrences in PDL dataset
 *   (common for niche distributor titles — handled gracefully via fallback)
 * - We enrich only the first N titles (cap = 5) to control credit burn
 * - Results are deduplicated and merged: originals first, then similar variants
 * - In-process cache prevents redundant API calls within a single request
 */

const PDL_JOB_TITLE_BASE = "https://api.peopledatalabs.com/v5/job_title/enrich";

// In-process cache scoped to each edge function invocation.
// Key: lowercased job title. Value: array of expanded titles (or empty on 404/error).
const titleCache = new Map<string, string[]>();

interface JobTitleEnrichResponse {
  cleaned_job_title: string;
  similar_job_titles: string[];
  relevant_skills: string[];
}

/**
 * Enrich a single job title via the PDL Job Title Enrichment API.
 * Returns the cleaned title + up to 5 similar titles, or an empty array on miss.
 */
async function enrichSingleTitle(title: string, apiKey: string): Promise<string[]> {
  const key = title.toLowerCase().trim();
  if (titleCache.has(key)) return titleCache.get(key)!;

  try {
    const url = `${PDL_JOB_TITLE_BASE}?job_title=${encodeURIComponent(title)}&pretty=false`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    });

    // 404 = title not in PDL's dataset (fewer than ~100 occurrences) — no charge, no match
    if (resp.status === 404) {
      console.log(`[JobTitleEnrich] 404 (no match) for "${title}" — using original`);
      titleCache.set(key, []);
      return [];
    }

    // 402 = credits exhausted — abort enrichment entirely, fall back to originals
    if (resp.status === 402) {
      console.warn(`[JobTitleEnrich] 402 credits exhausted — skipping enrichment`);
      titleCache.set(key, []);
      return [];
    }

    if (!resp.ok) {
      console.warn(`[JobTitleEnrich] ${resp.status} for "${title}" — using original`);
      titleCache.set(key, []);
      return [];
    }

    const data = (await resp.json()) as JobTitleEnrichResponse;
    const expanded: string[] = [];

    if (typeof data.cleaned_job_title === "string" && data.cleaned_job_title.length > 0) {
      expanded.push(data.cleaned_job_title);
    }
    if (Array.isArray(data.similar_job_titles)) {
      for (const t of data.similar_job_titles) {
        if (typeof t === "string" && t.length > 0) {
          expanded.push(t);
        }
      }
    }

    console.log(`[JobTitleEnrich] "${title}" → [${expanded.join(", ")}]`);
    titleCache.set(key, expanded);
    return expanded;
  } catch (err) {
    console.warn(
      `[JobTitleEnrich] Network error for "${title}": ${err instanceof Error ? err.message : String(err)}`
    );
    titleCache.set(key, []);
    return [];
  }
}

/**
 * Enrich up to MAX_TITLES_TO_ENRICH of the provided job titles in parallel.
 * Returns a deduplicated merged list: original titles first, then similar variants.
 * Capped at MAX_TOTAL_TITLES to avoid overloading the PDL ES query.
 *
 * @param titles  Array of job title strings from parse-query.ts
 * @param apiKey  PDL_API_KEY from Deno.env
 */
export async function enrichJobTitles(titles: string[], apiKey: string): Promise<string[]> {
  if (!titles || titles.length === 0) return [];
  if (!apiKey) return titles;

  const MAX_TITLES_TO_ENRICH = 5;
  const MAX_TOTAL_TITLES = 50;

  // Only enrich the first N distinct titles to cap credit usage
  const titlesToEnrich = titles.slice(0, MAX_TITLES_TO_ENRICH);

  // Enrich in parallel — each call is independent
  const enrichedArrays = await Promise.all(
    titlesToEnrich.map((t) => enrichSingleTitle(t, apiKey))
  );

  // Merge: originals first, then all similar variants, deduped (case-insensitive)
  const seen = new Set<string>();
  const merged: string[] = [];

  function addTitle(t: string): void {
    const lower = t.toLowerCase().trim();
    if (lower.length > 0 && !seen.has(lower)) {
      seen.add(lower);
      merged.push(t);
    }
  }

  // Originals first (preserves the parse-query intent)
  for (const t of titles) addTitle(t);

  // Then all expanded variants
  for (const expanded of enrichedArrays) {
    for (const t of expanded) addTitle(t);
  }

  const result = merged.slice(0, MAX_TOTAL_TITLES);
  if (result.length > titles.length) {
    console.log(
      `[JobTitleEnrich] Expanded ${titles.length} → ${result.length} titles (capped at ${MAX_TOTAL_TITLES})`
    );
  }
  return result;
}
