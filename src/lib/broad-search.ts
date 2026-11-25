const NATIONWIDE_PHRASE = /\s*,?\s*\b(?:in|across|throughout)\s+(?:the\s+)?(?:united states(?: of america)?|u\.?\s?s\.?a?\.?|usa)|\s+\bnationwide\b/gi;

/** Remove the old nationwide scope before adding a user's own narrowing words. */
export function buildNarrowedQuery(originalQuery: string, refinement: string): string {
  const base = originalQuery
    .replace(NATIONWIDE_PHRASE, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/[,.;\s]+$/g, "")
    .trim();
  const extra = refinement.trim();
  return `${base}${base && extra ? ", " : ""}${extra}`.trim();
}
