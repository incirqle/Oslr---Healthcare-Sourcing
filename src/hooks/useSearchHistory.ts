import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";

export interface SearchHistoryEntry {
  query: string;
  resultCount: number;
  timestamp: number;
}

const STORAGE_PREFIX = "oslr_search_history";
const MAX_ENTRIES = 10;

/** History is scoped per project: each project keeps its own recent searches. */
function storageKey(scope?: string | null): string {
  return scope ? `${STORAGE_PREFIX}:${scope}` : STORAGE_PREFIX;
}

function loadHistory(scope?: string | null): SearchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(scope)) || "[]");
  } catch {
    return [];
  }
}

function merge(a: SearchHistoryEntry[], b: SearchHistoryEntry[]): SearchHistoryEntry[] {
  const seen = new Set<string>();
  return [...a, ...b]
    .sort((x, y) => y.timestamp - x.timestamp)
    .filter((e) => {
      const k = e.query.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, MAX_ENTRIES);
}

/**
 * Recent searches. Written to the database (search_history) so they survive
 * a new browser, a new device, or a cleared cache — localStorage is only a
 * fast first paint.
 */
export function useSearchHistory(scope?: string | null) {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => loadHistory(scope));

  // Hydrate from the durable server-side history.
  useEffect(() => {
    if (!user || !companyId) return;
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("search_history")
        .select("query_text, result_count, created_at, search_params")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);
      const { data, error } = await q;
      if (cancelled || error || !data) return;
      const rows = data
        .filter((r) => {
          if (!scope) return true;
          const p = (r.search_params ?? {}) as { project_id?: string };
          return p.project_id === scope;
        })
        .map((r) => ({
          query: r.query_text,
          resultCount: r.result_count ?? 0,
          timestamp: new Date(r.created_at).getTime(),
        }));
      setHistory((prev) => merge(prev, rows));
    })();
    return () => { cancelled = true; };
  }, [user?.id, companyId, scope]);

  const addEntry = useCallback((query: string, resultCount: number) => {
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.query.toLowerCase() !== query.toLowerCase());
      const next = [{ query, resultCount, timestamp: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(storageKey(scope), JSON.stringify(next));
      } catch { /* storage unavailable — keep in-memory history */ }
      return next;
    });

    if (user && companyId) {
      void supabase
        .from("search_history")
        .insert({
          user_id: user.id,
          company_id: companyId,
          query_text: query,
          result_count: resultCount,
          search_params: scope ? { project_id: scope } : {},
        })
        .then(({ error }) => {
          if (error) console.warn("[search-history] save failed:", error.message);
        });
    }
  }, [scope, user?.id, companyId]);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(scope));
    } catch { /* ignore */ }
    setHistory([]);
  }, [scope]);

  return { history, addEntry, clearHistory };
}
