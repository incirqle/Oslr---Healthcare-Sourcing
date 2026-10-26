import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyDecision, decisionDeltas, emptyPreferences, featuresFor, rerank,
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

import { stripCredentialClaims } from "./agent-core.ts";
Deno.test("board certification is never shown as a reason", () => {
  const out = stripCredentialClaims("Double-board certified interventional pain physician in Arizona with pain fellowship training.");
  assert(!/board/i.test(out), out);
  assert(/interventional pain physician in Arizona/.test(out), out);
});
