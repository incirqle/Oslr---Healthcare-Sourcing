/**
 * military-affiliation.test.ts — the Balboa / Colorado lessons (2026-10-14).
 */

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  annotateFacilityLocation,
  applyMilitaryAffiliation,
  isActiveMilitaryEmployer,
  isReserveEmployer,
  isThinProfile,
  readMilitaryAffiliation,
} from "./military-affiliation.ts";
import { EMPLOYER_GROUPS, MILITARY_FACILITIES } from "./employer-groups.ts";
import { mapParsedToCriteria, matchEmployerGroup, matchMilitaryFacility, reconcileParsedClinicianIntent } from "./clinician-criteria.ts";
import { buildClinicianQuery } from "./build-clinician-query.ts";
import { expandParsedKeywords, validateAIOutput } from "./parse-query.ts";

type Row = Record<string, unknown>;
const emp = (name: string, extra: Row = {}): Row => ({ name, title: "Orthopaedic Surgeon", is_primary: false, ...extra });

function row(current: Row[], extra: Row = {}): Row {
  if (current.length > 0 && !current.some((e) => e.is_primary === true)) current[0].is_primary = true;
  return {
    headline: "Orthopaedic Surgeon",
    summary: "Fellowship-trained.",
    job_title: String(current[0]?.title ?? "Orthopaedic Surgeon"),
    job_company_name: String(current[0]?.name ?? ""),
    location_locality: "san diego",
    location_region: "california",
    current_employers: current,
    experience_history: [...current],
    education: [{ school_name: "USU" }],
    ...extra,
  };
}

/* ---------- employer reads ---------- */

Deno.test("service tags, hospital tags and .mil domains read as active military", () => {
  assert(isActiveMilitaryEmployer("US Navy"));
  assert(isActiveMilitaryEmployer("USN"));
  assert(isActiveMilitaryEmployer("United States Air Force"));
  assert(isActiveMilitaryEmployer("Naval Medical Center San Diego"));
  assert(isActiveMilitaryEmployer("Evans Army Community Hospital"));
  assert(isActiveMilitaryEmployer("Defense Health Agency"));
  assert(isActiveMilitaryEmployer("60th Medical Group"));
  assert(isActiveMilitaryEmployer("Some Clinic", "https://www.army.mil"));
  assert(!isActiveMilitaryEmployer("Salvation Army"));
  assert(!isActiveMilitaryEmployer("Advocate Medical Group"));
  assert(!isActiveMilitaryEmployer("Old Navy"));
});

Deno.test("foreign forces are never military for this product", () => {
  assert(!isActiveMilitaryEmployer("Ministry of National Guard Health Affairs (MNGHA)"));
  assert(!isReserveEmployer("Ministry of National Guard Health Affairs (MNGHA)"));
  assert(!isActiveMilitaryEmployer("Australian Army"));
  assert(!isReserveEmployer("Australian Army", "Officer Australian Army Reserve RAAMC"));
  assert(!isActiveMilitaryEmployer("Royal Navy"));
});

Deno.test("Guard and Reserve tags on the employer or the title", () => {
  assert(isReserveEmployer("U.S. Navy Reserve"));
  assert(isReserveEmployer("US Army Reserves"));
  assert(isReserveEmployer("Michigan Army National Guard"));
  assert(isReserveEmployer("US Army", "Major, US Army Reserves"));
  assert(isReserveEmployer("US Army", "Army Reservist"));
  assert(!isReserveEmployer("US Army", "Orthopaedic Surgeon"));
  assert(!isReserveEmployer("United States Air Force"));
});

/* ---------- the four reads ---------- */

Deno.test("active: only military employers (Lucas McDonald shape)", () => {
  const r = readMilitaryAffiliation(row([emp("US Navy"), emp("Naval Medical Center San Diego")]));
  assertEquals(r.affiliation, "active");
});

Deno.test("active: a USU faculty appointment or a CrossFit gym beside the hospital is still active (Waggoner shape)", () => {
  const r = readMilitaryAffiliation(row([emp("Naval Medical Center San Diego"), emp("Uniformed Services University", { title: "Assistant Professor" }), emp("Bear Republic CrossFit", { title: "Co-Owner" })]));
  assertEquals(r.affiliation, "active");
});

Deno.test("likely_reserve: civilian practice first, the service second, no 'reserve' anywhere (Romero shape)", () => {
  const r = readMilitaryAffiliation(row([emp("AdventHealth", { is_primary: true }), emp("US Army")]));
  assertEquals(r.affiliation, "likely_reserve");
  assert(r.evidence.includes("AdventHealth"));
});

Deno.test("reserve: an explicit Reserve employer (Novack shape)", () => {
  const r = readMilitaryAffiliation(row([emp("OrthoArizona", { is_primary: true, title: "Partner" }), emp("US Army Reserves", { title: "Major" })]));
  assertEquals(r.affiliation, "reserve");
});

Deno.test("veteran: military only in past roles", () => {
  const r = readMilitaryAffiliation(row([emp("Scripps Memorial Hospital")], {
    experience_history: [emp("Scripps Memorial Hospital"), emp("US Navy", { is_primary: false, end_date: "2015-01-01" })],
  }));
  assertEquals(r.affiliation, "veteran");
});

Deno.test("null: no military tie", () => {
  assertEquals(readMilitaryAffiliation(row([emp("Kaiser Permanente")])).affiliation, null);
});

/* ---------- thin profiles ---------- */

Deno.test("the fabricated 'Surgeon at US Army' shell is thin; a real profile is not", () => {
  const shell: Row = {
    headline: "Orthopaedic Surgeon at US Army",
    summary: null,
    job_title: "Orthopaedic Surgeon",
    job_company_name: "US Army",
    location_locality: null,
    location_region: null,
    current_employers: [emp("US Army", { is_primary: true })],
    experience_history: [emp("US Army")],
    education: [],
  };
  assert(isThinProfile(shell).thin);
  // One real signal (a city) is enough to be a person.
  assert(!isThinProfile({ ...shell, location_locality: "el paso", location_region: "texas" }).thin);
  assert(!isThinProfile(row([emp("US Army")])).thin);
});

/* ---------- the split ---------- */

const dodCriteria = () => {
  const parsed = validateAIOutput({
    role_class: "surgeon", job_titles: [], specialty: "orthopedic surgery", specialties: ["orthopedic surgery"],
    specialty_tense: "current", companies: ["department of defense"], current_companies: ["department of defense"],
    location: { state: "colorado", state_confidence: 0.95 },
  }) as unknown as Record<string, unknown>;
  const q = "DoD orthopedic surgeons in Colorado";
  expandParsedKeywords(parsed, q);
  return mapParsedToCriteria(reconcileParsedClinicianIntent(parsed, q), []);
};

Deno.test("a DoD ask keeps active duty, sets Guard / Reserve and likely-Reserve aside with evidence, drops thin shells", () => {
  const criteria = dodCriteria();
  const active = row([emp("US Army"), emp("Evans Army Community Hospital")], { full_name: "A" });
  const reserve = row([emp("OrthoArizona", { is_primary: true }), emp("US Army Reserves")], { full_name: "B" });
  const likely = row([emp("AdventHealth", { is_primary: true }), emp("US Army")], { full_name: "C" });
  const shell: Row = {
    full_name: "D", headline: "Orthopaedic Surgeon at US Army", summary: null, job_title: "Orthopaedic Surgeon",
    job_company_name: "US Army", location_locality: null, location_region: null,
    current_employers: [emp("US Army", { is_primary: true })], experience_history: [emp("US Army")], education: [],
  };
  const split = applyMilitaryAffiliation([active, reserve, likely, shell], criteria);
  assertEquals(split.kept.map((r) => r.full_name), ["A"]);
  assertEquals(split.reserve.map((r) => r.full_name), ["B", "C"]);
  assertEquals(split.thin.map((r) => r.full_name), ["D"]);
  assertEquals(active.military_affiliation, "active");
  assert(String(reserve.audit_reason).startsWith("Guard or Reserve"));
  assert(String(likely.audit_reason).startsWith("Likely Guard or Reserve"));
  assert(String(shell.audit_reason).startsWith("Thin profile"));
});

Deno.test("a civilian ask annotates but never sets aside on military grounds", () => {
  const parsed = validateAIOutput({
    role_class: "surgeon", job_titles: [], specialty: "orthopedic surgery", specialties: ["orthopedic surgery"],
    specialty_tense: "current", location: { city: "san diego", state: "california", city_confidence: 0.95, state_confidence: 0.95 },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(reconcileParsedClinicianIntent(parsed, "orthopedic surgeons in San Diego"), []);
  const likely = row([emp("UC San Diego Health", { is_primary: true }), emp("US Navy")]);
  const split = applyMilitaryAffiliation([likely], criteria);
  assertEquals(split.kept.length, 1);
  assertEquals(likely.military_affiliation, "likely_reserve");
  assertEquals(likely.audit_verdict, undefined);
});

/* ---------- groups, facilities, known answers ---------- */

Deno.test("DoD, Guard / Reserve, IHS and VA aliases resolve; bystanders do not", () => {
  const cases: Array<[string, string | null]> = [
    ["DoD", "dod"], ["Department of Defense", "dod"], ["military", "dod"], ["US Army", "dod"],
    ["United States Air Force", "dod"], ["Defense Health Agency", "dod"], ["Balboa", "dod"], ["Walter Reed", "dod"],
    ["Naval Medical Center San Diego", "dod"], ["US Army Reserve", "guard_reserve"], ["Air Force Reserve", "guard_reserve"],
    ["Army National Guard", "guard_reserve"], ["reservists", "guard_reserve"], ["guard and reserve", "guard_reserve"],
    ["Indian Health Service", "ihs"], ["the VA", "va"], ["VA hospital", "va"], ["Veterans Affairs", "va"],
    ["Department of Veterans Affairs", "va"], ["Salvation Army", null], ["Old Navy", null], ["Kaiser Permanente", "kaiser"],
  ];
  for (const [name, key] of cases) assertEquals(matchEmployerGroup(name)?.key ?? null, key, `"${name}"`);
});

Deno.test("no Guard / Reserve employer variant is the bare 'national guard' (the Saudi trap) and no reserve domain is the Air Force's", () => {
  const gr = EMPLOYER_GROUPS.guard_reserve;
  assert(!gr.name_variants.includes("national guard"));
  assert(!gr.domains.includes("afreserve.com"));
  assert(!gr.domains.includes("goang.com"));
  assert(!EMPLOYER_GROUPS.dod.name_variants.includes("medical group"), "a bare 'medical group' matches every civilian group");
});

Deno.test("VA group carries the measured variants and the Colorado facility", () => {
  const va = EMPLOYER_GROUPS.va;
  for (const v of ["veteran affairs", "veterans administration", "va hospital", "vamc", "department of veteran"]) {
    assert(va.name_variants.includes(v), v);
  }
  assert(va.company_ids.includes(6503188));
  assert(va.company_ids.includes(1129891));
});

Deno.test("every military facility has aliases, variants, and at least one record or variant", () => {
  for (const [key, def] of Object.entries(MILITARY_FACILITIES)) {
    assert(def.aliases.length > 0, key);
    assert(def.name_variants.length > 0, key);
    for (const id of def.company_ids) assert(Number.isInteger(id) && id > 0, `${key}: ${id}`);
    assert(def.company_ids.every((id) => EMPLOYER_GROUPS.dod.company_ids.includes(id)), `${key}: every facility record must also be in the dod group`);
  }
  assertEquals(matchMilitaryFacility("Balboa")?.key, "nmcsd");
  assertEquals(matchMilitaryFacility("Naval Medical Center San Diego")?.key, "nmcsd");
  assertEquals(matchMilitaryFacility("Walter Reed")?.key, "walter_reed");
  assertEquals(matchMilitaryFacility("Madigan")?.key, "madigan");
  assertEquals(matchMilitaryFacility("Kaiser Permanente"), null);
});

Deno.test("known answer: 'Navy orthopaedic surgeons at Balboa' is the base's records + every service, clipped to San Diego", () => {
  const parsed = validateAIOutput({
    role_class: "surgeon", job_titles: [], specialty: "orthopedic surgery", specialties: ["orthopedic surgery"],
    specialty_tense: "current", companies: ["balboa"], current_companies: ["balboa"], location: {},
  }) as unknown as Record<string, unknown>;
  const q = "Navy orthopaedic surgeons at Balboa";
  expandParsedKeywords(parsed, q);
  const criteria = mapParsedToCriteria(reconcileParsedClinicianIntent(parsed, q), []);
  const group = criteria.find((c) => c.kind === "employer_group");
  assertExists(group);
  const v = group!.value as { company_ids: number[]; name_variants: string[]; facility?: { key: string; city: string | null } };
  assertEquals(v.facility?.key, "nmcsd");
  assert(v.company_ids.includes(6518802) && v.company_ids.includes(7423349), "both NMCSD records");
  assert(v.company_ids.includes(1034053), "US Navy");
  assert(v.company_ids.includes(1040041), "US Army too — joint staffing");
  assert(v.name_variants.includes("us navy") && v.name_variants.includes("usn"));
  assert(v.name_variants.includes("naval medical center san diego"));
  const loc = criteria.find((c) => c.kind === "location");
  assertExists(loc);
  assertEquals((loc!.value as { city?: string; state?: string }).city, "san diego");
  assertEquals((loc!.value as { city?: string; state?: string }).state, "california");
  assertEquals(loc!.source, "inferred");
  const tree = buildClinicianQuery(criteria);
  assertExists(tree);
});

Deno.test("known answer: 'DoD orthopedic surgeons in Colorado' carries the services, DHA and the .mil domains", () => {
  const criteria = dodCriteria();
  const group = criteria.find((c) => c.kind === "employer_group");
  assertExists(group);
  const v = group!.value as { group_key: string; company_ids: number[]; domains: string[]; name_variants: string[] };
  assertEquals(v.group_key, "dod");
  assert(v.company_ids.includes(1040041) && v.company_ids.includes(1034053) && v.company_ids.includes(1100685));
  assert(v.domains.includes("army.mil") && v.domains.includes("dha.mil"));
  assert(v.name_variants.includes("defense health agency"));
  assert(v.name_variants.includes("evans army community hospital") || v.name_variants.includes("army community hospital"));
  const tree = buildClinicianQuery(criteria);
  assertExists(tree);
  assert(JSON.stringify(tree).includes("colorado"));
});

Deno.test("facility-recall rows listing another state get a transfer note, not a rejection", () => {
  const parsed = validateAIOutput({
    role_class: "surgeon", job_titles: [], specialty: "orthopedic surgery", specialties: ["orthopedic surgery"],
    specialty_tense: "current", companies: ["balboa"], current_companies: ["balboa"], location: {},
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(reconcileParsedClinicianIntent(parsed, "orthopaedic surgeons at Balboa"), []);
  const transferred = row([emp("Naval Medical Center San Diego")], { facility_recall: true, location_locality: "norfolk", location_region: "virginia" });
  const local = row([emp("Naval Medical Center San Diego")], { facility_recall: true });
  const noLoc = row([emp("Naval Medical Center San Diego")], { facility_recall: true, location_locality: null, location_region: null });
  annotateFacilityLocation([transferred, local, noLoc], criteria);
  assert(String(transferred.location_note).includes("norfolk"));
  assertEquals(local.location_note, undefined);
  assert(String(noLoc.location_note).startsWith("No location"));
  const split = applyMilitaryAffiliation([transferred], criteria);
  assertEquals(split.kept.length, 1);
});
