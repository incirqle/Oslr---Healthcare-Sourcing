import type { ParsedFilters } from "@/components/search/FilterReview";
import type { ReactNode } from "react";

/**
 * Collect all "highlight terms" from a parsed query — the things the user
 * actually asked for (companies, locations, specialties, titles, keywords).
 *
 * Returns lowercased, de-duped, length-sorted (longest first) so that
 * "orthopedic surgeon" wins over "orthopedic" when overlapping.
 */
export function collectHighlightTerms(filters: ParsedFilters): string[] {
  const raw = [
    ...(filters.companies ?? []),
    ...(filters.locations ?? []),
    ...(filters.specialties ?? []),
    ...(filters.job_titles ?? []),
    ...(filters.keywords ?? []),
  ]
    .map((t) => (t ?? "").trim())
    .filter((t) => t.length >= 3);

  // De-dupe (lowercased) and sort longest-first to avoid sub-string clobbering
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of raw) {
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
  }
  return out.sort((a, b) => b.length - a.length);
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Highlight matches of any term in `text` with a tinted background span.
 * Falls back to the raw text if no terms or no matches.
 */
export function highlightText(text: string | null | undefined, terms: string[]): ReactNode {
  if (!text) return null;
  if (!terms.length) return text;

  const pattern = new RegExp(`(${terms.map(escapeRegex).join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const isMatch = pattern.test(part);
    pattern.lastIndex = 0; // reset stateful flag
    if (!isMatch) return part;
    return (
      <mark
        key={i}
        className="rounded bg-primary/20 px-0.5 text-foreground"
      >
        {part}
      </mark>
    );
  });
}
