import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapParsedToCriteria } from "./clinician-criteria.ts";
import { broadSearchScope } from "./broad-search.ts";

Deno.test("every physician in the United States is a broad search", () => {
  const criteria = mapParsedToCriteria({ role_class: "physician" });
  assertEquals(broadSearchScope(criteria), { roleLabel: "Physicians" });
});

Deno.test("a nationwide nurse-only ask is broad", () => {
  const criteria = mapParsedToCriteria({ role_class: "nurse" });
  assert(broadSearchScope(criteria));
});

Deno.test("a specialty makes a nationwide physician search browsable", () => {
  const criteria = mapParsedToCriteria({ role_class: "physician", specialties: ["cardiology"] });
  assertEquals(broadSearchScope(criteria), null);
});

Deno.test("a state makes a physician search browsable", () => {
  const criteria = mapParsedToCriteria({ role_class: "physician", location: { state: "colorado" } });
  assertEquals(broadSearchScope(criteria), null);
});

Deno.test("an employer makes a nationwide physician search browsable", () => {
  const criteria = mapParsedToCriteria({ role_class: "physician", current_companies: ["mayo clinic"] });
  assertEquals(broadSearchScope(criteria), null);
});

Deno.test("a training stage makes a physician search browsable", () => {
  const criteria = mapParsedToCriteria({
    role_class: "resident",
    training_stage: { profession: "orthopedic", stage: "residency", year: 4 },
  });
  assertEquals(broadSearchScope(criteria), null);
});

Deno.test("experience makes a nationwide physician search browsable", () => {
  const criteria = mapParsedToCriteria({ role_class: "physician", min_years_experience: 5 });
  assertEquals(broadSearchScope(criteria), null);
});

Deno.test("a location without a clinical role is not handled by the broad-role guard", () => {
  const criteria = mapParsedToCriteria({ location: { state: "colorado" } });
  assertEquals(broadSearchScope(criteria), null);
});
