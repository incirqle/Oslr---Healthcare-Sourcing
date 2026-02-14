import { useState, useCallback } from "react";

export interface SearchHistoryEntry {
  query: string;
  resultCount: number;
  timestamp: number;
}

const STORAGE_KEY = "medsource_search_history";
const MAX_ENTRIES = 10;

function loadHistory(): SearchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryEntry[]>(loadHistory);

  const addEntry = useCallback((query: string, resultCount: number) => {
    setHistory((prev) => {
      const filtered = prev.filter((e) => e.query.toLowerCase() !== query.toLowerCase());
      const next = [{ query, resultCount, timestamp: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
