import { assert, assertEquals } from "jsr:@std/assert";
import { mapParsedToCriteria, isBedsideLeadAsk } from "./clinician-criteria.ts";

Deno.test("OR nurse in orthopedics: unit and service line are separate requirements", () => {
  const c = (mapParsedToCriteria as any)({ role_class: "nurse", specialties: ["orthopedic perioperative", "operating room", "perioperative", "orthopedic"] });
  const specs = (Array.isArray(c) ? c : c.criteria).filter((x: any) => x.kind === "specialty");
  assertEquals(specs.length, 2);
  const unit = specs.find((s: any) => s.value.terms.includes("operating room"));
  const ortho = specs.find((s: any) => s.value.terms.some((t: string) => t.includes("orthop")));
  assert(unit && ortho && unit !== ortho);
  assert(!ortho.value.terms.some((t: string) => t.includes("operating room") || t.includes("perioperative")));
});

Deno.test("Charge nurse never becomes a Director seniority filter", () => {
  assert(isBedsideLeadAsk({ job_titles: ["charge nurse"] }));
  const c = (mapParsedToCriteria as any)({ role_class: "nurse", job_titles: ["charge nurse"], seniority_levels: ["Director"] });
  assertEquals((Array.isArray(c) ? c : c.criteria).filter((x: any) => x.kind === "seniority").length, 0);
});

Deno.test("A specific nursing title never inherits a hard seniority filter", () => {
  for (const title of ["emergency room nurse manager", "director of nursing"]) {
    const c = (mapParsedToCriteria as any)({ role_class: "nurse", job_titles: [title], seniority_levels: ["Director"] });
    const criteria = Array.isArray(c) ? c : c.criteria;
    assertEquals(criteria.filter((x: any) => x.kind === "seniority").length, 0);
    assertEquals(criteria.filter((x: any) => x.kind === "title").length, 1);
  }
});

Deno.test("A generic nurse-leader ask keeps its explicit seniority filter", () => {
  const c = (mapParsedToCriteria as any)({ role_class: "nurse", job_titles: [], seniority_levels: ["Director"] });
  assertEquals((Array.isArray(c) ? c : c.criteria).filter((x: any) => x.kind === "seniority").length, 1);
});
