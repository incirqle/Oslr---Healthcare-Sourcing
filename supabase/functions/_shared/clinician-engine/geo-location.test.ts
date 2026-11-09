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
