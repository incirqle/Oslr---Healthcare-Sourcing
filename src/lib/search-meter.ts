import { supabase } from "@/integrations/supabase/client";

export interface SearchUsage { used: number; limit: number; resets_at: string }

export class SearchLimitError extends Error {
  constructor(message: string, public code: string, public retryAfterMs: number, public usage: SearchUsage | null) {
    super(message);
  }
}

/** Calls search-people and turns limit responses into a friendly SearchLimitError. */
export async function invokeSearchPeople(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("search-people", { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let payload: Record<string, unknown> | null = null;
    try { payload = ctx && typeof ctx.json === "function" ? await ctx.clone().json() : null; } catch { /* ignore */ }
    if (payload?.limit_code) {
      throw new SearchLimitError(
        String(payload.error ?? "Please slow down a little."),
        String(payload.limit_code),
        Number(payload.retry_after_ms ?? 0),
        (payload.search_usage as SearchUsage) ?? null,
      );
    }
    throw new Error(typeof payload?.error === "string" ? payload.error : error.message);
  }
  if (data?.limit_code) {
    throw new SearchLimitError(String(data.error), String(data.limit_code), Number(data.retry_after_ms ?? 0), data.search_usage ?? null);
  }
  return data;
}

export async function fetchSearchUsage(): Promise<SearchUsage | null> {
  try {
    const data = await invokeSearchPeople({ action: "search_usage" });
    return (data?.search_usage as SearchUsage) ?? null;
  } catch {
    return null;
  }
}

export function pingEngagement(): void {
  void supabase.functions.invoke("search-people", { body: { action: "meter_engagement" } }).catch(() => {});
}
