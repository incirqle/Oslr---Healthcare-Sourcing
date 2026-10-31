// Sourcing + AI helpers shared by clinician-agent and agents-tick.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleClinicianSearch } from "../clinician-engine/handler.ts";
import { parseQuery } from "../clinician-engine/parse-query.ts";
import { getCrustDataCache, setCrustDataCache } from "../clinician-engine/cache.ts";
import {
  type AgentPreferences, featuresFor, rerank,
} from "./agent-brain.ts";

export const CALIBRATION_SIZE = 6;
export const MAX_PER_DAY = 10;

// deno-lint-ignore no-explicit-any
export type Agent = Record<string, any>;

export function prefsOf(agent: Agent): AgentPreferences {
  const p = agent.preferences ?? {};
  return {
    ...p,
    weights: p.weights ?? {},
    skip: { cities: p.skip?.cities ?? [], employers: p.skip?.employers ?? [], features: p.skip?.features ?? [] },
  };
}

/** Interpretation only: no people provider, search meter or contact enrichment. */
export async function interpretBrief(brief: string) {
  const key = "clin:parse:" + brief.trim().toLowerCase().replace(/\s+/g, " ");
  const cached = await getCrustDataCache(key);
  const parsed = await parseQuery(brief, cached?.profiles[0] ?? null);
  if (!cached) await setCrustDataCache(key, 1, [parsed], null);
  return parsed;
}

/** Next occurrence of run_hour in the agent's timezone, at least 20h from now. */
export function nextRunAt(runHour: number, timeZone: string, from = new Date()): string {
  const minAt = from.getTime() + 20 * 3600_000;
  for (let addDays = 0; addDays < 3; addDays++) {
    const day = new Date(from.getTime() + addDays * 86400_000);
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
    // Find the UTC instant whose local hour in timeZone equals runHour.
    const guess = new Date(`${ymd}T${String(runHour).padStart(2, "0")}:05:00Z`);
    const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(guess));
    const shifted = new Date(guess.getTime() - (localHour - runHour) * 3600_000);
    if (shifted.getTime() >= minAt) return shifted.toISOString();
  }
  return new Date(minAt).toISOString();
}

export async function logEvent(admin: SupabaseClient, agent: Agent, type: string, payload: Record<string, unknown> = {}) {
  const { error } = await admin.from("clin_agent_events").insert({
    agent_id: agent.id, company_id: agent.company_id, event_type: type, payload,
  });
  if (error) console.error("[agent] event insert failed", error.message);
}

/** Flat card/drawer shape from a raw engine row; the raw row stays under `raw`. */
export function flattenRow(r: Record<string, unknown>): Record<string, unknown> {
  const locality = (r.location_locality as string) ?? null;
  const region = (r.location_region as string) ?? null;
  const loc = (r.location as string) ?? [locality, region].filter(Boolean).join(", ");
  return {
    id: r.id ?? r.linkedin_url,
    full_name: r.full_name ?? "",
    title: r.title ?? r.job_title ?? r.headline ?? null,
    current_employer: r.current_employer ?? r.job_company_name ?? null,
    location: loc || null,
    linkedin_url: r.linkedin_url ?? null,
    profile_pic_url: r.profile_pic_url ?? r.profile_picture_url ?? null,
    company_logo_url: r.company_logo_url ?? r.job_company_logo_url ?? null,
    company_domain: r.company_domain ?? r.job_company_domain ?? null,
    summary: r.summary ?? r.headline ?? null,
    match_rate: r.match_rate ?? null,
    audit_score: r.audit_score ?? null,
    raw: r,
  };
}

/** Oslr cannot verify board certification, so it is never shown as a reason. */
export function stripCredentialClaims(text: string): string {
  return text
    .replace(/\b(?:double|triple|dual)?[- ]?board[- ]certified\s*(?:in\s+[\w\s]+?(?=[,.;]|$))?/gi, "")
    .replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").trim();
}

export interface SourceResult {
  ok: boolean;
  status?: number;
  error?: string;
  limit?: boolean;
  added: number;
  served: number;
}

/** Run the clinician search for this agent, add new people to the pool, serve the top N. */
export async function sourceAgent(
  admin: SupabaseClient,
  agent: Agent,
  opts: { authHeader?: string; userAgent?: string | null; serve: number },
): Promise<SourceResult> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // The signed-in browser's own user agent for in-app creates; scheduled runs
  // identify as the Oslr agent (server-side, behind the service key).
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-oslr-user-agent": opts.userAgent || "Mozilla/5.0 (compatible; OslrAgent/1.0)",
  };
  if (opts.authHeader) headers.Authorization = opts.authHeader;
  else { headers.Authorization = `Bearer ${serviceKey}`; headers["x-oslr-internal-user"] = agent.owner_id; }

  const prefs = prefsOf(agent);
  const parsed = prefs.query?.brief === agent.brief ? prefs.query.parsed : await interpretBrief(agent.brief);
  prefs.query = { brief: agent.brief, parsed };
  agent.preferences = prefs;
  const { error: parseSaveError } = await admin.from("clin_agents").update({ preferences: prefs }).eq("id", agent.id);
  if (parseSaveError) return { ok: false, status: 500, error: "Could not save your search interpretation.", added: 0, served: 0 };
  const res = await handleClinicianSearch(new Request("http://internal/search", {
    method: "POST", headers, body: JSON.stringify({ query: agent.brief, cached_parsed: parsed, page: 0, size: 50 }),
  }));
  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try { body = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    return {
      ok: false, status: res.status, error: body?.error ?? "Search failed",
      limit: res.status === 429 || !!body?.limit_code, added: 0, served: 0,
    };
  }
  const rows: Record<string, unknown>[] = Array.isArray(body.results) ? body.results : [];
  const { data: existing } = await admin.from("clin_agent_pool").select("person_id").eq("agent_id", agent.id);
  const seen = new Set((existing ?? []).map((r) => r.person_id));
  const fresh = rows.map(flattenRow).filter((r) => r.id && !seen.has(String(r.id)));
  if (fresh.length > 0) {
    const inserts = fresh.map((r) => {
      const mr = typeof r.match_rate === "number" ? r.match_rate : typeof r.audit_score === "number" ? r.audit_score : 50;
      const base = Math.max(0.05, Math.min(1, mr / 100));
      return {
        agent_id: agent.id, company_id: agent.company_id, person_id: String(r.id),
        profile: r, features: featuresFor(r),
        why: stripCredentialClaims(String((r.raw as Record<string, unknown>).audit_reason ?? "")).slice(0, 400) || null,
        base_score: base, boost: 1, final_score: base,
      };
    });
    const { error } = await admin.from("clin_agent_pool").upsert(inserts, { onConflict: "agent_id,person_id", ignoreDuplicates: true });
    if (error) return { ok: false, status: 500, error: "Could not save matches: " + error.message, added: 0, served: 0 };
  }
  const served = await rerankAndServe(admin, agent, opts.serve);
  await logEvent(admin, agent, "batch_sourced", { added: fresh.length, served, total_seen: rows.length });
  return { ok: true, added: fresh.length, served };
}

/** Re-score every unreviewed row and mark the top `serve` waiting rows as served. */
export async function rerankAndServe(admin: SupabaseClient, agent: Agent, serve: number): Promise<number> {
  const prefs = prefsOf(agent);
  const { data: rows } = await admin.from("clin_agent_pool")
    .select("id, features, base_score, served_at").eq("agent_id", agent.id).is("decision", null);
  const ranked = rerank(prefs, (rows ?? []).map((r) => ({ ...r, features: r.features ?? [] })));
  const now = new Date().toISOString();
  let toServe = serve;
  let served = 0;
  for (const r of ranked) {
    const serveIt = !r.served_at && !r.pruned && toServe > 0;
    if (serveIt) { toServe--; served++; }
    await admin.from("clin_agent_pool").update({
      boost: r.boost, final_score: r.final_score, pruned: r.pruned,
      ...(serveIt ? { served_at: now } : {}),
    }).eq("id", r.id);
  }
  return served;
}

/* ── Lovable AI Gateway (Responses, streamed) ─────────────────────────── */

export class AiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function aiText(
  instructions: string,
  input: string,
  schema?: { name: string; schema: Record<string, unknown> },
): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new AiError(401, "AI is not configured");
  const body: Record<string, unknown> = {
    model: "openai/gpt-6-astra",
    instructions,
    input,
    stream: true,
    store: false,
    reasoning: { effort: "low" },
  };
  if (schema) body.text = { format: { type: "json_schema", name: schema.name, strict: true, schema: schema.schema } };
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`, "Lovable-API-Key": key,
      "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    let message = "AI request failed";
    try { const e = JSON.parse(t); message = e.message ?? e.error?.message ?? message; } catch { /* no safe message */ }
    throw new AiError(res.status, message);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.refusal.delta") throw new AiError(403, ev.delta || "The agent could not process this request.");
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
        if (ev.type === "response.failed" || ev.type === "error") throw new AiError(500, ev.error?.message ?? "AI failed");
      } catch (e) { if (e instanceof AiError) throw e; }
    }
  }
  if (!out.trim()) throw new AiError(502, "The agent returned no answer. No changes were applied.");
  return out.trim();
}

/** Regenerate the three-part taste memo from decisions so far. */
export async function refreshTasteMemo(admin: SupabaseClient, agent: Agent): Promise<string | null> {
  const { data: decs, error: dErr } = await admin.from("clin_agent_decisions")
    .select("decision, tags, note, skip_city, pool:clin_agent_pool(profile)")
    .eq("agent_id", agent.id).order("created_at", { ascending: false }).limit(40);
  if (dErr) console.warn("[agent] memo decisions read failed", dErr.message);
  if (!decs || decs.length === 0) return null;
  const lines = decs.map((d) => {
    // deno-lint-ignore no-explicit-any
    const p = (d as any).pool?.profile ?? {};
    return `${d.decision.toUpperCase()}: ${p.full_name ?? ""}, ${p.title ?? ""} at ${p.current_employer ?? ""} (${p.location ?? ""}). Tags: ${(d.tags ?? []).join(", ") || "none"}.${d.note ? " Note: " + d.note : ""}${d.skip_city ? " Skip town: " + d.skip_city : ""}`;
  }).join("\n");
  try {
    const memo = await aiText(
      "You help a healthcare recruiter's sourcing agent learn their taste. Write three short paragraphs titled 'Favor:', 'Ignore:', 'Never:'. Plain words, no dashes as punctuation, no credential or board certification claims, no demographic or diversity language. Under 120 words total.",
      `Search brief: ${agent.brief}\n\nDecisions:\n${lines}`,
    );
    if (memo) await admin.from("clin_agents").update({ taste_memo: memo }).eq("id", agent.id);
    return memo || null;
  } catch (e) {
    console.warn("[agent] taste memo failed", e instanceof Error ? e.message : e);
    return null;
  }
}
