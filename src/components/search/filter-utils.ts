/**
 * Client-side mirror of the adapter's keyword/specialty echo rule
 * (supabase/functions/search-people/refine-filters.ts). The parser's keyword
 * expansions add other SPELLINGS of a stated specialty ("orthopaedic" for
 * "orthopedic"); shown as separate Keyword chips they looked like extra
 * requirements, and removing the specialty chip did nothing because the
 * echoes re-created it server-side.
 */

export function variantKey(term: string): string {
  return term.toLowerCase()
    .replace(/ae/g, "e")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/ies$/, "y")
    .replace(/s$/, "");
}

export function keywordEchoesSpecialty(keyword: string, specialties: readonly string[]): boolean {
  const k = variantKey(keyword);
  if (!k) return false;
  return specialties.some((sp) => {
    const s = variantKey(sp);
    return s === k || s.split(" ").includes(k);
  });
}

export function dropSpecialtyEchoes(keywords: readonly string[], specialties: readonly string[]): string[] {
  return keywords.filter((k) => !keywordEchoesSpecialty(k, specialties));
}

/** Editor labels for the parse's location(s), as the engine's adapter derives them. */
export function locationLabelsFromParsed(parsed: Record<string, unknown>): string[] {
  const out: string[] = [];
  const loc = (parsed.location ?? {}) as Record<string, unknown>;
  const city = typeof loc.city === "string" ? loc.city : "";
  const state = typeof loc.state === "string" ? loc.state : "";
  if (city && state) out.push(`${city} ${state}`);
  else if (state) out.push(state);
  else if (city) out.push(city);
  if (Array.isArray(parsed.locations)) {
    for (const entry of parsed.locations as Array<Record<string, unknown>>) {
      const c = typeof entry?.city === "string" ? entry.city : "";
      const s = typeof entry?.state === "string" ? entry.state : "";
      if (c && s) out.push(`${c} ${s}`);
      else if (s) out.push(s);
      else if (c) out.push(c);
    }
  }
  return out;
}
