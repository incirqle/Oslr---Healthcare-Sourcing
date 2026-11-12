type Row = Record<string, unknown>;

const hasText = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const hasRows = (value: unknown) => Array.isArray(value) && value.length > 0;

/** Blank legacy enrichment shells must be fetched again, not reused forever. */
export function hasUsableProfileEnrichment(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const profile = value as Row;
  if (hasText(profile.summary)) return true;
  if (["experience", "education", "skills", "certifications", "honors"].some((key) => hasRows(profile[key]))) return true;
  const research = profile.research_profile;
  if (!research || typeof research !== "object") return false;
  const r = research as Row;
  return hasText(r.profile_url) || hasText(r.designation) || hasText(r.organisation) ||
    hasRows(r.interests) || hasRows(r.top_articles) ||
    ["article_count", "citations", "h_index", "i10_index"].some((key) => typeof r[key] === "number" && (r[key] as number) > 0);
}
