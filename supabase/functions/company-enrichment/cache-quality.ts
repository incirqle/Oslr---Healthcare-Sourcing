type Row = Record<string, unknown>;
const rows = (value: unknown) => Array.isArray(value) && value.length > 0;
const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;

/** Reject legacy failed base shells while accepting newly verified partial records. */
export function hasCompanyBaseEvidence(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const base = value as Row;
  if (base.source_complete === true) return true;
  const headcount = base.headcount && typeof base.headcount === "object" ? base.headcount as Row : {};
  return text(base.description) || typeof base.year_founded === "number" || text(base.hq_city) ||
    text(base.industry) || rows(base.sites) || rows(base.leaders) ||
    rows(headcount.timeseries) || (headcount.by_region != null && typeof headcount.by_region === "object");
}
