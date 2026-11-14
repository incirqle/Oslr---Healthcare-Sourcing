import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  agentMatchQuality, applyDecision, decisionDeltas, emptyPreferences, featuresFor, rerank,
} from "./agent-brain.ts";

const row = { title: "Owner, Pain Physician", current_employer: "Desert Spine Clinic", location: "Phoenix, Arizona, United States" };

Deno.test("approval boosts stay between +15% and +40%", () => {
  const f = featuresFor(row);
  for (const tags of [[], ["practice_owner"], ["leadership"], ["right_area"], ["career_stage"], ["specialty_fit"]]) {
    for (const m of Object.values(decisionDeltas("approved", tags, f))) assert(m >= 1.15 && m <= 1.4, `${tags} ${m}`);
  }
});

Deno.test("pass cuts stay between -30% and -80%", () => {
  const f = featuresFor(row);
  for (const tags of [[], ["wrong_area"], ["wrong_specialty"], ["too_junior"], ["in_training"], ["wrong_setting"]]) {
    for (const m of Object.values(decisionDeltas("passed", tags, f))) assert(m >= 0.2 && m <= 0.7, `${tags} ${m}`);
  }
});

Deno.test("skip town prunes everyone in that city", () => {
  const prefs = applyDecision(emptyPreferences(), "passed", ["wrong_area"], featuresFor(row), "Phoenix");
  assertEquals(prefs.skip.cities, ["Phoenix"]);
  const ranked = rerank(prefs, [
    { id: "a", base_score: 0.9, features: featuresFor(row) },
    { id: "b", base_score: 0.5, features: featuresFor({ ...row, location: "Tucson, Arizona" }) },
  ]);
  assertEquals(ranked[0].id, "b");
  assertEquals(ranked[1].pruned, true);
});

Deno.test("practice owner approval lifts owners above others", () => {
  const prefs = applyDecision(emptyPreferences(), "approved", ["practice_owner"], featuresFor(row));
  const ranked = rerank(prefs, [
    { id: "staff", base_score: 0.6, features: featuresFor({ title: "Physician", location: "Denver, Colorado" }) },
    { id: "owner", base_score: 0.5, features: featuresFor({ title: "Founder", location: "Denver, Colorado" }) },
  ]);
  assertEquals(ranked[0].id, "owner");
});

Deno.test("agents withhold graduated fellows from current-fellow briefs", () => {
  const profile = {
    raw: {
      audit_verdict: "strong",
      audit_score: 92,
      current_employers: [{ title: "Orthopedic Surgeon", start_date: "2022-08-01", end_date: null, is_primary: true }],
      experience_history: [
        { title: "Orthopedic Surgeon", start_date: "2022-08-01", end_date: null, is_primary: true },
        { title: "Hand Surgery Fellow", start_date: "2021-07-01", end_date: "2022-07-31" },
      ],
    },
  };
  const quality = agentMatchQuality(profile, { training_stage: { stage: "fellowship", stages: ["fellowship"], profession: "orthopedic surgery" } });
  assertEquals(quality.eligible, false);
});

Deno.test("agents do not count residency and fellowship toward requested practice experience", () => {
  const profile = {
    raw: {
      audit_verdict: "strong",
      audit_score: 92,
      experience_history: [
        { title: "Orthopedic Surgeon", start_date: "2024-07-01", end_date: null, is_primary: true },
        { title: "Sports Medicine Fellow", start_date: "2023-07-01", end_date: "2024-06-30" },
        { title: "Orthopedic Surgery Resident", start_date: "2018-07-01", end_date: "2023-06-30" },
      ],
    },
  };
  assertEquals(agentMatchQuality(profile, { min_years_experience: 5 }).eligible, false);
  assertEquals(agentMatchQuality(profile, { min_years_experience: 2, max_years_experience: 5 }).eligible, true);
});

import { normalizeClinicalIntent } from "../clinician-engine/clinical-intent.ts";
Deno.test("agents apply recent-graduate practice limits from old pinned briefs", () => {
  const intent = normalizeClinicalIntent({
    role_class: "fellow",
    training_stage: { stage: "fellowship", profession: "orthopedic surgery" },
    recently_changed_jobs: true,
  }, "recent graduate foot and ankle-trained fellows in the United States");
  const experienced = {
    raw: {
      audit_verdict: "strong",
      audit_score: 90,
      experience_history: [{ title: "Orthopedic Surgeon", start_date: "2015-07-01", end_date: null, is_primary: true }],
    },
  };
  assertEquals(agentMatchQuality(experienced, intent).eligible, false);
  assertEquals(intent.training_stage, null);
  assertEquals(intent.recently_changed_jobs, false);
  const currentFellow = {
    raw: {
      audit_verdict: "strong",
      audit_score: 90,
      job_title: "Foot and Ankle Fellow",
      current_employers: [{ title: "Foot and Ankle Fellow", start_date: "2025-07-01", end_date: null, is_primary: true }],
    },
  };
  assertEquals(agentMatchQuality(currentFellow, intent).eligible, false);
});

import { stripCredentialClaims } from "./agent-core.ts";
Deno.test("board certification is never shown as a reason", () => {
  const out = stripCredentialClaims("Double-board certified interventional pain physician in Arizona with pain fellowship training.");
  assert(!/board/i.test(out), out);
  assert(/interventional pain physician in Arizona/.test(out), out);
});
