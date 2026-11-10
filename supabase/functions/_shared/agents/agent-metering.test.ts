import { assertEquals } from "jsr:@std/assert";
import { activeAgentCount, agentPolicy, agentBuildCredits, AGENT_BUILD_CREDITS } from "./agent-metering.ts";

Deno.test("building an agent costs 15 credits", () => assertEquals(AGENT_BUILD_CREDITS, 15));
Deno.test("starter: 1 active agent, 10 results a day", () => {
  assertEquals(agentPolicy("starter").limit, 1);
  assertEquals(agentPolicy("starter").daily_max, 10);
});
Deno.test("pro: 4 active agents per user, 25 results a day", () => {
  assertEquals(agentPolicy("pro").limit, 4);
  assertEquals(agentPolicy("pro").scope, "user");
  assertEquals(agentPolicy("pro").daily_max, 25);
});
Deno.test("enterprise: no agent limit", () => assertEquals(agentPolicy("enterprise").limit, null));
Deno.test("enterprise allows 50 daily candidates", () => assertEquals(agentPolicy("enterprise").daily_max, 50));
Deno.test("unlimited pass has no agent build debit", () => assertEquals(agentBuildCredits(true), 0));
Deno.test("ordinary access remains 15 credits per build", () => assertEquals(agentBuildCredits(false), 15));
Deno.test("pro counts only the user's own active agents", () => {
  const rows = [{ status: "sourcing", owner_id: "a" }, { status: "sourcing", owner_id: "b" }, { status: "paused", owner_id: "a" }];
  assertEquals(activeAgentCount(rows, "pro", "a"), 1);
  assertEquals(activeAgentCount(rows, "starter", "a"), 2);
});
