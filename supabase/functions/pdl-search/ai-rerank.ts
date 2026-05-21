/**
 * ai-rerank.ts — LLM re-ranking of top N PDL results against parsed query intent.
 *
 * Uses Claude Haiku (via direct Anthropic API) for fast, reliable structured classification.
 * Gemini Pro consistently timed out at 50 candidates with tool calls; Haiku returns compact
 * JSON in ~3-6s for the same payload.
 *
 * Strategy:
 *  - Take top 50 by deterministic score (already sorted)
 *  - Build a compact JSON brief per candidate
 *  - Single Claude call returns array of { id, score }
 *  - On any failure: return original list unchanged (safe fallback)
 */

import type { FormattedCandidate } from "./format-results.ts";
import { callClaude, CLAUDE_HAIKU } from "./ai-router.ts";

const RERANK_MODEL = CLAUDE_HAIKU;
const RERANK_TOP_N = 50;
const RERANK_BATCH_SIZE = 25;
const RERANK_BATCH_TIMEOUT_MS = 25000;
const RERANK_MAX_TOKENS = 2048; // 25 items × ~30 tokens each + JSON overhead

interface RerankItem {
  id: string;
  score: number;
}

interface RerankResponse {
  rankings: RerankItem[];
}

interface RerankResult {
  candidates: FormattedCandidate[];
  ai_reranked: boolean;
  ai_rerank_error?: string;
  ai_rerank_count?: number;
  ai_rerank_ms?: number;
}

function buildBrief(c: FormattedCandidate, idx: number): Record<string, unknown> {
  // F3: include job_company_id + headline/summary (truncated) + sub_role across
  // top 3 experience entries with is_current flag, so the reranker can tell
  // CURRENT vs PAST employer and judge specialty from the bio text.
  const topExp = (c.experience || []).slice(0, 3).map((exp) => {
    const co = (exp.company as Record<string, unknown> | null) || null;
    const title = (exp.title as Record<string, unknown> | null) || null;
    return {
      company: co?.name ?? null,
      company_id: co?.id ?? null,
      sub_role: title?.sub_role ?? null,
      is_current: exp.end_date == null,
    };
  });

  const trunc = (s: string | null | undefined, n: number) =>
    typeof s === "string" && s.length > n ? s.slice(0, n) + "…" : (s || null);

  return {
    idx,
    id: c.id,
    name: c.full_name,
    title: c.job_title,
    employer: c.job_company_name,
    employer_id: c.job_company_id,
    headline: trunc(c.headline, 280),
    summary: trunc(c.summary, 280),
    industry: c.job_company_industry || c.industry || null,
    onet_broad: c.job_onet_broad_occupation,
    onet_specific: c.job_onet_specific_occupation,
    sub_role: c.job_title_sub_role,
    lives: [c.location_locality, c.location_region].filter(Boolean).join(", ") || null,
    practices: [c.job_company_location_locality, c.job_company_location_region].filter(Boolean).join(", ") || null,
    skills: (c.clinical_skills || []).slice(0, 8),
    top_experience: topExp,
  };
}

function buildIntentSummary(parsed: Record<string, unknown>, query: string, anchorIds: string[]): string {
  const titles = (parsed.job_titles as string[]) || [];
  const specsArr = (parsed.specialties as string[]) || [];
  const singleSpec = typeof parsed.specialty === "string" ? [parsed.specialty as string] : [];
  const specs = Array.from(new Set([...specsArr, ...singleSpec].filter(Boolean)));
  const loc = (parsed.location as { city?: string; state?: string }) || {};
  const companies = (parsed.current_companies as string[]) || (parsed.companies as string[]) || [];
  const credentials = (parsed.credentials as string[]) || [];

  // G6 — first canonical specialty drives the hard specialty rule
  const requiredSpecialty = specs[0] || null;

  const parts: string[] = [];
  parts.push(`Original query: "${query}"`);
  if (titles.length) parts.push(`Roles wanted: ${titles.join(", ")}`);
  if (specs.length) parts.push(`SPECIALTY (CRITICAL — must match): ${specs.join(", ")}`);
  if (requiredSpecialty) {
    parts.push(`REQUIRED_SPECIALTY: ${requiredSpecialty}`);
  }
  if (credentials.length) parts.push(`Credentials: ${credentials.join(", ")}`);
  if (companies.length) parts.push(`Employers of interest: ${companies.join(", ")}`);
  if (anchorIds.length) {
    parts.push(`ANCHOR_COMPANY_IDS (current employer MUST be one of these): ${anchorIds.join(", ")}`);
  }
  if (loc.city || loc.state) {
    parts.push(`Location: ${[loc.city, loc.state].filter(Boolean).join(", ")} (practice location matters more than residence)`);
  }
  return parts.join("\n");
}

const SYSTEM_PROMPT = `You are a clinical recruiting relevance judge.

You will receive:
1. A recruiter's intent (role, specialty, location, employer signals)
2. A list of candidate profiles (each with idx + id)

Your job: score each candidate 0-100 on how well they match the recruiter's intent.

Scoring guidance:
- 90-100: Exact specialty + practices in target location + credible employer
- 70-89: Right specialty OR right location, strong other signals
- 50-69: Adjacent specialty (e.g. general surgeon when ortho was asked) OR same field but wrong subspecialty
- 20-49: Same broad field but clear specialty mismatch (e.g. hospitalist when ortho was asked)
- 0-19: Wrong field entirely, or out-of-state with no practice connection

Hard rules:
- If a specialty is requested, candidates of a different physician specialty (hospitalist, family medicine, internal medicine, urgent care, OB/GYN, pediatrician, emergency medicine, regenerative medicine) should score below 50 UNLESS their title/skills show the requested specialty.
- If a location is requested, prefer candidates whose PRACTICE location matches over those who only RESIDE there.
- Penalize candidates whose practice is in a different US state than requested (score below 30).
- ANCHOR EMPLOYER RULE: If ANCHOR_COMPANY_IDS is provided in the intent, candidates whose \`employer_id\` is NOT in that list MUST score ≤ 25, regardless of how well their title or specialty matches. A past employee of the anchor (anchor appears only in \`top_experience\` with \`is_current: false\`) is NOT a current employee and falls under this rule.
- REQUIRED SPECIALTY RULE: If REQUIRED_SPECIALTY is provided (e.g. "orthopedics", "cardiology", "neurology"), candidates whose \`onet_specific\`, \`onet_broad\`, \`sub_role\`, \`title\`, \`headline\`, and \`summary\` contain NO signal of that specialty MUST score ≤ 25. A vascular surgeon, cardiothoracic surgeon, or general hospitalist at the anchor employer is NOT a match when REQUIRED_SPECIALTY is "orthopedics". Specialty signal counts include subspecialties (e.g. "spine surgeon", "hand surgeon", "sports medicine" all satisfy orthopedics).
- Don't penalize for missing data — score on what's present.

OUTPUT FORMAT — return ONLY valid JSON, no prose, no markdown fences:
{"rankings":[{"id":"<exact_id>","score":<0-100>}, ...]}

You MUST include one entry per candidate, using the exact id provided.`;

async function scoreBatch(
  batchIdx: number,
  totalBatches: number,
  briefs: Record<string, unknown>[],
  intent: string,
): Promise<{ scores: Map<string, number>; ms: number; error?: string }> {
  const startMs = Date.now();
  const userMessage = `RECRUITER INTENT:\n${intent}\n\nCANDIDATES (${briefs.length}):\n${JSON.stringify(briefs)}`;

  try {
    const result = await callClaude<RerankResponse>(
      SYSTEM_PROMPT,
      userMessage,
      null,
      `ai-rerank:batch${batchIdx + 1}`,
      { model: RERANK_MODEL, timeoutMs: RERANK_BATCH_TIMEOUT_MS, maxTokens: RERANK_MAX_TOKENS },
    );

    const scores = new Map<string, number>();
    const rankings = result?.rankings;
    if (Array.isArray(rankings)) {
      for (const r of rankings) {
        if (r && typeof r.id === "string" && typeof r.score === "number") {
          scores.set(r.id, Math.max(0, Math.min(100, r.score)));
        }
      }
    }
    const ms = Date.now() - startMs;
    console.log(`[ai-rerank] batch ${batchIdx + 1}/${totalBatches} scored ${scores.size}/${briefs.length} in ${ms}ms`);
    return { scores, ms };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    const ms = Date.now() - startMs;
    console.warn(`[ai-rerank] batch ${batchIdx + 1}/${totalBatches} failed in ${ms}ms: ${msg}`);
    return { scores: new Map(), ms, error: msg };
  }
}

export async function rerankWithAI(
  candidates: FormattedCandidate[],
  parsed: Record<string, unknown>,
  query: string,
  _lovableApiKey: string | undefined,
  opts: { anchorMode?: boolean; anchorCompanyIds?: string[] } = {},
): Promise<RerankResult> {
  if (!candidates || candidates.length === 0) {
    return { candidates, ai_reranked: false };
  }

  const anchorIds = opts.anchorCompanyIds ?? [];
  const anchorMode = opts.anchorMode ?? anchorIds.length > 0;

  const startMs = Date.now();
  const topN = Math.min(candidates.length, RERANK_TOP_N);
  const head = candidates.slice(0, topN);
  const tail = candidates.slice(topN);

  const briefs = head.map(buildBrief);
  const intent = buildIntentSummary(parsed, query, anchorIds);

  // Split into parallel batches
  const batches: Record<string, unknown>[][] = [];
  for (let i = 0; i < briefs.length; i += RERANK_BATCH_SIZE) {
    batches.push(briefs.slice(i, i + RERANK_BATCH_SIZE));
  }

  console.log(`[ai-rerank] provider=anthropic model=${RERANK_MODEL} feeding ${briefs.length} candidates in ${batches.length} parallel batches (anchorMode=${anchorMode})`);

  const batchResults = await Promise.all(
    batches.map((b, i) => scoreBatch(i, batches.length, b, intent)),
  );

  // Merge all scores
  const scoreById = new Map<string, number>();
  const errors: string[] = [];
  for (const r of batchResults) {
    for (const [id, score] of r.scores) scoreById.set(id, score);
    if (r.error) errors.push(r.error);
  }

  if (scoreById.size === 0) {
    console.warn(`[ai-rerank] all batches failed, returning deterministic ranking`);
    return { candidates, ai_reranked: false, ai_rerank_error: errors.join("; ") || "no_scores" };
  }

  // F2: Anchor-mode blend trusts the LLM more (0.25 det / 0.75 ai) because the
  // deterministic scorer rewards title/ONET matches at the wrong employer.
  // Non-anchor searches keep the original 0.6/0.4 blend.
  const detWeight = anchorMode ? 0.25 : 0.6;
  const aiWeight = anchorMode ? 0.75 : 0.4;
  const reranked = head.map(c => {
    const aiScore = scoreById.get(c.id);
    if (typeof aiScore !== "number") return c;
    const blended = Math.round(detWeight * c.relevance_score + aiWeight * aiScore);
    return { ...c, relevance_score: Math.max(0, Math.min(100, blended)), ai_score: aiScore };
  });

  reranked.sort((a, b) => b.relevance_score - a.relevance_score);


  const elapsed = Date.now() - startMs;
  const partial = scoreById.size < head.length;
  console.log(
    `[ai-rerank] total scored ${scoreById.size}/${head.length} in ${elapsed}ms via ${RERANK_MODEL}` +
    (partial ? ` (PARTIAL — ${head.length - scoreById.size} kept deterministic)` : ""),
  );

  return {
    candidates: [...reranked, ...tail],
    ai_reranked: true,
    ai_rerank_count: scoreById.size,
    ai_rerank_ms: elapsed,
    ai_rerank_error: errors.length ? errors.join("; ") : undefined,
  };
}
