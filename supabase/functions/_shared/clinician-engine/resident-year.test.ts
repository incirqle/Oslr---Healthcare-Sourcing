import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { assessResidentYear, residencyProgramRecall, sortByResidentYearTier, splitResidentYearRows } from "./resident-year.ts";

const NOW = new Date("2026-11-17T00:00:00Z");
const stage = { stage: "residency", stages: ["residency"], years: [4, 5], profession: "orthopedic surgery", professions: ["orthopedic surgery"], title_terms: [] } as any;
const criteria = [
  { id: "c0", kind: "location", enforcement: "hard", value: { level: "city", city: "new york city", state: "new york" } },
  { id: "c2", kind: "training_stage", enforcement: "hard", value: stage },
] as any;
const res = (title: string, start: string | null, extra: Record<string, unknown> = {}) => ({
  current_employers: [{ title, start_date: start, name: "NYU Langone Health" }], ...extra,
});

Deno.test("a current fellow is never shown in a resident search", () => {
  assertEquals(assessResidentYear(res("Complex Joint Reconstruction Fellow", "2026-08"), stage, NOW).status, "fellow");
  assertEquals(assessResidentYear({ current_employers: [
    { title: "Hand Fellow", start_date: "2026-08" }, { title: "Orthopaedic Surgery Resident", start_date: "2021-06" },
  ] }, stage, NOW).status, "fellow");
});

Deno.test("a resident applying to a sports fellowship stays a resident", () => {
  const a = assessResidentYear(res("Orthopedic Surgery Resident", "2021-06", { summary: "PGY4. Applying for 2026-2027 Sports Fellowship" }), stage, NOW);
  assertEquals(a.status, "stated");
  assertEquals(a.tier, 0);
  assertEquals(assessResidentYear(res("Orthopaedic Surgery Resident Research Fellow", "2022-06"), stage, NOW).status, "dated");
});

Deno.test("PGY-1, PGY-2 and PGY-3 are removed, written or dated", () => {
  assertEquals(assessResidentYear(res("Orthopedic Surgery Resident", "2024-07"), stage, NOW).status, "junior");
  assertEquals(assessResidentYear(res("Orthopedic Surgery Resident", "2025-07"), stage, NOW).status, "junior");
  assertEquals(assessResidentYear(res("Orthopedic Surgery Resident", "2026-05"), stage, NOW).status, "junior");
  assertEquals(assessResidentYear(res("Orthopedic Surgery Resident PGY-2", "2022-06"), stage, NOW).status, "other_year");
});

Deno.test("2020 through 2023 starts count as possible PGY-4/5", () => {
  for (const start of ["2020-07", "2021-06", "2022-06", "2023-07"]) {
    assertEquals(assessResidentYear(res("Orthopaedic Surgery Resident", start), stage, NOW).status, "dated", start);
  }
});

Deno.test("stale open residencies are removed and undated ones set aside", () => {
  assertEquals(assessResidentYear(res("Orthopedic Surgery Resident", "2013-07"), stage, NOW).status, "stale");
  assertEquals(assessResidentYear(res("Orthopedic Surgery Resident", null), stage, NOW).status, "undated");
  const split = splitResidentYearRows([res("Orthopedic Surgery Resident", null)], criteria, NOW);
  assertEquals(split.clean.length, 0);
  assertEquals((split.rejected[0] as any).audit_reason, "Training year not listed");
});

Deno.test("chief resident counts as final year", () => {
  assertEquals(assessResidentYear(res("Chief Resident, Orthopaedic Surgery", null), stage, NOW).status, "chief");
});

Deno.test("written PGY ranks above date estimates", () => {
  const split = splitResidentYearRows([
    res("Orthopedic Surgery Resident", "2022-06", { full_name: "dated" }),
    res("Orthopedic Surgery Resident", "2022-06", { full_name: "stated", headline: "PGY-5 Orthopaedic Surgery" }),
  ], criteria, NOW);
  assertEquals(sortByResidentYearTier(split.clean).map((r: any) => r.full_name), ["stated", "dated"]);
});

Deno.test("New York orthopedic resident searches also search the city's programs by name", () => {
  const recall = residencyProgramRecall(criteria);
  assert(recall);
  for (const p of ["nyu langone", "hospital for special surgery", "mount sinai", "montefiore", "columbia university irving", "suny downstate", "maimonides", "lenox hill", "one brooklyn health"]) {
    assert(recall.variants.includes(p), p);
  }
  assertEquals(residencyProgramRecall([criteria[0], { ...criteria[1], value: { ...stage, stages: ["residency", "fellowship"] } }] as any), null);
});

Deno.test("program recall never depends on sports-medicine interest", () => {
  const withSoftInterest = [...criteria, { id: "interest", kind: "specialty", enforcement: "soft", value: { terms: ["sports medicine"] } }] as any;
  assertEquals(residencyProgramRecall(withSoftInterest), residencyProgramRecall(criteria));
});

Deno.test("a research-year entry does not reset the residency start", () => {
  const row = { current_employers: [
    { title: "Orthopedic Surgery Resident Research Fellow", start_date: "2025-05" },
    { title: "Orthopedic Surgery Resident", start_date: "2021-05" },
  ] };
  assertEquals(assessResidentYear(row, stage, NOW).status, "dated");
});

Deno.test("residents in another specialty are not orthopedic residents", () => {
  for (const t of ["Emergency Medicine Resident Physician", "Urology Resident", "Internal Medicine Resident", "Emergency Medicine Physician Assistant Resident"]) {
    assertEquals(assessResidentYear(res(t, "2022-06"), stage, NOW).status, "not_resident", t);
  }
  assertEquals(assessResidentYear(res("Resident Physician", "2022-06"), stage, NOW).status, "not_resident");
  assertEquals(assessResidentYear(res("Resident Physician", "2022-06", { headline: "Resident Physician in Orthopaedic Surgery" }), stage, NOW).status, "dated");
  assertEquals(assessResidentYear({
    current_employers: [{ title: "Resident Physician", start_date: "2022-06", name: "NYU Langone Orthopedics" }],
  }, stage, NOW).status, "dated");
});
