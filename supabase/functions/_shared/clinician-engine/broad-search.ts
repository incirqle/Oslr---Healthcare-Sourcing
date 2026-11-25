import type { LocationValue, SearchCriteria } from "./clinician-criteria.ts";

export interface BroadSearchScope {
  roleLabel: string;
}

/**
 * A role-only nationwide ask is a market-sizing question, not a browsable
 * candidate search. Any stated clinical, employer, training, experience or
 * local-geography constraint makes it an ordinary search again.
 *
 * The United States criterion is normally inferred by the criteria mapper,
 * so an omitted location and an explicit nationwide ask intentionally look
 * the same here. No provider call or hardcoded market total is involved.
 */
export function broadSearchScope(criteria: SearchCriteria[]): BroadSearchScope | null {
  const active = criteria.filter((c) => c.enforcement !== "dropped");
  const roles = active.filter((c) => c.kind === "role_class");
  if (roles.length === 0) return null;

  const locations = active.filter((c) => c.kind === "location");
  const unsupported = active.some((c) => c.kind !== "role_class" && c.kind !== "location");
  if (unsupported) return null;

  const nationwide = locations.every((c) => {
    const value = c.value as LocationValue;
    return value.level === "country" && /united states|usa|u\.s\.?/i.test(value.country ?? "");
  });
  if (!nationwide) return null;

  return { roleLabel: roles.map((c) => c.label).join(" / ") };
}
