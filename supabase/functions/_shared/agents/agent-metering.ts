export const AGENT_BUILD_CREDITS = 30;
export const ACTIVE_AGENT_STATUSES = ["calibrating", "sourcing"] as const;

export function agentPolicy(plan: string | null | undefined) {
  if (plan === "enterprise") return { limit: null, scope: "workspace" } as const;
  if (plan === "pro") return { limit: 5, scope: "user" } as const;
  return { limit: 1, scope: "workspace" } as const;
}

export function activeAgentCount(
  rows: { status: string; owner_id: string }[], plan: string | null | undefined, userId: string,
) {
  const policy = agentPolicy(plan);
  return rows.filter((row) => ACTIVE_AGENT_STATUSES.some((s) => s === row.status)
    && (policy.scope === "workspace" || row.owner_id === userId)).length;
}