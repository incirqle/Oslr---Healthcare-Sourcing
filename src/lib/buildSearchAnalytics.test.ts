import { describe, expect, it } from "vitest";
import { buildSearchAnalytics } from "@/lib/buildSearchAnalytics";
import { recomputeRanking, type RankingCriterion } from "@/lib/ranking";
import type { Candidate, CandidateCriterionResult } from "@/components/search/SearchResults";

const NOW = Date.parse("2026-10-18");
const res = (criterion_id: string, status: CandidateCriterionResult["status"], extra: Partial<CandidateCriterionResult> = {}): CandidateCriterionResult =>
  ({ criterion_id, status, source: "grader", evidence: "e", section: null, explanation: null, group: "preferred", ...extra });
const row = (id: string, extra: Partial<Candidate> = {}): Candidate =>
  ({ id, full_name: id, title: null, current_employer: null, location: null, linkedin_url: null, email: null, phone: null, skills: [], avg_tenure_months: null, industry: null, company_size: null, ...extra });
const rc = (id: string, must_have = false): RankingCriterion => ({ id, text: id, title: id.toUpperCase(), position: 0, must_have, origin: "parsed" });

const kept = [
  row("a", { match_rate: 90, employment_model: "private_practice", military_affiliation: "veteran",
    criteria_results: [res("sp", "met", { group: "required", source: "rule", evidence: "Joint reconstruction fellowship" }), res("x", "met"), res("y", "met")],
    raw: { location_locality: "Nashville", experience_history: [{ title: "Orthopedic Surgeon", start_date: "2014-07-01" }, { title: "Fellow", company_name: "Rush", start_date: "2013-07-01" }], education: [] } }),
  row("b", { match_rate: 30, employment_model: "hospital_employed",
    criteria_results: [res("sp", "met", { group: "required", source: "rule", evidence: "Matched the search filter: Joint reconstruction" }), res("x", "partial"), res("y", "not_met")],
    raw: { location_locality: "Nashville", experience_history: [{ title: "Surgeon", start_date: "2024-01-01" }], education: [{ school_name: "Vanderbilt", degrees: ["Residency"] }] } }),
  row("c", { match_rate: 60, criteria_results: [res("sp", "met", { group: "required" }), res("x", "unknown")], raw: { location_locality: "Franklin" } }),
];
const hidden = [row("h1", { set_aside_reason: "grader" }), row("h2", { set_aside_reason: "must_have" }), row("h3", { set_aside_reason: "grader" })];
const required = [{ id: "sp", kind: "specialty", label: "Joint reconstruction", subspecialty: true }];
const ranking = [rc("x"), rc("y")];
const A = buildSearchAnalytics(kept, hidden, required, ranking, { providerTotal: 500, now: NOW });

describe("buildSearchAnalytics (spec 9.7, 12)", () => {
  it("funnel totals add up: kept + hidden = fetched", () => {
    expect(A.funnel.fetched).toBe(kept.length + hidden.length);
    expect(A.funnel.set_aside.reduce((s, r) => s + r.count, 0) + A.funnel.met_must_haves).toBe(A.funnel.fetched);
    expect(A.funnel).toMatchObject({ provider_total: 500, fetched: 6, after_required: 4, met_must_haves: 3, match_75: 1 });
    expect(A.funnel.set_aside[0]).toEqual({ reason: "grader", count: 2 });
  });

  it("coverage counts per criterion sum to kept rows, in importance order", () => {
    for (const c of A.coverage) expect(Object.values(c.counts).reduce((s, n) => s + n, 0)).toBe(kept.length);
    expect(A.coverage.map((c) => c.id)).toEqual(["x", "y"]);
    expect(A.coverage[1].counts).toEqual({ met: 1, partial: 0, unknown: 1, not_met: 1 });
  });

  it("match distribution buckets kept rows, hidden with no Preferred criteria", () => {
    expect(A.match!.map((b) => b.count)).toEqual([0, 1, 1, 1]);
    expect(buildSearchAnalytics(kept, hidden, required, []).match).toBeNull();
  });

  it("employer type counts kept and hidden", () => {
    expect(A.employer).toEqual({ private_practice: 1, hospital_employed: 1, unknown: 4 });
  });

  it("subspecialty evidence splits rule, grader and none; absent without a subspecialty ask", () => {
    expect(A.subspecialty).toEqual({ label: "Joint reconstruction", rule: 1, grader: 0, none: 2 });
    expect(buildSearchAnalytics(kept, hidden, [{ id: "sp", kind: "specialty", label: "Ortho" }], ranking).subspecialty).toBeNull();
  });

  it("years in practice start after training", () => {
    expect(A.years.map((b) => b.count)).toEqual([1, 0, 1, 0]);
    expect(A.years_unknown).toBe(1);
  });

  it("top cities", () => {
    expect(A.cities).toEqual([{ name: "Nashville", count: 2 }, { name: "Franklin", count: 1 }]);
  });

  it("training programs from fellow or residency records", () => {
    expect(A.training).toEqual([{ name: "Rush", count: 1 }, { name: "Vanderbilt", count: 1 }]);
  });

  it("military shows only when a row has an affiliation", () => {
    expect(A.military).toEqual([{ affiliation: "veteran", count: 1 }]);
    expect(buildSearchAnalytics(kept.slice(1), [], required, ranking).military).toBeNull();
  });

  it("changes live when a criterion is locked as a must-have", () => {
    const live = recomputeRanking(kept, [], [rc("x"), rc("y", true)]);
    const B = buildSearchAnalytics(live.kept, live.setAside, required, [rc("x"), rc("y", true)]);
    expect(B.funnel.met_must_haves).toBe(2);
    expect(B.funnel.set_aside).toEqual([{ reason: "must_have", count: 1 }]);
    expect(B.funnel.fetched).toBe(3);
  });
});
