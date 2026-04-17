/**
 * ai-router.ts — Direct Anthropic API call helper for Claude models.
 * Used by parse-query.ts (L2 parser) and index.ts (L5 cascade planner).
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

export const CLAUDE_HAIKU = "claude-haiku-4-5-20251001";
export const CLAUDE_SONNET = "claude-sonnet-4-6";

export async function callClaude<T>(
  systemPrompt: string,
  userMessage: string,
  fallbackValue: T | null = null,
  label = "Claude",
  options: { model?: string; timeoutMs?: number; maxTokens?: number } = {}
): Promise<T> {
  const { model = CLAUDE_SONNET, timeoutMs = 10000, maxTokens = 1024 } = options;

  if (!ANTHROPIC_API_KEY) {
    console.warn(`[${label}] ANTHROPIC_API_KEY not set — using fallback`);
    if (fallbackValue !== null) return fallbackValue;
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[${label}] Anthropic API error ${res.status}: ${errText}`);
      if (fallbackValue !== null) return fallbackValue;
      throw new Error(`Anthropic API ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as T;
    return parsed;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error(`[${label}] Timed out after ${timeoutMs}ms`);
    } else {
      console.error(`[${label}] Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (fallbackValue !== null) return fallbackValue;
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
