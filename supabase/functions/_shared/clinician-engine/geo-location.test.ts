import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildClinicianQuery, titleCasePlace } from "./build-clinician-query.ts";

const crit = [{ kind: "location", enforcement: "hard", value: { level: "city", city: "philadelphia", state: "pennsylvania" } }] as never;

Deno.test("geocoded city is sent title-cased", () => {
  assertEquals(titleCasePlace("philadelphia, pennsylvania"), "Philadelphia, Pennsylvania");
  assertEquals(JSON.stringify(buildClinicianQuery(crit)).includes("Philadelphia, Pennsylvania"), true);
});

Deno.test("noGeo fallback drops the radius but keeps the city", () => {
  const s = JSON.stringify(buildClinicianQuery(crit, { noGeo: true }));
  assertEquals(s.includes("geo_distance"), false);
  assertEquals(s.includes("philadelphia"), true);
});

Deno.test("city discovery never requires a populated profile state", () => {
  const tree = buildClinicianQuery(crit) as any;
  assertEquals(tree.op, "or");
  // State only ever pairs with the city text; metro-label and geo branches
  // need no state, so blank-state metro profiles and commuters still match.
  const stateFree = tree.conditions.filter((c: any) => !JSON.stringify(c).includes("basic_profile.location.state"));
  assertEquals(stateFree.some((c: any) => JSON.stringify(c).includes("geo_distance")), true);
  assertEquals(stateFree.some((c: any) => JSON.stringify(c).includes("metropolitan")), true);
  const alternatives = JSON.stringify(tree.conditions);
  assertEquals(alternatives.includes("basic_profile.location.full_location"), true);
  assertEquals(alternatives.includes("geo_distance"), true);
});
