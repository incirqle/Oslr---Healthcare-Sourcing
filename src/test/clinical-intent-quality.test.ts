/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isNonOperativeQuery,
  normalizeClinicalIntent,
  pgyYears,
  splitNonoperativeRows,
} from "../../supabase/functions/_shared/clinician-engine/clinical-intent";

const austinParse = {
  role_class: "physician",
  specialty: "pediatric orthopedic",
  specialties: ["pediatric orthopedic", "non-operative orthopedic", "pediatrics", "orthopedic"],
  required_keywords: ["non-operative", "conservative", "pediatric", "orthopedic", "orthopaedic"],
  current_role_only: false,
};

describe("clinical terminology normalization", () => {
  it("turns non-operative into a modality, not a keyword that admits surgeons", () => {
    const parsed = normalizeClinicalIntent(austinParse, "Pediatric non-operative orthopedic physicians in Austin, Texas");
    expect(isNonOperativeQuery("non-op ortho")).toBe(true);
    expect(parsed.practice_modality).toMatchObject({ mode: "nonoperative" });
    expect(parsed.specialties).not.toContain("non-operative orthopedic");
    expect(parsed.specialties).not.toContain("pediatrics");
    expect(parsed.required_keywords).not.toContain("non-operative");
    expect(parsed.current_role_only).toBe(true);
  });

  it("rejects operative surgeons but keeps explicit non-operative physicians", () => {
    const rows: Array<{ job_title: string; headline: string; audit_verdict?: unknown }> = [
      { job_title: "Pediatric Orthopedic Surgeon", headline: "Operative sports medicine" },
      { job_title: "Primary Care Sports Medicine Physician", headline: "Non-operative pediatric orthopedic care" },
      { job_title: "Pediatric Physiatrist", headline: "Pediatric rehabilitation medicine" },
    ];
    const { clean, rejected } = splitNonoperativeRows(rows);
    expect(rejected).toHaveLength(1);
    expect(clean).toHaveLength(2);
    expect(rejected[0].audit_verdict).toBe("reject");
  });

  it.each([
    ["PGY-4/5 orthopedic residents in New York City", [4, 5]],
    ["PGY4 and PGY5 spine fellows", [4, 5]],
    ["PGY-3 podiatric residents", [3]],
  ])("preserves every stated year in %s", (query, expected) => {
    expect(pgyYears(query)).toEqual(expected);
  });

  it("keeps the working NYC orthopedic resident search resident-only", () => {
    const parsed = normalizeClinicalIntent({}, "PGY-4 and PGY-5 orthopedic residents in New York City");
    expect(parsed.role_class).toBe("resident");
    expect(parsed.training_stage).toMatchObject({
      stage: "residency",
      stages: ["residency"],
      professions: ["orthopedic surgery"],
      years: [4, 5],
    });
  });

  it("unifies spine residents and fellows across their actual parent programs", () => {
    const parsed = normalizeClinicalIntent({}, "PGY-4/5 spine-focused residents or fellows in New York City");
    expect(parsed.role_classes).toEqual(["resident", "fellow"]);
    expect(parsed.training_stage).toMatchObject({
      stages: ["residency", "fellowship"],
      professions: ["orthopedic surgery", "neurosurgery", "physical medicine and rehabilitation"],
      years: [4, 5],
    });
    expect(parsed.specialties).toContain("spine");
  });
});
