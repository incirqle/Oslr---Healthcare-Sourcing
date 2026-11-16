import { assert, assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessCurrentTraining,
  clinicalTimeline,
  experienceFit,
  splitCurrentTrainingRows,
  splitExperienceRows,
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

Deno.test("fellowship-trained attending language is not a current fellowship role", () => {
  const row = {
    current_employers: [role("Fellowship-Trained Orthopedic Surgeon", "2022-08-01", null, true)],
    experience_history: [role("Fellowship-Trained Orthopedic Surgeon", "2022-08-01", null, true)],
  };
  assertEquals(assessCurrentTraining(row, fellowship, NOW).eligible, false);
  assertEquals(clinicalTimeline(row, NOW).active_practice_years, 4);
});

Deno.test("a generic physician title can use a current training-program employer as evidence", () => {
  const row = { current_employers: [{ ...role("Physician", "2026-07-01", null, true), company_name: "Orthopedic Surgery Residency Program" }] };
  const residency: TrainingStageRequest = { ...fellowship, stage: "residency", stages: ["residency"] };
  assertEquals(assessCurrentTraining(row, residency, NOW).eligible, true);
});

Deno.test("requested PGY years rank people but never drop current residents", () => {
  const residency: TrainingStageRequest = { stage: "residency", stages: ["residency"], years: [4, 5], profession: "orthopedic surgery" };
  const pgy4 = { current_employers: [role("Orthopedic Surgery Resident", "2023-07-01", null, true)] };
  const researchYear = { current_employers: [role("Orthopedic Surgery Resident", "2021-07-01", null, true)] };
  const chiefReset = { current_employers: [role("Chief Resident, Orthopaedic Surgery", "2026-07-01", null, true)] };
  assertEquals(assessCurrentTraining(pgy4, residency, NOW).eligible, true);
  assertEquals(assessCurrentTraining(researchYear, residency, NOW).eligible, true);
  assertEquals(assessCurrentTraining(chiefReset, residency, NOW).eligible, true);
});

Deno.test("a current sports medicine fellow stays in a senior-resident search", () => {
  const residency: TrainingStageRequest = { stage: "residency", stages: ["residency"], years: [4, 5], profession: "orthopedic surgery" };
  const fellow = { current_employers: [role("Sports Medicine Fellow", "2026-08-01", null, true)] };
  assertEquals(assessCurrentTraining(fellow, residency, NOW).eligible, true);
});

Deno.test("pre-medical support work is not post-training licensed practice", () => {
  const row = {
    current_employers: [role("Orthopedic Surgery Resident", "2021-07-01", null, true)],
    experience_history: [
      role("Orthopedic Surgery Resident", "2021-07-01", null, true),
      role("Nurse's Attendent", "2014-05-01", "2014-08-01"),
    ],
  };
  assertEquals(clinicalTimeline(row, NOW).active_practice_years, null);
});

Deno.test("volunteer surgical observation and research fellowships do not distort career timelines", () => {
  const row = {
    experience_history: [
      role("Orthopedic Surgery Resident", "2022-07-01", null, true),
      role("Post-baccalaureate Fellow, Intramural Research Training Award", "2016-10-01", "2018-06-01"),
      role("Same-Day Surgery Unit Medical Volunteer", "2008-07-01", "2008-08-01"),
    ],
  };
  const timeline = clinicalTimeline(row, NOW);
  assertEquals(timeline.active_practice_years, null);
  assertEquals(timeline.training_years, 4);
});

Deno.test("surgical internships are training and resident advising is not clinical training", () => {
  const row = {
    experience_history: [
      role("Hand Surgery Fellow", "2025-07-01", null, true),
      role("Plastic Surgery Resident", "2020-07-01", "2025-06-01"),
      role("General Surgery Intern", "2019-07-01", "2020-06-01"),
      role("Resident Advisor", "2012-08-01", "2013-05-01"),
    ],
  };
  const timeline = clinicalTimeline(row, NOW);
  assertEquals(timeline.active_practice_years, null);
  assertEquals(timeline.training_years, 7);
});

Deno.test("hard practice ranges reject known misses but retain unknown timelines", () => {
  const practicing = (start: string) => ({ experience_history: [role("Orthopedic Surgeon", start, null, true)] });
  const split = splitExperienceRows([
    practicing("2024-07-01"),
    practicing("2022-07-01"),
    practicing("2025-07-01"),
    practicing("2010-07-01"),
    { experience_history: [role("Orthopedic Surgeon", null, null, true)] },
  ], { min: 2, max: 5 }, NOW);
  // One year short is a visible partial match; far misses are rejected.
  assertEquals(split.clean.length, 4);
  assertEquals(split.rejected.length, 1);
  assertEquals(split.rejected.map((r) => r.active_practice_years), [16]);
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

// ---- Career stage: experience asks never serve trainees or students ----
import { careerStage as __stage, experienceFit as __fit } from "./clinical-timeline.ts";
const __now = new Date("2026-11-01T00:00:00Z");
Deno.test("resident with 12 years of total history fails a 12-year experience ask", () => {
  const p = { current_employers: [{ title: "Orthopaedic Surgery Resident PGY-4", company_name: "NYU Langone", start_date: "2022-07-01" }],
    past_employers: [{ title: "Research Assistant", company_name: "Columbia", start_date: "2014-06-01", end_date: "2018-05-01" }] };
  if (__stage(p) !== "trainee") throw new Error("expected trainee");
  if (__fit(p, { min: 12 }, __now).status !== "not_met") throw new Error("resident must not pass");
});
Deno.test("current fellow fails an experience ask", () => {
  const p = { current_employers: [{ title: "Foot and Ankle Fellow", company_name: "OrthoCarolina", start_date: "2026-08-01" }] };
  if (__fit(p, { min: 5 }, __now).status !== "not_met") throw new Error("fellow must not pass");
});
Deno.test("medical student fails an experience ask", () => {
  const p = { current_employers: [{ title: "Medical Student", company_name: "Harvard Medical School", start_date: "2023-08-01" }] };
  if (__stage(p) !== "student") throw new Error("expected student");
  if (__fit(p, { min: 2 }, __now).status !== "not_met") throw new Error("student must not pass");
});
Deno.test("nurse residency counts as RN practice", () => {
  const p = { current_employers: [{ title: "RN Nurse Resident", company_name: "UCHealth", start_date: "2020-09-01" }] };
  if (__stage(p) !== "practicing") throw new Error("nurse resident is practicing");
  if (__fit(p, { min: 5 }, __now).status !== "met") throw new Error("6 years RN should meet 5+");
});
Deno.test("nurse tech years are not RN years", () => {
  const p = { current_employers: [{ title: "Registered Nurse", company_name: "Mayo", start_date: "2024-06-01" }],
    past_employers: [{ title: "Nurse Tech", company_name: "Mayo", start_date: "2019-01-01", end_date: "2024-05-01" }] };
  if (__fit(p, { min: 5 }, __now).status !== "not_met") throw new Error("only 2 RN years");
});
Deno.test("15-year RN passes a plain 12-year floor", () => {
  const p = { current_employers: [{ title: "Charge Nurse", company_name: "HCA", start_date: "2011-01-01" }] };
  if (__fit(p, { min: 12 }, __now).status !== "met") throw new Error("15 years should meet 12+");
});
Deno.test("attending who moved jobs last year keeps prior practice years", () => {
  const p = { current_employers: [{ title: "Orthopedic Surgeon", company_name: "Mount Sinai", start_date: "2025-09-01" }],
    past_employers: [{ title: "Orthopedic Surgeon", company_name: "Cleveland Clinic", start_date: "2013-08-01", end_date: "2025-08-01" }] };
  if (__fit(p, { min: 12 }, __now).status !== "met") throw new Error("13 years should meet 12+");
});
Deno.test("profile with no dates stays unknown", () => {
  const p = { current_employers: [{ title: "Orthopedic Surgeon", company_name: "X" }] };
  if (__fit(p, { min: 12 }, __now).status !== "unknown") throw new Error("undated stays unknown");
});
