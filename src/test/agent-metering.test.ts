import { describe, expect, it } from "vitest";
import { activeAgentCount, agentPolicy, AGENT_BUILD_CREDITS } from "../../supabase/functions/_shared/agents/agent-metering";

describe("agent plan metering", () => {
  it("Starter allows one active agent across the workspace", () => {
    expect(agentPolicy("starter")).toEqual({ limit: 1, scope: "workspace", daily_max: 10 });
    expect(activeAgentCount([{ status: "sourcing", owner_id: "other" }], "starter", "me")).toBe(1);
  });
  it("Pro allows four active agents per individual user", () => {
    expect(agentPolicy("pro")).toEqual({ limit: 4, scope: "user", daily_max: 25 });
    expect(activeAgentCount([{ status: "sourcing", owner_id: "other" }, { status: "calibrating", owner_id: "me" }], "pro", "me")).toBe(1);
  });
  it("Enterprise has no active agent cap", () => {
    expect(agentPolicy("enterprise").limit).toBeNull();
  });
  it("Every new agent costs 15 workspace credits", () => {
    expect(AGENT_BUILD_CREDITS).toBe(15);
  });
  it("Paused, completed and closed agents do not occupy active slots", () => {
    expect(activeAgentCount(["paused", "completed", "closed", "calibrating", "sourcing"].map((status) => ({ status, owner_id: "me" })), "starter", "me")).toBe(2);
  });
});