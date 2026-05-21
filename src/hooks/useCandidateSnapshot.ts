import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Candidate } from "@/components/search/SearchResults";

/**
 * Lazily generate a 1-sentence AI snapshot for a candidate card.
 *
 * - Module-level Map cache: dedupes across rerenders, page changes, and
 *   re-mounts within a session. Cleared on full page reload (fine — cheap).
 * - Concurrency-limited queue (max 3 in flight) so a page of 15 cards
 *   doesn't fan out 15 simultaneous AI calls.
 * - Caller passes `enabled` (typically gated on row visibility/hover) so
 *   we never spend tokens on cards the user never sees.
 */

const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
let active = 0;
const MAX_CONCURRENT = 3;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active += 1;
}

function release() {
  active -= 1;
  const next = waiters.shift();
  if (next) next();
}

function buildPrompt(c: Candidate): string {
  const parts: string[] = [];
  if (c.title) parts.push(`Title: ${c.title}`);
  if (c.current_employer) parts.push(`Employer: ${c.current_employer}`);
  if (c.location) parts.push(`Location: ${c.location}`);
  if (c.years_experience) parts.push(`Years experience: ${c.years_experience}`);
  const skills = (c.clinical_skills?.length ? c.clinical_skills : c.skills) || [];
  if (skills.length) parts.push(`Skills: ${skills.slice(0, 8).join(", ")}`);
  if (c.summary) parts.push(`Headline: ${c.summary}`);
  return parts.join("\n");
}

async function fetchSnapshot(candidate: Candidate): Promise<string> {
  const existing = inflight.get(candidate.id);
  if (existing) return existing;

  const promise = (async () => {
    await acquire();
    try {
      const { data, error } = await supabase.functions.invoke("pdl-search", {
        body: { action: "ai_snapshot", prompt: buildPrompt(candidate) },
      });
      if (error) throw error;
      const snap = typeof data?.snapshot === "string" ? data.snapshot.trim() : "";
      const value = snap || "";
      cache.set(candidate.id, value);
      return value;
    } catch {
      cache.set(candidate.id, "");
      return "";
    } finally {
      release();
      inflight.delete(candidate.id);
    }
  })();

  inflight.set(candidate.id, promise);
  return promise;
}

export function useCandidateSnapshot(candidate: Candidate, enabled: boolean) {
  const cached = cache.get(candidate.id);
  const [snapshot, setSnapshot] = useState<string>(cached ?? "");
  const [loading, setLoading] = useState<boolean>(enabled && cached === undefined);

  useEffect(() => {
    if (!enabled) return;
    if (cache.has(candidate.id)) {
      setSnapshot(cache.get(candidate.id) ?? "");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSnapshot(candidate).then((value) => {
      if (cancelled) return;
      setSnapshot(value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [candidate.id, enabled]);

  return { snapshot, loading };
}
