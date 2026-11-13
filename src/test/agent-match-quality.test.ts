import { describe, expect, it } from "vitest";
import { agentBaseScore, agentMatchQuality, emptyPreferences, rerank } from "../../supabase/functions/_shared/agents/agent-brain";

describe("Agent match quality", () => {
  it("never serves a weak or rejected match to meet the calibration quota", () => {
    expect(agentMatchQuality({ raw: { audit_verdict: "weak", audit_score: 88 } }).eligible).toBe(false);
    expect(agentMatchQuality({ raw: { audit_verdict: "reject", audit_score: 20 } }).eligible).toBe(false);
    expect(agentMatchQuality({ raw: { audit_verdict: "strong", audit_score: 82 } }).eligible).toBe(true);
  });

  it("withholds operative-modality failures and low-confidence matches", () => {
    expect(agentMatchQuality({ raw: { modality_filtered: true } }).eligible).toBe(false);
    expect(agentMatchQuality({ raw: { audit_score: 25 } }).eligible).toBe(false);
  });

  it("uses the 95/100 audit instead of a structural zero from all-hard criteria", () => {
    expect(agentBaseScore({ raw: { audit_score: 95, match_rate: 0 } })).toBe(0.95);
    expect(agentBaseScore({ raw: { match_rate: 72 } })).toBe(0.72);
  });

  it("does not discard unaudited deterministic matches", () => {
    expect(agentMatchQuality({ title: "Pediatric Physiatrist", raw: {} }).eligible).toBe(true);
  });

  it("keeps quality pruning when ordinary Agent reranking runs", () => {
    const [row] = rerank(emptyPreferences(), [{ id: "weak", features: [], base_score: 0.9, pruned: true }]);
    expect(row.pruned).toBe(true);
  });
});
