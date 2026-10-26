// clinician-agent: create / list / roster / decide / steer / update for Oslr Agents.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveCaller } from "../_shared/clinician-engine/lib/auth.ts";
import { APPROVE_TAGS, applyDecision, approvalSignals, PASS_TAGS } from "../_shared/agents/agent-brain.ts";
import {
  AiError, aiText, CALIBRATION_SIZE, logEvent, MAX_PER_DAY, nextRunAt, prefsOf,
  refreshTasteMemo, rerankAndServe, sourceAgent,
} from "../_shared/agents/agent-core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-oslr-user-agent",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const caller = await resolveCaller(admin, req);
    if (!caller || req.headers.get("x-oslr-internal-user")) return json({ error: "Please sign in." }, 401);
    const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", caller.userId).maybeSingle();
    const companyId = prof?.company_id as string | undefined;
    if (!companyId) return json({ error: "No workspace found." }, 400);
    const { data: feat } = await admin.from("company_features").select("agents_enabled").eq("company_id", companyId).maybeSingle();
    if (!feat?.agents_enabled) return json({ error: "Agents are not turned on for your team.", locked: true }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    const loadAgent = async (id: unknown) => {
      if (typeof id !== "string") return null;
      const { data } = await admin.from("clin_agents").select("*").eq("id", id).eq("company_id", companyId).maybeSingle();
      return data;
    };

    if (action === "list") {
      const { data: agents } = await admin.from("clin_agents").select("*").eq("company_id", companyId)
        .neq("status", "closed").order("created_at", { ascending: false });
      const ids = (agents ?? []).map((a) => a.id);
      const { data: pool } = ids.length
        ? await admin.from("clin_agent_pool").select("agent_id, decision, served_at, pruned").in("agent_id", ids)
        : { data: [] };
      const stats: Record<string, { waiting: number; approved: number; passed: number }> = {};
      for (const p of pool ?? []) {
        const s = (stats[p.agent_id] ??= { waiting: 0, approved: 0, passed: 0 });
        if (p.decision === "approved") s.approved++;
        else if (p.decision === "passed") s.passed++;
        else if (p.served_at && !p.pruned) s.waiting++;
      }
      return json({ agents: (agents ?? []).map((a) => ({ ...a, stats: stats[a.id] ?? { waiting: 0, approved: 0, passed: 0 } })) });
    }

    if (action === "create") {
      const name = String(body.name ?? "").trim().slice(0, 120);
      const brief = String(body.brief ?? "").trim().slice(0, 500);
      if (!name || brief.length < 8) return json({ error: "Add a name and describe who to find." }, 400);
      const perDay = Math.max(1, Math.min(MAX_PER_DAY, Number(body.per_day) || 10));
      const goal = body.goal ? Math.max(1, Math.min(1000, Number(body.goal))) : null;
      const finish = typeof body.finish_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.finish_date) ? body.finish_date : null;
      const tz = typeof body.timezone === "string" && body.timezone.length < 60 ? body.timezone : "America/New_York";
      let projectId: string | null = typeof body.project_id === "string" ? body.project_id : null;
      if (projectId) {
        const { data: p } = await admin.from("projects").select("id").eq("id", projectId).eq("company_id", companyId).maybeSingle();
        if (!p) projectId = null;
      }
      if (!projectId) {
        const { data: p, error } = await admin.from("projects")
          .insert({ company_id: companyId, name, description: brief, created_by: caller.userId }).select("id").single();
        if (error) return json({ error: "Could not create the project." }, 500);
        projectId = p.id;
      }
      const { data: agent, error } = await admin.from("clin_agents").insert({
        company_id: companyId, project_id: projectId, owner_id: caller.userId, name, brief,
        per_day: perDay, goal, finish_date: finish, timezone: tz, status: "calibrating",
      }).select("*").single();
      if (error) return json({ error: "Could not create the agent." }, 500);
      await logEvent(admin, agent, "chat", { role: "user", text: brief });
      await logEvent(admin, agent, "calibration_started", {});
      const r = await sourceAgent(admin, agent, { authHeader: req.headers.get("Authorization")!, serve: CALIBRATION_SIZE });
      if (!r.ok) {
        await admin.from("clin_agents").update({ status: "paused", pause_reason: r.error }).eq("id", agent.id);
        return json({ agent_id: agent.id, warning: r.error });
      }
      await logEvent(admin, agent, "chat", {
        role: "agent",
        text: r.served > 0
          ? `I found ${r.served} people to start. Approve or pass each one so I learn what you want.`
          : "I could not find anyone for this yet. Try widening the area or the role.",
      });
      return json({ agent_id: agent.id, served: r.served });
    }

    const agent = await loadAgent(body.agent_id);
    if (!agent) return json({ error: "Agent not found." }, 404);

    if (action === "roster") {
      const [{ data: pool }, { data: decisions }, { data: events }] = await Promise.all([
        admin.from("clin_agent_pool").select("id, person_id, profile, features, why, final_score, served_at, decision, decided_at, pruned")
          .eq("agent_id", agent.id).or("served_at.not.is.null,decision.not.is.null").order("final_score", { ascending: false }),
        admin.from("clin_agent_decisions").select("pool_id, decision, tags, note, skip_city, created_at")
          .eq("agent_id", agent.id).order("created_at", { ascending: false }),
        admin.from("clin_agent_events").select("event_type, payload, created_at").eq("agent_id", agent.id)
          .order("created_at", { ascending: true }).limit(300),
      ]);
      const featById = new Map((pool ?? []).map((p) => [p.id, p.features ?? []]));
      const signals = approvalSignals((decisions ?? []).map((d) => ({ decision: d.decision, features: featById.get(d.pool_id) ?? [] })));
      const { data: waitingTotal } = await admin.from("clin_agent_pool").select("id", { count: "exact", head: false })
        .eq("agent_id", agent.id).is("decision", null).is("served_at", null).eq("pruned", false);
      return json({
        agent, pool: pool ?? [], decisions: decisions ?? [], events: events ?? [], signals,
        reserve: (waitingTotal ?? []).length, tags: { approve: APPROVE_TAGS, pass: PASS_TAGS },
      });
    }

    if (action === "decide") {
      const decision = body.decision === "approved" ? "approved" : body.decision === "passed" ? "passed" : null;
      if (!decision) return json({ error: "Pick approve or pass." }, 400);
      const allowed = new Set<string>([...APPROVE_TAGS, ...PASS_TAGS].map((t) => t.id as string));
      const tags: string[] = (Array.isArray(body.tags) ? body.tags : []).filter((t: unknown): t is string => typeof t === "string" && allowed.has(t)).slice(0, 8);
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) || null : null;
      const skipCity = typeof body.skip_city === "string" ? body.skip_city.trim().slice(0, 80) || null : null;
      const { data: row } = await admin.from("clin_agent_pool").select("*").eq("id", body.pool_id).eq("agent_id", agent.id).maybeSingle();
      if (!row) return json({ error: "Person not found." }, 404);

      const now = new Date().toISOString();
      const { error: dErr } = await admin.from("clin_agent_decisions").insert({
        agent_id: agent.id, company_id: companyId, pool_id: row.id, user_id: caller.userId,
        decision, tags, note, skip_city: skipCity,
      });
      if (dErr) return json({ error: "Could not save your decision." }, 500);
      await admin.from("clin_agent_pool").update({ decision, decided_at: now }).eq("id", row.id);
      const prefs = applyDecision(prefsOf(agent), decision, tags, row.features ?? [], decision === "passed" ? skipCity : null);
      agent.preferences = prefs;

      // Approved people land in the agent's project pipeline.
      if (decision === "approved" && agent.project_id) {
        const p = row.profile ?? {};
        const { data: dup } = await admin.from("candidates").select("id").eq("project_id", agent.project_id).eq("person_id", row.person_id).maybeSingle();
        if (!dup) {
          const { error: cErr } = await admin.from("candidates").insert({
            company_id: companyId, project_id: agent.project_id, person_id: row.person_id,
            full_name: p.full_name ?? "Unknown", title: p.title ?? null, current_employer: p.current_employer ?? null,
            location: p.location ?? null, linkedin_url: p.linkedin_url ?? null, skills: p.skills ?? null,
            avg_tenure_months: p.avg_tenure_months ?? null, raw_data: p.raw ?? p, added_by: caller.userId,
            notes: note, tags: ["agent"], status: "new",
          });
          if (cErr) console.error("[agent] candidate insert failed", cErr.message);
        }
      }

      // Calibration done when nothing served is still waiting.
      const { count: waiting } = await admin.from("clin_agent_pool").select("id", { count: "exact", head: true })
        .eq("agent_id", agent.id).is("decision", null).not("served_at", "is", null).eq("pruned", false);
      const patch: Record<string, unknown> = { preferences: prefs, last_reviewed_at: now };
      if (agent.status === "calibrating" && (waiting ?? 0) === 0) {
        patch.status = "sourcing";
        patch.next_run_at = nextRunAt(agent.run_hour, agent.timezone);
        await logEvent(admin, agent, "calibration_completed", {});
      }
      const { count: saved } = await admin.from("clin_agent_pool").select("id", { count: "exact", head: true })
        .eq("agent_id", agent.id).eq("decision", "approved");
      if (agent.goal && (saved ?? 0) >= agent.goal) {
        patch.status = "completed";
        await logEvent(admin, agent, "goal_reached", { saved });
      }
      await admin.from("clin_agents").update(patch).eq("id", agent.id);
      await rerankAndServe(admin, agent, 0);
      if (tags.length > 0 || note) await refreshTasteMemo(admin, agent);
      return json({ ok: true, status: patch.status ?? agent.status });
    }

    if (action === "steer") {
      const message = String(body.message ?? "").trim().slice(0, 600);
      if (!message) return json({ error: "Type a message." }, 400);
      await logEvent(admin, agent, "chat", { role: "user", text: message });
      let out: { reply: string; skip_cities: string[]; brief_addition: string } = { reply: "", skip_cities: [], brief_addition: "" };
      try {
        const raw = await aiText(
          "You are an Oslr sourcing agent for clinical hiring (doctors, nurses, allied health). The recruiter is steering you. Reply in one or two friendly plain sentences, no dashes as punctuation. If they ask to skip towns, list them in skip_cities. If they change who to find, write a short phrase to add to the search in brief_addition, else empty. Never claim board certification, NPI or hospital privileges data. Never use demographic or diversity language.",
          `Brief: ${agent.brief}\nTaste memo: ${agent.taste_memo ?? "none yet"}\nRecruiter: ${message}`,
          { name: "steer", schema: {
            type: "object", additionalProperties: false, required: ["reply", "skip_cities", "brief_addition"],
            properties: { reply: { type: "string" }, skip_cities: { type: "array", items: { type: "string" } }, brief_addition: { type: "string" } },
          } },
        );
        out = JSON.parse(raw);
      } catch (e) {
        const status = e instanceof AiError ? e.status : 500;
        const msg = status === 402 ? "AI credits are used up for now." : status === 429 ? "The agent is busy. Try again in a minute." : "The agent could not answer right now.";
        await logEvent(admin, agent, "chat", { role: "agent", text: msg });
        return json({ error: msg }, status === 402 || status === 429 ? status : 502);
      }
      const prefs = prefsOf(agent);
      for (const c of out.skip_cities ?? []) if (c && !prefs.skip.cities.includes(c)) prefs.skip.cities.push(c.slice(0, 80));
      const patch: Record<string, unknown> = { preferences: prefs };
      const add = (out.brief_addition ?? "").trim();
      if (add) patch.brief = `${agent.brief}. ${add}`.slice(0, 500);
      await admin.from("clin_agents").update(patch).eq("id", agent.id);
      agent.preferences = prefs;
      await rerankAndServe(admin, agent, 0);
      await logEvent(admin, agent, "chat", { role: "agent", text: out.reply || "Got it.", brief_addition: add || null, skip_cities: out.skip_cities ?? [] });
      return json({ ok: true, reply: out.reply });
    }

    if (action === "update") {
      const patch: Record<string, unknown> = {};
      if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
      if (typeof body.email_updates === "boolean") patch.email_updates = body.email_updates;
      if (body.status === "paused" && ["sourcing", "calibrating"].includes(agent.status)) { patch.status = "paused"; patch.pause_reason = "Paused by you"; }
      if (body.status === "resume" && agent.status === "paused") {
        patch.status = "sourcing"; patch.pause_reason = null; patch.empty_runs = 0;
        patch.next_run_at = nextRunAt(agent.run_hour, agent.timezone);
      }
      if (body.status === "closed") patch.status = "closed";
      if (typeof body.unskip_city === "string") {
        const prefs = prefsOf(agent);
        prefs.skip.cities = prefs.skip.cities.filter((c) => c !== body.unskip_city);
        patch.preferences = prefs;
      }
      if (Object.keys(patch).length === 0) return json({ error: "Nothing to change." }, 400);
      await admin.from("clin_agents").update(patch).eq("id", agent.id);
      if (patch.status) await logEvent(admin, agent, "status_" + String(patch.status), {});
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    console.error("[clinician-agent]", e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});
