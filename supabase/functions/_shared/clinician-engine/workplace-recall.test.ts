import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildWorkplaceRecallCriteria, buildWorkplaceRecallPasses, collectWorkplaceAnchors, statedResidentYearTextFilter } from "./workplace-recall.ts";

const location = { id: "loc", kind: "location", enforcement: "hard", value: { level: "city", city: "boston", state: "massachusetts" } } as any;
const training = { id: "stage", kind: "training_stage", enforcement: "hard", value: { stage: "residency", title_terms: ["resident"] } } as any;
const specialty = { id: "specialty", kind: "specialty", enforcement: "hard", value: { terms: ["orthopedic"] } } as any;
const interest = { id: "interest", kind: "specialty", enforcement: "soft", value: { terms: ["sports medicine"] } } as any;
const rows = [
  { current_employers: [{ title: "Orthopedic Surgery Resident", name: "Boston Medical Center", crustdata_company_id: 10 }] },
  { current_employers: [{ title: "Orthopaedic Surgery Resident", name: "Boston Medical Center", crustdata_company_id: 10 }] },
  { current_employers: [{ title: "Orthopedic Surgery Resident", name: "Mass General Brigham", crustdata_company_id: 20 }] },
  { current_employers: [{ title: "Attending Surgeon", name: "Should Not Become An Anchor", crustdata_company_id: 30 }] },
];

Deno.test("local trainee employers become location-free recall anchors", () => {
  const anchors = collectWorkplaceAnchors(rows);
  assertEquals(anchors.company_ids, [10, 20]);
  assertEquals(anchors.name_variants, ["boston medical center", "mass general brigham"]);
  const recalled = buildWorkplaceRecallCriteria([location, training, specialty, interest], rows);
  assert(recalled);
  assert(!recalled.some((c) => c.kind === "location" && (c.value as any).level === "city"));
  const group = recalled.find((c) => c.id === "workplace_recall")!.value as any;
  assertEquals(group.company_ids, [10, 20]);
  assert(recalled.some((c) => c.id === "specialty" && c.enforcement === "hard"));
  assert(recalled.some((c) => c.id === "interest" && c.enforcement === "soft"));
});

Deno.test("curated programs and learned employers share one workplace pass", () => {
  const recalled = buildWorkplaceRecallCriteria([location, training, specialty], rows, ["boston children's hospital"]);
  const group = recalled!.find((c) => c.id === "workplace_recall")!.value as any;
  assertEquals(group.name_variants, ["boston children's hospital", "boston medical center", "mass general brigham"]);
});

Deno.test("a named employer is searched without the trainee's stale home city", () => {
  const company = { id: "company", kind: "company", enforcement: "hard", value: { name: "Vanderbilt University Medical Center", tense: "current" } } as any;
  const recalled = buildWorkplaceRecallCriteria([location, training, specialty, company], []);
  assert(recalled);
  assert(!recalled.some((c) => c.kind === "location"));
  assert(recalled.some((c) => c.id === "company"));
  assert(!recalled.some((c) => c.id === "workplace_recall"));
});

Deno.test("ordinary non-trainee searches do not get a nationwide workplace pass", () => {
  assertEquals(buildWorkplaceRecallCriteria([location, specialty], rows), null);
});

Deno.test("each program gets its own pass and uncovered local employers are retained", () => {
  const passes = buildWorkplaceRecallPasses(
    [location, training, specialty, interest],
    rows,
    [["boston medical center", "boston university"], ["boston children's hospital"]],
  );
  assertEquals(passes.length, 3);
  const groups = passes.map((pass) => {
    const group = pass.find((c) => c.kind === "employer_group")!.value as any;
    return group.name_variants;
  });
  assertEquals(groups, [
    ["boston medical center", "boston university"],
    ["boston children's hospital"],
    ["mass general brigham"],
  ]);
  for (const pass of passes) {
    assert(!pass.some((c) => c.kind === "location" && (c.value as any).level === "city"));
    assert(pass.some((c) => c.id === "specialty" && c.enforcement === "hard"));
    assert(pass.some((c) => c.id === "interest" && c.enforcement === "soft"));
  }
});

Deno.test("stated-year recall searches only the requested PGY spellings on profile evidence", () => {
  const filter = statedResidentYearTextFilter([4, 5])!;
  const serialized = JSON.stringify(filter);
  for (const term of ["pgy-4", "pgy 4", "pgy4", "pgy-5", "pgy 5", "pgy5"]) assert(serialized.includes(term));
  assert(!serialized.includes("pgy-3"));
  assert(!serialized.includes("pgy-6"));
  assertEquals((filter.conditions as unknown[]).length, 18);
  assertEquals(statedResidentYearTextFilter([]), null);
});
