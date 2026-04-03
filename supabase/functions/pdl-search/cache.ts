/**
 * cache.ts — SHA-256 cache key generation for PDL queries.
 */

export async function getPDLCacheKey(
  query: Record<string, unknown>,
  size: number,
  scrollToken?: string,
  sandbox = false
): Promise<string> {
  const raw = JSON.stringify({ query, size, scrollToken: scrollToken ?? null, sandbox });
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
