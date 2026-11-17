/**
 * ranking-criteria.test.ts: spec section 12 (docs/oslr-criteria-ranking-spec.md).
 */

import { assert, assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  applyClinicalInterestEvidenceGate,
  buildCriteriaResults,
  type CriterionResult,
  type CriterionStatus,
  type RankingCriterion,
  resolveCriterion,
  scoreRow,
} from "./ranking-criteria.ts";
import { AUDIT_SYSTEM_PROMPT, buildAuditUserMessage, parseAuditVerdicts } from "./audit.ts";
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
  assertEquals(resolveCriterion(c, { stage_fit: "out_of_window", stage_evidence: "Start-date estimate only" })?.status, "partial");
  assertEquals(resolveCriterion(c, { stage_fit: "unknown" })?.status, "unknown");
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

Deno.test("audit rules keep fellows, stated PGY evidence and clinical-interest breadcrumbs", () => {
  assert(AUDIT_SYSTEM_PROMPT.includes("A current fellow can be a strong match"));
  assert(AUDIT_SYSTEM_PROMPT.includes("GENERIC YEARS OF EXPERIENCE count dated clinical work"));
  const message = buildAuditUserMessage(
    "PGY-4/5 orthopedic residents interested in sports medicine",
    [{ ...crit("specialty", { terms: ["sports medicine"], tense: "any", subspecialty: { label: "Sports Medicine", siblings: ["hand"] } }), note: "Clinical interest is ranked from profile evidence" }],
    [{ full_name: "Example Resident", stage_evidence: "Orthopaedic Surgery Resident PGY-4 states PGY-4" }],
    0,
  );
  assert(message.includes("CLINICAL INTEREST (ranked evidence): Sports Medicine"));
  assert(message.includes("training-year evidence: Orthopaedic Surgery Resident PGY-4 states PGY-4"));
});

Deno.test("clinical-interest gate removes unsupported strong rows and restores evidence-backed fellows", () => {
  const interest = {
    ...crit("specialty", { terms: ["sports medicine"], tense: "any", subspecialty: { label: "Sports Medicine", education_terms: ["sports medicine"], siblings: [] } }),
    note: "Clinical interest is ranked from profile evidence",
  };
  const stage = { ...crit("training_stage", { stage: "residency", years: [4, 5], senior_fellow_recall: true, title_terms: [] }), enforcement: "hard" as const };
  const rows: Array<Record<string, any>> = [
    { full_name: "No evidence", audit_verdict: "strong", audit_score: 85, audit_criteria: [{ criterion_id: "c1", status: "unknown", evidence: null, section: null }] },
    { full_name: "Sports fellow", audit_verdict: "weak", audit_score: 60, audit_reason: "Current fellow; completed residency", stage_fit: "in_window", evidence_snippet: "Orthopaedic Surgery Sports Medicine Fellow" },
    { full_name: "Related fellow", audit_verdict: "weak", audit_score: 55, audit_reason: "Clinical fellow with another fellowship focus", stage_fit: "in_window", audit_criteria: [{ criterion_id: "c1", status: "partial", evidence: "Diploma in Sports and Exercise Medicine", section: "edu1" }] },
  ];
  applyClinicalInterestEvidenceGate(rows, [interest, stage]);
  assertEquals(rows[0].audit_verdict, "weak");
  assertEquals(rows[0].interest_reviewable, false);
  assertEquals(rows[1].audit_verdict, "strong");
  assertEquals(rows[1].interest_reviewable, true);
  assertEquals(rows[2].audit_verdict, "weak");
  assertEquals(rows[2].interest_reviewable, true);
});

Deno.test("9. training institution resolver requires school or clinical training evidence", () => {
  const c = crit("training_institution", ["johns hopkins hospital"]);
  const education = resolveCriterion(c, { education: [{ school_name: "Johns Hopkins Hospital" }] });
  assertEquals(education?.status, "met");
  const fellowship = resolveCriterion(c, {
    experience_history: [{ title: "Surgical Fellow", company_name: "Johns Hopkins Hospital", start_date: "2023-07-01", end_date: "2024-06-30" }],
  });
  assertEquals(fellowship?.status, "met");
  const attendingOnly = resolveCriterion(c, {
    experience_history: [{ title: "Attending Surgeon", company_name: "Johns Hopkins Hospital", start_date: "2020-01-01", end_date: null }],
  });
  assertEquals(attendingOnly, null);
});
