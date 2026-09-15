// crustdata-rate-limit.ts — US-009: per-endpoint client-side rate limiting.
//
// Pure token-bucket math + a lazy-seeded per-path limiter + an in-flight
// request coalescer. NO imports from crustdata-v2.ts (that module imports
// this one) and NO network/env access here — everything external (seed
// fetch, clock, sleep) is injected, which is what makes the unit tests
// timer-free and API-free.
//
// SCOPE NOTE (accepted limitation): Supabase edge functions are short-lived
// and horizontally scaled, so these buckets are PER-INSTANCE, not global.
// A cold-started instance begins with a full bucket. That still smooths a
// single instance's bursts (the failure mode we actually saw: rapid card
// expansion / widen loops from one session), and the 429-retry path in
// crustdata-v2.ts covers cross-instance overshoot.

// ─────────────────────────────────────────────────────────────────────
// Token bucket (pure math, injected clock via nowMs arguments)
// ─────────────────────────────────────────────────────────────────────
export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(readonly rpm: number, nowMs: number) {
    if (!(rpm > 0)) throw new Error(`TokenBucket rpm must be > 0 (got ${rpm})`);
    this.tokens = rpm; // start full — capacity = rpm
    this.lastRefillMs = nowMs;
  }

  /** Continuous refill at rpm/60000 tokens per ms, capped at capacity. */
  private refill(nowMs: number): void {
    const elapsed = Math.max(0, nowMs - this.lastRefillMs);
    this.tokens = Math.min(this.rpm, this.tokens + elapsed * (this.rpm / 60_000));
    this.lastRefillMs = nowMs;
  }

  /** Consume one token if available. */
  tryTake(nowMs: number): boolean {
    this.refill(nowMs);
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** 0 when a token is available now; else ms until the next one refills. */
  msUntilToken(nowMs: number): number {
    this.refill(nowMs);
    if (this.tokens >= 1) return 0;
    return Math.ceil((1 - this.tokens) / (this.rpm / 60_000));
  }

  /** Whole tokens currently available (test/introspection helper). */
  available(nowMs: number): number {
    this.refill(nowMs);
    return Math.floor(this.tokens);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Per-path limiter, lazily seeded from GET /account/endpoints
// ─────────────────────────────────────────────────────────────────────
export interface RateLimitSeed {
  path: string;
  rpm: number;
}

export type SeedResult =
  | { ok: true; data: RateLimitSeed[] }
  | { ok: false; detail: string };

export type SeedFetcher = () => Promise<SeedResult>;

/** Fallback rpm used ONLY when the /account/endpoints seed call fails
 *  (or omits a path). Mirrors the limits observed on the test key
 *  2026-08-04; the live seed always wins when available. */
export const FALLBACK_RPM: Record<string, number> = {
  "/person/search": 30,
  "/person/enrich": 15,
};
/** Last-resort rpm for paths absent from both the seed and FALLBACK_RPM. */
export const DEFAULT_RPM = 15;

export type AcquireResult =
  | { ok: true; waitedMs: number }
  | { ok: false; waitMs: number };

export class CrustdataRateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private seeds: Map<string, number> | null = null;
  private seeding: Promise<void> | null = null;
  /** "endpoint" once seeded from the API, "fallback" if the seed failed. */
  seedSource: "unseeded" | "endpoint" | "fallback" = "unseeded";

  constructor(
    private readonly fetcher: SeedFetcher,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
    /** acquire() waits up to this long for a token; longer waits fail busy. */
    private readonly maxWaitMs = 15_000,
  ) {}

  /** Seed once, lazily, at first acquire. Concurrent callers share the
   *  in-flight seed promise so /account/endpoints is hit at most once. */
  private async ensureSeeded(): Promise<void> {
    if (this.seeds) return;
    if (!this.seeding) {
      this.seeding = (async () => {
        const r = await this.fetcher();
        const m = new Map<string, number>();
        if (r.ok) {
          for (const s of r.data) {
            if (s.path && s.rpm > 0) m.set(s.path, s.rpm);
          }
          this.seedSource = "endpoint";
        } else {
          this.seedSource = "fallback";
          console.warn(
            `[rate-limit] /account/endpoints seed failed (${r.detail}) — ` +
              `falling back to defaults ${JSON.stringify(FALLBACK_RPM)}`,
          );
        }
        this.seeds = m;
      })();
    }
    await this.seeding;
  }

  private rpmFor(path: string): number {
    const seeded = this.seeds?.get(path);
    if (seeded && seeded > 0) return seeded;
    return FALLBACK_RPM[path] ?? DEFAULT_RPM;
  }

  private bucketFor(path: string): TokenBucket {
    let b = this.buckets.get(path);
    if (!b) {
      b = new TokenBucket(this.rpmFor(path), this.now());
      this.buckets.set(path, b);
    }
    return b;
  }

  /** Wait-or-fail: block (bounded by maxWaitMs) until a token for `path`
   *  is available. Returns {ok:false, waitMs} when the caller should
   *  surface a busy state instead of waiting. */
  async acquire(path: string): Promise<AcquireResult> {
    await this.ensureSeeded();
    const bucket = this.bucketFor(path);
    let waited = 0;
    while (!bucket.tryTake(this.now())) {
      const waitMs = bucket.msUntilToken(this.now());
      if (waited + waitMs > this.maxWaitMs) return { ok: false, waitMs };
      await this.sleep(waitMs);
      waited += waitMs;
    }
    return { ok: true, waitedMs: waited };
  }
}

// ─────────────────────────────────────────────────────────────────────
// In-flight coalescer (US-009 #4 — debounce award_evidence per URL)
// ─────────────────────────────────────────────────────────────────────
// A second request for the same key while the first is still in flight,
// or within `windowMs` (~2s) of it starting, gets the SAME promise —
// so a double-clicked card expansion costs one enrich call, not two.
// No timers: expiry is checked lazily on access against the injected clock.

interface CoalesceEntry {
  promise: Promise<unknown>;
  startedAt: number;
  settled: boolean;
}

export class InFlightCoalescer {
  private entries = new Map<string, CoalesceEntry>();

  constructor(
    private readonly windowMs = 2_000,
    private readonly now: () => number = Date.now,
  ) {}

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing && (!existing.settled || this.now() - existing.startedAt < this.windowMs)) {
      return existing.promise as Promise<T>;
    }
    const entry: CoalesceEntry = {
      promise: undefined as unknown as Promise<unknown>,
      startedAt: this.now(),
      settled: false,
    };
    entry.promise = fn().finally(() => {
      entry.settled = true;
      // Opportunistic cleanup of expired settled entries (no timers).
      for (const [k, e] of this.entries) {
        if (e.settled && this.now() - e.startedAt >= this.windowMs) this.entries.delete(k);
      }
    });
    this.entries.set(key, entry);
    return entry.promise as Promise<T>;
  }

  /** Number of tracked keys (test helper). */
  size(): number {
    return this.entries.size;
  }
}
