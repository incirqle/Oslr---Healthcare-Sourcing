import { describe, expect, it } from "vitest";
import { recomputeRanking, scoreRow, weightPercent, sortByCriterion, type RankingCriterion } from "@/lib/ranking";
import type { Candidate, CandidateCriterionResult } from "@/components/search/SearchResults";

const rc = (id: string, must_have = false): RankingCriterion => ({ id, text: id, title: id, position: 0, must_have, origin: "parsed" });
const res = (criterion_id: string, status: CandidateCriterionResult["status"]): CandidateCriterionResult =>
  ({ criterion_id, status, source: "grader", evidence: `ev ${criterion_id}`, section: null, explanation: null, group: "preferred" });
const row = (id: string, results: CandidateCriterionResult[], extra: Partial<Candidate> = {}): Candidate =>
  ({ id, full_name: id, title: null, current_employer: null, location: null, linkedin_url: null, email: null, phone: null, skills: [], avg_tenure_months: null, industry: null, company_size: null, criteria_results: results, ...extra });

describe("client ranking recompute (spec 7)", () => {
  it("weights four criteria 40/30/20/10", () => {
    expect([0, 1, 2, 3].map((i) => weightPercent(i, 4))).toEqual([40, 30, 20, 10]);
  });

  it("scores met, not shown x2, partly as 50", () => {
    const r = scoreRow([res("a", "met"), res("b", "not_met"), res("c", "unknown"), res("d", "partial")], [rc("a"), rc("b"), rc("c"), rc("d")]);
    expect(r.match_rate).toBe(4 * 1 + 3 * 0 + 2 * 0.25 + 1 * 0.5 === 5 ? 50 : -1);
  });

  it("scores no, not shown, partly, yes as 28", () => {
    const r = scoreRow([res("a", "not_met"), res("b", "unknown"), res("c", "partial"), res("d", "met")], [rc("a"), rc("b"), rc("c"), rc("d")]);
    expect(r.match_rate).toBe(28);
  });

  it("returns no match rate with zero preferred criteria", () => {
    expect(scoreRow([], []).match_rate).toBeNull();
  });

  it("reordering changes the order of results", () => {
    const a = row("A", [res("x", "met"), res("y", "not_met")]);
    const b = row("B", [res("x", "not_met"), res("y", "met")]);
    expect(recomputeRanking([a, b], [], [rc("x"), rc("y")]).kept.map((r) => r.id)).toEqual(["A", "B"]);
    expect(recomputeRanking([a, b], [], [rc("y"), rc("x")]).kept.map((r) => r.id)).toEqual(["B", "A"]);
  });

  it("a No on a must-have sets the row aside with the note", () => {
    const a = row("A", [res("x", "not_met")]);
    const out = recomputeRanking([a], [], [rc("x", true)]);
    expect(out.kept).toHaveLength(0);
    expect(out.setAside[0].set_aside_reason).toBe("must_have");
    expect(out.setAside[0].set_aside_note).toBe("No on: x. ev x");
  });

  it("Not shown on a must-have keeps the row", () => {
    expect(recomputeRanking([row("A", [res("x", "unknown")])], [], [rc("x", true)]).kept).toHaveLength(1);
  });

  it("pending criteria do not count toward match", () => {
    const out = recomputeRanking([row("A", [res("x", "met")])], [], [{ ...rc("u1"), pending: true }, rc("x")]);
    expect(out.kept[0].match_rate).toBe(100);
  });

  it("sorts by one criterion yes > partly > not shown > no", () => {
    const rows = [row("N", [res("x", "not_met")]), row("U", [res("x", "unknown")]), row("Y", [res("x", "met")]), row("P", [res("x", "partial")])];
    expect(sortByCriterion(rows, "x").map((r) => r.id)).toEqual(["Y", "P", "U", "N"]);
  });
});
