// ─── SHA-256 Search Cache + Enrichment Cache ─────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CACHE_TTL_HOURS } from "./config.ts";

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// SHA-256 hash a string
async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Generate cache key from filters + pagination
export async function generateCacheKey(
  filters: Record<string, unknown>,
  size: number,
  from: number
): Promise<string> {
  const payload = JSON.stringify({ filters, size, from });
  return sha256(payload);
}

// Look up cached search results
export async function getCachedSearch(queryHash: string): Promise<{
  response: unknown;
  total_count: number;
} | null> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("pdl_cache")
      .select("response, total_count, expires_at")
      .eq("query_hash", queryHash)
      .single();

    if (error || !data) return null;

    // Check TTL
    if (new Date(data.expires_at) < new Date()) {
      // Expired — delete and return null
      await supabase.from("pdl_cache").delete().eq("query_hash", queryHash);
      console.log("Cache expired, deleted:", queryHash.slice(0, 12));
      return null;
    }

    console.log("Cache hit:", queryHash.slice(0, 12));
    return { response: data.response, total_count: data.total_count };
  } catch (e) {
    console.error("Cache read error:", e);
    return null;
  }
}

// Store search results in cache
export async function setCachedSearch(
  queryHash: string,
  queryText: string,
  filters: Record<string, unknown>,
  response: unknown,
  totalCount: number
): Promise<void> {
  try {
    const supabase = getServiceClient();
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await supabase.from("pdl_cache").upsert(
      {
        query_hash: queryHash,
        query_text: queryText,
        filters,
        response,
        total_count: totalCount,
        expires_at: expiresAt,
      },
      { onConflict: "query_hash" }
    );

    console.log("Cache set:", queryHash.slice(0, 12), "ttl:", CACHE_TTL_HOURS, "hours");
  } catch (e) {
    console.error("Cache write error:", e);
  }
}

// Look up cached enrichment by PDL ID or LinkedIn URL
export async function getCachedEnrichment(
  pdlId?: string,
  linkedinUrl?: string
): Promise<unknown | null> {
  try {
    const supabase = getServiceClient();
    let query = supabase.from("people_enrichments").select("enriched_data");

    if (pdlId) {
      query = query.eq("pdl_id", pdlId);
    } else if (linkedinUrl) {
      query = query.eq("linkedin_url", linkedinUrl);
    } else {
      return null;
    }

    const { data, error } = await query.single();
    if (error || !data) return null;

    console.log("Enrichment cache hit:", pdlId || linkedinUrl);
    return data.enriched_data;
  } catch (e) {
    console.error("Enrichment cache read error:", e);
    return null;
  }
}

// Cache enrichment data
export async function setCachedEnrichment(
  pdlId: string | null,
  linkedinUrl: string | null,
  enrichedData: unknown
): Promise<void> {
  try {
    const supabase = getServiceClient();
    await supabase.from("people_enrichments").upsert(
      {
        pdl_id: pdlId,
        linkedin_url: linkedinUrl,
        enriched_data: enrichedData,
      },
      { onConflict: "pdl_id" }
    );

    console.log("Enrichment cached:", pdlId || linkedinUrl);
  } catch (e) {
    console.error("Enrichment cache write error:", e);
  }
}
