// Agent limits per plan. The database trigger enforces the same numbers.
export const AGENT_BUILD_CREDITS = 15;
export const ACTIVE_AGENT_STATUSES = ["calibrating", "sourcing"] as const;

export function agentPolicy(plan: string | null | undefined) {
  if (plan === "enterprise") return { limit: null, scope: "workspace", daily_max: 50 } as const;
  if (plan === "pro") return { limit: 4, scope: "user", daily_max: 25 } as const;
  return { limit: 1, scope: "workspace", daily_max: 10 } as const;
}

export function activeAgentCount(
  rows: { status: string; owner_id: string }[], plan: string | null | undefined, userId: string,
) {
  const policy = agentPolicy(plan);
  return rows.filter((row) => ACTIVE_AGENT_STATUSES.some((s) => s === row.status)
    && (policy.scope === "workspace" || row.owner_id === userId)).length;
}
