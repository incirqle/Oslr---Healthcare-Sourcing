/**
 * employer-groups.test.ts — the Kaiser / Colorado Permanente regression
 * (2026-10-14) and the invariants that keep the curated table honest.
 */

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { EMPLOYER_GROUPS } from "./employer-groups.ts";
import { containsWholePhrase } from "./clinical-vocabulary.ts";
import { mapParsedToCriteria, matchEmployerGroup, reconcileParsedClinicianIntent } from "./clinician-criteria.ts";
import { buildClinicianQuery } from "./build-clinician-query.ts";
import { expandParsedKeywords, validateAIOutput } from "./parse-query.ts";

type Leaf = { field: string; type: string; value: unknown };
function leavesOf(tree: unknown): Leaf[] {
  const out: Leaf[] = [];
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const node = n as { conditions?: unknown[]; field?: string };
    if (Array.isArray(node.conditions)) node.conditions.forEach(walk);
    else if (node.field) out.push(n as Leaf);
  };
  walk(tree);
  return out;
}

/* ---------- table invariants ---------- */

Deno.test("every curated employer group carries verified ids, aliases and name variants", () => {
  for (const [key, def] of Object.entries(EMPLOYER_GROUPS)) {
    assert(def.label.trim().length > 0, `${key}: label`);
    assert(def.aliases.length > 0, `${key}: needs at least one alias`);
    assert(
      def.company_ids.length > 0,
      `${key}: an id-less group is exactly the Kaiser bug — resolve ids via /company/identify before shipping`,
    );
    assert(def.name_variants.length > 0, `${key}: needs at least one name variant`);
    for (const id of def.company_ids) {
      assert(Number.isInteger(id) && id > 0, `${key}: bad company id ${id}`);
    }
    assertEquals(new Set(def.company_ids).size, def.company_ids.length, `${key}: duplicate company id`);
    for (const a of def.aliases) assertEquals(a, a.toLowerCase(), `${key}: alias "${a}" must be lowercase`);
    for (const v of def.name_variants) {
      assertEquals(v, v.toLowerCase(), `${key}: variant "${v}" must be lowercase`);
      assert(v.trim().length >= 3, `${key}: variant "${v}" too short`);
    }
    for (const d of def.domains) assert(d.includes("."), `${key}: domain "${d}"`);
  }
});

const GENERIC_WORDS = ["mercy", "baptist", "methodist", "memorial", "saint", "st.", "community", "regional", "general", "university", "health", "medical", "hospital", "children", "children's"];

Deno.test("no group uses a generic hospital word as a bare alias or variant", () => {
  for (const [key, def] of Object.entries(EMPLOYER_GROUPS)) {
    for (const a of [...def.aliases, ...def.name_variants]) {
      assert(!GENERIC_WORDS.includes(a.trim()), `${key}: "${a}" is a generic word — it would match unrelated systems`);
    }
  }
});

Deno.test("the longest matching alias wins across groups", () => {
  // "St. John Providence" is an Ascension system in Michigan, not Providence.
  assertEquals(matchEmployerGroup("St. John Providence")?.key, "ascension");
  assertEquals(matchEmployerGroup("Providence")?.key, "providence");
  assertEquals(matchEmployerGroup("Providence Swedish")?.key, "providence");
  // Chicago's Swedish Hospital is Endeavor; Seattle's Swedish is Providence.
  assertEquals(matchEmployerGroup("Swedish Hospital")?.key, "endeavor");
  assertEquals(matchEmployerGroup("Swedish Medical Center")?.key, "providence");
  // Colorado vs Cincinnati.
  assertEquals(matchEmployerGroup("UCHealth")?.key, "uchealth");
  assertEquals(matchEmployerGroup("UC Health")?.key, "uc_cincinnati");
  // Advocate Health (parent) vs Advocate Aurora vs Atrium.
  assertEquals(matchEmployerGroup("Advocate Health")?.key, "advocate_health");
  assertEquals(matchEmployerGroup("Advocate Aurora Health")?.key, "advocate_aurora");
  assertEquals(matchEmployerGroup("Atrium Health")?.key, "atrium");
  assertEquals(matchEmployerGroup("Wake Forest Baptist")?.key, "atrium");
});

Deno.test("aliases are whole phrases — bystanders do not match", () => {
  assertEquals(matchEmployerGroup("Patient Advocate Foundation"), null);
  assertEquals(matchEmployerGroup("Brigham Young University"), null);
  assertEquals(matchEmployerGroup("Nova Health"), null);
  assertEquals(matchEmployerGroup("Mercy Hospital"), null);
  assertEquals(matchEmployerGroup("Baptist Health"), null);
  assertEquals(matchEmployerGroup("Methodist Hospital"), null);
  assertEquals(matchEmployerGroup("Memorial Hermann"), null);
});

Deno.test("renamed and physician-group entities resolve to their system", () => {
  const cases: Array<[string, string]> = [
    ["Kaiser Permanente", "kaiser"],
    ["Kaiser", "kaiser"],
    ["Colorado Permanente Medical Group", "kaiser"],
    ["The Permanente Medical Group", "kaiser"],
    ["Palo Alto Medical Foundation", "sutter"],
    ["SCL Health", "intermountain"],
    ["Centura Health", "commonspirit"],
    ["Dignity Health", "commonspirit"],
    ["Beaumont Health", "corewell"],
    ["Spectrum Health", "corewell"],
    ["NorthShore University HealthSystem", "endeavor"],
    ["Lifespan", "brown_health"],
    ["Greenville Health System", "prisma"],
    ["Park Nicollet", "healthpartners"],
    ["Washington University Physicians", "bjc"],
    ["Barnes-Jewish Hospital", "bjc"],
    ["CU Medicine", "uchealth"],
    ["University of Colorado Hospital", "uchealth"],
    ["Massachusetts General Hospital", "mgb"],
    ["Brigham and Women's Hospital", "mgb"],
    ["Weill Cornell Medicine", "nyp"],
    ["Columbia University Irving Medical Center", "nyp"],
    ["Medical College of Wisconsin", "froedtert"],
    ["University of Minnesota Physicians", "fairview"],
    ["IHA", "trinity"],
    ["Loyola Medicine", "trinity"],
    ["Seton Healthcare Family", "ascension"],
    ["Florida Hospital", "adventhealth"],
    ["Wellmont Health System", "ballad"],
    ["David Geffen School of Medicine at UCLA", "ucla"],
    ["Yale School of Medicine", "yale"],
    ["Jersey Shore University Medical Center", "hackensack"],
    ["Dartmouth-Hitchcock", "dartmouth"],
    ["Allegheny General Hospital", "ahn"],
    ["University of Pittsburgh Physicians", "upmc"],
    ["Perelman School of Medicine", "penn"],
    ["Harborview Medical Center", "uw_medicine"],
  ];
  for (const [name, key] of cases) {
    assertEquals(matchEmployerGroup(name)?.key, key, `"${name}" should be ${key}`);
  }
});

/* ---------- the known answer: Kaiser orthopedic surgeons in Colorado ---------- */

Deno.test("live failure 2026-10-14: Kaiser orthopedic surgeons in Colorado reach every Permanente entity", () => {
  const query = "Find orthopedic surgeons at Kaiser Permanente in Colorado.";
  const parsed = validateAIOutput({
    role_class: "surgeon",
    job_titles: [],
    specialty: "orthopedic surgery",
    specialties: ["orthopedic surgery"],
    specialty_tense: "current",
    companies: ["kaiser permanente"],
    current_companies: ["kaiser permanente"],
    location: { state: "colorado", state_confidence: 0.95 },
  }) as unknown as Record<string, unknown>;
  expandParsedKeywords(parsed, query);
  const criteria = mapParsedToCriteria(reconcileParsedClinicianIntent(parsed, query), []);

  const group = criteria.find((c) => c.kind === "employer_group");
  assertExists(group, "Kaiser must map to an employer_group");
  const v = group!.value as { company_ids: number[]; name_variants: string[]; domains: string[] };
  assert(v.company_ids.includes(1587372), "Colorado Permanente Medical Group (CPMG) id must be in the group");
  assert(v.company_ids.includes(6088378), "The Permanente Medical Group (Northern California) id must be in the group");
  assert(v.company_ids.includes(7452744), "Southern California Permanente Medical Group id must be in the group");
  assert(v.name_variants.includes("permanente"), "the bare 'permanente' variant catches every regional medical group by name");
  assert(v.domains.includes("kpphysiciancareers.org"), "CPMG's own domain");

  const tree = buildClinicianQuery(criteria);
  const leaves = leavesOf(tree);
  const idLeaf = leaves.find((l) => l.field === "experience.employment_details.current.company_id" && l.type === "in");
  assertExists(idLeaf, "the employer clause must carry the id set");
  assert((idLeaf!.value as number[]).includes(1587372));
  const nameLeaves = leaves.filter((l) => l.field === "experience.employment_details.current.company_name").map((l) => String(l.value));
  assert(nameLeaves.includes("permanente"), "the employer clause must match 'Permanente' employer names");
  assert(nameLeaves.includes("kaiser permanente"));
  // The state filter is still there — the employer clause widens recall, not geography.
  assert(leaves.some((l) => l.field === "basic_profile.location.state" && l.value === "colorado"));
});

Deno.test("containsWholePhrase treats punctuation as a boundary (St. John Providence)", () => {
  assert(containsWholePhrase("st. john providence", "st. john providence"));
  assert(containsWholePhrase("ascension st. john providence health system", "st. john providence"));
  assert(!containsWholePhrase("providencetown clinic", "providence"));
});
