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
    expect(training?.value).toMatchObject({ years: [4, 5], stages: ["residency"], senior_fellow_recall: false });
    expect(criteria.find((c) => c.kind === "role_class")?.value).toMatchObject({ class: "resident" });
    const nodes = leaves(buildClinicianQuery(criteria));
    expect(nodes.some((n) => n.field === "basic_profile.headline" && String(n.value).includes("resident"))).toBe(true);
    expect(nodes.some((n) => n.field === "experience.employment_details.current.description" && String(n.value).includes("resident"))).toBe(true);
    expect(nodes.some((n) => n.field === "experience.employment_details.current.title" && /\bfellow/i.test(String(n.value)))).toBe(false);
    expect(nodes.some((n) => n.field === "experience.employment_details.current.title" && String(n.value).includes("chief resident"))).toBe(true);
    expect(nodes.some((n) => n.field === "basic_profile.headline" && /pgy-?4/i.test(String(n.value)))).toBe(true);
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

  it("does not use education history to recall current fellows", () => {
    const parsed = normalizeClinicalIntent({}, "Current hand surgery fellows in New York");
    const criteria = mapParsedToCriteria(parsed);
    const nodes = leaves(buildClinicianQuery(criteria));
    expect(nodes.some((n) => n.field === "experience.employment_details.current.title")).toBe(true);
    expect(nodes.every((n) => !String(n.field).startsWith("education."))).toBe(true);
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

  it("uses stated PGY evidence before conflicting date estimates", () => {
    const stage = {
      profession: "orthopedic surgery",
      professions: ["orthopedic surgery"],
      stage: "residency" as const,
      stages: ["residency" as const],
      year: null,
      years: [4, 5],
      title_terms: ["resident"],
    };
    expect(stageFit({ current_employers: [{ title: "Orthopaedic Surgery Resident PGY-4", start_date: "2020-07-01" }] }, stage, new Date("2026-11-13T00:00:00Z"))).toBe("in_window");
    expect(stageFit({ current_employers: [{ title: "Orthopaedic Surgery Resident PGY-3", start_date: "2023-07-01" }] }, stage, new Date("2026-11-13T00:00:00Z"))).toBe("out_of_window");
    expect(stageFit({ current_employers: [{ title: "Chief Resident, Orthopaedic Surgery", start_date: "2026-07-01" }] }, stage, new Date("2026-11-13T00:00:00Z"))).toBe("in_window");
  });

  it("never treats a current sports-medicine fellow as a PGY-4/5 resident", () => {
    const fit = stageFit({ current_employers: [{ title: "Sports Medicine Fellow", start_date: "2026-07-01" }] }, {
      profession: "orthopedic surgery",
      professions: ["orthopedic surgery"],
      stage: "residency",
      stages: ["residency"],
      year: null,
      years: [4, 5],
      title_terms: ["orthopedic surgery resident", "resident"],
    }, new Date("2026-11-13T00:00:00Z"));
    expect(fit).not.toBe("in_window");
  });

  it("keeps orthopedics required while sports-medicine interest ranks profile evidence", () => {
    const parsed = normalizeClinicalIntent({
      specialty: "orthopedic surgery",
      specialties: ["orthopedic surgery", "sports medicine"],
      location: { city: "new york", state: "new york" },
    }, "PGY-4/5 orthopedic residents in New York City interested in sports medicine");
    const criteria = mapParsedToCriteria(parsed);
    const sports = criteria.find((c) => c.kind === "specialty" && c.label === "Sports Medicine");
    expect(sports?.enforcement).toBe("soft");
    expect(sports?.value).toMatchObject({ tense: "any" });
    expect(criteria.some((c) => c.kind === "training_stage" && c.enforcement === "hard")).toBe(true);
    const nodes = leaves(buildClinicianQuery(criteria));
    expect(nodes.every((n) => String(n.value) !== "sports medicine")).toBe(true);
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
