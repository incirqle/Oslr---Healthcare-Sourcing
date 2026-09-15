/**
 * title-vocabulary.ts — ground stated job titles in the titles that exist.
 *
 * The engine's history with job titles is the reason this file is careful.
 *
 * The original parser INVENTED titles: role words in the raw query ("reps")
 * were mapped through a hand-written table to ["sales representative",
 * "territory manager", ...] and those inventions became hard filters. Real
 * sellers are titled Spine Specialist or Clinical Consultant, so the invented
 * requirement removed exactly the people being searched for, and the search
 * returned nothing. That table is gone.
 *
 * The vendor's replacement was `title_synonyms` from the language model —
 * better, but still guessing. A model's idea of a title variant is not
 * evidence that anybody holds that title.
 *
 * This asks the provider instead. `/person/search/autocomplete` returns the
 * titles actually present in the index, by frequency, and it is FREE. Probed
 * live 2026-09-10: "trauma sales" returns Trauma Sales Representative, Trauma
 * Sales Associate, Trauma Sales Consultant, Trauma Sales Manager, Trauma Sales
 * Rep, Trauma Sales Specialist, Trauma Sales.
 *
 * The rule this file keeps: expansion only ever happens around a title the
 * USER NAMED. It widens recall for a stated requirement; it never creates one.
 */

import { personSearchAutocomplete } from "./lib/crustdata-v2.ts";

/**
 * Cap on expansions per stated title. Each becomes a filter clause, and the
 * long tail of autocomplete is noise ("Trauma Sales" alone matches anything).
 */
export const MAX_TITLE_EXPANSIONS = 8;

/** Per-isolate memo. Autocomplete is free but not instant, and pages repeat. */
const memo = new Map<string, string[]>();

/**
 * Expand one stated title into the real titles the index contains.
 *
 * Returns the original plus any provider-known variants, lowercased and
 * de-duplicated. On any failure it returns just the original: a recall
 * enhancement must never be able to narrow or fail a search.
 */
export async function expandStatedTitle(stated: string): Promise<string[]> {
  const term = stated.trim().toLowerCase();
  if (!term) return [];
  const cached = memo.get(term);
  if (cached) return cached;

  let hits: string[] = [];
  try {
    hits = await personSearchAutocomplete("title", term);
  } catch (err) {
    console.warn(`[title-vocab] autocomplete failed for "${term}" — using the stated title alone`, err);
  }

  const out: string[] = [term];
  for (const h of hits) {
    const v = h.trim().toLowerCase();
    if (!v || out.includes(v)) continue;
    // Keep only variants that still contain the stated title. Autocomplete is
    // a prefix/partial match, so it can drift ("sales" -> "Sales Engineer");
    // an expansion that no longer contains what the user said is a different
    // job, not a synonym for theirs.
    if (!v.includes(term) && !term.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_TITLE_EXPANSIONS) break;
  }

  memo.set(term, out);
  return out;
}

/**
 * Expand every stated title in a query.
 *
 * Runs the lookups in parallel — they are free and independent — and returns a
 * flat, de-duplicated list. Given no stated titles it returns nothing: silence
 * from the user is not an invitation to invent a requirement.
 */
export async function expandStatedTitles(stated: string[]): Promise<string[]> {
  const terms = stated.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (terms.length === 0) return [];

  const groups = await Promise.all(terms.map((t) => expandStatedTitle(t)));
  const out: string[] = [];
  for (const group of groups) {
    for (const v of group) if (!out.includes(v)) out.push(v);
  }
  return out;
}
