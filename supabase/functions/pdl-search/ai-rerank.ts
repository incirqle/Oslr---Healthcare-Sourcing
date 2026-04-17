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
  return {
    idx,
    id: c.id,
    name: c.full_name,
    title: c.job_title,
    employer: c.job_company_name,
    industry: c.job_company_industry || c.industry || null,
    onet_broad: c.job_onet_broad_occupation,
    onet_specific: c.job_onet_specific_occupation,
    sub_role: c.job_title_sub_role,
    lives: [c.location_locality, c.location_region].filter(Boolean).join(", ") || null,
    practices: [c.job_company_location_locality, c.job_company_location_region].filter(Boolean).join(", ") || null,
    skills: (c.clinical_skills || []).slice(0, 4),
  };
}

function buildIntentSummary(parsed: Record<string, unknown>, query: string): string {
  const titles = (parsed.job_titles as string[]) || [];
  const specs = (parsed.specialties as string[]) || [];
  const loc = (parsed.location as { city?: string; state?: string }) || {};
  const companies = (parsed.current_companies as string[]) || (parsed.companies as string[]) || [];
  const credentials = (parsed.credentials as string[]) || [];

  const parts: string[] = [];
  parts.push(`Original query: "${query}"`);
  if (titles.length) parts.push(`Roles wanted: ${titles.join(", ")}`);
  if (specs.length) parts.push(`Specialties: ${specs.join(", ")}`);
  if (credentials.length) parts.push(`Credentials: ${credentials.join(", ")}`);
  if (companies.length) parts.push(`Employers of interest: ${companies.join(", ")}`);
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
- Don't penalize for missing data — score on what's present.

OUTPUT FORMAT — return ONLY valid JSON, no prose, no markdown fences:
{"rankings":[{"id":"<exact_id>","score":<0-100>}, ...]}

You MUST include one entry per candidate, using the exact id provided.`;

export async function rerankWithAI(
  candidates: FormattedCandidate[],
  parsed: Record<string, unknown>,
  query: string,
  _lovableApiKey: string | undefined,
): Promise<RerankResult> {
  if (!candidates || candidates.length === 0) {
    return { candidates, ai_reranked: false };
  }

  const startMs = Date.now();
  const topN = Math.min(candidates.length, RERANK_TOP_N);
  const head = candidates.slice(0, topN);
  const tail = candidates.slice(topN);

  const briefs = head.map(buildBrief);
  const intent = buildIntentSummary(parsed, query);

  const userMessage = `RECRUITER INTENT:\n${intent}\n\nCANDIDATES (${briefs.length}):\n${JSON.stringify(briefs)}`;

  console.log(`[ai-rerank] provider=anthropic model=${RERANK_MODEL} feeding ${briefs.length} candidates`);

  try {
    const result = await callClaude<RerankResponse>(
      SYSTEM_PROMPT,
      userMessage,
      null,
      "ai-rerank",
      { model: RERANK_MODEL, timeoutMs: RERANK_TIMEOUT_MS, maxTokens: RERANK_MAX_TOKENS },
    );

    const rankings = result?.rankings;
    if (!Array.isArray(rankings) || rankings.length === 0) {
      console.warn("[ai-rerank] empty rankings from Claude");
      return { candidates, ai_reranked: false, ai_rerank_error: "empty_rankings" };
    }

    const scoreById = new Map<string, number>();
    for (const r of rankings) {
      if (r && typeof r.id === "string" && typeof r.score === "number") {
        scoreById.set(r.id, Math.max(0, Math.min(100, r.score)));
      }
    }

    const reranked = head.map(c => {
      const aiScore = scoreById.get(c.id);
      if (typeof aiScore === "number") {
        return { ...c, relevance_score: aiScore };
      }
      return c;
    });

    reranked.sort((a, b) => b.relevance_score - a.relevance_score);

    const elapsed = Date.now() - startMs;
    console.log(`[ai-rerank] scored ${scoreById.size}/${head.length} in ${elapsed}ms via ${RERANK_MODEL}`);

    return {
      candidates: [...reranked, ...tail],
      ai_reranked: true,
      ai_rerank_count: scoreById.size,
      ai_rerank_ms: elapsed,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    console.warn(`[ai-rerank] failed: ${msg}`);
    return { candidates, ai_reranked: false, ai_rerank_error: msg };
  }
}
