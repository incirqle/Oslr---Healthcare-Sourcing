// search-meter.ts — per-user search metering + bot protection.
//
// Only a NEW search counts. Pagination, filter refinements of the same
// query, the preview→results pair, and exact repeats within 4 hours are free.
// Counted searches go through: a token bucket (burst then steady refill),
// an hourly backstop, a daily cap (UTC midnight reset) and a "scraper sweep"
// tripwire (many unique searches with zero engagement).
// deno-lint-ignore-file no-explicit-any

export const METER = {
  burst: 8,
  refillMs: 20_000,
  hourly: 60,
  daily: 150,
  repeatWindowMs: 30 * 24 * 60 * 60 * 1000,
  sweepSize: 20,
  sweepPauseMs: 10 * 60 * 1000,
};

export interface MeterUsage { used: number; limit: number; resets_at: string }

export type MeterDecision =
  | { ok: true; counted: boolean; usage: MeterUsage }
  | { ok: false; status: number; code: string; message: string; retry_after_ms: number; usage: MeterUsage };

export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function isBrowserAgent(ua: string | null): boolean {
  if (!ua) return false;
  if (!/Mozilla\//.test(ua)) return false;
  return !/(python-requests|curl\/|wget|axios|node-fetch|undici|puppeteer|scrapy|go-http-client|claude|anthropic|gptbot|httpx|aiohttp)/i.test(ua);
}

function startOfUtcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Pure token bucket over counted-search timestamps (ascending). */
export function bucketWaitMs(times: number[], now: number): number {
  let tokens = METER.burst;
  let last = times[0] ?? now;
  for (const t of times) {
    tokens = Math.min(METER.burst, tokens + (t - last) / METER.refillMs);
    tokens -= 1;
    last = t;
  }
  tokens = Math.min(METER.burst, tokens + (now - last) / METER.refillMs);
  return tokens >= 1 ? 0 : Math.ceil((1 - tokens) * METER.refillMs);
}

async function usageFor(admin: any, userId: string, now: number): Promise<MeterUsage> {
  const day = startOfUtcDay(now);
  const { count } = await admin.from("search_meter_events").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("kind", "search").gte("created_at", new Date(day).toISOString());
  return { used: count ?? 0, limit: METER.daily, resets_at: new Date(day + 86_400_000).toISOString() };
}

export async function getUsage(admin: any, userId: string): Promise<MeterUsage> {
  return usageFor(admin, userId, Date.now());
}

export async function logEngagement(admin: any, userId: string, kind: "page" | "open"): Promise<void> {
  await admin.from("search_meter_events").insert({ user_id: userId, kind });
}

export async function meterSearch(
  admin: any,
  opts: { userId: string; query: string; page: number; userAgent: string | null; isAdmin?: boolean },
): Promise<MeterDecision> {
  const now = Date.now();
  const { userId } = opts;
  const qn = normalizeQuery(opts.query);
  const block = async (status: number, code: string, message: string, retry: number): Promise<MeterDecision> => {
    await admin.from("search_meter_events").insert({ user_id: userId, kind: "blocked", query_norm: code });
    return { ok: false, status, code, message, retry_after_ms: retry, usage: await usageFor(admin, userId, now) };
  };

  if (!isBrowserAgent(opts.userAgent)) {
    return block(403, "automated_client",
      "Oslr searches must be run from the Oslr app in a web browser. Automated tools aren't allowed.", 0);
  }

  // Pagination is always free, and counts as real engagement.
  if (opts.page > 0) {
    await logEngagement(admin, userId, "page");
    return { ok: true, counted: false, usage: await usageFor(admin, userId, now) };
  }

  // Exact repeat (also covers preview→results and filter refinements).
  const { data: repeat } = await admin.from("search_meter_events").select("id")
    .eq("user_id", userId).eq("kind", "search").eq("query_norm", qn)
    .gte("created_at", new Date(now - METER.repeatWindowMs).toISOString()).limit(1);
  if (repeat && repeat.length > 0) {
    return { ok: true, counted: false, usage: await usageFor(admin, userId, now) };
  }

  if (opts.isAdmin) {
    await admin.from("search_meter_events").insert({ user_id: userId, kind: "search", query_norm: qn });
    return { ok: true, counted: true, usage: await usageFor(admin, userId, now) };
  }

  const usage = await usageFor(admin, userId, now);
  if (usage.used >= METER.daily) {
    return block(429, "daily_limit",
      `You've reached your daily limit of ${METER.daily} new searches. It resets at midnight UTC — paging through results still works.`,
      Date.parse(usage.resets_at) - now);
  }

  const { data: recent } = await admin.from("search_meter_events").select("created_at, query_norm")
    .eq("user_id", userId).eq("kind", "search")
    .gte("created_at", new Date(now - 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true });
  const recentRows = (recent ?? []) as { created_at: string; query_norm: string }[];
  if (recentRows.length >= METER.hourly) {
    const oldest = Date.parse(recentRows[0].created_at);
    return block(429, "hourly_limit",
      "You're searching very quickly. Please take a short break — new searches open up again in a few minutes.",
      Math.max(60_000, oldest + 3_600_000 - now));
  }

  const lastTen = recentRows.map((r) => Date.parse(r.created_at)).filter((t) => t >= now - 10 * 60 * 1000);
  const wait = bucketWaitMs(lastTen, now);
  if (wait > 0) {
    return block(429, "burst",
      "Searching quickly — please take a moment while results settle.", wait);
  }

  // Scraper-sweep tripwire: last N searches all different, zero engagement.
  const { data: lastN } = await admin.from("search_meter_events").select("created_at, query_norm")
    .eq("user_id", userId).eq("kind", "search")
    .order("created_at", { ascending: false }).limit(METER.sweepSize);
  const rows = (lastN ?? []) as { created_at: string; query_norm: string }[];
  if (rows.length >= METER.sweepSize && new Set(rows.map((r) => r.query_norm)).size === rows.length) {
    const since = rows[rows.length - 1].created_at;
    const latest = Date.parse(rows[0].created_at);
    const [{ count: engaged }, { count: saved }] = await Promise.all([
      admin.from("search_meter_events").select("id", { count: "exact", head: true })
        .eq("user_id", userId).in("kind", ["page", "open"]).gte("created_at", since),
      admin.from("candidates").select("id", { count: "exact", head: true })
        .eq("added_by", userId).gte("created_at", since),
    ]);
    if ((engaged ?? 0) === 0 && (saved ?? 0) === 0 && now - latest < METER.sweepPauseMs) {
      return block(429, "sweep_pause",
        "We've paused new searches for a few minutes because of unusual activity. Open a profile or save a candidate from your current results, or try again shortly.",
        latest + METER.sweepPauseMs - now);
    }
  }

  await admin.from("search_meter_events").insert({ user_id: userId, kind: "search", query_norm: qn });
  return { ok: true, counted: true, usage: { ...usage, used: usage.used + 1 } };
}
