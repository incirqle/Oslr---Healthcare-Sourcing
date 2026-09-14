import "./crustdata-killswitch.ts";
import { CrustdataRateLimiter, InFlightCoalescer } from "./crustdata-rate-limit.ts";
// Crustdata v2 helpers — Person Search + Batch Contact Enrich.
//
// Auth: `Authorization: Token <key>` (NOT Bearer).
// Killswitch: handled at the global fetch shim (blocks all api.crustdata.com).
// Default: all callers are off until USE_CRUSTDATA_V2=true is set in env.

const BASE = "https://api.crustdata.com";
const V2_HEADER = "2025-11-01";

export type V2Result<T> =
  | { ok: true; data: T }
  | {
    ok: false;
    status: number;
    insufficientCredits: boolean;
    detail: string;
    /** US-009: true when rate-limited twice (or local budget exhausted) —
     *  callers map this to a distinct "busy, retrying" response state. */
    busy?: boolean;
    /** Parsed Retry-After header (ms), when Crustdata sent one. */
    retryAfterMs?: number;
  };

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = Deno.env.get("CRUSTDATA_API_KEY");
  if (!key) throw new Error("CRUSTDATA_API_KEY not set");
  return {
    Authorization: `Token ${key}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-version": V2_HEADER,
    ...extra,
  };
}

/** Retry-After is either delta-seconds or an HTTP-date. Returns ms or undefined. */
function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs) && secs >= 0) return Math.round(secs * 1000);
  const at = Date.parse(header);
  if (!Number.isNaN(at)) return Math.max(0, at - Date.now());
  return undefined;
}

function isInsuff(status: number, body: string): boolean {
  if (status === 402) return true;
  const t = (body || "").toLowerCase();
  return (
    t.includes("insufficient_credit") ||
    t.includes("insufficient credit") ||
    t.includes("not enough credits") ||
    t.includes("credit limit") ||
    t.includes("quota")
  );
}

async function call<T>(path: string, init: RequestInit = {}): Promise<V2Result<T>> {
  let res: Response;
  try {
    res = await fetch(path.startsWith("http") ? path : `${BASE}${path}`, {
      ...init,
      headers: { ...headers(), ...(init.headers as Record<string, string> ?? {}) },
    });
  } catch (e) {
    return { ok: false, status: 502, insufficientCredits: false, detail: String(e) };
  }
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      insufficientCredits: isInsuff(res.status, text),
      detail: text.slice(0, 600),
      retryAfterMs: parseRetryAfterMs(res.headers.get("retry-after")),
    };
  }
  try {
    return { ok: true, data: text ? (JSON.parse(text) as T) : (null as unknown as T) };
  } catch {
    return { ok: false, status: 502, insufficientCredits: false, detail: "invalid json" };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Flag
// ─────────────────────────────────────────────────────────────────────
/**
 * v2 is the only transport this engine has — the v1 endpoints are removed and
 * there is nothing to fall back to. The flag survives only as an emergency
 * OFF switch (USE_CRUSTDATA_V2=false), not as something a deploy must
 * remember to turn on. Requiring opt-in meant a fresh environment without the
 * env var refused every search: a landmine, not a safety.
 */
export function v2Enabled(): boolean {
  const v = (Deno.env.get("USE_CRUSTDATA_V2") ?? "").toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

// ─────────────────────────────────────────────────────────────────────
// Account endpoints (free) + per-endpoint rate limiter (US-009)
// ─────────────────────────────────────────────────────────────────────
// GET /account/endpoints returns per-path effective_rate_limit_rpm
// (verified live 2026-08-05: { api_version, token_limit_rpm,
// endpoints: [{ path, category, status, effective_rate_limit_rpm, fields }] }).
// Optional ?path= filters to one endpoint.

export interface AccountEndpointRpm {
  path: string;
  status: string | null;
  rpm: number | null;
}

interface AccountEndpointsResponse {
  endpoints?: Array<{
    path?: string;
    status?: string;
    effective_rate_limit_rpm?: number | null;
  }>;
}

export async function accountEndpointsV2(
  path?: string,
): Promise<V2Result<AccountEndpointRpm[]>> {
  const qs = path ? `?path=${encodeURIComponent(path)}` : "";
  const r = await call<AccountEndpointsResponse>(`/account/endpoints${qs}`, { method: "GET" });
  if (!r.ok) return r;
  const rows = Array.isArray(r.data?.endpoints) ? r.data.endpoints : [];
  return {
    ok: true,
    data: rows
      .filter((e) => typeof e?.path === "string" && e.path.length > 0)
      .map((e) => ({
        path: e.path as string,
        status: typeof e.status === "string" ? e.status : null,
        rpm: typeof e.effective_rate_limit_rpm === "number" ? e.effective_rate_limit_rpm : null,
      })),
  };
}

// Per-instance limiter, lazily seeded from /account/endpoints at the first
// rate-limited call. Edge functions are short-lived, so the bucket protects
// a single instance's burst behavior only (see crustdata-rate-limit.ts note);
// the 429 retry below covers cross-instance overshoot.
const limiter = new CrustdataRateLimiter(async () => {
  const r = await accountEndpointsV2();
  if (!r.ok) return { ok: false, detail: `HTTP ${r.status}: ${r.detail.slice(0, 200)}` };
  return {
    ok: true,
    data: r.data
      .filter((e) => typeof e.rpm === "number" && e.rpm > 0)
      .map((e) => ({ path: e.path, rpm: e.rpm as number })),
  };
});

// Debounce enrich per URL (~2s): a double-expanded card coalesces to the
// in-flight promise instead of issuing a second billable call.
const enrichCoalescer = new InFlightCoalescer(2_000);

const RETRY_BACKOFF_MS = 2_000;

/** Gate `exec` behind the per-path token bucket; on a Crustdata 429, back
 *  off once (Retry-After if present, else 2s) and retry once. A second 429
 *  (or an exhausted local budget) returns busy: true. */
async function rateLimited<T>(
  path: string,
  exec: () => Promise<V2Result<T>>,
): Promise<V2Result<T>> {
  const gate = await limiter.acquire(path);
  if (!gate.ok) {
    console.warn(`[rate-limit] ${path} local budget exhausted — next token in ${gate.waitMs}ms, failing busy`);
    return {
      ok: false,
      status: 429,
      insufficientCredits: false,
      busy: true,
      detail: `local rate limit: next slot in ~${Math.ceil(gate.waitMs / 1000)}s`,
      retryAfterMs: gate.waitMs,
    };
  }
  let r = await exec();
  if (!r.ok && r.status === 429) {
    const backoff = r.retryAfterMs ?? RETRY_BACKOFF_MS;
    console.warn(`[rate-limit] ${path} got 429 from Crustdata — backing off ${backoff}ms, retrying once`);
    await new Promise((res) => setTimeout(res, backoff));
    r = await exec();
    if (!r.ok && r.status === 429) {
      console.warn(`[rate-limit] ${path} 429 again after retry — surfacing busy state`);
      return { ...r, busy: true };
    }
  }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
// Autocomplete (free)
// ─────────────────────────────────────────────────────────────────────
export interface AutocompleteHit {
  value: string;
  label?: string;
  score?: number;
}

export async function personSearchAutocomplete(
  field: "title" | "company" | "location" | "skill" | "industry",
  query: string,
): Promise<string[]> {
  if (!query?.trim()) return [];
  const r = await call<{ results?: AutocompleteHit[]; data?: AutocompleteHit[] }>(
    "/person/search/autocomplete",
    { method: "POST", body: JSON.stringify({ field, query }) },
  );
  if (!r.ok) return [];
  const hits = r.data?.results ?? r.data?.data ?? [];
  return hits.map((h) => h.value).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────
// Company Identify (free)
// ─────────────────────────────────────────────────────────────────────
// POST /company/identify with a names array. Response is an array aligned
// with the input names; each element carries candidate `matches`, best
// first, with the id at matches[0].company_data.basic_info.crustdata_company_id
// (verified live in demo/crustdata.mjs identifyCompany, 2026-08-04).
// Beware: name matching is substring-loose — "Stryker" also matches
// "Stryker Dealership Group" (trailer sales) — so callers should prefer the
// resolved company_id over name filters, which is exactly why this exists.

export interface CompanyIdentifyV2Hit {
  /** The input name this hit resolves (echoed back, aligned by index). */
  name: string;
  company_id: number | null;
  resolved_name: string | null;
  confidence: number | null;
}

interface IdentifyRow {
  matches?: Array<{
    confidence_score?: number;
    company_data?: { basic_info?: Record<string, unknown> };
  }>;
}

export async function companyIdentifyV2(
  names: string[],
): Promise<V2Result<CompanyIdentifyV2Hit[]>> {
  const clean = names
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter(Boolean);
  if (clean.length === 0) return { ok: true, data: [] };

  const r = await call<IdentifyRow[]>("/company/identify", {
    method: "POST",
    body: JSON.stringify({ names: clean }),
  });
  if (!r.ok) return r;

  const rows = Array.isArray(r.data) ? r.data : [];
  const hits = clean.map((name, i): CompanyIdentifyV2Hit => {
    const best = rows[i]?.matches?.[0];
    const info = best?.company_data?.basic_info;
    const rawId = info?.crustdata_company_id ?? info?.company_id ?? null;
    return {
      name,
      company_id: typeof rawId === "number" ? rawId : null,
      resolved_name: typeof info?.name === "string" ? info.name : null,
      confidence: typeof best?.confidence_score === "number" ? best.confidence_score : null,
    };
  });
  return { ok: true, data: hits };
}

// ─────────────────────────────────────────────────────────────────────
// v2 Person Search
// ─────────────────────────────────────────────────────────────────────
export interface PersonSearchV2Input {
  filters: Record<string, unknown>;
  limit?: number;
  cursor?: string;
  fields?: string[];
  /**
   * Natural-language recall, additive to `filters`.
   *
   * Structured filters can only match text that is literally present. A
   * recruiter asking for "reps who carried a bag in ortho trauma" describes a
   * person; no substring expresses it. The semantic block hands Crustdata the
   * sentence itself and gets back candidates ranked by fit.
   *
   * Absent from this client until 2026-09-10, which is why the hiring engine
   * had no semantic path at all: the capability was not missing from the
   * product, it was missing from the request body.
   */
  search?: { query: string; mode?: "hybrid" | "lexical" | "semantic" };
  /**
   * "exact" makes `filters` HARD constraints alongside the semantic query
   * instead of soft recall hints. Always set it when a semantic query rides
   * along, or location and employer stop being requirements.
   */
  mode?: "exact";
}

export interface PersonSearchV2Result {
  profiles: Record<string, unknown>[];
  total_count: number;
  next_cursor: string | null;
}

// Some accounts do not have access to every projectable field (e.g.
// basic_profile.summary). The provider answers 403 permission_error and names
// the locked fields. Rather than failing the whole search, drop those fields
// (from both the projection and any filter leaf that references them) and
// retry once. The denied set is remembered for the life of the isolate so we
// stop asking for locked fields at all.
const deniedFields = new Set<string>();

function parseDeniedFields(detail: string): string[] {
  const out = new Set<string>();
  try {
    const parsed = JSON.parse(detail);
    const meta = parsed?.error?.metadata;
    if (Array.isArray(meta)) {
      for (const entry of meta) {
        for (const f of entry?.denied_fields ?? []) {
          if (typeof f === "string") out.add(f);
        }
      }
    }
  } catch { /* fall through to regex */ }
  if (out.size === 0) {
    for (const m of detail.matchAll(/locked on my account%3A\+?([A-Za-z0-9_.]+)/g)) out.add(m[1]);
    for (const m of detail.matchAll(/Access denied to fields:\s*([A-Za-z0-9_.,\s]+)/g)) {
      for (const part of m[1].split(",")) {
        const v = part.trim();
        if (v) out.add(v);
      }
    }
  }
  return [...out];
}

// deno-lint-ignore no-explicit-any
function stripDeniedFromFilters(node: any): any {
  if (!node || typeof node !== "object") return node;
  if (Array.isArray(node.conditions)) {
    const kept = node.conditions
      .map(stripDeniedFromFilters)
      .filter((c: unknown) => c !== null);
    if (kept.length === 0) return null;
    return { ...node, conditions: kept };
  }
  if (typeof node.field === "string" && deniedFields.has(node.field)) return null;
  return node;
}

export async function personSearchV2(
  input: PersonSearchV2Input,
): Promise<V2Result<PersonSearchV2Result>> {
  const requestedFields = input.fields ?? [
    "basic_profile",
    "experience",
    "education",
    "contact",
    "crustdata_person_id",
    "social_handles.professional_network_identifier.profile_url",
  ];

  const send = async (): Promise<V2Result<Record<string, unknown>>> => {
    const fields = requestedFields.filter((f) => !deniedFields.has(f));
    const filters = deniedFields.size ? stripDeniedFromFilters(input.filters) : input.filters;
    const body: Record<string, unknown> = {
      filters: filters ?? { op: "and", conditions: [] },
      limit: input.limit ?? 25,
      fields,
    };
    if (input.cursor) body.cursor = input.cursor;
    // Semantic recall. `mode: "exact"` keeps the structured filters hard;
    // without it the provider treats them as hints and geography stops being
    // enforced. Sorting is not supported alongside a semantic query.
    if (input.search?.query) {
      body.search = { query: input.search.query, mode: input.search.mode ?? "hybrid" };
      body.mode = input.mode ?? "exact";
    }
    return await rateLimited("/person/search", () =>
      call<Record<string, unknown>>("/person/search", {
        method: "POST",
        body: JSON.stringify(body),
      }));
  };

  let r = await send();
  if (!r.ok && r.status === 403) {
    const locked = parseDeniedFields(r.detail ?? "");
    const fresh = locked.filter((f) => !deniedFields.has(f));
    if (fresh.length) {
      for (const f of fresh) deniedFields.add(f);
      console.warn(`[crustdata.v2] account lacks access to ${fresh.join(", ")} — retrying without them`);
      r = await send();
    }
  }
  if (!r.ok) return r;
  const json = r.data ?? {};
  const profiles = (json.profiles ?? json.data ?? json.results ?? []) as Record<string, unknown>[];
  const total_count = (json.total_count ?? json.total ?? profiles.length) as number;
  const next_cursor = (json.next_cursor ?? json.cursor ?? null) as string | null;
  return { ok: true, data: { profiles, total_count, next_cursor } };
}


// ─────────────────────────────────────────────────────────────────────
// v2 Company Search — the company-graph half of deep specialty recall.
// A person at a foot-and-ankle company rarely writes "foot and ankle" on
// their own profile; the COMPANY writes it in its specialities. This finds
// those companies so the person search can follow the employment edge.
// POST /company/search, 0.03 credits per returned company.
// ─────────────────────────────────────────────────────────────────────
export interface CompanySearchV2Input {
  filters: Record<string, unknown>;
  limit?: number;
}
export interface CompanySearchV2Hit {
  company_id: number;
  name: string;
}
export async function companySearchV2(
  input: CompanySearchV2Input,
): Promise<V2Result<CompanySearchV2Hit[]>> {
  const body = {
    filters: input.filters,
    limit: input.limit ?? 100,
  };
  const r = await rateLimited("/company/search", () =>
    call<Record<string, unknown>>("/company/search", {
      method: "POST",
      body: JSON.stringify(body),
    }));
  if (!r.ok) return r;
  const rows = ((r.data?.companies ?? r.data?.data ?? r.data?.results ?? []) as Record<string, unknown>[]);
  const hits: CompanySearchV2Hit[] = [];
  for (const row of rows) {
    const basic = (row.basic_info ?? row) as Record<string, unknown>;
    const id = basic.crustdata_company_id ?? basic.company_id ?? row.crustdata_company_id;
    const name = basic.name ?? row.name;
    if (typeof id === "number" && typeof name === "string") hits.push({ company_id: id, name });
  }
  return { ok: true, data: hits };
}

// ─────────────────────────────────────────────────────────────────────
// v2 Person Enrich (synchronous, base 1 credit when cached record found)
// ─────────────────────────────────────────────────────────────────────
// POST /person/enrich body { professional_network_profile_urls: [url], fields }.
// Response is a LIST aligned with the input urls: each row is
// { matched_on, matches: [{ person_data }] } — best match first
// (verified live in demo/crustdata.mjs personEnrich, 2026-08-04).
// NOTE: honors.* and skills are filter-only in /person/search projections
// (400 in `fields` there) but are valid enrich fields — this is the only
// way to read the actual award records.

export interface PersonEnrichV2Row {
  matched_on?: unknown;
  matches?: Array<{ person_data?: Record<string, unknown> }>;
}

export const AWARD_EVIDENCE_FIELDS = [
  "basic_profile.name",
  // About text + employment descriptions: award mentions frequently live only
  // in one of these. Both are enabled on the account since the provider
  // lifted the field restrictions (2026-09-08).
  "basic_profile.summary",
  "experience.employment_details.current.description",
  "experience.employment_details.past.description",
  "honors",
  "skills",
] as const;


export async function personEnrichV2(
  linkedinUrl: string,
  fields: readonly string[] = AWARD_EVIDENCE_FIELDS,
): Promise<V2Result<PersonEnrichV2Row[]>> {
  const url = (linkedinUrl ?? "").trim();
  if (!url) return { ok: false, status: 400, insufficientCredits: false, detail: "linkedin url required" };
  // US-009: coalesce duplicate requests for the same URL (~2s window) so a
  // double-clicked card expansion issues ONE enrich call, then gate behind
  // the per-path token bucket with single 429 retry.
  const r = await enrichCoalescer.run(
    `${url}|${fields.join(",")}`,
    () =>
      rateLimited("/person/enrich", () =>
        call<PersonEnrichV2Row[]>("/person/enrich", {
          method: "POST",
          body: JSON.stringify({
            professional_network_profile_urls: [url],
            fields: [...fields],
          }),
        })),
  );
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] };
}

// ─────────────────────────────────────────────────────────────────────
// v2 Company Enrich (2 credits/record when a company matches)
// ─────────────────────────────────────────────────────────────────────
// POST /company/enrich with ONE identifier type per call
// (crustdata_company_ids[] preferred — exact; names[] fallback) + fields.
// Response is a LIST aligned with the input: each row is
// { matched_on, match_type, matches: [{ company_data }] } — best match first
// (probed live 2026-08-25). Leadership/headcount/hiring/news are ENRICH-ONLY
// sections (never returned by /company/search) — this is the only way to
// read them. Rate limit class: enrich (15 rpm).

export interface CompanyEnrichV2Row {
  matched_on?: unknown;
  match_type?: unknown;
  matches?: Array<{ company_data?: Record<string, unknown> }>;
}

/** Field groups the company-intel panel needs (Steven call 2026-08-07:
 *  leadership, hiring trends, "what's going on there"). */
export const COMPANY_INTEL_FIELDS = [
  "basic_info",
  "people",
  "headcount",
  "hiring",
  "news",
  "funding",
] as const;

export async function companyEnrichV2(
  input: { companyId?: number | null; name?: string | null },
  fields: readonly string[] = COMPANY_INTEL_FIELDS,
): Promise<V2Result<CompanyEnrichV2Row[]>> {
  const name = (input.name ?? "").trim();
  const hasId = typeof input.companyId === "number" && Number.isFinite(input.companyId);
  if (!hasId && !name) {
    return { ok: false, status: 400, insufficientCredits: false, detail: "companyId or name required" };
  }
  const body = hasId
    ? { crustdata_company_ids: [input.companyId], fields: [...fields] }
    : { names: [name], fields: [...fields] };
  // Same double-click protection as person enrich: coalesce identical
  // requests (~2s window), then the per-path token bucket + 429 retry.
  const r = await enrichCoalescer.run(
    `company|${hasId ? `id:${input.companyId}` : `name:${name.toLowerCase()}`}|${fields.join(",")}`,
    () =>
      rateLimited("/company/enrich", () =>
        call<CompanyEnrichV2Row[]>("/company/enrich", {
          method: "POST",
          body: JSON.stringify(body),
        })),
  );
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data) ? r.data : [] };
}

// ─────────────────────────────────────────────────────────────────────
// Batch Contact Enrich (poll-to-completion)
// ─────────────────────────────────────────────────────────────────────
// Required fields per project decision: business_email + personal_emails + mobile_phone.
// Crustdata bills the record only if at least one required field is returned.
export const DEFAULT_REQUIRED_FIELDS = [
  "business_email",
  "personal_emails",
  "mobile_phone",
] as const;

export interface BatchEnrichInput {
  linkedin_url: string;
  /** Optional custom id echoed back in the result for client-side correlation. */
  custom_id?: string;
}

export interface BatchEnrichResult {
  linkedin_url: string;
  business_email: string | null;
  business_email_verified: boolean;
  personal_emails: string[];
  mobile_phone: string | null;
  phones: string[];
  raw: Record<string, unknown>;
  has_contact: boolean;
}

interface BatchSubmitResponse {
  batch_id?: string;
  id?: string;
  status?: string;
}

interface BatchStatusResponse {
  status?: "queued" | "running" | "in_progress" | "completed" | "failed" | string;
  download_url?: string;
  result_url?: string;
  output_url?: string;
  results?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  error?: string;
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000;

export function pickHasContact(p: Record<string, unknown>): BatchEnrichResult {
  // Row shape verified live 2026-08-07: { professional_network_url, person_id,
  //   business_email: [{email, status}], personal_contact_info:
  //   { personal_emails: [{email, status}], phone_numbers: [string] } }.
  // Legacy flat keys kept as fallbacks for cached rows.
  const linkedin_url = (p.professional_network_url ?? p.linkedin_url ?? p.linkedin_profile_url ?? "") as string;

  type EmailObj = { email?: string; status?: string };
  const beArr = (Array.isArray(p.business_email) ? p.business_email : p.business_email ? [p.business_email] : []) as (EmailObj | string)[];
  const beFirst = beArr[0];
  const businessEmail = (typeof beFirst === "string" ? beFirst : beFirst?.email ?? null) as string | null;
  const businessEmailVerified = typeof beFirst === "object" && beFirst !== null
    ? beFirst.status === "deliverable"
    : !!(p.business_email_verified ?? p.work_email_verified ?? false);

  const pci = (p.personal_contact_info ?? {}) as Record<string, unknown>;
  const peArr = (Array.isArray(pci.personal_emails) ? pci.personal_emails : (p.personal_emails as unknown[]) ?? []) as (EmailObj | string)[];
  const personalEmails = peArr
    .map((e) => (typeof e === "string" ? e : e?.email))
    .filter((e): e is string => typeof e === "string" && e.length > 0);

  const rawPhones = (Array.isArray(pci.phone_numbers) ? pci.phone_numbers : (p.phones ?? p.phone_numbers ?? [])) as string | string[];
  const phones = (Array.isArray(rawPhones) ? rawPhones : rawPhones ? [rawPhones] : [])
    .filter((e): e is string => typeof e === "string" && !e.includes("@"));

  const mobilePhone = ((p.mobile_phone as string | null) ?? phones[0] ?? null) as string | null;

  const has_contact = !!(businessEmail || personalEmails.length || mobilePhone || phones.length);

  return {
    linkedin_url,
    business_email: businessEmail,
    business_email_verified: businessEmailVerified,
    personal_emails: personalEmails,
    mobile_phone: mobilePhone,
    phones,
    raw: p,
    has_contact,
  };
}

/**
 * Submit a batch contact enrich and poll until complete (or 30s timeout).
 * Resolves to an array of BatchEnrichResult aligned by linkedin_url match.
 * has_contact=false means Crustdata returned nothing useful → caller MUST NOT
 * charge the user for those records.
 */
export async function batchContactEnrich(
  inputs: BatchEnrichInput[],
  requiredFields: readonly string[] = DEFAULT_REQUIRED_FIELDS,
): Promise<V2Result<BatchEnrichResult[]>> {
  if (!inputs.length) return { ok: true, data: [] };

  // 1. Submit — wire contract verified live 2026-08-07: the endpoint takes
  // professional_network_profile_urls + nested `fields` paths ("required_fields"
  // and inputs[] are rejected with a 400).
  const FIELD_MAP: Record<string, string> = {
    business_email: "business_email",
    personal_emails: "personal_contact_info.personal_emails",
    mobile_phone: "personal_contact_info.phone_numbers",
    phone_numbers: "personal_contact_info.phone_numbers",
  };
  const fields = [...new Set(requiredFields.map((f) => FIELD_MAP[f] ?? f))];
  const submit = await call<BatchSubmitResponse>("/batch/person/contact/enrich", {
    method: "POST",
    body: JSON.stringify({
      professional_network_profile_urls: inputs.map((i) => i.linkedin_url),
      fields,
    }),
  });
  if (!submit.ok) return submit;

  const batchId = submit.data?.batch_id ?? submit.data?.id;
  if (!batchId) {
    return { ok: false, status: 502, insufficientCredits: false, detail: "no batch_id in submit response" };
  }

  // 2. Poll
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    // Status lives at /batch/{id} (the submit response status_url), not under the enrich path.
    const status = await call<BatchStatusResponse>(`/batch/${batchId}`, {
      method: "GET",
    });
    if (!status.ok) {
      // transient — keep polling unless insufficient credits
      if (status.insufficientCredits) return status;
      continue;
    }

    const s = (status.data?.status ?? "").toLowerCase();
    if (s === "failed") {
      return {
        ok: false,
        status: 502,
        insufficientCredits: false,
        detail: status.data?.error ?? "batch failed",
      };
    }
    if (s === "completed" || status.data?.results || status.data?.data) {
      // Prefer inline results; otherwise fetch download URL.
      let rows: Record<string, unknown>[] = [];
      if (Array.isArray(status.data?.results)) rows = status.data!.results!;
      else if (Array.isArray(status.data?.data)) rows = status.data!.data!;
      else {
        const url = status.data?.download_url ?? status.data?.result_url ?? status.data?.output_url;
        if (url) {
          const fetched = await fetchBatchOutput(url);
          if (!fetched.ok) return fetched;
          rows = fetched.data;
        }
      }
      return { ok: true, data: rows.map(pickHasContact) };
    }
    // queued / running → keep polling
  }

  return { ok: false, status: 504, insufficientCredits: false, detail: "batch poll timeout" };
}

async function fetchBatchOutput(url: string): Promise<V2Result<Record<string, unknown>[]>> {
  try {
    // download_url is a PRESIGNED S3 URL — sending Authorization alongside the
    // query-string signature makes S3 reject the request. Fetch bare.
    const res = await fetch(url);
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, status: res.status, insufficientCredits: isInsuff(res.status, t), detail: t.slice(0, 400) };
    }
    // Output is .jsonl.gz; S3 serves it without Content-Encoding, so fetch does
    // NOT auto-decompress. Detect gzip magic bytes and decompress explicitly.
    const buf = new Uint8Array(await res.arrayBuffer());
    let text: string;
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
      const ds = new DecompressionStream("gzip");
      text = await new Response(new Blob([buf]).stream().pipeThrough(ds)).text();
    } else {
      text = new TextDecoder().decode(buf);
    }
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const rows = lines.map((l) => {
      try { return JSON.parse(l) as Record<string, unknown>; } catch { return null; }
    }).filter((x): x is Record<string, unknown> => !!x);
    return { ok: true, data: rows };
  } catch (e) {
    return { ok: false, status: 502, insufficientCredits: false, detail: String(e) };
  }
}

// NOTE (Oslr fork): the reference repo's enrichSingleV2 helper is not ported —
// it lazy-imports a facility-crustdata module that is outside this engine's
// fork set, and nothing in this engine calls it. Single-profile contact
// enrichment routes through batchContactEnrich above.
