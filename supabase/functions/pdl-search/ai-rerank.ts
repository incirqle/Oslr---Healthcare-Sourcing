/**
 * ai-rerank.ts — LLM re-ranking of top N PDL results against the parsed query intent.
 *
 * Uses Lovable AI Gateway (google/gemini-3-flash-preview) for cheap, fast scoring.
 * Returns relevance scores 0-100 keyed by candidate id. Falls back gracefully on any error.
 *
 * Strategy:
 *  - Take top 50 by deterministic score (already sorted)
 *  - Build a compact JSON brief per candidate (name, title, employer, locality, practice locality,
 *    onet codes, top skills, headline) — keep tokens minimal
 *  - Single LLM call returns array of { id, score, reason }
 *  - Merge: final = AI score (0-100) becomes new relevance_score; ties broken by deterministic score
 *  - On any failure (timeout, 429, 402, parse error): return original list unchanged
 */

import type { FormattedCandidate } from "./format-results.ts";

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const RERANK_MODEL = "google/gemini-3.1-pro-preview";
const RERANK_TOP_N = 50;
const RERANK_TIMEOUT_MS = 25000;

interface RerankItem {
  id: string;
  score: number;
  reason?: string;
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
    skills: (c.clinical_skills || []).slice(0, 6),
    headline: (c.headline || "").slice(0, 140) || null,
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
- If a specialty is requested, candidates of a different physician specialty (hospitalist, family medicine, internal medicine, urgent care, OB/GYN, pediatrician, emergency medicine) should score below 50 UNLESS their title/skills show the requested specialty.
- If a location is requested, prefer candidates whose PRACTICE location matches over those who only RESIDE there.
- Penalize candidates whose practice is in a different US state than requested (score below 30).
- Don't penalize for missing data — score on what's present.

You MUST call the rank_candidates function with one entry per candidate. Use the exact id provided.`;

export async function rerankWithAI(
  candidates: FormattedCandidate[],
  parsed: Record<string, unknown>,
  query: string,
  lovableApiKey: string | undefined,
): Promise<RerankResult> {
  if (!lovableApiKey) {
    return { candidates, ai_reranked: false, ai_rerank_error: "no_api_key" };
  }
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RERANK_TIMEOUT_MS);

  try {
    const resp = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "rank_candidates",
              description: "Score each candidate on relevance to the recruiter intent.",
              parameters: {
                type: "object",
                properties: {
                  rankings: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string", description: "Exact candidate id from input" },
                        score: { type: "number", description: "Relevance 0-100" },
                        reason: { type: "string", description: "1 short sentence why" },
                      },
                      required: ["id", "score"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["rankings"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "rank_candidates" } },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`[ai-rerank] gateway ${resp.status}: ${errText.slice(0, 200)}`);
      return {
        candidates,
        ai_reranked: false,
        ai_rerank_error: `gateway_${resp.status}`,
      };
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) {
      console.warn("[ai-rerank] no tool call returned");
      return { candidates, ai_reranked: false, ai_rerank_error: "no_tool_call" };
    }

    const parsedArgs = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
    const rankings: RerankItem[] = parsedArgs.rankings || [];
    if (!Array.isArray(rankings) || rankings.length === 0) {
      return { candidates, ai_reranked: false, ai_rerank_error: "empty_rankings" };
    }

    // Build score map by id
    const scoreById = new Map<string, { score: number; reason?: string }>();
    for (const r of rankings) {
      if (r && typeof r.id === "string" && typeof r.score === "number") {
        scoreById.set(r.id, {
          score: Math.max(0, Math.min(100, r.score)),
          reason: r.reason,
        });
      }
    }

    // Merge: re-ranked head gets AI score; tail keeps deterministic score
    const reranked = head.map(c => {
      const ai = scoreById.get(c.id);
      if (ai) {
        return {
          ...c,
          relevance_score: ai.score,
          ai_match_reason: ai.reason || null,
        } as FormattedCandidate & { ai_match_reason?: string | null };
      }
      return c;
    });

    // Sort head by new AI score (desc), break ties on original deterministic order (already preserved)
    reranked.sort((a, b) => b.relevance_score - a.relevance_score);

    const elapsed = Date.now() - startMs;
    console.log(`[ai-rerank] scored ${scoreById.size}/${head.length} in ${elapsed}ms`);

    return {
      candidates: [...reranked, ...tail],
      ai_reranked: true,
      ai_rerank_count: scoreById.size,
      ai_rerank_ms: elapsed,
    };
  } catch (err) {
    const isAbort = (err as Error).name === "AbortError";
    const msg = isAbort ? "timeout" : (err instanceof Error ? err.message : "unknown");
    console.warn(`[ai-rerank] failed: ${msg}`);
    return { candidates, ai_reranked: false, ai_rerank_error: msg };
  } finally {
    clearTimeout(timeout);
  }
}
