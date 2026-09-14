/**
 * audit.ts — the AI deep-dive pass over returned clinician results.
 *
 * Structure ported verbatim from search-talent/w2-audit.ts (grading and
 * ranking are ONE model pass; chunks run in parallel; graceful degradation
 * everywhere). The system prompt is the healthcare grader (blueprint §7
 * "Oslr grader translations" + §12).
 */

import type { SearchCriteria } from "./clinician-criteria.ts";

export type AuditVerdict = "strong" | "weak" | "reject";

export interface AuditRow {
  verdict: AuditVerdict;
  reason: string;
  evidence: string | null;
  /** Relevance 0-100 within the verdict, produced in the SAME pass. */
  score: number | null;
}

export interface AuditSummary {
  model: string;
  audited: number;
  strong: number;
  weak: number;
  rejected: number;
  waste_pct: number;
  elapsed_ms: number;
}

export interface AuditableResult {
  full_name?: string | null;
  headline?: string | null;
  summary?: string | null;
  job_title?: string | null;
  job_company_name?: string | null;
  job_seniority_level?: string | null;
  job_start_date?: string | null;
  location_locality?: string | null;
  location_region?: string | null;
  match_scope?: string | null;
  stage_fit?: string | null;
  employer_class?: string | null;
  experience_history?: Array<{
    company_name?: string | null;
    title?: string | null;
    is_primary?: boolean;
    start_date?: string | null;
    end_date?: string | null;
    summary?: string | null;
  }> | null;
  education?: Array<{
    school_name?: string | null;
    degrees?: string[];
    majors?: string[];
    end_date?: string | null;
  }> | null;
}

export const AUDIT_SYSTEM_PROMPT =
  `You are the results auditor for a clinical healthcare recruiting search engine (nurses, physicians, residents, APPs, allied health). You receive the recruiter's original natural-language query, the filters that were enforced, and a numbered list of candidate profiles the database returned. Every profile already satisfies the literal filters — your job is judging INTENT.

For each profile return a verdict:
- "strong": clearly the kind of clinician the recruiter is looking for. Quote the single most convincing verbatim snippet from the profile as evidence.
- "weak": satisfies the filters but misses part of the intent. Typical reasons: the matching role is a secondary/concurrent entry; the specialty is a sibling vertical (general ICU when CVICU was asked); the training year is adjacent (a PGY-2 when PGY-3 was asked — name the year); the geography matches the state but not the stated sub-region; the role has drifted toward administration.
- "reject": matched on a technicality a recruiter would call wrong (a passing mention of the key phrase, a wholly unrelated current occupation, a never-closed stale role).

Rules:
- Judge INTENT, not just words. "Nurses" wants licensed bedside or clinical RNs/LPNs; a "Nurse Innovator | Healthcare Executive" headline is not a staff nurse — weak at best, with the real current role named.
- CREDENTIALS ARE CLASSES, NOT INTERCHANGEABLE TITLES: RN, BSN, NP, PA-C, CRNA, MD, DO, DPM are different licenses. If the recruiter asked for nurses, a nurse practitioner is a DIFFERENT license class — include as weak with the class named in the reason, never silently as strong. If a credential was asked (e.g. CRNA), verify it appears on the profile (title, headline, education, credential letters after the name).
- TENSE IS INTENT. Unless the query explicitly asks for former/past people ("used to", "former", "background in"), the person's CURRENT primary occupation must fit the asked role and vertical. History never rescues a current role outside the asked vertical: a former cardiac nurse now in pharma sales is a "reject" for "cardiovascular nurses". (A CONTEXT line below may state that past-role candidates are the explicit premise of this page; only then does this rule not apply.) "Background in X" phrasing DOES license history for X — but the person must still currently be what the role words ask for.
- TRAINING STAGES ARE YEARS, VERIFIED FROM DATES: "PGY-3" means third post-graduate year. Verify stage AND year from the role start dates on the profile (a residency started ~26 months ago is PGY-3 territory this fall). An attending or fellow is a reject for a resident ask; a graduated (former) resident is a reject unless the page's CONTEXT says otherwise; an adjacent year is weak with the year named. Quote the date evidence. A "resident" entry with a start date many years back and a different primary role is a STALE never-closed position — reject it, naming the real current role. "PGY" titles are overwhelmingly PHARMACY residents — a pharmacy resident is a reject for a physician/podiatric residency ask.
- SPECIALTY FAMILIES ARE UMBRELLAS: CVICU/cath lab/telemetry are cardiovascular nursing; exact vertical = strong, sibling (general ICU for CVICU) = weak with the sibling named, different service line (school nurse for cardiovascular) = reject.
- EMPLOYER GROUPS: "at the VA" means CURRENTLY employed by a Veterans Affairs entity (VA medical centers, Veterans Health Care Systems). A VA stint years ago is not current VA employment.
- TRAVEL/AGENCY NURSES: an employer that is a staffing agency (Aya, AMN, Cross Country…) with facility assignments in the role text is a normal clinical career pattern — judge the clinical work, not the employer name. A travel-stint pattern is signal, not noise.
- OPENNESS TO MOVING: when the query asks who might leave or be open to a move, judge it like any other intent — no filter can express it. Positive: explicit openness language, a long unpromoted stint, employer turmoil in role text. Negative: a recent promotion or fresh "excited to join" language. Quote the signal.
- ROLE DESCRIPTIONS ARE FIRST-CLASS EVIDENCE — read every "role descriptions:" block before saying a profile shows no evidence; unit names, certifications and patient populations usually live only there.
- evidence MUST be copied verbatim from the profile data you were given (never invented, never outside knowledge). Keep it under 140 characters.
- reason: one short sentence, plain words, useful to a recruiter.
- Never reject for missing data you were not shown.
- score: 0-100, how well this person fits the ask RELATIVE TO THE OTHERS in this list. Use the whole range. Verdict outranks score: a weak 90 still sits below a strong 40.
- Output ONLY valid JSON: {"verdicts": [{"i": <profile number>, "verdict": "strong"|"weak"|"reject", "score": <0-100>, "reason": str, "evidence": str|null}, ...]} covering EVERY profile number you were given, no markdown.`;

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** One profile block for the audit prompt. */
export function auditProfileBlock(r: AuditableResult, i: number): string {
  const lines = [
    `#${i}`,
    `name: ${s(r.full_name) || "?"}`,
    `headline: ${s(r.headline)}`,
    `location: ${[s(r.location_locality), s(r.location_region)].filter(Boolean).join(", ")}`,
    `current: ${s(r.job_title)} @ ${s(r.job_company_name)}${s(r.job_start_date) ? ` (started ${s(r.job_start_date).slice(0, 7)})` : ""}`,
  ];
  if (r.employer_class) lines.push(`employer class: ${r.employer_class}`);
  if (r.job_seniority_level) lines.push(`seniority class: ${r.job_seniority_level}`);
  if (r.match_scope === "secondary") {
    lines.push(`note: matched via a secondary/concurrent role, not the primary one`);
  }
  if (r.stage_fit && r.stage_fit !== "unknown") {
    lines.push(`stage date check: ${r.stage_fit === "in_window" ? "start date fits the asked training year" : "start date does NOT fit the asked training year"}`);
  }
  const past = (r.experience_history ?? [])
    .filter((e) => e && e.is_primary !== true && s(e.company_name))
    .slice(0, 5)
    .map((e) => {
      const dates = [s(e.start_date).slice(0, 7), s(e.end_date).slice(0, 7)].filter(Boolean).join("→");
      return [[s(e.title), s(e.company_name)].filter(Boolean).join(" @ "), dates ? `(${dates})` : ""].filter(Boolean).join(" ");
    });
  if (past.length > 0) lines.push(`past roles: ${past.join("; ")}`);
  const edu = (r.education ?? [])
    .filter((e) => e && (s(e.school_name) || (e.degrees ?? []).length > 0))
    .slice(0, 4)
    .map((e) =>
      [
        (e.degrees ?? []).join("/"),
        (e.majors ?? []).join("/"),
        s(e.school_name),
        s(e.end_date) ? `ended ${s(e.end_date).slice(0, 7)}` : "",
      ].filter(Boolean).join(", ")
    );
  if (edu.length > 0) lines.push(`education: ${edu.join("; ")}`);
  if (s(r.summary)) lines.push(`about: ${s(r.summary).slice(0, 500)}`);
  const roleDescriptions = (r.experience_history ?? [])
    .filter((e) => e && s(e.summary))
    .slice(0, 4)
    .map((e) => `${[s(e.title), s(e.company_name)].filter(Boolean).join(" @ ")}: ${s(e.summary).slice(0, 600)}`);
  if (roleDescriptions.length > 0) {
    lines.push(`role descriptions:\n${roleDescriptions.join("\n")}`);
  }
  return lines.join("\n");
}

/** Full user message for one audit chunk (offset = index of chunk start). */
export function buildAuditUserMessage(
  query: string,
  criteria: SearchCriteria[],
  rows: AuditableResult[],
  offset: number,
  contextNote?: string,
): string {
  const filters = criteria
    .filter((c) => c.enforcement === "hard")
    .map((c) => `${c.kind}=${c.label}`)
    .join(", ");
  return [
    `RECRUITER'S QUERY: ${query}`,
    `ENFORCED FILTERS: ${filters}`,
    `TODAY: ${new Date().toISOString().slice(0, 10)}`,
    ...(contextNote ? [`CONTEXT: ${contextNote}`] : []),
    `PROFILES:`,
    ...rows.map((r, k) => auditProfileBlock(r, offset + k)),
  ].join("\n\n");
}

const VALID_VERDICTS = new Set<string>(["strong", "weak", "reject"]);

export function parseAuditVerdicts(raw: unknown): Map<number, AuditRow> {
  const out = new Map<number, AuditRow>();
  const verdicts = (raw as { verdicts?: unknown } | null)?.verdicts;
  if (!Array.isArray(verdicts)) return out;
  for (const v of verdicts) {
    if (!v || typeof v !== "object") continue;
    const row = v as Record<string, unknown>;
    const i = typeof row.i === "number" && Number.isInteger(row.i) ? row.i : null;
    const verdict = typeof row.verdict === "string" && VALID_VERDICTS.has(row.verdict)
      ? row.verdict as AuditVerdict
      : null;
    if (i === null || verdict === null) continue;
    const scoreRaw = row.score;
    const scoreNum = typeof scoreRaw === "number" ? scoreRaw : typeof scoreRaw === "string" ? Number(scoreRaw) : NaN;
    out.set(i, {
      verdict,
      reason: s(row.reason).slice(0, 200),
      evidence: s(row.evidence) ? s(row.evidence).slice(0, 160) : null,
      score: Number.isFinite(scoreNum) ? Math.min(100, Math.max(0, Math.round(scoreNum))) : null,
    });
  }
  return out;
}

/** strong → weak → unaudited → reject; use with a stable sort. */
export function auditTier(verdict: AuditVerdict | null | undefined): number {
  return verdict === "strong" ? 0 : verdict === "weak" ? 1 : verdict === "reject" ? 3 : 2;
}

export function summarizeAudit(
  model: string,
  total: number,
  rows: Map<number, AuditRow>,
  elapsedMs: number,
): AuditSummary {
  let strong = 0, weak = 0, rejected = 0;
  for (const r of rows.values()) {
    if (r.verdict === "strong") strong++;
    else if (r.verdict === "weak") weak++;
    else rejected++;
  }
  return {
    model,
    audited: rows.size,
    strong,
    weak,
    rejected,
    waste_pct: total > 0 ? Math.round((rejected / total) * 100) : 0,
    elapsed_ms: elapsedMs,
  };
}

export const AUDIT_CHUNK_SIZE = 25;

export type AuditTransport = <T>(
  systemPrompt: string,
  userMessage: string,
  fallback: T,
  layer: string,
  options?: { model?: string; timeoutMs?: number; maxTokens?: number },
) => Promise<T>;

/**
 * Run the audit over all rows (chunked, chunks in PARALLEL). Returns null
 * when nothing could be audited — callers pass rows through unaudited.
 * Never throws.
 */
export async function runClinicianAudit(
  transport: AuditTransport,
  model: string,
  query: string,
  criteria: SearchCriteria[],
  rows: AuditableResult[],
  opts: { contextNote?: string } = {},
): Promise<{ verdicts: Map<number, AuditRow>; summary: AuditSummary } | null> {
  if (rows.length === 0) return null;
  const t0 = Date.now();
  const layer = "Clinician-Audit";
  const verdicts = new Map<number, AuditRow>();
  const chunks: Array<{ chunk: AuditableResult[]; at: number }> = [];
  for (let at = 0; at < rows.length; at += AUDIT_CHUNK_SIZE) {
    chunks.push({ chunk: rows.slice(at, at + AUDIT_CHUNK_SIZE), at });
  }
  const settled = await Promise.all(chunks.map(({ chunk, at }) =>
    transport<unknown>(
      AUDIT_SYSTEM_PROMPT,
      buildAuditUserMessage(query, criteria, chunk, at, opts.contextNote),
      null,
      layer,
      { model, timeoutMs: 90_000, maxTokens: 8000 },
    ).catch((err) => {
      console.warn(`[${layer}] chunk@${at} failed — its rows pass through unaudited`, err);
      return null;
    })
  ));
  for (const raw of settled) {
    for (const [i, row] of parseAuditVerdicts(raw)) verdicts.set(i, row);
  }
  if (verdicts.size === 0) return null;
  return { verdicts, summary: summarizeAudit(model, rows.length, verdicts, Date.now() - t0) };
}
