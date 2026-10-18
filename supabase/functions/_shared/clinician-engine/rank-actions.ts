/**
 * rank-actions.ts: rank_criteria (spec 6.2, 6.3), explain_criteria (6.4)
 * and per-search suggestions. Pure: every side effect (grader, cache, log)
 * is injected, and nothing here can reach the people-data provider. The
 * only rows used are the ones cached for the run, so these actions never
 * spend provider credits (rank-actions.test.ts proves it).
 */

import { auditProfileBlock, runClinicianAudit, type AuditableResult, type AuditTransport } from "./audit.ts";
import { resolveRanking, shortTitle, type CriterionResult, type RankingCriterion } from "./ranking-criteria.ts";
import type { SearchCriteria } from "./clinician-criteria.ts";

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export interface RunSnapshot {
  user_id: string;
  query: string;
  criteria: SearchCriteria[];
  rows: Row[];
}

export interface RankDeps {
  transport: AuditTransport;
  model: string;
  cacheGet: (key: string) => Promise<unknown | null>;
  cacheSet: (key: string, value: unknown) => Promise<void>;
  sha1: (s: string) => Promise<string>;
  log?: (event: Record<string, unknown>) => void;
}

export const rowIdOf = (r: Row): string => String(r.id ?? r.linkedin_url ?? "");
export const runCacheKey = (runId: string) => `clin:run:${runId}`;
export const critCacheKey = async (runId: string, text: string, sha1: RankDeps["sha1"]) =>
  `clin:crit:${runId}:${await sha1(text.toLowerCase().trim())}`;

/** The grader may name a 1-2 word title; otherwise the text-derived one. */
export function cleanTitle(raw: unknown, text: string): string {
  if (typeof raw === "string") {
    const t = raw.replace(/[\u2013\u2014]/g, "-").replace(/["'.]/g, "").trim();
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length >= 1 && words.length <= 2 && t.length <= 18) return t;
  }
  return shortTitle(text);
}

export const TITLE_NOTE =
  'Also add a top-level "titles" object: {"<criterion id>": "<1-2 word column title>"} for every RANKING CRITERIA id, plain words, no punctuation.';

/** Pull {"titles": {...}} out of a grader chunk. */
export function titlesFromRaw(raw: unknown): Record<string, string> {
  const t = (raw as { titles?: unknown } | null)?.titles;
  if (!t || typeof t !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
  return out;
}

interface CachedCrit {
  title: string;
  results: Record<string, CriterionResult>;
}

export interface RankOutcome {
  criteria_results_by_row: Record<string, CriterionResult[]>;
  titles: Record<string, string>;
  failed: string[];
  stats: { rows: number; rule_decided: number; graded_rows: number; cached_criteria: number; elapsed_ms: number };
}

/**
 * Check new or edited criteria against every cached row of the run: rules
 * first, then ONE grader pass (chunked, parallel, the audit's model and
 * prompt) over the rows rules could not decide. Each criterion's answers
 * are cached by run + text, so the same text never re-grades.
 */
export async function rankCriteria(
  runId: string,
  snap: RunSnapshot,
  criteria: RankingCriterion[],
  deps: RankDeps,
): Promise<RankOutcome> {
  const t0 = Date.now();
  const byId = new Map(snap.criteria.map((c) => [c.id, c]));
  const out: Record<string, CriterionResult[]> = {};
  const push = (rowId: string, r: CriterionResult) => (out[rowId] ??= []).push(r);
  const titles: Record<string, string> = {};
  const failed: string[] = [];
  let ruleDecided = 0, cachedCount = 0;

  const todo: { rc: RankingCriterion; key: string; rules: Map<string, CriterionResult | null> }[] = [];
  for (const rc of criteria) {
    const key = await critCacheKey(runId, rc.text, deps.sha1);
    const hit = (await deps.cacheGet(key)) as CachedCrit | null;
    if (hit && hit.results) {
      cachedCount++;
      titles[rc.id] = hit.title;
      for (const r of snap.rows) {
        const id = rowIdOf(r);
        const res = hit.results[id];
        push(id, { ...(res ?? { status: "unknown", source: "grader", evidence: null, section: null, explanation: null }), criterion_id: rc.id } as CriterionResult);
      }
      continue;
    }
    const rules = new Map<string, CriterionResult | null>();
    for (const r of snap.rows) {
      const res = resolveRanking(rc, byId, r);
      if (res) ruleDecided++;
      rules.set(rowIdOf(r), res);
    }
    todo.push({ rc, key, rules });
  }

  let gradedRows = 0;
  if (todo.length > 0) {
    // Rows with at least one undecided criterion, and which ids each needs.
    const need = snap.rows
      .map((r) => ({ r, ids: new Set(todo.filter((t) => t.rules.get(rowIdOf(r)) === null).map((t) => t.rc.id)) }))
      .filter((x) => x.ids.size > 0);
    gradedRows = need.length;
    const rawTitles: Record<string, string> = {};
    const audit = need.length === 0 ? null : await runClinicianAudit(
      deps.transport,
      deps.model,
      snap.query,
      snap.criteria,
      need.map((x) => x.r as AuditableResult),
      {
        contextNote: TITLE_NOTE,
        ranking: todo.map((t) => ({ id: t.rc.id, text: t.rc.text })),
        pendingFor: (i) => need[i]?.ids ?? new Set<string>(),
        onRaw: (raw) => Object.assign(rawTitles, titlesFromRaw(raw)),
      },
    );
    const answered = new Map<string, Map<string, CriterionResult>>(); // crit -> row -> result
    need.forEach((x, i) => {
      const v = audit?.verdicts.get(i);
      for (const g of v?.criteria ?? []) {
        if (!x.ids.has(g.criterion_id)) continue;
        const m = answered.get(g.criterion_id) ?? new Map();
        m.set(rowIdOf(x.r), { criterion_id: g.criterion_id, status: g.status, source: "grader", evidence: g.evidence, section: g.section, explanation: null });
        answered.set(g.criterion_id, m);
      }
    });
    for (const t of todo) {
      const graded = answered.get(t.rc.id) ?? new Map();
      const expected = need.filter((x) => x.ids.has(t.rc.id)).length;
      if (expected > 0 && graded.size === 0) {
        failed.push(t.rc.id);
        continue;
      }
      const title = cleanTitle(rawTitles[t.rc.id], t.rc.text);
      titles[t.rc.id] = title;
      const results: Record<string, CriterionResult> = {};
      for (const r of snap.rows) {
        const id = rowIdOf(r);
        const res = t.rules.get(id) ?? graded.get(id) ??
          { criterion_id: t.rc.id, status: "unknown" as const, source: "grader" as const, evidence: null, section: null, explanation: null };
        results[id] = res;
        push(id, res);
      }
      // Only a complete answer is cached; a partial one re-grades on Retry.
      if (graded.size >= expected) await deps.cacheSet(t.key, { title, results } satisfies CachedCrit);
    }
  }

  const stats = { rows: snap.rows.length, rule_decided: ruleDecided, graded_rows: gradedRows, cached_criteria: cachedCount, elapsed_ms: Date.now() - t0 };
  deps.log?.({
    event: "clinician_rank_criteria",
    run_id: runId,
    model: deps.model,
    criteria: criteria.length,
    graded_criteria: todo.length,
    failed: failed.length,
    ...stats,
    criteria_tokens_est: 40 * todo.length * gradedRows,
  });
  return { criteria_results_by_row: out, titles, failed, stats };
}

/* ------------------------------------------------------------------ */
/*  explain_criteria (spec 6.4)                                        */
/* ------------------------------------------------------------------ */

export interface ExplainItem {
  row_id: string;
  criterion_id: string;
  text: string;
  status: string;
  evidence: string | null;
}

export const EXPLAIN_SYSTEM_PROMPT =
  `You explain a recruiter's search results. For each numbered item you get a candidate profile, one criterion, and the verdict already given (yes, partly, not_shown, no) with its evidence. Write ONE plain sentence (under 30 words) saying why that verdict fits, using only the profile data shown. Never change the verdict. Never use dashes as punctuation. Output ONLY JSON: {"explanations": [{"k": <item number>, "text": str}]}.`;

const STATUS_WORD: Record<string, string> = { met: "yes", partial: "partly", unknown: "not_shown", not_met: "no" };

export async function explainCriteria(
  runId: string,
  snap: RunSnapshot,
  items: ExplainItem[],
  deps: Omit<RankDeps, "model"> & { model: string },
): Promise<Record<string, string>> {
  const rows = new Map(snap.rows.map((r) => [rowIdOf(r), r]));
  const out: Record<string, string> = {};
  const keyOf = async (it: ExplainItem) => `clin:explain:${runId}:${it.row_id}:${it.criterion_id}:${await deps.sha1(it.text.toLowerCase().trim() + "|" + it.status)}`;
  const todo: { it: ExplainItem; key: string }[] = [];
  for (const it of items) {
    if (!rows.has(it.row_id)) continue;
    const key = await keyOf(it);
    const hit = (await deps.cacheGet(key)) as { text?: string } | null;
    if (hit?.text) out[`${it.row_id}|${it.criterion_id}`] = hit.text;
    else todo.push({ it, key });
  }
  if (todo.length === 0) return out;
  const msg = todo.map(({ it }, k) => [
    `ITEM ${k}`,
    auditProfileBlock(rows.get(it.row_id) as AuditableResult, k),
    `CRITERION: ${it.text}`,
    `VERDICT: ${STATUS_WORD[it.status] ?? it.status}`,
    `EVIDENCE: ${it.evidence ?? "none"}`,
  ].join("\n")).join("\n\n");
  const raw = await deps.transport<unknown>(EXPLAIN_SYSTEM_PROMPT, msg, null, "Clinician-Explain", {
    model: deps.model, timeoutMs: 30_000, maxTokens: 120 * todo.length + 200,
  }).catch(() => null);
  const list = (raw as { explanations?: unknown } | null)?.explanations;
  if (Array.isArray(list)) {
    for (const e of list) {
      const k = typeof (e as Row)?.k === "number" ? (e as Row).k : -1;
      const text = typeof (e as Row)?.text === "string" ? String((e as Row).text).replace(/\s*[\u2013\u2014]\s*/g, ", ").trim().slice(0, 300) : "";
      const t = todo[k];
      if (!t || !text) continue;
      out[`${t.it.row_id}|${t.it.criterion_id}`] = text;
      await deps.cacheSet(t.key, { text });
    }
  }
  deps.log?.({ event: "clinician_explain_criteria", run_id: runId, model: deps.model, asked: todo.length, answered: Object.keys(out).length });
  return out;
}

/* ------------------------------------------------------------------ */
/*  Suggestions for this search (spec 9.2)                             */
/* ------------------------------------------------------------------ */

/** Things Oslr cannot check: never suggested. */
export const UNCHECKABLE = /privileg|\bnpi\b|publicat|publish|licen[cs]/i;

export const SUGGEST_SYSTEM_PROMPT =
  `You help a healthcare recruiter rank search results. Given their search, suggest 6 short PREFERRED criteria (each under 60 characters) that a recruiter for this exact clinical role would rank by and that can be judged from a professional profile: training, fellowship, procedures, care setting, patient population, experience, employer type, leadership. Never suggest anything about hospital privileges, NPI numbers, publications or state licenses. No dashes as punctuation. Output ONLY JSON: {"suggestions": [str, ...]}.`;

export function cleanSuggestions(raw: unknown, exclude: string[] = []): string[] {
  const list = (raw as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(list)) return [];
  const taken = new Set(exclude.map((x) => x.toLowerCase().trim()));
  const out: string[] = [];
  for (const s of list) {
    if (typeof s !== "string") continue;
    const t = s.replace(/\s*[\u2013\u2014]\s*/g, ", ").trim();
    if (!t || t.length > 80 || UNCHECKABLE.test(t) || taken.has(t.toLowerCase())) continue;
    taken.add(t.toLowerCase());
    out.push(t);
    if (out.length === 6) break;
  }
  return out.length >= 4 ? out : [];
}

export async function suggestCriteria(query: string, transport: AuditTransport, model: string): Promise<string[]> {
  const raw = await transport<unknown>(SUGGEST_SYSTEM_PROMPT, `SEARCH: ${query}`, null, "Clinician-Suggest", {
    model, timeoutMs: 12_000, maxTokens: 400,
  }).catch(() => null);
  return cleanSuggestions(raw);
}
