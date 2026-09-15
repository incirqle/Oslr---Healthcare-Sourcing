import { useState, useCallback } from "react";

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

export function useSearchHistory(scope?: string | null) {
  const [history, setHistory] = useState<SearchHistoryEntry[]>(() => loadHistory(scope));

  const addEntry = useCallback((query: string, resultCount: number) => {
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.query.toLowerCase() !== query.toLowerCase());
      const next = [{ query, resultCount, timestamp: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      try {
        localStorage.setItem(storageKey(scope), JSON.stringify(next));
      } catch { /* storage unavailable — keep in-memory history */ }
      return next;
    });
  }, [scope]);

  const clearHistory = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(scope));
    } catch { /* ignore */ }
    setHistory([]);
  }, [scope]);

  return { history, addEntry, clearHistory };
}
