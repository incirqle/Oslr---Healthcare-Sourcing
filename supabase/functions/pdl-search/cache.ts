/**
 * cache.ts — SHA-256 cache key generation for PDL queries.
 *
 * RANK_VERSION: bump this whenever scoring/reranking logic changes so old cached
 * pools are invalidated. Without this, users see pre-fix orderings until TTL expires.
 */

const RANK_VERSION = "v11-crustdata-hybrid-default-on-2026-06-02";

export async function getPDLCacheKey(
  query: Record<string, unknown>,
  size: number,
  scrollToken?: string,
  sandbox = false
): Promise<string> {
  const raw = JSON.stringify({ query, size, scrollToken: scrollToken ?? null, sandbox, rankVersion: RANK_VERSION });
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
