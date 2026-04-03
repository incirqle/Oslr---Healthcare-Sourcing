/**
 * fetch-pdl-results.ts — Two-key PDL API calls, retry logic, DB cache, advisory locks.
 *
 * CRITICAL PATTERN: Two-key routing
 * - PDL_PREVIEW_API_KEY / PDL_PREVIEW_KEY → count-only queries (size=1), zero credit burn
 * - PDL_API_KEY → full profile fetches, 1 credit per record
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPDLCacheKey } from "./cache.ts";

export { getPDLCacheKey };

/* ------------------------------------------------------------------ */
/* PDL Fetch with Exponential Backoff                                  */
/* ------------------------------------------------------------------ */

interface PDLResult {
  ok: boolean;
  data: Record<string, unknown>;
  error?: Record<string, unknown>;
}

export async function fetchPDLWithRetry(
  url: string,
  init: RequestInit,
  queryHash: string,
  maxRetries = 3
): Promise<PDLResult> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, init);

      if (res.status === 429) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[PDL] Rate limited (429), retry ${attempt + 1}/${maxRetries} in ${wait}ms [${queryHash}]`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        return {
          ok: false,
          data: {},
          error: {
            error_code: "PDL_RATE_LIMITED",
            message: "PDL rate limit exceeded. Please try again in a few seconds.",
            retryable: true,
          },
        };
      }

      if (res.status === 402) {
        return {
          ok: false,
          data: {},
          error: {
            error_code: "PDL_CREDITS_EXHAUSTED",
            message: "PDL credits exhausted. Contact your administrator.",
            retryable: false,
          },
        };
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[PDL] Error ${res.status}: ${errText} [${queryHash}]`);
        return {
          ok: false,
          data: {},
          error: {
            error_code: "PDL_UNAVAILABLE",
            message: `PDL returned ${res.status}`,
            retryable: res.status >= 500,
          },
        };
      }

      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[PDL] Network error, retry ${attempt + 1}/${maxRetries} in ${wait}ms [${queryHash}]`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  return {
    ok: false,
    data: {},
    error: {
      error_code: "PDL_UNAVAILABLE",
      message: `PDL fetch failed after ${maxRetries} retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      retryable: true,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Preview (count-only) — uses PDL_PREVIEW_API_KEY                     */
/* ------------------------------------------------------------------ */

export async function runPreview(
  pdlQuery: Record<string, unknown>,
  pdlBaseUrl = "https://api.peopledatalabs.com"
): Promise<number> {
  const previewKey = Deno.env.get("PDL_PREVIEW_API_KEY") || Deno.env.get("PDL_PREVIEW_KEY");
  if (!previewKey) throw new Error("PDL_PREVIEW_API_KEY not configured");

  const body = { query: pdlQuery, dataset: "all", size: 1 };
  const result = await fetchPDLWithRetry(
    `${pdlBaseUrl}/v5/person/search`,
    {
      method: "POST",
      headers: { "X-Api-Key": previewKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "preview"
  );

  if (!result.ok) {
    console.error("[PREVIEW] Failed:", result.error);
    return 0;
  }

  return (result.data.total as number) || 0;
}

/* ------------------------------------------------------------------ */
/* Full profile fetch — uses PDL_API_KEY (1 credit per record)         */
/* ------------------------------------------------------------------ */

export async function fetchProfiles(
  pdlQuery: Record<string, unknown>,
  size: number,
  pdlBaseUrl = "https://api.peopledatalabs.com"
): Promise<Record<string, unknown>[]> {
  const liveKey = Deno.env.get("PDL_API_KEY");
  if (!liveKey) throw new Error("PDL_API_KEY not configured");

  const body = {
    query: pdlQuery,
    dataset: "all",
    size: Math.min(size, 100),
  };

  const result = await fetchPDLWithRetry(
    `${pdlBaseUrl}/v5/person/search`,
    {
      method: "POST",
      headers: { "X-Api-Key": liveKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    "profiles"
  );

  if (!result.ok) {
    console.error("[PROFILES] Failed:", result.error);
    return [];
  }

  return (result.data.data as Record<string, unknown>[]) || [];
}

/* ------------------------------------------------------------------ */
/* DB Cache helpers — pdl_cache table with 4-hour TTL                  */
/* ------------------------------------------------------------------ */

export async function getDBCache(
  client: ReturnType<typeof createClient>,
  cacheKey: string
): Promise<{ total: number; data: unknown[]; scroll_token: string | null } | null> {
  try {
    const { data, error } = await client
      .from("pdl_cache")
      .select("total, data, scroll_token, created_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (error || !data) return null;

    // Check 4-hour TTL
    const age = Date.now() - new Date(data.created_at).getTime();
    if (age > 4 * 60 * 60 * 1000) return null;

    return {
      total: data.total,
      data: data.data || [],
      scroll_token: data.scroll_token || null,
    };
  } catch {
    return null;
  }
}

export async function setDBCache(
  client: ReturnType<typeof createClient>,
  cacheKey: string,
  total: number,
  data?: unknown[],
  scrollToken?: string | null
): Promise<void> {
  try {
    await client.from("pdl_cache").upsert({
      cache_key: cacheKey,
      total,
      data: data || [],
      scroll_token: scrollToken || null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[CACHE] Write failed:", err);
  }
}

export async function cleanExpiredCache(
  client: ReturnType<typeof createClient>
): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    await client.from("pdl_cache").delete().lt("created_at", cutoff);
  } catch {
    // fire-and-forget
  }
}

/* ------------------------------------------------------------------ */
/* Advisory Lock helpers — prevent thundering herd                     */
/* ------------------------------------------------------------------ */

export async function tryAdvisoryLock(
  client: ReturnType<typeof createClient>,
  queryHash: string
): Promise<{ locked: boolean; lockKey: number }> {
  try {
    const lockKey = parseInt(queryHash.slice(0, 8), 16);
    const { data } = await client.rpc("pg_try_advisory_lock", { key: lockKey });
    return { locked: !!data, lockKey };
  } catch {
    return { locked: true, lockKey: 0 }; // fail-open
  }
}

export async function releaseAdvisoryLock(
  client: ReturnType<typeof createClient>,
  lockKey: number
): Promise<void> {
  try {
    await client.rpc("pg_advisory_unlock", { key: lockKey });
  } catch {
    // best-effort
  }
}

export async function waitForCache(
  client: ReturnType<typeof createClient>,
  cacheKey: string,
  maxWaitMs = 5000
): Promise<{ total: number; data: unknown[]; scroll_token: string | null } | null> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const cached = await getDBCache(client, cacheKey);
    if (cached && cached.data.length > 0) return cached;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}
