
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_SONNET  = "claude-sonnet-4-6";
const CLAUDE_HAIKU   = "claude-haiku-4-5-20251001";
const CLAUDE_OPUS    = "claude-opus-4-5";

export async function callClaude<T>(
  systemPrompt: string,
  userMessage:  string,
  fallback:     T,
  layer:        string,
  options?: { model?: string; timeoutMs?: number; maxTokens?: number }
): Promise<T> {
  const model     = options?.model     ?? CLAUDE_SONNET;
  const timeout   = options?.timeoutMs ?? 5000;
  const maxTokens = options?.maxTokens ?? 1024;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  if (!apiKey) {
    console.error(`[${layer}] ANTHROPIC_API_KEY is not set — skipping Claude call`);
    return fallback;
  }
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST", signal: ctrl.signal,
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model, max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "(unreadable)");
      console.error(`[${layer}] Claude HTTP ${res.status} | model=${model} | body=${errBody}`);
      return fallback;
    }
    const json    = await res.json();
    const text    = json?.content?.[0]?.text ?? "";
    const cleaned = text.replace(/^```(?:json)?\n?/,"").replace(/\n?```$/,"").trim();
    return JSON.parse(cleaned) as T;
  } catch(err: unknown) {
    clearTimeout(timer);
    const name = (err as {name?:string})?.name;
    if (name === "AbortError") console.warn(`[${layer}] Claude timeout (${timeout}ms) — fallback`);
    else console.error(`[${layer}] Claude error: ${err instanceof Error ? err.stack || err.message : String(err)}`);
    return fallback;
  }
}

// Convenience exports for model constants
export { CLAUDE_SONNET, CLAUDE_HAIKU, CLAUDE_OPUS };
