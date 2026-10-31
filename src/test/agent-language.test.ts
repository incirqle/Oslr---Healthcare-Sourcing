import { describe, expect, it } from "vitest";
import { applyLanguageRules, steeringPatch, validateRules } from "../../supabase/functions/_shared/agents/agent-language";
import { applyDecision, emptyPreferences, rerank } from "../../supabase/functions/_shared/agents/agent-brain";

describe("natural-language agent controls", () => {
  it("sets five daily people without changing search wording", () => {
    expect(steeringPatch({ status: "sourcing", brief: "Pain doctors in Phoenix" }, { per_day: 5 }, []).patch).toEqual({ per_day: 5 });
  });
  it("rejects volumes above the existing ten per day limit", () => {
    expect(() => steeringPatch({ status: "sourcing", brief: "Pain doctors" }, { per_day: 11 }, [])).toThrow();
  });
  it("pause frees the active state and resume requests a metered active state", () => {
    expect(steeringPatch({ status: "sourcing", brief: "Pain doctors" }, { status: "pause" }, []).patch.status).toBe("paused");
    expect(steeringPatch({ status: "paused", brief: "Pain doctors" }, { status: "resume" }, []).patch.status).toBe("sourcing");
  });
  it("does not reopen closed agents", () => {
    expect(() => steeringPatch({ status: "closed", brief: "Pain doctors" }, { status: "resume" }, [])).toThrow();
  });
  it("replaces contradictory briefs rather than appending them", () => {
    expect(steeringPatch({ status: "sourcing", brief: "Pain doctors in Phoenix" }, { brief: "Pain doctors in Tucson" }, []).patch.brief).toBe("Pain doctors in Tucson");
  });
  it("rejects invented feature keys", () => {
    expect(validateRules({ exclude: ["role:trainee", "credential:invented"] }, []).exclude).toEqual(["role:trainee"]);
  });
  it("a hard no trainees note removes trainees from the unreviewed pool", () => {
    const rules = validateRules({ exclude: ["role:trainee"] }, []);
    const prefs = applyLanguageRules(emptyPreferences(), rules);
    const ranked = rerank(prefs, [{ id: "resident", features: ["role:trainee"], base_score: 1 }, { id: "doctor", features: ["role:clinician"], base_score: 0.5 }]);
    expect(ranked[0].id).toBe("doctor");
    expect(ranked.find(r => r.id === "resident")?.pruned).toBe(true);
  });
  it("preserves parsed briefs and learned exclusions through later decisions", () => {
    const prefs = { ...emptyPreferences(), query: { brief: "Pain doctors", parsed: { specialties: ["pain"] } }, skip: { cities: [], employers: [], features: ["role:trainee"] } };
    const next = applyDecision(prefs, "approved", [], ["role:clinician"]);
    expect(next.query).toEqual(prefs.query);
    expect(next.skip.features).toEqual(["role:trainee"]);
  });
  it("questions do not change volume, status or brief", () => {
    expect(steeringPatch({ status: "sourcing", brief: "Pain doctors" }, { reply: "Your agent runs daily.", per_day: null, status: null, brief: null }, []).patch).toEqual({});
  });
});