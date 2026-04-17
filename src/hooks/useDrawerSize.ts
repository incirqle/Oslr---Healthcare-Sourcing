import { useCallback, useEffect, useState } from "react";

export type DrawerSize = "compact" | "wide";

const STORAGE_KEY = "oslr.drawer.size";

/**
 * Persistent compact/wide preference for the candidate drawer.
 * Defaults to "compact" (620px). Wide is ~960px, capped to viewport.
 */
export function useDrawerSize() {
  const [size, setSizeState] = useState<DrawerSize>(() => {
    if (typeof window === "undefined") return "compact";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "wide" ? "wide" : "compact";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, size);
  }, [size]);

  const toggle = useCallback(() => {
    setSizeState((current) => (current === "compact" ? "wide" : "compact"));
  }, []);

  const setSize = useCallback((next: DrawerSize) => setSizeState(next), []);

  return { size, toggle, setSize, isWide: size === "wide" };
}
