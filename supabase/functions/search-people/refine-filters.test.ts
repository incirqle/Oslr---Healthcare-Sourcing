/**
 * refine-filters.test.ts — the criteria editor's edits must reach the
 * engine. Pure module: no network, no env.
 */
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  applyEditorFilters,
  dropSpecialtyEchoes,
  keywordEchoesSpecialty,
  locationLabelsFromParsed,
  parseLocationEdit,
} from "./refine-filters.ts";

const MIAMI_PARSE = {
  role_class: "surgeon",
  role_classes: [],
  job_titles: [],
  specialty: "orthopedic surgery",
  specialties: ["orthopedic surgery", "orthopedic"],
  required_keywords: ["orthopedic", "orthopaedic"],
  keywords: [],
  current_companies: [],
  companies: [],
  location: { city: "miami", state: "florida", metro: "miami", region_key: null, city_confidence: 0.95, state_confidence: 0.95 },
  locations: [],
  min_years_experience: null,
};

Deno.test("location edits parse city/state/abbreviation forms", () => {
  assertEquals(parseLocationEdit("Miami, Florida"), { city: "miami", state: "florida" });
  assertEquals(parseLocationEdit("miami florida"), { city: "miami", state: "florida" });
  assertEquals(parseLocationEdit("Fort Lauderdale, FL"), { city: "fort lauderdale", state: "florida" });
  assertEquals(parseLocationEdit("Florida"), { city: null, state: "florida" });
  assertEquals(parseLocationEdit("NC"), { city: null, state: "north carolina" });
  assertEquals(parseLocationEdit("Raleigh North Carolina"), { city: "raleigh", state: "north carolina" });
  assertEquals(parseLocationEdit("Dallas"), { city: "dallas", state: null });
  assertEquals(parseLocationEdit("  "), null);
});

Deno.test("keyword echoes of a specialty are recognised across spellings and plurals", () => {
  assert(keywordEchoesSpecialty("orthopaedic", ["orthopedic surgery"]));
  assert(keywordEchoesSpecialty("orthopedics", ["orthopedic"]));
  assert(!keywordEchoesSpecialty("arthroplasty", ["orthopedic surgery"]));
  assertEquals(dropSpecialtyEchoes(["orthopedic", "orthopaedic", "cardiac"], ["orthopedic surgery"]), ["cardiac"]);
});

Deno.test("an unchanged editor payload leaves the parse alone except for keyword echoes", () => {
  const out = applyEditorFilters(MIAMI_PARSE, {
    job_titles: [],
    specialties: ["orthopedic surgery", "orthopedic"],
    keywords: [],
    companies: [],
    locations: locationLabelsFromParsed(MIAMI_PARSE),
    experience_years: null,
    role_class: "surgeon",
  });
  assertEquals(out.location, MIAMI_PARSE.location);
  assertEquals(out.role_class, "surgeon");
  assertEquals(out.specialties, ["orthopedic surgery", "orthopedic"]);
  // The echoes are gone: the builder derives spellings itself.
  assertEquals(out.required_keywords, []);
});

Deno.test("removing a specialty chip removes it — the keyword echo cannot resurrect it", () => {
  const out = applyEditorFilters(MIAMI_PARSE, {
    specialties: ["orthopedic surgery"],
    keywords: [],
  });
  assertEquals(out.specialties, ["orthopedic surgery"]);
  assertEquals(out.specialty, "orthopedic surgery");
  assertEquals(out.required_keywords, []);
});

Deno.test("location, experience and role edits reach the parse", () => {
  const out = applyEditorFilters(MIAMI_PARSE, {
    locations: ["Fort Lauderdale, Florida", "Tampa FL"],
    experience_years: 10,
    role_class: "physician",
  });
  const loc = out.location as Record<string, unknown>;
  assertEquals(loc.city, "fort lauderdale");
  assertEquals(loc.state, "florida");
  assertEquals(loc.region_key, null);
  assertEquals(out.locations, [{ state: "florida", city: "tampa" }]);
  assertEquals(out.min_years_experience, 10);
  assertEquals(out.role_class, "physician");
  assertEquals(out.role_classes, []);

  // Clearing the role makes the ask role-free; clearing locations clears both.
  const cleared = applyEditorFilters(MIAMI_PARSE, { role_class: null, locations: [] });
  assertEquals(cleared.role_class, null);
  assertEquals((cleared.location as Record<string, unknown>).state, null);
  assertEquals(cleared.locations, []);
});

Deno.test("employment model edits reach the parse and can be cleared", () => {
  const set = applyEditorFilters(MIAMI_PARSE, { employment_model: "private_practice" });
  assertEquals(set.employment_model, "private_practice");
  const cleared = applyEditorFilters({ ...MIAMI_PARSE, employment_model: "hospital_employed" }, { employment_model: null });
  assertEquals(cleared.employment_model, null);
  const junk = applyEditorFilters(MIAMI_PARSE, { employment_model: "pe-backed" });
  assertEquals(junk.employment_model, undefined);
});

Deno.test("a state-only location edit keeps the whole state", () => {
  const out = applyEditorFilters(MIAMI_PARSE, { locations: ["Florida"] });
  const loc = out.location as Record<string, unknown>;
  assertEquals(loc.city, null);
  assertEquals(loc.state, "florida");
});
