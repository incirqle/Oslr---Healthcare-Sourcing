// Clinician-engine run logging. This file belongs to search-clinicians ONLY.
// Ported from search-talent/lib/run-log.ts; writes to the clinician tables
// added by this engine's migration. Fail-soft everywhere: logging must never
// fail a search (blueprint §9).

export const CLINICIAN_ENGINE = "clinician" as const;
export const CLINICIAN_ENGINE_VERSION = "crustdata_clin_v2";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function newRunId(): string {
  return `clin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isLoggableUser(userId: unknown): userId is string {
  return typeof userId === "string" &&
    userId !== "00000000-0000-0000-0000-000000000000" &&
    UUID_RE.test(userId);
}

// deno-lint-ignore no-explicit-any
type Client = any;

/** Recent-searches history (clinician_searches). */
export async function logClinicianSearch(
  client: Client,
  opts: {
    userId: string;
    query: string;
    filters?: unknown;
    resultCount: number;
    skip?: boolean;
  },
): Promise<void> {
  try {
    if (opts.skip) return;
    const trimmed = String(opts.query || "").trim();
    if (!trimmed) return;
    if (!isLoggableUser(opts.userId)) {
      console.warn(`[clinician:log-search] skipped: invalid user id ${JSON.stringify(opts.userId)}`);
      return;
    }
    const { error } = await client
      .from("clinician_searches")
      .insert({
        user_id: opts.userId,
        query: trimmed,
        filters: opts.filters ?? {},
        result_count: opts.resultCount,
      });
    if (error) {
      console.error(`[clinician:log-search] insert failed user_id=${opts.userId}: ${error.message}`);
    }
  } catch (e) {
    console.error("[clinician:log-search] threw:", e instanceof Error ? e.message : String(e));
  }
}

export interface ClinicianRunRecord {
  run_id: string;
  user_id?: string | null;
  raw_query?: string | null;
  parsed_payload?: unknown;
  criteria?: unknown;
  provider_query?: unknown;
  result_count?: number | null;
  total_count?: number | null;
  page?: number | null;
  size?: number | null;
  widened?: boolean | null;
  widen_options?: unknown;
  cache_hit?: boolean | null;
  credits_charged?: number | null;
  credits_session?: number | null;
  credit_ceiling?: number | null;
  audit_summary?: unknown;
  latency_ms?: number | null;
  error_code?: string | null;
  error?: string | null;
  /** Console-only telemetry — never inserted. */
  rejected_filtered?: number | null;
}

/** Per-run telemetry (clinician_search_intelligence). */
export async function logClinicianRun(client: Client, rec: ClinicianRunRecord): Promise<void> {
  try {
    const { rejected_filtered, ...persisted } = rec;
    const row = {
      ...persisted,
      engine: CLINICIAN_ENGINE,
      engine_version: CLINICIAN_ENGINE_VERSION,
      user_id: isLoggableUser(rec.user_id) ? rec.user_id : null,
    };
    const { error } = await client.from("clinician_search_intelligence").insert(row);
    if (error) {
      console.error(`[clinician:run-log] insert failed run_id=${rec.run_id}: ${error.message}`);
    } else {
      console.log(JSON.stringify({
        event: "clinician_run",
        run_id: rec.run_id,
        results: rec.result_count ?? 0,
        total: rec.total_count ?? 0,
        rejected_filtered: rejected_filtered ?? 0,
        cache_hit: rec.cache_hit ?? false,
        credits: rec.credits_charged ?? 0,
        latency_ms: rec.latency_ms ?? null,
        error_code: rec.error_code ?? null,
      }));
    }
  } catch (e) {
    console.error("[clinician:run-log] threw:", e instanceof Error ? e.message : String(e));
  }
}
