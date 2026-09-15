/**
 * clinician-criteria.test.ts — mapper + builder contract tests over the
 * blueprint's canonical query archetypes plus the tense-mixed query.
 * Pure modules only: no network, no env.
 */
import { assert, assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  mapParsedToCriteria,
  matchEmployerGroup,
  type EmployerGroupValue,
  type SpecialtyValue,
  type TrainingStageValue,
} from "./clinician-criteria.ts";
import {
  buildClinicianQuery,
  connectorVariants,
  safeTitleTerms,
  type V2FilterBranch,
  type V2FilterLeaf,
  type V2FilterNode,
} from "./build-clinician-query.ts";
import { validateAIOutput } from "./parse-query.ts";
import { widenOptions } from "./widen-criteria.ts";
import { computeMatchScope, stageFit, stageStartWindow } from "./match-scope.ts";
import { classifyEmployer } from "./employer-class.ts";

/* ---------- helpers ---------- */

function leaves(node: V2FilterNode | null): V2FilterLeaf[] {
  if (!node) return [];
  if ("field" in node) return [node];
  return (node as V2FilterBranch).conditions.flatMap(leaves);
}

function fieldsUsed(node: V2FilterNode | null): Set<string> {
  return new Set(leaves(node).map((l) => l.field));
}

/* ---------- archetype 1: PGY-3 podiatric residents in Texas ---------- */

Deno.test("archetype 1: PGY-3 podiatric residents in Texas", () => {
  const parsed = validateAIOutput({
    role_class: "resident",
    training_stage: { profession: "podiatric", stage: "residency", year: 3 },
    job_titles: [],
    specialty: "podiatry",
    specialties: ["podiatry"],
    specialty_tense: "current",
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const stage = criteria.find((c) => c.kind === "training_stage");
  assertExists(stage);
  const sv = stage!.value as TrainingStageValue;
  assertEquals(sv.year, 3);
  // Probe-verified spellings all present.
  for (const t of ["podiatry resident", "podiatric resident", "podiatric surgery resident", "podiatric surgical resident"]) {
    assert(sv.title_terms.includes(t), `missing stage term: ${t}`);
  }
  // The PGY-pharmacy trap: bare "pgy" never becomes a filter term.
  const tree = buildClinicianQuery(criteria);
  const allValues = leaves(tree).map((l) => String(l.value).toLowerCase());
  assert(!allValues.some((v) => v === "pgy" || v === "pgy-3" || v === "pgy3"), "bare PGY leaked into filters");
  // Location is a state '=' leaf, never `in`.
  const stateLeaves = leaves(tree).filter((l) => l.field === "basic_profile.location.state");
  assertEquals(stateLeaves.length, 1);
  assertEquals(stateLeaves[0].type, "=");
  assertEquals(stateLeaves[0].value, "texas");
  // No invented titles: no `title` criterion exists.
  assert(!criteria.some((c) => c.kind === "title"), "invented title criterion");
});

/* ---------- archetype 2: cardiovascular-background nurses, 5+ years ---------- */

Deno.test("archetype 2: nurses with cardiovascular background, 5 years experience", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    job_titles: [],
    specialty: "cardiovascular",
    specialties: ["cardiovascular"],
    specialty_tense: "any",
    min_years_experience: 5,
    location: {},
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const roleClass = criteria.find((c) => c.kind === "role_class");
  assertExists(roleClass);
  const spec = criteria.find((c) => c.kind === "specialty");
  assertExists(spec);
  assertEquals((spec!.value as SpecialtyValue).tense, "any");

  const exp = criteria.find((c) => c.kind === "experience");
  assertExists(exp, "min_years_experience must survive the validator→mapper chain (the exact field the reference engine once dropped)");

  const tree = buildClinicianQuery(criteria);
  const fields = fieldsUsed(tree);
  // Background phrasing licenses history: past surfaces present.
  assert(fields.has("experience.employment_details.past.title"), "tense 'any' must include past titles");
  assert(fields.has("years_of_experience_raw"));
  // Inferred US default appended when no location stated.
  assert(criteria.some((c) => c.kind === "location" && c.source === "inferred"));
});

/* ---------- archetype 3: orthopedic physicians at the VA ---------- */

Deno.test("archetype 3: orthopedic physicians at the VA", () => {
  assertExists(matchEmployerGroup("the va"));
  assertExists(matchEmployerGroup("veterans affairs"));

  const parsed = validateAIOutput({
    role_class: "physician",
    job_titles: [],
    specialty: "orthopedic",
    specialties: ["orthopedic"],
    specialty_tense: "current",
    current_companies: ["the va"],
    location: {},
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const group = criteria.find((c) => c.kind === "employer_group");
  assertExists(group, "the VA must resolve to an employer_group, never a bare name");
  const gv = group!.value as EmployerGroupValue;
  assert(gv.company_ids.includes(1129891), "VA anchor id missing");
  assert(gv.domains.includes("va.gov"));
  // No plain company criterion duplicates the group.
  assert(!criteria.some((c) => c.kind === "company"), "VA must not also emit a company criterion");

  const tree = buildClinicianQuery(criteria);
  const allLeaves = leaves(tree);
  // NEVER a bare "VA" substring filter.
  assert(
    !allLeaves.some((l) => typeof l.value === "string" && l.value.toLowerCase().trim() === "va"),
    "bare 'VA' substring leaked into filters",
  );
  // Both spellings of orthopedic present (ae/e connector family).
  const values = allLeaves.map((l) => String(l.value).toLowerCase());
  assert(values.some((v) => v.includes("orthopaedic")), "orthopaedic spelling missing");
  assert(values.some((v) => v.includes("orthopedic")), "orthopedic spelling missing");
  // Specialty is current-tense: no past surfaces in the tree.
  const fields = fieldsUsed(tree);
  assert(!fields.has("experience.employment_details.past.title"), "current-tense ask leaked past surfaces");
});

/* ---------- tense query: former OR nurse, now med-surg, Dallas ---------- */

Deno.test("tense query: former OR nurse now on a med-surg floor in Dallas", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    job_titles: [],
    specialties: ["operating room", "perioperative"],
    specialty_tense: "past",
    required_keywords: ["med surg", "medical surgical"],
    location: { city: "dallas", state: "texas" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const specialties = criteria.filter((c) => c.kind === "specialty");
  assertEquals(specialties.length, 2, "past ask must split into past + current specialty criteria");
  const past = specialties.find((c) => (c.value as SpecialtyValue).tense === "past");
  const current = specialties.find((c) => (c.value as SpecialtyValue).tense === "current");
  assertExists(past);
  assertExists(current);
  assert((past!.value as SpecialtyValue).terms.includes("operating room"));
  assert((current!.value as SpecialtyValue).terms.includes("med surg"));

  const tree = buildClinicianQuery(criteria);
  const allLeaves = leaves(tree);
  // The past-tense group touches ONLY past surfaces.
  const orLeaves = allLeaves.filter((l) => String(l.value).includes("operating room"));
  assert(orLeaves.length > 0);
  assert(
    orLeaves.every((l) => l.field.startsWith("experience.employment_details.past.")),
    "past-tense specialty leaked onto current surfaces",
  );
  // The current group carries the med-surg connector triplet.
  const msValues = allLeaves
    .filter((l) => !l.field.startsWith("experience.employment_details.past."))
    .map((l) => String(l.value).toLowerCase());
  assert(msValues.includes("med surg"));
  assert(msValues.includes("med/surg"));
  assert(msValues.includes("med-surg"));
  // City: state '=' AND (city '=' OR full_location substring) — never bare
  // city equality (probe D: city='Dallas' alone removed every result).
  const fields = fieldsUsed(tree);
  assert(fields.has("basic_profile.location.full_location"), "city fallback surface missing");
});

/* ---------- unit: connector variants ---------- */

Deno.test("connectorVariants covers and/&, slash-hyphen-space, ae/e", () => {
  const andVars = connectorVariants("labor and delivery");
  assert(andVars.includes("labor & delivery"));
  const msVars = connectorVariants("med/surg");
  assert(msVars.includes("med surg"));
  assert(msVars.includes("med-surg"));
  const aeVars = connectorVariants("orthopedic surgeon");
  assert(aeVars.includes("orthopaedic surgeon"));
  const eaVars = connectorVariants("orthopaedic surgeon");
  assert(eaVars.includes("orthopedic surgeon"));
});

/* ---------- unit: short-token guard ---------- */

Deno.test("safeTitleTerms drops short ambiguous tokens", () => {
  const { kept, dropped } = safeTitleTerms(["md", "rn", "icu nurse"]);
  assertEquals(kept, ["icu nurse"]);
  assertEquals(dropped.sort(), ["md", "rn"]);
});

/* ---------- unit: widen options never offer the anchor ---------- */

Deno.test("widenOptions skips company and employer_group anchors", () => {
  const parsed = validateAIOutput({
    role_class: "physician",
    specialties: ["orthopedic"],
    current_companies: ["the va"],
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);
  const opts = widenOptions(criteria);
  const targets = new Set(opts.map((o) => o.targetId));
  for (const c of criteria) {
    if (c.kind === "employer_group" || c.kind === "company") {
      assert(!targets.has(c.id), "widen offered to drop the employer anchor");
    }
  }
});

/* ---------- unit: match scope + stage fit ---------- */

Deno.test("stale never-ended resident entry is demoted by scope and stage fit", () => {
  const parsed = validateAIOutput({
    role_class: "resident",
    training_stage: { profession: "podiatric", stage: "residency", year: 3 },
    specialties: ["podiatry"],
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  // Probe A's stale profile shape: primary role is practice owner, the
  // "resident" title only on a secondary never-closed entry from 2010.
  const staleProfile = {
    headline: "Podiatrist + Owner",
    current_employers: [
      { title: "Owner", name: "Foot and Ankle Specialists", is_default: true, start_date: "2013-02-01T00:00:00" },
      { title: "Chief Resident- Podiatric Medicine & Surgery", name: "Kingwood Medical Center", is_default: false, start_date: "2010-07-01T00:00:00" },
    ],
  };
  assertEquals(computeMatchScope(staleProfile, criteria), "secondary");

  const now = new Date("2026-09-14T00:00:00Z");
  const stage = criteria.find((c) => c.kind === "training_stage")!.value as TrainingStageValue;
  assertEquals(stageFit(staleProfile, stage, now), "out_of_window");

  // Probe A's genuine PGY-3: residency started 2026-06 → in window fall 2026.
  const genuine = {
    headline: "Resident Physician (PGY3)",
    current_employers: [
      { title: "Resident Physician - Podiatric Medicine & Surgery", name: "Baylor Scott & White Health", is_default: true, start_date: "2024-06-01T00:00:00" },
    ],
  };
  assertEquals(computeMatchScope(genuine, criteria), "primary");
  assertEquals(stageFit(genuine, stage, now), "in_window");

  const w = stageStartWindow(3, now);
  assert(w.from < new Date("2024-06-01") && new Date("2024-06-01") < w.to);
});

/* ---------- unit: the great inversion ---------- */

Deno.test("employer classifier tags but the engine never filters on it", async () => {
  assertEquals(classifyEmployer("Baylor Scott & White Health"), "provider");
  assertEquals(classifyEmployer("Stryker"), "commercial");
  assertEquals(classifyEmployer("Aya Healthcare"), "commercial"); // staffing agency
  // Grep-gate (port plan item 2): the reference's exclusion function must
  // not exist anywhere in this engine.
  const needle = ["partition", "Provider", "Employers"].join("");
  const dir = new URL(".", import.meta.url).pathname;
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) continue;
    const text = await Deno.readTextFile(dir + entry.name);
    assert(
      !text.includes(needle),
      `provider-exclusion leaked into ${entry.name}`,
    );
  }
});

/* ---------- unit: cached_parsed id stability ---------- */

Deno.test("criterion ids are stable across a re-validated cached parse", () => {
  const first = validateAIOutput({
    role_class: "nurse",
    specialties: ["cardiovascular"],
    specialty_tense: "any",
    min_years_experience: 5,
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>;
  const criteria1 = mapParsedToCriteria(first);
  // Simulate the client echoing `parsed` back as cached_parsed.
  const second = validateAIOutput(first) as unknown as Record<string, unknown>;
  const criteria2 = mapParsedToCriteria(second);
  assertEquals(
    criteria1.map((c) => `${c.id}:${c.kind}`),
    criteria2.map((c) => `${c.id}:${c.kind}`),
  );
});

/* ---------- round 2: elite gaps (2026-09-15) ---------- */

Deno.test("multi-location: Dallas or Houston ORs, never ANDs to zero", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    specialties: ["critical care"],
    required_keywords: ["icu"],
    location: { city: "dallas", state: "texas" },
    locations: [{ state: "texas", city: "houston" }, { state: "oklahoma" }],
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);
  const locs = criteria.filter((c) => c.kind === "location");
  assertEquals(locs.length, 3, "each location keeps its own positional criterion");

  const tree = buildClinicianQuery(criteria) as V2FilterBranch;
  // The top-level AND must contain exactly ONE location group (an OR of the
  // alternatives), not three AND'd location clauses.
  const topLocationNodes = tree.conditions.filter((n) =>
    leaves(n).every((l) => l.field.startsWith("basic_profile.location")) && leaves(n).length > 0
  );
  assertEquals(topLocationNodes.length, 1, "locations must collapse into one OR group");
  const group = topLocationNodes[0] as V2FilterBranch;
  assertEquals(group.op, "or");
  const stateValues = leaves(group).filter((l) => l.field === "basic_profile.location.state").map((l) => l.value);
  assert(stateValues.includes("texas"));
  assert(stateValues.includes("oklahoma"));
});

Deno.test("experience and tenure ranges emit floor and cap", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    specialties: ["critical care"],
    min_years_experience: 5,
    max_years_experience: 10,
    tenure_max_years: 2,
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);
  const exp = criteria.find((c) => c.kind === "experience");
  assertExists(exp);
  assertEquals(exp!.label, "5–10 years experience");
  const tree = buildClinicianQuery(criteria);
  const yoe = leaves(tree).filter((l) => l.field === "years_of_experience_raw");
  assertEquals(yoe.length, 2);
  assert(yoe.some((l) => l.type === "=>" && l.value === 5));
  assert(yoe.some((l) => l.type === "=<" && l.value === 10));
  const tenure = leaves(tree).filter((l) => l.field === "experience.employment_details.current.years_at_company_raw");
  assertEquals(tenure.length, 1);
  assertEquals(tenure[0].type, "=<");
  assertEquals(tenure[0].value, 2);
});

Deno.test("employer size: small practices cap headcount, large floors it", () => {
  const small = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["family medicine"],
    practice_size: "small",
    location: { state: "georgia" },
  }) as unknown as Record<string, unknown>);
  const sizeCriterion = small.find((c) => c.kind === "employer_size");
  assertExists(sizeCriterion);
  const smallTree = buildClinicianQuery(small);
  const smallLeaves = leaves(smallTree).filter((l) => l.field === "experience.employment_details.current.company_headcount_latest");
  assertEquals(smallLeaves.length, 1);
  assertEquals(smallLeaves[0].type, "=<");
  assertEquals(smallLeaves[0].value, 50);

  const large = mapParsedToCriteria(validateAIOutput({
    role_class: "nurse",
    specialties: ["oncology"],
    practice_size: "large",
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>);
  const largeTree = buildClinicianQuery(large);
  const largeLeaves = leaves(largeTree).filter((l) => l.field === "experience.employment_details.current.company_headcount_latest");
  assertEquals(largeLeaves.length, 1);
  assertEquals(largeLeaves[0].type, "=>");
});

Deno.test("resolved employer group (UMiami shape) builds ids + domains + variants in one OR", () => {
  // The shape index.ts writes after resolveEmployerGroup upgrades a company
  // criterion — probed live 2026-09-15.
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["cardiology"],
    current_companies: ["university of miami"],
    location: {},
  }) as unknown as Record<string, unknown>);
  const company = criteria.find((c) => c.kind === "company");
  assertExists(company);
  company!.kind = "employer_group";
  company!.value = {
    group_key: "resolved:university of miami",
    name: "University of Miami",
    company_ids: [6052108, 6510636, 1142323, 6061457, 1346670],
    domains: ["miami.edu", "umiamihealth.org", "umiamihospital.com"],
    name_variants: [
      "university of miami",
      "university of miami health system",
      "university of miami miller school of medicine",
      "uhealth - university of miami health system",
    ],
  } as unknown as typeof company.value;

  const tree = buildClinicianQuery(criteria);
  const idLeaves = leaves(tree).filter((l) => l.field === "experience.employment_details.current.company_id");
  assertEquals(idLeaves.length, 1);
  assertEquals(idLeaves[0].type, "in");
  assert(Array.isArray(idLeaves[0].value) && (idLeaves[0].value as number[]).includes(1142323));
  const domainLeaves = leaves(tree).filter((l) => l.field === "experience.employment_details.current.company_website_domain");
  assert(domainLeaves.some((l) => l.value === "umiamihealth.org"));
  const nameLeaves = leaves(tree).filter((l) => l.field === "experience.employment_details.current.company_name");
  assert(nameLeaves.some((l) => String(l.value).includes("uhealth")));
});

Deno.test("compound chain query holds every filter at once", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    credentials: ["ccrn"],
    specialties: ["critical care"],
    required_keywords: ["icu"],
    practice_size: "large",
    min_years_experience: 5,
    max_years_experience: 15,
    past_companies: ["hca healthcare"],
    location: { city: "dallas", state: "texas" },
    locations: [{ state: "texas", city: "houston" }],
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);
  const kinds = new Set(criteria.map((c) => c.kind));
  for (const k of ["role_class", "credential", "specialty", "employer_size", "experience", "past_company", "location"]) {
    assert(kinds.has(k as never), `compound query lost criterion kind: ${k}`);
  }
  const tree = buildClinicianQuery(criteria);
  assertExists(tree);
  // Past employer is AND'd (career chain), not OR'd with locations/employers.
  const pastLeaves = leaves(tree).filter((l) => l.field === "experience.employment_details.past.company_name");
  assertEquals(pastLeaves.length, 1);
});

/* ---------- round 3: subspecialty depth + hyper-local geo (2026-09-15) ---------- */

Deno.test("subspecialty: joint reconstruction splits from parent and ANDs with it", () => {
  const parsed = validateAIOutput({
    role_class: "physician",
    specialties: ["joint reconstruction", "orthopedic"],
    specialty_tense: "current",
    location: { city: "golden", state: "colorado" },
    locations: [{ state: "colorado", city: "boulder" }],
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const specialtyCriteria = criteria.filter((c) => c.kind === "specialty");
  assertEquals(specialtyCriteria.length, 2, "subspecialty and parent must be separate ANDed criteria");
  const sub = specialtyCriteria.find((c) => {
    const v = c.value as SpecialtyValue;
    return !!v.subspecialty;
  });
  assertExists(sub, "joint reconstruction must be flagged as a subspecialty");
  const sv = sub!.value as SpecialtyValue;
  assertEquals(sv.subspecialty!.label, "Joint Reconstruction");
  // Procedure vocabulary present (probed live: skills carry the arthroplasty ladder).
  for (const t of ["arthroplasty", "joint replacement", "total joint", "adult reconstruction"]) {
    assert(sv.terms.includes(t), `missing procedure term: ${t}`);
  }
  assert(sv.subspecialty!.siblings.includes("spine"));

  const tree = buildClinicianQuery(criteria);
  // Fellowship surfaces join the subspecialty OR (education field_of_study/degree).
  const eduLeaves = leaves(tree).filter((l) =>
    (l.field === "education.schools.field_of_study" || l.field === "education.schools.degree") &&
    String(l.value).includes("reconstruction")
  );
  assert(eduLeaves.length > 0, "fellowship education surfaces missing from subspecialty group");

  // The parent 'orthopedic' terms must NOT sit in the same OR-group as the
  // subspecialty terms (they would satisfy the group alone and dilute the ask).
  const branch = tree as V2FilterBranch;
  const groupsWithArthroplasty = branch.conditions.filter((n) =>
    leaves(n).some((l) => String(l.value).includes("arthroplasty"))
  );
  for (const g of groupsWithArthroplasty) {
    assert(
      !leaves(g).some((l) => String(l.value) === "orthopedic"),
      "parent specialty term leaked into the subspecialty OR-group",
    );
  }

  // Hyper-local: each city gets a geo_distance circle alternative.
  const geoLeaves = leaves(tree).filter((l) => l.type === "geo_distance");
  const geoLocs = geoLeaves.map((l) => (l.value as { location?: string }).location ?? "");
  assert(geoLocs.some((s) => s.includes("golden")), "Golden geo circle missing");
  assert(geoLocs.some((s) => s.includes("boulder")), "Boulder geo circle missing");
});

Deno.test("subspecialty asks always earn a semantic pass, even with a named employer", async () => {
  const { semanticWorthRunning } = await import("./semantic-recall.ts");
  const withEmployer = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["joint reconstruction", "orthopedic"],
    current_companies: ["uchealth"],
    location: { state: "colorado" },
  }) as unknown as Record<string, unknown>);
  assert(semanticWorthRunning(withEmployer), "subspecialty + employer must still run semantic recall");

  const genericWithEmployer = mapParsedToCriteria(validateAIOutput({
    role_class: "nurse",
    specialties: ["cardiovascular"],
    current_companies: ["uchealth"],
    location: { state: "colorado" },
  }) as unknown as Record<string, unknown>);
  assert(!semanticWorthRunning(genericWithEmployer), "generic specialty + employer keeps the old gate");
});

Deno.test("subspecialty depth across verticals: neurovascular and structural heart", () => {
  const neuro = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["neurovascular", "neurology"],
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>);
  const neuroSub = neuro.find((c) => c.kind === "specialty" && !!(c.value as SpecialtyValue).subspecialty);
  assertExists(neuroSub);
  const nv = (neuroSub!.value as SpecialtyValue);
  assert(nv.terms.includes("thrombectomy"));
  assert(nv.terms.includes("neurointerventional"));

  const sh = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["structural heart", "cardiology"],
    location: { state: "florida" },
  }) as unknown as Record<string, unknown>);
  const shSub = sh.find((c) => c.kind === "specialty" && !!(c.value as SpecialtyValue).subspecialty);
  assertExists(shSub);
  assert((shSub!.value as SpecialtyValue).terms.includes("tavr"));
});

Deno.test("grader context carries the subspecialty sibling map", async () => {
  const { buildAuditUserMessage } = await import("./audit.ts");
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["joint reconstruction", "orthopedic"],
    location: { state: "colorado" },
  }) as unknown as Record<string, unknown>);
  const msg = buildAuditUserMessage("joint reconstruction orthopedic surgeons in golden colorado", criteria, [], 0);
  assert(msg.includes("SUBSPECIALTY: Joint Reconstruction"));
  assert(msg.includes("spine"), "sibling map missing from grader context");
});

/* ---------- round 4: fellowship, workplace setting, stage+state (2026-09-15) ---------- */

Deno.test("fellowship trained cardiovascular surgeons: qualifier + surgical subspecialty", () => {
  const parsed = validateAIOutput({
    role_class: "physician",
    fellowship_trained: true,
    specialties: ["cardiovascular surgery"],
    specialty_tense: "current",
    location: {},
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const fellowship = criteria.find((c) => c.kind === "fellowship");
  assertExists(fellowship, "fellowship_trained must become a hard qualifier criterion");
  assertEquals(fellowship!.enforcement, "hard");

  // "cardiovascular surgery" hits the cv_surgery subspecialty, not cardiology.
  const sub = criteria.find((c) => c.kind === "specialty" && !!(c.value as SpecialtyValue).subspecialty);
  assertExists(sub);
  const sv = sub!.value as SpecialtyValue;
  assertEquals(sv.subspecialty!.key === "cv_surgery", true);
  assert(sv.terms.includes("cardiothoracic"));

  const tree = buildClinicianQuery(criteria);
  const allLeaves = leaves(tree);
  // Fellowship gate spans education degree, past fellow titles, and
  // self-description spellings.
  assert(allLeaves.some((l) => l.field === "education.schools.degree" && l.value === "fellowship"));
  assert(allLeaves.some((l) => l.field === "experience.employment_details.past.title" && l.value === "fellow"));
  assert(allLeaves.some((l) => l.field === "basic_profile.headline" && l.value === "fellowship-trained"));
});

Deno.test("nurses that work in surgery centers: setting becomes a hard employer-name gate", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    care_setting: "asc",
    care_setting_is_workplace: true,
    specialties: [],
    location: { state: "south carolina" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const setting = criteria.find((c) => c.kind === "care_setting");
  assertExists(setting);
  assertEquals(setting!.enforcement, "hard", "workplace setting must be hard");

  const tree = buildClinicianQuery(criteria);
  const nameLeaves = leaves(tree).filter((l) => l.field === "experience.employment_details.current.company_name");
  assert(nameLeaves.some((l) => l.value === "surgery center"));
  assert(nameLeaves.some((l) => l.value === "surgical center"));
  // And the state holds.
  assert(leaves(tree).some((l) => l.field === "basic_profile.location.state" && l.value === "south carolina"));

  // Soft preference stays soft (no employer-name leaves).
  const soft = mapParsedToCriteria(validateAIOutput({
    role_class: "nurse",
    care_setting: "asc",
    care_setting_is_workplace: false,
    specialties: ["perioperative"],
    location: { state: "south carolina" },
  }) as unknown as Record<string, unknown>);
  const softSetting = soft.find((c) => c.kind === "care_setting");
  assertExists(softSetting);
  assertEquals(softSetting!.enforcement, "soft");
});

Deno.test("current third year orthopedic residents in Tennessee: stage terms carry both spellings", () => {
  const parsed = validateAIOutput({
    role_class: "resident",
    training_stage: { profession: "orthopedic", stage: "residency", year: 3 },
    specialties: ["orthopedic"],
    specialty_tense: "current",
    current_role_only: true,
    location: { state: "tennessee" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const stage = criteria.find((c) => c.kind === "training_stage");
  assertExists(stage);
  const sv = stage!.value as TrainingStageValue;
  assertEquals(sv.year, 3);
  assert(sv.title_terms.includes("orthopedic resident"));

  const tree = buildClinicianQuery(criteria);
  const titleValues = leaves(tree)
    .filter((l) => l.field === "experience.employment_details.current.title")
    .map((l) => String(l.value));
  // ae/e connector family covers the dominant British spelling.
  assert(titleValues.some((v) => v.includes("orthopaedic") && v.includes("resident")), "orthopaedic resident spelling missing");
  assert(leaves(tree).some((l) => l.field === "basic_profile.location.state" && l.value === "tennessee"));
  // Ortho residency is 5 years — the year-3 window centers on a 2024 summer
  // start for an autumn-2026 search.
  const w = stageStartWindow(3, new Date("2026-09-15T00:00:00Z"));
  assert(w.from < new Date("2024-07-01") && new Date("2024-07-01") < w.to);
});

/* ---------- round 5: ranking + recall gap closure (2026-09-15) ---------- */

Deno.test("soft criteria actually rank: widened specialty puts specialists first", async () => {
  const { rankDeterministic } = await import("./soft-rank.ts");
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "nurse",
    specialties: ["cardiovascular"],
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>);
  // Simulate the auto-widen ladder demoting the specialty to soft.
  const spec = criteria.find((c) => c.kind === "specialty")!;
  spec.enforcement = "soft";

  const generic = { headline: "Registered Nurse", job_title: "RN", experience_history: [] };
  const specialist = {
    headline: "CVICU Registered Nurse | cardiovascular critical care",
    job_title: "RN",
    experience_history: [],
  };
  const ranked = rankDeterministic([generic, specialist] as never[], criteria) as Array<Record<string, unknown>>;
  assertEquals(ranked[0].headline, specialist.headline, "the demoted specialty must still rank specialists first");
  assert((ranked[0].soft_score as number) > (ranked[1].soft_score as number));
  assert((ranked[0].soft_matches as string[]).length > 0);
});

Deno.test("soft care-setting preference scores the ASC-named employer first", async () => {
  const { scoreSoftCriteria } = await import("./soft-rank.ts");
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "nurse",
    care_setting: "asc",
    care_setting_is_workplace: false,
    specialties: ["perioperative"],
    location: { state: "south carolina" },
  }) as unknown as Record<string, unknown>);
  const ascRow = { job_company_name: "Palmetto Surgery Center", headline: "PACU RN" };
  const hospitalRow = { job_company_name: "Prisma Health Richland Hospital", headline: "PACU RN" };
  const a = scoreSoftCriteria(ascRow as never, criteria);
  const b = scoreSoftCriteria(hospitalRow as never, criteria);
  assert(a.score > b.score, "ASC-named employer must outscore the hospital on an ASC preference");
});

Deno.test("credential evidence tier attaches a verbatim snippet and outranks unevidenced rows", async () => {
  const { rankDeterministic } = await import("./soft-rank.ts");
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "nurse",
    credentials: ["ccrn"],
    specialties: ["critical care"],
    location: { state: "texas" },
  }) as unknown as Record<string, unknown>);
  const evidenced = {
    headline: "ICU Nurse, BSN, CCRN — cardiovascular ICU",
    job_title: "ICU Registered Nurse",
    experience_history: [],
  };
  const bare = { headline: "ICU Nurse", job_title: "ICU Registered Nurse", experience_history: [] };
  const ranked = rankDeterministic([bare, evidenced] as never[], criteria) as Array<Record<string, unknown>>;
  assertEquals(ranked[0].headline, evidenced.headline);
  assert(String(ranked[0].evidence_snippet ?? "").toLowerCase().includes("ccrn"));
});

Deno.test("lexicalVariants closes the singular/plural whole-word gap", async () => {
  const { lexicalVariants } = await import("./build-clinician-query.ts");
  assert(lexicalVariants("orthopedic").includes("orthopedics"));
  assert(lexicalVariants("surgery center").includes("surgery centers"));
  assert(lexicalVariants("orthopedics").includes("orthopedic"));
  // ae/e + plural compose.
  assert(lexicalVariants("orthopedic").includes("orthopaedics"));
});

Deno.test("zero-result remarks reorder the widen ladder toward the culprit", async () => {
  const { reorderLadderByRemarks } = await import("./widen-criteria.ts");
  const ladder = [
    { kind: "fellowship", note: "" },
    { kind: "specialty", note: "" },
    { kind: "credential", note: "" },
    { kind: "employer_size", note: "" },
    { kind: "care_setting", note: "" },
  ];
  const remarks = [{
    code: "condition_eliminates_all",
    path: "filters.conditions[2]",
    message: "experience.employment_details.current.company_headcount_latest =< 50 removes every result (312 match without it).",
  }];
  const reordered = reorderLadderByRemarks(ladder, remarks as never);
  assertEquals(reordered[0].kind, "employer_size", "the culprit rung must move first");
  assertEquals(reordered.length, ladder.length);
  // No remarks → order unchanged.
  assertEquals(reorderLadderByRemarks(ladder, [])[0].kind, "fellowship");
});

/* ---------- round 6: population-modified subspecialty at a health system ---------- */

Deno.test("pediatric oncologists: dedicated peds hem-onc family, no adult-oncology dilution", () => {
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["pediatric oncology"],
    specialty_tense: "current",
    current_companies: ["vanderbilt health system"],
    location: {},
  }) as unknown as Record<string, unknown>);

  const sub = criteria.find((c) => c.kind === "specialty" && !!(c.value as SpecialtyValue).subspecialty);
  assertExists(sub, "pediatric oncology must hit the peds_hem_onc subspecialty family");
  const sv = sub!.value as SpecialtyValue;
  assertEquals(sv.subspecialty!.key === "peds_hem_onc", true);
  // Every term in the family carries the population — bare "oncology" never
  // appears, so an adult oncologist cannot satisfy the group.
  assert(sv.terms.every((t) => !/^oncolog/.test(t)), "bare oncology term leaked into the peds group");
  assert(sv.subspecialty!.siblings.includes("adult oncology"));

  const tree = buildClinicianQuery(criteria);
  const values = leaves(tree).map((l) => String(l.value).toLowerCase());
  assert(!values.includes("oncology"), "bare 'oncology' must not be a filter value for a pediatric ask");
  // Connector spellings of the fellowship phrase survive to the tree.
  assert(values.some((v) => v.includes("hematology/oncology") || v.includes("hematology-oncology") || v.includes("hematology oncology")));
});

Deno.test("generic population split: pediatric cardiology ANDs population with specialty", () => {
  const criteria = mapParsedToCriteria(validateAIOutput({
    role_class: "physician",
    specialties: ["pediatric cardiology"],
    specialty_tense: "current",
    location: { state: "tennessee" },
  }) as unknown as Record<string, unknown>);

  const specialtyCriteria = criteria.filter((c) => c.kind === "specialty");
  assertEquals(specialtyCriteria.length, 2, "modifier compound must split into population + specialty criteria");
  const population = specialtyCriteria.find((c) => c.label.includes("population"));
  assertExists(population);
  const pv = population!.value as SpecialtyValue;
  assert(pv.terms.includes("pediatric"));
  assert(pv.terms.includes("paediatric"));
  const specialty = specialtyCriteria.find((c) => !c.label.includes("population"))!;
  const stv = specialty.value as SpecialtyValue;
  assert(stv.terms.includes("cardiology"), "base specialty must be matchable");
  assert(stv.terms.includes("pediatric cardiology"), "compound phrase stays in the specialty group");

  // In the tree: the pediatric group and the cardiology group are SEPARATE
  // AND-ed OR-groups — an adult cardiologist satisfies one, never both.
  const tree = buildClinicianQuery(criteria) as V2FilterBranch;
  const groupHasBoth = tree.conditions.some((n) => {
    const vals = leaves(n).map((l) => String(l.value).toLowerCase());
    return vals.includes("pediatric") && vals.includes("cardiology");
  });
  assert(!groupHasBoth, "population and specialty must not share one OR-group");
});

/* ---------- round 7: multi-class OR + South Florida (2026-09-15) ---------- */

Deno.test("CRNAs and SRNAs in South Florida: classes union, region resolves", () => {
  const parsed = validateAIOutput({
    role_class: null,
    role_classes: ["crna", "srna"],
    specialties: [],
    location: { state: "florida", region_key: "south_florida" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  const rc = criteria.filter((c) => c.kind === "role_class");
  assertEquals(rc.length, 1, "multiple classes must union into ONE OR criterion, never AND");
  const terms = (rc[0].value as { terms: string[] }).terms;
  for (const t of ["crna", "srna", "nurse anesthesia student", "rrna", "nurse anesthesiologist", "nurse anesthesist"]) {
    assert(terms.includes(t), `missing class term: ${t}`);
  }
  assert(rc[0].label.includes("CRNA") && rc[0].label.includes("SRNA"));

  const loc = criteria.find((c) => c.kind === "location");
  assertExists(loc);
  assertEquals(loc!.label, "South Florida");

  const tree = buildClinicianQuery(criteria);
  const allLeaves = leaves(tree);
  // Region = florida clip AND OR of the Miami + West Palm circles.
  assert(allLeaves.some((l) => l.field === "basic_profile.location.state" && l.value === "florida"));
  const geo = allLeaves.filter((l) => l.type === "geo_distance");
  assertEquals(geo.length, 2, "South Florida must emit both metro circles");
  // Class terms land on current titles.
  const titleValues = allLeaves
    .filter((l) => l.field === "experience.employment_details.current.title")
    .map((l) => String(l.value));
  assert(titleValues.includes("srna"));
  assert(titleValues.includes("crna"));
});

Deno.test("region phrase backstop: 'south florida' in raw query resolves the region key", async () => {
  const { reconcileParsedClinicianIntent } = await import("./clinician-criteria.ts");
  const parsed = validateAIOutput({
    role_classes: ["crna", "srna"],
    location: { state: "florida" },
  }) as unknown as Record<string, unknown>;
  const reconciled = reconcileParsedClinicianIntent(parsed, "find me all of the students, CRNAs and SRNAs in South Florida");
  const loc = reconciled.location as Record<string, unknown>;
  assertEquals(loc.region_key, "south_florida");
});

/* ---------- round 8: the regional gazetteer (2026-09-15) ---------- */

Deno.test("regional gazetteer: every table entry builds a valid location group", async () => {
  const { SUB_STATE_REGIONS, MULTI_STATE_REGIONS } = await import("./clinician-criteria.ts");
  // Metros: clip states AND circles.
  for (const [key, region] of Object.entries(SUB_STATE_REGIONS)) {
    const criteria = mapParsedToCriteria(validateAIOutput({
      role_class: "nurse",
      specialties: ["critical care"],
      location: { state: region.state, region_key: key },
    }) as unknown as Record<string, unknown>);
    const loc = criteria.find((c) => c.kind === "location");
    assertExists(loc, `region ${key}: no location criterion`);
    assertEquals(loc!.label, region.label);
    const tree = buildClinicianQuery(criteria);
    const geo = leaves(tree).filter((l) => l.type === "geo_distance");
    assertEquals(geo.length, region.circles.length, `region ${key}: circle count`);
    const clipStates = leaves(tree)
      .filter((l) => l.field === "basic_profile.location.state")
      .map((l) => l.value);
    for (const s of region.states ?? [region.state]) {
      assert(clipStates.includes(s), `region ${key}: missing clip state ${s}`);
    }
    // Never `in` on states.
    assert(
      leaves(tree).every((l) => l.field !== "basic_profile.location.state" || l.type === "="),
      `region ${key}: state leaf must use '='`,
    );
  }
  // Multi-state bands: or() of '=' leaves, one per state.
  for (const [key, region] of Object.entries(MULTI_STATE_REGIONS)) {
    const criteria = mapParsedToCriteria(validateAIOutput({
      role_class: "nurse",
      specialties: ["critical care"],
      location: { region_key: key },
    }) as unknown as Record<string, unknown>);
    const tree = buildClinicianQuery(criteria);
    const clipStates = leaves(tree)
      .filter((l) => l.field === "basic_profile.location.state")
      .map((l) => l.value);
    assertEquals(clipStates.length, region.states.length, `band ${key}: state leaf count`);
  }
});

Deno.test("border-straddling metros clip to every state and widen to the full set", async () => {
  const { reconcileParsedClinicianIntent } = await import("./clinician-criteria.ts");
  const { applyRelaxations } = await import("./widen-criteria.ts");
  // DMV spans DC/MD/VA.
  const parsed = reconcileParsedClinicianIntent(
    validateAIOutput({
      role_class: "nurse",
      specialties: ["critical care"],
      location: {},
    }) as unknown as Record<string, unknown>,
    "ICU nurses in the DMV",
  );
  const criteria = mapParsedToCriteria(parsed);
  const loc = criteria.find((c) => c.kind === "location")!;
  assertEquals(loc.label, "DMV (DC–Maryland–Virginia)");
  const tree = buildClinicianQuery(criteria);
  const clipStates = leaves(tree)
    .filter((l) => l.field === "basic_profile.location.state")
    .map((l) => l.value);
  for (const s of ["district of columbia", "maryland", "virginia"]) {
    assert(clipStates.includes(s), `DMV missing clip state ${s}`);
  }
  // city_to_state widen relaxes the metro to ALL three states.
  const { criteria: widened, relaxed } = applyRelaxations(criteria, [], true);
  const widenedLoc = widened.find((c) => c.kind === "location")!;
  assertEquals((widenedLoc.value as { level: string }).level, "multi_state");
  assertEquals(((widenedLoc.value as { states: string[] }).states).length, 3);
  assert(relaxed.length === 1);
});

Deno.test("regional phrase backstops resolve nicknames from the raw query", async () => {
  const { reconcileParsedClinicianIntent } = await import("./clinician-criteria.ts");
  const cases: Array<[string, string]> = [
    ["nurses in chicagoland", "chicagoland"],
    ["CRNAs in the tri-state area", "nyc_metro"],
    ["PTs in the research triangle", "research_triangle"],
    ["physicians on the gulf coast", "gulf_coast"],
    ["nurses in the carolinas", "carolinas"],
    ["ICU nurses in the mid-atlantic", "mid_atlantic"],
    ["hospitalists in the front range", "front_range"],
    ["nurses in tampa bay", "tampa_bay"],
  ];
  for (const [query, expected] of cases) {
    const parsed = reconcileParsedClinicianIntent(
      validateAIOutput({ role_class: "nurse", location: {} }) as unknown as Record<string, unknown>,
      query,
    );
    assertEquals(
      (parsed.location as Record<string, unknown>).region_key,
      expected,
      `phrase backstop failed for: ${query}`,
    );
  }
});

Deno.test("parser prompt region enum stays in sync with the tables", async () => {
  const src = await Deno.readTextFile(
    new URL("./parse-query.ts", import.meta.url).pathname,
  );
  // The enum is generated from the tables at prompt-build time — the source
  // must reference both tables, not a hand-typed list.
  assert(src.includes("Object.keys(SUB_STATE_REGIONS)"));
  assert(src.includes("Object.keys(MULTI_STATE_REGIONS)"));
});

Deno.test("a typed city beats a parser-volunteered region (Denver live failure)", async () => {
  const { reconcileParsedClinicianIntent } = await import("./clinician-criteria.ts");
  // Live failure 2026-09-15: "Find sports medicine surgeons in Denver,
  // Colorado." parsed with city=denver AND region_key=front_range; the
  // mapper let the region win, so the hard filter covered the whole Front
  // Range instead of Denver.
  const parsed = reconcileParsedClinicianIntent(
    validateAIOutput({
      role_class: "physician",
      specialty: "sports medicine",
      location: { city: "denver", state: "colorado", region_key: "front_range" },
    }) as unknown as Record<string, unknown>,
    "Find sports medicine surgeons in Denver, Colorado.",
  );
  const loc = parsed.location as Record<string, unknown>;
  assertEquals(loc.region_key, undefined, "hallucinated region must be dropped");
  const criteria = mapParsedToCriteria(parsed);
  const locCriterion = criteria.find((c) => c.kind === "location");
  assert(locCriterion, "location criterion required");
  const v = locCriterion.value as { level: string; city?: string; state?: string };
  assertEquals(v.level, "city", "must be a hard city-level filter");
  assertEquals(v.city, "denver");
  assertEquals(v.state, "colorado");

  // A genuine region ask keeps the region even when a city sneaks in.
  const regionParsed = reconcileParsedClinicianIntent(
    validateAIOutput({
      role_class: "physician",
      location: { city: "denver", state: "colorado", region_key: "front_range" },
    }) as unknown as Record<string, unknown>,
    "sports medicine surgeons in the front range",
  );
  assertEquals(
    (regionParsed.location as Record<string, unknown>).region_key,
    "front_range",
    "explicit region phrase keeps the region",
  );
  const regionCriteria = mapParsedToCriteria(regionParsed);
  const regionLoc = regionCriteria.find((c) => c.kind === "location");
  assertEquals((regionLoc?.value as { level: string }).level, "region");
});

Deno.test("city with no state stays a hard location, never a nationwide search", () => {
  const parsed = validateAIOutput({
    role_class: "nurse",
    location: { city: "denver" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);
  const loc = criteria.find((c) => c.kind === "location" && c.source === "user");
  assert(loc, "state-less city must still produce a location criterion");
  const v = loc.value as { level: string; city?: string; state?: string };
  assertEquals(v.level, "city");
  assertEquals(v.city, "denver");
  assertEquals(v.state, undefined);
  const tree = buildClinicianQuery(criteria);
  assert(tree, "query must build");
  const s = JSON.stringify(tree);
  assert(s.includes("geo_distance"), "city-only location must carry a geo circle");
  assert(s.includes("denver"), "city name must appear in the filter");
});

Deno.test("empty-intent criteria are detectable (guard input)", () => {
  // Location-only parse — the handler's guard refuses to search on this.
  const parsed = validateAIOutput({
    location: { city: "nashville", state: "tennessee" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);
  const INTENT_KINDS = new Set([
    "role_class", "specialty", "title", "company", "past_company",
    "employer_group", "credential", "care_setting", "fellowship",
    "training_stage", "seniority", "keyword",
  ]);
  assertEquals(
    criteria.some((c) => INTENT_KINDS.has(c.kind) && c.enforcement !== "dropped"),
    false,
    "a location-only parse must carry no intent criteria",
  );
});

Deno.test("adaptive radius + headline role matching (Aspen recall fix)", () => {
  // Live probe 2026-09-15: 15mi/title-only found 15 people; 50mi + headline
  // matching found 113 — including Steadman's "Medical Director - Aspen"
  // whose surgeon identity lives only in his headline.
  const parsed = validateAIOutput({
    role_class: "physician",
    specialty: "orthopedics",
    location: { city: "aspen", state: "colorado" },
  }) as unknown as Record<string, unknown>;
  const criteria = mapParsedToCriteria(parsed);

  // Default: tight 15mi circle.
  const tight = JSON.stringify(buildClinicianQuery(criteria));
  assert(tight.includes('"distance":15'), "default city radius is 15mi");

  // Role-class terms must gate on the HEADLINE as well as the title.
  assert(
    tight.includes('"basic_profile.headline","type":"[.]","value":"surgeon"'),
    "role class must match headlines too",
  );

  // Thin-city widen: radius_mi=50 on the location value re-draws the circle.
  const loc = criteria.find((c) => c.kind === "location")!;
  (loc.value as { radius_mi?: number }).radius_mi = 50;
  const wide = JSON.stringify(buildClinicianQuery(criteria));
  assert(wide.includes('"distance":50'), "radius_mi=50 widens the circle");
  assert(!wide.includes('"distance":15'), "widened tree drops the 15mi circle");
});
