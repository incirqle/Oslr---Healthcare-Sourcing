// agents-tick: hourly. Runs each due agent at most once per ~24h, bounded per tick.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent, nextRunAt, sourceAgent } from "../_shared/agents/agent-core.ts";

const MAX_AGENTS_PER_TICK = 5;
const INACTIVE_DAYS = 7;
const MAX_EMPTY_RUNS = 3;

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  // Single-flight lease.
  const { data: lease } = await admin.from("clin_agent_lease")
    .update({ locked_until: new Date(now.getTime() + 10 * 60_000).toISOString() })
    .eq("id", 1).lt("locked_until", now.toISOString()).select("id");
  if (!lease || lease.length === 0) return new Response(JSON.stringify({ skipped: "locked" }), { status: 200 });

  const results: unknown[] = [];
  try {
    const { data: due } = await admin.from("clin_agents").select("*")
      .eq("status", "sourcing").lte("next_run_at", now.toISOString())
      .order("next_run_at", { ascending: true }).limit(MAX_AGENTS_PER_TICK);
    for (const agent of due ?? []) {
      const { data: feat } = await admin.from("company_features").select("agents_enabled").eq("company_id", agent.company_id).maybeSingle();
      const today = now.toISOString().slice(0, 10);
      let stop: { status: string; reason: string } | null = null;
      if (!feat?.agents_enabled) stop = { status: "paused", reason: "Agents are turned off for this team" };
      else if (agent.finish_date && agent.finish_date < today) stop = { status: "completed", reason: "Finish date reached" };
      else if (agent.last_reviewed_at && now.getTime() - new Date(agent.last_reviewed_at).getTime() > INACTIVE_DAYS * 86400_000) {
        stop = { status: "paused", reason: "Paused after 7 days without review" };
      }
      if (stop) {
        await admin.from("clin_agents").update({ status: stop.status, pause_reason: stop.reason }).eq("id", agent.id);
        await logEvent(admin, agent, "status_" + stop.status, { reason: stop.reason });
        results.push({ id: agent.id, stop });
        continue;
      }
      // Claim the slot first so a crash never re-runs a paid search within the day.
      const next = nextRunAt(agent.run_hour, agent.timezone, now);
      await admin.from("clin_agents").update({ next_run_at: next, last_run_at: now.toISOString() }).eq("id", agent.id);
      const r = await sourceAgent(admin, agent, { serve: agent.per_day });
      if (!r.ok) {
        const hard = r.status === 402 || r.status === 403;
        if (hard) {
          await admin.from("clin_agents").update({ status: "paused", pause_reason: r.error }).eq("id", agent.id);
        }
        await logEvent(admin, agent, "run_failed", { error: r.error, status: r.status });
        results.push({ id: agent.id, error: r.error });
        if (r.status === 429) break; // shared rate limit: stop this tick
        continue;
      }
      const empty = r.served === 0 ? (agent.empty_runs ?? 0) + 1 : 0;
      const patch: Record<string, unknown> = { empty_runs: empty };
      if (empty >= MAX_EMPTY_RUNS) { patch.status = "paused"; patch.pause_reason = "No new people for 3 runs. Try widening the search."; }
      await admin.from("clin_agents").update(patch).eq("id", agent.id);
      await logEvent(admin, agent, "daily_run", { served: r.served, added: r.added });
      results.push({ id: agent.id, served: r.served });
    }
  } finally {
    await admin.from("clin_agent_lease").update({ locked_until: new Date().toISOString() }).eq("id", 1);
  }
  return new Response(JSON.stringify({ ran: results.length, results }), { status: 200, headers: { "Content-Type": "application/json" } });
});
