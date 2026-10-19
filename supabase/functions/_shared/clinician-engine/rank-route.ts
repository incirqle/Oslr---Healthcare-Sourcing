/**
 * rank-route.ts: wires rank-actions.ts to the real cache and grader. Reads
 * only crustdata_cache rows written by this engine (the run snapshot and
 * per-criterion answers); it never calls the people-data provider.
 */
import { getCrustDataCache, setCrustDataCache, SEARCH_TTL_MS } from "./cache.ts";
import { callClaude, CLAUDE_OPUS, CLAUDE_SONNET } from "./ai-router.ts";
import { explainCriteria, rankCriteria, rowIdOf, runCacheKey, suggestCriteria, type ExplainItem, type RunSnapshot } from "./rank-actions.ts";
import type { RankingCriterion } from "./ranking-criteria.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export async function sha1Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const cacheGet = async (key: string) => (await getCrustDataCache(key))?.profiles?.[0] ?? null;
const cacheSet = (key: string, value: unknown) => setCrustDataCache(key, 1, [value], null);
const log = (e: Record<string, unknown>) => console.log(JSON.stringify(e));

/** Save the run's kept and hidden rows for later rank / explain calls. */
export async function saveRunSnapshot(runId: string, snap: RunSnapshot): Promise<void> {
  const rows = snap.rows.map((r) => {
    const { criteria_results: _a, match_breakdown: _b, ...rest } = r;
    return { ...rest, id: rowIdOf(r) };
  });
  await setCrustDataCache(runCacheKey(runId), rows.length, [{ meta: { user_id: snap.user_id, query: snap.query, criteria: snap.criteria } }, ...rows], null);
}

async function loadRunSnapshot(runId: string, userId: string): Promise<RunSnapshot | null> {
  const hit = await getCrustDataCache(runCacheKey(runId));
  const head = hit?.profiles?.[0]?.meta;
  if (!head || head.user_id !== userId) return null;
  return { user_id: head.user_id, query: head.query, criteria: head.criteria ?? [], rows: hit!.profiles.slice(1) };
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });

function validCriteria(raw: unknown): RankingCriterion[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 10) return null;
  const out: RankingCriterion[] = [];
  for (const [i, c] of raw.entries()) {
    const x = c as Row;
    if (!x || typeof x.id !== "string" || !/^[\w-]{1,40}$/.test(x.id)) return null;
    if (typeof x.text !== "string" || !x.text.trim() || x.text.length > 300) return null;
    out.push({
      id: x.id, text: x.text.trim(), title: String(x.title ?? ""), position: i, must_have: x.must_have === true,
      origin: x.origin === "parsed" || x.origin === "suggested" ? x.origin : "user",
      ...(typeof x.source_criterion_id === "string" ? { source_criterion_id: x.source_criterion_id } : {}),
    });
  }
  return out;
}

export async function handleRankAction(body: Row, userId: string, cors: Record<string, string>): Promise<Response> {
  const runId = typeof body.run_id === "string" && /^[\w-]{4,80}$/.test(body.run_id) ? body.run_id : null;
  if (!runId) return json({ error: "run_id is required" }, 400, cors);
  const snap = await loadRunSnapshot(runId, userId);
  if (!snap) return json({ error: "This search has expired. Run it again to check new criteria." }, 404, cors);

  if (body.action === "rank_criteria") {
    const criteria = validCriteria(body.criteria);
    if (!criteria) return json({ error: "criteria must be 1 to 10 items with id and text" }, 400, cors);
    if ((Deno.env.get("ANTHROPIC_API_KEY") ?? "") === "") return json({ error: "Checking criteria is unavailable right now." }, 503, cors);
    const model = Deno.env.get("CLINICIAN_AUDIT_MODEL") || CLAUDE_OPUS;
    const r = await rankCriteria(runId, snap, criteria, { transport: callClaude, model, cacheGet, cacheSet, sha1: sha1Hex, log });
    return json({ ...r, credits: 0 }, 200, cors);
  }

  // explain_criteria
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 60).filter((x: Row) =>
    x && typeof x.row_id === "string" && typeof x.criterion_id === "string" && typeof x.text === "string" && typeof x.status === "string"
  ) as ExplainItem[];
  if (items.length === 0) return json({ explanations: {} }, 200, cors);
  const explanations = await explainCriteria(runId, snap, items, { transport: callClaude, model: CLAUDE_SONNET, cacheGet, cacheSet, sha1: sha1Hex, log });
  return json({ explanations, credits: 0 }, 200, cors);
}

/** Suggestions for one query, cached 4h by query text. */
export async function suggestionsFor(query: string): Promise<string[]> {
  try {
    const key = `clin:suggest:${await sha1Hex(query.toLowerCase().trim())}`;
    const hit = (await cacheGet(key)) as { list?: string[] } | null;
    if (hit?.list?.length) return hit.list;
    if ((Deno.env.get("ANTHROPIC_API_KEY") ?? "") === "") return [];
    const list = await suggestCriteria(query, callClaude, CLAUDE_SONNET);
    if (list.length) await cacheSet(key, { list });
    return list;
  } catch {
    return [];
  }
}
