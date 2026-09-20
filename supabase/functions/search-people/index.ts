/**
 * search-people/index.ts — the product search, powered by the Crustdata clinician engine.
 *
 * This function is the product search over the Crustdata clinician engine (same wire
 * contract the legacy SearchPage was built against). SearchPage,
 * CandidateDrawer, and useCandidateSnapshot invoke it and read specific
 * response fields; every search runs through
 * supabase/functions/search-clinicians — the Crustdata-v2 engine: clinical
 * vocabulary, subspecialty families, regions, employer resolution,
 * deterministic ranking, and the AI audit.
 *
 * Wire contract the frontend depends on:
 *  - { query, preview: true }            → { preview, total, parsed, results: [], … }
 *  - { query, filters, parsed, page, size, scroll_token }
 *                                        → { results (flat person rows), total, … }
 *  - { action: "enrich_person", linkedin_url | email }
 *                                        → { data: EnrichedData-shaped, likelihood }
 *  - { action: "ai_summary" | "ai_snapshot", prompt }
 *                                        → { summary } | { snapshot }
 *
 * The engine runs IN-PROCESS (handleClinicianSearch), so auth, rate limits,
 * caching, credit ceilings, widening, and run logging are all the engine's.
 */

import { handleClinicianSearch } from "../_shared/clinician-engine/handler.ts";
import { callClaude } from "../_shared/clinician-engine/ai-router.ts";
import {
  batchContactEnrich,
  personEnrichV2,
} from "../_shared/clinician-engine/lib/crustdata-v2.ts";
import {
  ENRICHMENT_TTL_MS,
  getCrustDataCache,
  getPermanentEnrichment,
  normalizeCrustDataV2Profile,
  savePermanentEnrichment,
  setCrustDataCache,
} from "../_shared/clinician-engine/cache.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ------------------------------------------------------------------ */
/*  Row translation: engine card row → SearchPage row shape    */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function firstYear(dateish: unknown): number | null {
  if (typeof dateish !== "string") return null;
  const m = dateish.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

/** Years of experience from the earliest employment start date on the row. */
function inferYearsExperience(row: Row): number {
  const hist = Array.isArray(row.experience_history) ? row.experience_history : [];
  let earliest: number | null = null;
  for (const e of hist as Row[]) {
    const y = firstYear(e.start_date);
    if (y !== null && (earliest === null || y < earliest)) earliest = y;
  }
  if (earliest === null) return 0;
  return Math.max(0, new Date().getFullYear() - earliest);
}

/** Relevance for the UI: audit score when the grader ran, verdict tier
 *  fallback, deterministic soft score floor otherwise. */
function relevanceScore(row: Row): number {
  const audit = row.audit_score;
  if (typeof audit === "number" && Number.isFinite(audit)) return Math.round(audit);
  const verdict = typeof row.audit_verdict === "string" ? row.audit_verdict : null;
  if (verdict === "strong") return 90;
  if (verdict === "weak") return 62;
  const soft = typeof row.soft_score === "number" ? row.soft_score : 0;
  return Math.min(88, 70 + soft * 2);
}

function toSearchPageRow(row: Row): Row {
  const primary = (Array.isArray(row.current_employers)
    ? (row.current_employers as Row[]).find((e) => e.is_primary === true) ??
      (row.current_employers as Row[])[0]
    : null) ?? null;
  return {
    ...row,
    id: row.id ?? row.linkedin_url ?? null,
    job_title: row.job_title ?? null,
    job_company_name: row.job_company_name ?? null,
    job_company_industry: (primary?.industry as string | undefined) ?? null,
    job_company_size: null,
    location_locality: row.location_locality ?? null,
    location_region: row.location_region ?? null,
    linkedin_url: row.linkedin_url ?? null,
    relevance_score: relevanceScore(row),
    profile_pic_url: row.profile_picture_url ?? null,
    years_experience: inferYearsExperience(row),
    inferred_years_experience: inferYearsExperience(row),
    summary: row.summary ?? row.headline ?? null,
    headline: row.headline ?? null,
    // Contact data comes from enrich-on-expand, never the search row.
    email: null,
    emails: [],
    phone: null,
    phone_numbers: [],
    has_contact_info: false,
    skills: [],
    all_skills: [],
    clinical_skills: [],
    // Drawer fallback path reads raw.experience_history — already on the row.
  };
}

/* ------------------------------------------------------------------ */
/*  Scope banners derived from the engine's criteria echo               */
/* ------------------------------------------------------------------ */

function deriveCompanyScope(criteria: Row[]): Row | null {
  const group = criteria.find((c) => c.kind === "employer_group");
  if (group) {
    const v = (group.value ?? {}) as Row;
    const variants = Array.isArray(v.name_variants) ? v.name_variants as string[] : [];
    const ids = Array.isArray(v.company_ids) ? v.company_ids : [];
    return {
      anchor_name: (v.name as string | undefined) ?? group.label ?? null,
      is_health_system: true,
      is_small_practice: false,
      affiliated_count: Math.max(ids.length, variants.length),
      sample_affiliates: variants.slice(0, 5),
      multi_entity: true,
    };
  }
  const company = criteria.find((c) => c.kind === "company");
  if (company) {
    const v = (company.value ?? {}) as Row;
    return {
      anchor_name: (v.name as string | undefined) ?? company.label ?? null,
      is_health_system: false,
      is_small_practice: true,
      affiliated_count: 0,
      sample_affiliates: [],
      multi_entity: false,
    };
  }
  return null;
}

function deriveGeoScope(parsed: Row | null, relaxed: string[]): Row {
  const loc = ((parsed?.location ?? {}) as Row);
  const geoWidened = relaxed.some((r) => /→ all of|multi_state|state/i.test(r));
  return {
    requested_city: loc.city ?? null,
    requested_state: loc.state ?? null,
    geo_expanded: geoWidened,
    semantic_relaxed: relaxed.length > 0 && !geoWidened,
    effective_scope: geoWidened ? "state" : relaxed.length > 0 ? "semantic" : "local",
    winning_step: null,
    cascade_steps_used: relaxed,
  };
}

/* ------------------------------------------------------------------ */
/*  Engine invocation (in-process)                                      */
/* ------------------------------------------------------------------ */

async function runEngine(req: Request, engineBody: Row): Promise<{ status: number; data: Row }> {
  const engineReq = new Request("http://internal/search-clinicians", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(req.headers.get("Authorization") ? { Authorization: req.headers.get("Authorization")! } : {}),
      ...(req.headers.get("apikey") ? { apikey: req.headers.get("apikey")! } : {}),
    },
    body: JSON.stringify(engineBody),
  });
  const res = await handleClinicianSearch(engineReq);
  const data = (await res.json()) as Row;
  return { status: res.status, data };
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                        */
/* ------------------------------------------------------------------ */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const requestStart = Date.now();

  try {
    const body = (await req.json()) as Row;
    const action = (body.action as string | undefined) ?? null;

    /* ── enrich_person: Crustdata profile + contact enrich ─────────── */
    if (action === "enrich_person") {
      const linkedinUrl = typeof body.linkedin_url === "string" ? body.linkedin_url.trim() : "";
      if (!linkedinUrl) {
        // Crustdata cannot enrich by bare email; a LinkedIn URL is required.
        return json({ error: "A LinkedIn URL is required to enrich this profile." }, 400);
      }
      const cacheKey = "clin:drawer:" + linkedinUrl.toLowerCase();
      const cached = await getCrustDataCache(cacheKey, ENRICHMENT_TTL_MS);
      if (cached && cached.profiles[0]) {
        return json({ data: cached.profiles[0], likelihood: null, cached: true });
      }
      // Permanent store: once paid for, a profile is never re-purchased.
      const stored = await getPermanentEnrichment(linkedinUrl);
      if (stored) {
        return json({ data: stored, likelihood: null, cached: true });
      }

      const [profileRes, contactRes] = await Promise.all([
        personEnrichV2(linkedinUrl, [
          "basic_profile.name",
          "basic_profile.summary",
          "experience.employment_details.current",
          "experience.employment_details.past",
          "education",
          "honors",
          "skills",
          "certifications",
        ]).catch(() => null),
        batchContactEnrich([{ linkedin_url: linkedinUrl }]).catch(() => null),
      ]);

      const person = (profileRes && profileRes.ok
        ? (profileRes.data[0]?.matches?.[0]?.person_data ?? {})
        : {}) as Row;
      const basic = (person.basic_profile ?? {}) as Row;
      const contact = contactRes && contactRes.ok ? (contactRes.data[0] ?? null) : null;

      const certNames = Array.isArray(person.certifications)
        ? (person.certifications as unknown[]).map((c) =>
          typeof c === "string" ? c : ((c as Row)?.name as string | undefined) ?? null
        ).filter((c): c is string => !!c)
        : [];

      // Same normalizer the search rows go through, so the drawer sees one
      // consistent shape for employment and education.
      const norm = normalizeCrustDataV2Profile(person) as Row;
      const mapExperience = (list: unknown, isCurrent: boolean) =>
        (Array.isArray(list) ? list as Row[] : []).map((e) => ({
          title: e.title ? { name: e.title as string } : null,
          company: (e.name ?? e.company)
            ? {
              name: (e.name ?? e.company) as string,
              website: (e.company_website_domain as string | undefined) ?? null,
              linkedin_url: null,
            }
            : null,
          start_date: (e.start_date as string | undefined) ?? "",
          end_date: (e.end_date as string | undefined) ?? null,
          is_primary: isCurrent && e.is_default === true,
          summary: (e.description as string | undefined) ?? null,
          location_names: null,
        }));
      const experience = [
        ...mapExperience(norm.current_employers, true),
        ...mapExperience(norm.past_employers, false),
      ];
      const education = (Array.isArray(norm.education_background) ? norm.education_background as Row[] : [])
        .map((edu) => ({
          school: (edu.institute_name ?? edu.school_name)
            ? { name: (edu.institute_name ?? edu.school_name) as string, website: null, linkedin_url: null }
            : null,
          degrees: edu.degree_name ? [edu.degree_name as string] : [],
          majors: edu.field_of_study ? [edu.field_of_study as string] : [],
          start_date: (edu.start_date as string | undefined) ?? "",
          end_date: (edu.end_date as string | undefined) ?? null,
          summary: null,
        }));

      const shaped = {
        full_name: (basic.name as string | undefined) ?? (person.name as string | undefined) ?? "",
        summary: (basic.summary as string | undefined) ?? (person.summary as string | undefined) ?? "",
        skills: Array.isArray(person.skills) ? person.skills : [],
        certifications: certNames,
        work_email: contact?.business_email ?? "",
        personal_emails: contact?.personal_emails ?? [],
        mobile_phone: contact?.mobile_phone ?? "",
        phone_numbers: contact?.phones ?? [],
        experience,
        education,
        linkedin_url: linkedinUrl,
      };
      await setCrustDataCache(cacheKey, 1, [shaped], null);
      await savePermanentEnrichment(
        linkedinUrl,
        shaped,
        typeof body.person_id === "string" ? body.person_id : null,
      );
      return json({ data: shaped, likelihood: null });
    }

    /* ── ai_summary / ai_snapshot: unchanged behavior, engine AI stack ─ */
    if (action === "ai_summary") {
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      if (!prompt) return json({ error: "prompt required" }, 400);
      const result = await callClaude<{ summary: string }>(
        `You are a concise healthcare-recruiting assistant. You will receive a profile brief. Write a factual 3-4 sentence professional summary. Return ONLY valid JSON: { "summary": "..." }`,
        prompt,
        { summary: "" },
        "AI-Summary",
        { timeoutMs: 15000 },
      );
      return json({ summary: result.summary || "" });
    }

    if (action === "ai_snapshot") {
      const prompt = typeof body.prompt === "string" ? body.prompt : "";
      if (!prompt) return json({ error: "prompt required" }, 400);
      const result = await callClaude<{ snapshot: string }>(
        `You are a healthcare-recruiting assistant. Given a clinician's brief, write ONE crisp sentence (max 22 words) capturing what's most relevant for a recruiter — specialty, training stage or seniority, signal of fit. No filler like "is a" or "with experience in". Return ONLY valid JSON: { "snapshot": "..." }`,
        prompt,
        { snapshot: "" },
        "AI-Snapshot",
        { timeoutMs: 10000 },
      );
      return json({ snapshot: result.snapshot || "" });
    }

    /* ── Search paths ──────────────────────────────────────────────── */
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return json({ error: "Query is required" }, 400);

    const preview = body.preview === true;
    const page = typeof body.page === "number" ? body.page : 0;
    const size = typeof body.size === "number" ? body.size : 10;

    // The results call re-sends the preview's `parsed` verbatim; handing it
    // to the engine as cached_parsed skips the second LLM parse AND keeps
    // criterion ids positionally stable across the two calls.
    let clientParsed = body.parsed && typeof body.parsed === "object" ? { ...(body.parsed as Row) } : null;

    // Refine support: the filter editor sends edited arrays in body.filters.
    // SearchPage derives those arrays FROM the preview's parsed, so a value
    // identical to its derivation is untouched; only a genuine edit (added /
    // removed / changed entries) overrides the parsed payload the engine maps.
    const bodyFilters = body.filters && typeof body.filters === "object" ? body.filters as Row : null;
    if (clientParsed && bodyFilters) {
      const arr = (v: unknown): string[] | null =>
        Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : null;
      const same = (a: string[] | null, b: string[]): boolean =>
        !!a && a.length === b.length && a.every((x, i) => x === b[i]);
      const edited = (sent: string[] | null, derived: string[]): sent is string[] =>
        sent !== null && !same(sent, derived);

      const dJobTitles = arr(clientParsed.job_titles) ?? [];
      const dSpecialties = arr(clientParsed.specialties) ??
        (typeof clientParsed.specialty === "string" && clientParsed.specialty ? [clientParsed.specialty] : []);
      const dKeywords = arr(clientParsed.required_keywords) ?? arr(clientParsed.keywords) ?? [];
      const dCompanies = arr(clientParsed.current_companies) ?? arr(clientParsed.companies) ?? [];

      const fJobTitles = arr(bodyFilters.job_titles);
      const fSpecialties = arr(bodyFilters.specialties);
      const fKeywords = arr(bodyFilters.keywords);
      const fCompanies = arr(bodyFilters.companies);

      if (edited(fJobTitles, dJobTitles)) clientParsed.job_titles = fJobTitles;
      if (edited(fSpecialties, dSpecialties)) {
        clientParsed.specialties = fSpecialties;
        clientParsed.specialty = fSpecialties[0] ?? null;
      }
      if (edited(fKeywords, dKeywords)) {
        clientParsed.required_keywords = fKeywords;
        clientParsed.keywords = fKeywords;
      }
      if (edited(fCompanies, dCompanies)) {
        clientParsed.current_companies = fCompanies;
        clientParsed.companies = fCompanies;
      }
    }

    const engineBody: Row = {
      query,
      preview,
      page,
      size,
      ...(clientParsed ? { cached_parsed: clientParsed } : {}),
    };

    const { status, data } = await runEngine(req, engineBody);

    // Engine-level failures pass through with their message.
    if (status >= 400 || (typeof data.error === "string" && !Array.isArray(data.results))) {
      return json({ error: data.error ?? "Search failed", detail: data.detail ?? null }, status >= 400 ? status : 502);
    }

    const parsed = (data.parsed ?? clientParsed ?? {}) as Row;
    const criteria = Array.isArray(data.criteria) ? data.criteria as Row[] : [];
    const relaxed = Array.isArray(data.relaxed) ? data.relaxed as string[] : [];
    const total = typeof data.total === "number" ? data.total : 0;

    if (preview) {
      return json({
        preview: true,
        total,
        parsed,
        parsed_categories: [],
        parsed_keywords: [],
        results: [],
        scroll_token: null,
        hasMore: total > size,
        engine: "clinician",
        run_id: data.run_id ?? null,
        criteria,
        relaxed,
        widen_options: data.widen_options ?? [],
        credits: data.credits ?? 0,
        ...(typeof data.error_code === "string" ? { guard: data.error_code, guard_message: data.error_message ?? null } : {}),
        timing_ms: Date.now() - requestStart,
      });
    }

    const rows = (Array.isArray(data.results) ? data.results as Row[] : []).map(toSearchPageRow);
    // Grader rejects: kept out of `results`, surfaced so the page is never
    // silently empty. Same row shape as results, plus audit_verdict/reason.
    const hiddenRows = (Array.isArray(data.hidden_results) ? data.hidden_results as Row[] : []).map(toSearchPageRow);

    return json({
      results: rows,
      total,
      browsable_total: typeof data.browsable_total === "number" ? data.browsable_total : rows.length,
      parsed,
      parsed_categories: [],
      parsed_keywords: [],
      scroll_token: null,
      hasMore: data.hasMore === true,
      rejected_filtered: typeof data.rejected_filtered === "number" ? data.rejected_filtered : hiddenRows.length,
      hidden_results: hiddenRows,
      cascade_used: relaxed.length > 0,
      cascade_plan: relaxed,
      geo_scope: deriveGeoScope(parsed, relaxed),
      company_scope: deriveCompanyScope(criteria),
      ai_reranked: !!data.audit,
      ai_rerank_model: data.audit ? "claude-opus" : null,
      engine: "clinician",
      run_id: data.run_id ?? null,
      criteria,
      relaxed,
      exact: data.exact ?? relaxed.length === 0,
      widen_options: data.widen_options ?? [],
      fallback: data.fallback ?? null,
      fallback_note: data.fallback_note ?? null,
      audit: data.audit ?? null,
      credits: data.credits ?? 0,
      credits_session: data.credits_session ?? 0,
      cache_hit: data.cache_hit ?? false,
      timing_ms: Date.now() - requestStart,
    });
  } catch (err) {
    console.error("[search-people] handler error:", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
