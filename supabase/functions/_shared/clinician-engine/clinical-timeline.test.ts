import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessCurrentTraining,
  clinicalTimeline,
  experienceFit,
  splitCurrentTrainingRows,
  type TrainingStageRequest,
} from "./clinical-timeline.ts";

const NOW = new Date("2026-11-14T12:00:00Z");
const fellowship: TrainingStageRequest = {
  profession: "orthopedic surgery",
  professions: ["orthopedic surgery"],
  stage: "fellowship",
  stages: ["fellowship"],
  title_terms: ["fellow"],
};

function role(title: string, start_date: string | null, end_date: string | null, is_primary = false) {
  return { title, company_name: "Example Medical Center", start_date, end_date, is_primary };
}

Deno.test("practice experience excludes college research, residency and fellowship", () => {
  const result = clinicalTimeline({
    experience_history: [
      role("Orthopedic Surgeon", "2022-08-01", null, true),
      role("Hand Surgery Fellow", "2021-07-01", "2022-07-31"),
      role("Orthopedic Surgery Resident", "2016-07-01", "2021-06-30"),
      role("Research Assistant", "2012-06-01", "2014-05-31"),
    ],
  }, NOW);
  assertEquals(result.active_practice_years, 4);
  assertEquals(result.training_years, 6);
  assertEquals(result.active_practice_since, "2022-08-01");
  assert(!result.experience_evidence?.includes("2012"));
});

Deno.test("overlapping concurrent appointments do not double-count practice years", () => {
  const result = clinicalTimeline({
    experience_history: [
      role("Orthopedic Surgeon", "2022-01-01", null, true),
      role("Attending Physician", "2023-01-01", null),
    ],
  }, NOW);
  assertEquals(result.active_practice_years, 4);
});

Deno.test("unknown practice dates stay unknown instead of becoming zero or a career estimate", () => {
  const result = clinicalTimeline({ experience_history: [role("Orthopedic Surgeon", null, null, true)] }, NOW);
  assertEquals(result.active_practice_years, null);
  assertEquals(experienceFit({ experience_history: [role("Orthopedic Surgeon", null, null, true)] }, { min: 2, max: 5 }, NOW).status, "unknown");
});

Deno.test("two-to-five-year searches use independent practice rather than training time", () => {
  const row = { experience_history: [role("Orthopedic Surgeon", "2024-07-01", null, true), role("Sports Medicine Fellow", "2023-07-01", "2024-06-30")] };
  assertEquals(experienceFit(row, { min: 2, max: 5 }, NOW).status, "met");
  const senior = { experience_history: [role("Orthopedic Surgeon", "2010-07-01", null, true), role("Sports Medicine Fellow", "2009-07-01", "2010-06-30")] };
  assertEquals(experienceFit(senior, { min: 2, max: 5 }, NOW).status, "not_met");
});

Deno.test("a past fellow who is now an attending is not a current fellow", () => {
  const row = {
    current_employers: [role("Orthopedic Surgeon", "2022-08-01", null, true)],
    experience_history: [role("Orthopedic Surgeon", "2022-08-01", null, true), role("Hand Surgery Fellow", "2021-07-01", "2022-07-31")],
  };
  const result = assessCurrentTraining(row, fellowship, NOW);
  assertEquals(result.eligible, false);
  assert(/No current/.test(result.reason ?? ""));
});

Deno.test("a stale open fellowship cannot outrank a current fellow", () => {
  const stale = { current_employers: [role("Hand Surgery Fellow", "2020-07-01", null, true)] };
  const current = { current_employers: [role("Hand Surgery Fellow", "2026-07-01", null, true)] };
  assertEquals(assessCurrentTraining(stale, fellowship, NOW).eligible, false);
  assertEquals(assessCurrentTraining(current, fellowship, NOW).eligible, true);
  const split = splitCurrentTrainingRows([stale, current], fellowship, NOW);
  assertEquals(split.clean.length, 1);
  assertEquals(split.rejected.length, 1);
  assertEquals(split.rejected[0].training_filtered, true);
});

Deno.test("a later primary attending role invalidates a stale open fellowship", () => {
  const row = {
    current_employers: [
      role("Orthopedic Surgeon", "2023-08-01", null, true),
      role("Hand Surgery Fellow", "2020-07-01", null),
    ],
  };
  assertEquals(assessCurrentTraining(row, fellowship, NOW).eligible, false);
});

Deno.test("a later attending role wins even when the stale fellowship is marked primary", () => {
  const row = {
    current_employers: [
      role("Hand Surgery Fellow", "2020-07-01", null, true),
      role("Orthopedic Surgeon", "2023-08-01", null),
    ],
  };
  assertEquals(assessCurrentTraining(row, fellowship, NOW).eligible, false);
});

Deno.test("current training with an unlisted start date remains reviewable", () => {
  const row = { current_employers: [role("Clinical Fellow", null, null, true)] };
  assertEquals(assessCurrentTraining(row, fellowship, NOW).eligible, true);
});

Deno.test("residency duration uses the requested profession rather than a universal three-year cap", () => {
  const residency: TrainingStageRequest = { ...fellowship, stage: "residency", stages: ["residency"] };
  const row = { current_employers: [role("Orthopedic Surgery Resident", "2021-07-01", null, true)] };
  assertEquals(assessCurrentTraining(row, residency, NOW).eligible, true);
});
