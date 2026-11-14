/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import {
  isNonOperativeQuery,
  normalizeClinicalIntent,
  pgyYears,
  splitNonoperativeRows,
  trainingInstitutions,
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

  it("reads recent graduate trained fellows as completed fellowship and 0-5 practice years", () => {
    const parsed = normalizeClinicalIntent({
      role_class: "fellow",
      training_stage: { profession: "orthopedic surgery", stage: "fellowship", year: null },
      recently_changed_jobs: true,
    }, "Find me recent graduate foot and ankle-trained fellows in the United States");
    expect(parsed.training_stage).toBeNull();
    expect(parsed.role_class).toBeNull();
    expect(parsed.fellowship_trained).toBe(true);
    expect(parsed.min_years_experience).toBe(0);
    expect(parsed.max_years_experience).toBe(5);
    expect(parsed.recently_changed_jobs).toBe(false);
    expect(parsed.unmapped_concepts).toEqual([]);
    expect(parsed.search_notes).toContain("current residents and fellows are excluded");
  });

  it("keeps explicit current fellows in the current training stage", () => {
    const parsed = normalizeClinicalIntent({}, "Current foot and ankle fellows in the United States");
    expect(parsed.training_stage).toMatchObject({ stage: "fellowship" });
    expect(parsed.role_class).toBe("fellow");
    expect(parsed.min_years_experience).toBeUndefined();
  });

  it("uses one shared career-stage grammar", () => {
    expect(normalizeClinicalIntent({}, "new graduate nurses")).toMatchObject({ min_years_experience: 0, max_years_experience: 2 });
    expect(normalizeClinicalIntent({}, "mid-career nurses")).toMatchObject({ min_years_experience: 5, max_years_experience: 10 });
    expect(normalizeClinicalIntent({}, "seasoned nurses")).toMatchObject({ min_years_experience: 10, max_years_experience: null });
  });

  it("turns exact experience into a bounded practice range and preserves explicit ranges", () => {
    expect(normalizeClinicalIntent({}, "circulating nurses with 12 years of experience")).toMatchObject({ min_years_experience: 11, max_years_experience: 13 });
    expect(normalizeClinicalIntent({ min_years_experience: 5, max_years_experience: 10 }, "nurses with 5 to 10 years of experience")).toMatchObject({ min_years_experience: 5, max_years_experience: 10 });
  });

  it("moves a training hospital out of current employers", () => {
    const query = "Circulating OR nurses with 12 years of experience who trained at Johns Hopkins Hospital";
    expect(trainingInstitutions(query)).toEqual(["johns hopkins hospital"]);
    const parsed = normalizeClinicalIntent({ current_companies: ["johns hopkins hospital"], companies: ["johns hopkins hospital"] }, query);
    expect(parsed.training_institutions).toEqual(["johns hopkins hospital"]);
    expect(parsed.current_companies).toEqual([]);
    expect(parsed.companies).toEqual([]);
  });

  it("does not turn the OR abbreviation into a surgery-center preference", () => {
    expect(normalizeClinicalIntent({ care_setting: "asc" }, "Circulating OR nurses with 12 years of experience").care_setting).toBeNull();
    expect(normalizeClinicalIntent({ care_setting: "asc" }, "OR nurses in ambulatory surgery centers").care_setting).toBe("asc");
  });

  it("does not move a plain workplace into training history", () => {
    const parsed = normalizeClinicalIntent({ current_companies: ["johns hopkins hospital"] }, "OR nurses at Johns Hopkins Hospital");
    expect(parsed.current_companies).toEqual(["johns hopkins hospital"]);
    expect(parsed.training_institutions).toBeUndefined();
  });
});
