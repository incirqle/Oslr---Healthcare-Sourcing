/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import { normalizeClinicalIntent } from "../../supabase/functions/_shared/clinician-engine/clinical-intent";
import { mapParsedToCriteria } from "../../supabase/functions/_shared/clinician-engine/clinician-criteria";
import { buildClinicianQuery } from "../../supabase/functions/_shared/clinician-engine/build-clinician-query";
import { stageFit } from "../../supabase/functions/_shared/clinician-engine/match-scope";

type Node = { op?: string; conditions?: Node[]; field?: string; value?: unknown };
function leaves(node: Node | null): Node[] {
  if (!node) return [];
  return node.conditions ? node.conditions.flatMap(leaves) : [node];
}

describe("clinical intent reaches the real provider query", () => {
  it("keeps the NYC orthopedic resident gate and adds PGY-4 and PGY-5 date evidence", () => {
    const parsed = normalizeClinicalIntent({ location: { city: "new york", state: "new york" } }, "PGY-4/5 orthopedic residents in New York City");
    const criteria = mapParsedToCriteria(parsed);
    const training = criteria.find((c) => c.kind === "training_stage");
    expect(training?.value).toMatchObject({ years: [4, 5], stages: ["residency"] });
    expect(criteria.find((c) => c.kind === "role_class")?.value).toMatchObject({ class: "resident" });
    const nodes = leaves(buildClinicianQuery(criteria));
    expect(nodes.some((n) => n.field === "basic_profile.headline" && String(n.value).includes("resident"))).toBe(true);
    expect(nodes.some((n) => n.field === "experience.employment_details.current.description" && String(n.value).includes("resident"))).toBe(true);
    expect(nodes.every((n) => !/\bpgy\b/i.test(String(n.value)))).toBe(true);
  });

  it("supports residents or fellows and all spine parent programs", () => {
    const parsed = normalizeClinicalIntent({}, "PGY4 and PGY5 spine-focused residents or fellows in New York City");
    const criteria = mapParsedToCriteria(parsed);
    expect(criteria.find((c) => c.kind === "role_class")?.value).toMatchObject({ class: "resident+fellow" });
    const training = criteria.find((c) => c.kind === "training_stage")?.value as { title_terms: string[]; years: number[] };
    expect(training.years).toEqual([4, 5]);
    expect(training.title_terms).toContain("neurosurgery resident");
    expect(training.title_terms).toContain("orthopedic surgery fellow");
  });

  it("accepts any stated PGY year and any current resident/fellow role", () => {
    const fit = stageFit({
      current_employers: [
        { title: "Internal Medicine Resident", start_date: "2020-07-01", is_default: true },
        { title: "Orthopedic Spine Fellow", start_date: "2023-07-01" },
      ],
    }, {
      profession: "orthopedic surgery",
      professions: ["orthopedic surgery", "neurosurgery"],
      stage: "residency",
      stages: ["residency", "fellowship"],
      year: null,
      years: [4, 5],
      title_terms: ["resident", "fellow"],
    }, new Date("2026-11-13T00:00:00Z"));
    expect(fit).toBe("in_window");
  });

  it("does not let the old Austin parse re-admit general pediatricians or surgeons", () => {
    const parsed = normalizeClinicalIntent({
      role_class: "physician",
      specialty: "pediatric orthopedic",
      specialties: ["pediatric orthopedic", "non-operative orthopedic", "pediatrics", "orthopedic"],
      required_keywords: ["non-operative", "conservative", "pediatric", "orthopedic"],
      location: { city: "austin", state: "texas" },
    }, "Pediatric non-operative orthopedic physicians in Austin, Texas");
    const criteria = mapParsedToCriteria(parsed);
    expect(criteria.some((c) => c.kind === "practice_modality" && c.enforcement === "hard")).toBe(true);
    const nodes = leaves(buildClinicianQuery(criteria));
    const roleValues = nodes.filter((n) => n.field === "experience.employment_details.current.title").map((n) => String(n.value));
    expect(roleValues).toContain("sports medicine physician");
    expect(roleValues).not.toContain("surgeon");
    expect(nodes.every((n) => String(n.value) !== "non-operative orthopedic")).toBe(true);
  });
});
