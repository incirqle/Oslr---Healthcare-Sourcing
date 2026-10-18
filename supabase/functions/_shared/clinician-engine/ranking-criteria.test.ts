/**
 * ranking-criteria.test.ts: spec section 12 (docs/oslr-criteria-ranking-spec.md).
 */

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildCriteriaResults,
  type CriterionResult,
  type CriterionStatus,
  type RankingCriterion,
  resolveCriterion,
  scoreRow,
} from "./ranking-criteria.ts";
import { parseAuditVerdicts } from "./audit.ts";
import type { SearchCriteria } from "./clinician-criteria.ts";

const rc = (id: string, position: number, must_have = false): RankingCriterion => ({
  id, text: id, title: id, position, must_have, origin: "parsed",
});
const res = (criterion_id: string, status: CriterionStatus): CriterionResult => ({
  criterion_id, status, source: "grader", evidence: null, section: null, explanation: null,
});
const four = ["p0", "p1", "p2", "p3"];

Deno.test("1. scoreRow: four met -> 100", () => {
  const r = scoreRow(four.map((id) => res(id, "met")), four.map((id, i) => rc(id, i)));
  assertEquals(r.match_rate, 100);
});

Deno.test("2. scoreRow: [met, not_met, unknown, partial] -> 50", () => {
  const statuses: CriterionStatus[] = ["met", "not_met", "unknown", "partial"];
  const r = scoreRow(four.map((id, i) => res(id, statuses[i])), four.map((id, i) => rc(id, i)));
  assertEquals(r.match_rate, 50);
});

Deno.test("3. scoreRow: first criterion dragged to last -> 28", () => {
  const statuses: CriterionStatus[] = ["met", "not_met", "unknown", "partial"];
  const results = four.map((id, i) => res(id, statuses[i]));
  const order = ["p1", "p2", "p3", "p0"];
  const r = scoreRow(results, order.map((id, i) => rc(id, i)));
  assertEquals(r.match_rate, 28);
  assertEquals(r.breakdown.map((b) => b.max), [4, 3, 2, 1]);
});

Deno.test("4. must-have not_met is reported; unknown is not", () => {
  const ranking = [rc("p0", 0, true), rc("p1", 1, true)];
  const r = scoreRow([res("p0", "not_met"), res("p1", "unknown")], ranking);
  assertEquals(r.must_have_failed, ["p0"]);
});

const crit = (kind: SearchCriteria["kind"], value: unknown): SearchCriteria => ({
  id: "c1", kind, label: kind, value: value as SearchCriteria["value"], enforcement: "soft", source: "user", evidenceSource: "search",
});

Deno.test("5. resolver training_stage", () => {
  const c = crit("training_stage", { profession: null, stage: "residency", year: 3, title_terms: [] });
  assertEquals(resolveCriterion(c, { stage_fit: "in_window", job_start_date: "2024-07-01" })?.status, "met");
  assertEquals(resolveCriterion(c, { stage_fit: "out_of_window" })?.status, "not_met");
  assertEquals(resolveCriterion(c, { stage_fit: "unknown" }), null);
});

Deno.test("6. resolver employment_model", () => {
  const c = crit("employment_model", { model: "private_practice" });
  const met = resolveCriterion(c, { employment_model: "private_practice", employment_model_evidence: "owner title at a 14-person practice" });
  assertEquals(met?.status, "met");
  assertEquals(met?.source, "rule");
  assert(met?.evidence?.includes("private_practice"));
  assertEquals(resolveCriterion(c, { employment_model: "unknown" }), null);
});

Deno.test("7. parseAuditVerdicts drops unknown ids and bad statuses, keeps the verdict", () => {
  const raw = {
    verdicts: [{
      i: 0, verdict: "strong", score: 88, reason: "Fits.", evidence: "Adult Reconstruction Fellowship",
      criteria: [
        { id: "p0", status: "yes", evidence: "Adult Reconstruction Fellowship", section: "edu0" },
        { id: "zz", status: "yes", evidence: null, section: null },
        { id: "p1", status: "maybe", evidence: null, section: null },
      ],
    }],
  };
  const v = parseAuditVerdicts(raw, new Set(["p0", "p1"])).get(0);
  assertExists(v);
  assertEquals(v.verdict, "strong");
  assertEquals(v.score, 88);
  assertEquals(v.criteria?.length, 1);
  assertEquals(v.criteria?.[0], { criterion_id: "p0", status: "met", evidence: "Adult Reconstruction Fellowship", section: "edu0" });
});

Deno.test("8. missing criteria key -> every Preferred result unknown, row kept", () => {
  const v = parseAuditVerdicts({ verdicts: [{ i: 0, verdict: "weak", score: 60, reason: "Partly.", evidence: null }] }, new Set(four)).get(0);
  assertExists(v);
  assertEquals(v.verdict, "weak");
  assertEquals(v.criteria, null);
  const ranking = four.map((id, i) => rc(id, i));
  const results = buildCriteriaResults({}, [], ranking, new Map(), new Map(), v.criteria, { kept: true });
  assertEquals(results.map((r) => r.status), ["unknown", "unknown", "unknown", "unknown"]);
  assertEquals(scoreRow(results, ranking).must_have_failed, []);
});
