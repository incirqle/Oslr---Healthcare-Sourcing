// Doctor intel: CMS Open Payments (exact via NPI), PubMed, ClinicalTrials.gov.
// Free federal sources only. Results cached platform-wide for 365 days.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { clinicalTrialsNameQuery, doctorIntelCacheComplete, extractClinicalTrials } from "./research.ts";

const TTL_MS = 365 * 24 * 60 * 60 * 1000;
const VERSION = "v4";
const OP_DATASETS: Record<string, string> = {
  "2025": "fb0b1734-1410-429d-92f6-3f4b35218e5e",
  "2024": "e6b17c6a-2534-4207-a4a1-6746a14911ff",
  "2023": "fb3a65aa-c901-4a38-a813-b04b00dfa2a9",
  "2022": "df01c2f8-dc1f-4e79-96cb-8208beaf143c",
};

const Person = z.object({
  first: z.string().min(1).max(80),
  last: z.string().min(1).max(80),
  state: z.string().max(40).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  employer: z.string().max(200).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
});
const Body = z.object({ people: z.array(Person).min(1).max(25), refresh: z.boolean().optional() });
type P = z.infer<typeof Person>;

const STATES: Record<string, string> = { alabama:"AL",alaska:"AK",arizona:"AZ",arkansas:"AR",california:"CA",colorado:"CO",connecticut:"CT",delaware:"DE",florida:"FL",georgia:"GA",hawaii:"HI",idaho:"ID",illinois:"IL",indiana:"IN",iowa:"IA",kansas:"KS",kentucky:"KY",louisiana:"LA",maine:"ME",maryland:"MD",massachusetts:"MA",michigan:"MI",minnesota:"MN",mississippi:"MS",missouri:"MO",montana:"MT",nebraska:"NE",nevada:"NV","new hampshire":"NH","new jersey":"NJ","new mexico":"NM","new york":"NY","north carolina":"NC","north dakota":"ND",ohio:"OH",oklahoma:"OK",oregon:"OR",pennsylvania:"PA","rhode island":"RI","south carolina":"SC","south dakota":"SD",tennessee:"TN",texas:"TX",utah:"UT",vermont:"VT",virginia:"VA",washington:"WA","west virginia":"WV",wisconsin:"WI",wyoming:"WY","district of columbia":"DC" };
const stateCode = (s?: string | null) => {
  if (!s) return null;
  const t = s.trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATES[t.toLowerCase()] ?? null;
};
const clean = (s: string) => s.replace(/[,.].*$/, "").replace(/[^A-Za-z' -]/g, "").trim();
export const keyOf = (p: P) =>
  [VERSION, clean(p.first).toLowerCase(), clean(p.last).toLowerCase(), stateCode(p.state) ?? "", (p.employer ?? "").toLowerCase().trim()].join("|");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let ncbiQueue: Promise<void> = Promise.resolve();
let nextNcbiRequestAt = 0;

/** NCBI permits three requests per second without an API key. Serialize its
 * traffic across every concurrent doctor in this isolate, with headroom. */
function fetchNcbi(url: string, signal: AbortSignal): Promise<Response> {
  const run = ncbiQueue.then(async () => {
    const wait = Math.max(0, nextNcbiRequestAt - Date.now());
    if (wait) await sleep(wait);
    nextNcbiRequestAt = Date.now() + 350;
    return fetch(url, { signal, headers: { "User-Agent": "Oslr/1.0 (oslr.health)" } });
  });
  ncbiQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function getJson(url: string, ms = 8000): Promise<any> {
  const isNcbi = new URL(url).hostname === "eutils.ncbi.nlm.nih.gov";
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = isNcbi
        ? await fetchNcbi(url, ctl.signal)
        : await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Oslr/1.0 (oslr.health)" } });
      if (!r.ok) {
        lastError = new Error(`HTTP ${r.status}`);
        if ((r.status === 429 || r.status >= 500) && attempt < 2) {
          const retryAfter = Number(r.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 750 * (2 ** attempt));
          continue;
        }
        throw lastError;
      }
      return await r.json();
    } catch (e) {
      lastError = e;
      const aborted = e instanceof DOMException && e.name === "AbortError";
      if (!aborted && attempt < 2) await sleep(750 * (2 ** attempt));
      else if (aborted || attempt === 2) throw e;
    } finally {
      clearTimeout(t);
    }
  }
  throw lastError ?? new Error("Request failed");
}

const tokens = (s?: string | null) => (s ?? "").toLowerCase().split(/[^a-z]+/)
  .filter((w) => w.length > 3)
  .map((w) => w === "orthopaedic" || w === "orthopaedics" || w === "orthopedics" ? "orthopedic" : w);

async function resolveNpi(p: P) {
  const first = clean(p.first), last = clean(p.last), st = stateCode(p.state);
  const q = new URLSearchParams({ version: "2.1", first_name: first, last_name: last, enumeration_type: "NPI-1", limit: "50" });
  if (st) q.set("state", st);
  const d = await getJson(`https://npiregistry.cms.hhs.gov/api/?${q}`);
  let rows: any[] = d?.results ?? [];
  if (rows.length > 1) {
    const words = new Set([...tokens(p.title), ...tokens(p.city)]);
    const scored = rows.map((r) => {
      const tx = (r.taxonomies ?? []).map((t: any) => t.desc).join(" ");
      const cities = (r.addresses ?? []).map((a: any) => a.city).join(" ");
      const hay = new Set([...tokens(tx), ...tokens(cities)]);
      let s = 0; for (const w of words) if (hay.has(w)) s++;
      return { r, s };
    }).sort((a, b) => b.s - a.s);
    if (scored[0].s > 0 && scored[0].s > (scored[1]?.s ?? -1)) rows = [scored[0].r];
  }
  if (rows.length !== 1) return { npi: null, candidates: rows.length };
  const r = rows[0];
  const primary = (r.taxonomies ?? []).find((t: any) => t.primary) ?? r.taxonomies?.[0];
  return {
    npi: String(r.number),
    candidates: 1,
    credential: r.basic?.credential ?? null,
    specialty: primary?.desc ?? null,
    city: r.addresses?.find((a: any) => a.address_purpose === "LOCATION")?.city ?? null,
  };
}

async function openPayments(npi: string) {
  const years = await Promise.all(Object.entries(OP_DATASETS).map(async ([year, id]) => {
    const q = new URLSearchParams();
    q.set("conditions[0][property]", "covered_recipient_npi");
    q.set("conditions[0][value]", npi);
    q.set("conditions[0][operator]", "=");
    q.set("limit", "500");
    for (const f of ["total_amount_of_payment_usdollars", "applicable_manufacturer_or_applicable_gpo_making_payment_name", "nature_of_payment_or_transfer_of_value"]) q.append("properties[]", f);
    try {
      const d = await getJson(`https://openpaymentsdata.cms.gov/api/1/datastore/query/${id}/0?${q}`, 10000);
      return { year, rows: (d?.results ?? []) as any[] };
    } catch { return { year, rows: [] as any[] }; }
  }));
  const byYear: { year: string; total: number; count: number }[] = [];
  const companies = new Map<string, number>(), kinds = new Map<string, number>();
  let total = 0, count = 0;
  for (const { year, rows } of years) {
    let yt = 0;
    for (const r of rows) {
      const amt = Number(r.total_amount_of_payment_usdollars) || 0;
      yt += amt;
      const c = r.applicable_manufacturer_or_applicable_gpo_making_payment_name || "Unknown";
      companies.set(c, (companies.get(c) ?? 0) + amt);
      const k = r.nature_of_payment_or_transfer_of_value || "Other";
      kinds.set(k, (kinds.get(k) ?? 0) + amt);
    }
    total += yt; count += rows.length;
    byYear.push({ year, total: Math.round(yt * 100) / 100, count: rows.length });
  }
  const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }));
  return { total: Math.round(total * 100) / 100, count, byYear, topCompanies: top(companies), byType: top(kinds) };
}

async function pubmed(p: P) {
  const name = `${clean(p.first)} ${clean(p.last)}`;
  const aff = [p.employer, p.city].filter(Boolean).map((a) => `"${String(a).replace(/"/g, "")}"[ad]`);
  const run = async (term: string) => {
    const d = await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=8&sort=pub_date&term=${encodeURIComponent(term)}`);
    return { count: Number(d?.esearchresult?.count ?? 0), ids: (d?.esearchresult?.idlist ?? []) as string[] };
  };
  // Strict matching to avoid name collisions: initials only with the exact
  // employer; full name with employer or city; no state-wide or loose fallback.
  const initials = `${clean(p.last)} ${clean(p.first).charAt(0)}`;
  const emp = p.employer ? `"${String(p.employer).replace(/"/g, "")}"[ad]` : null;
  let match: "affiliation" | "name" = "affiliation";
  let res = { count: 0, ids: [] as string[] };
  if (emp) res = await run(`("${name}"[au] OR "${initials}"[au]) AND ${emp}`);
  if (res.count === 0 && aff.length) res = await run(`"${name}"[au] AND (${aff.join(" OR ")})`);
  if (res.count === 0) {
    const nameOnly = await run(`"${name}"[au]`);
    // Name-only only for very rare full names.
    if (nameOnly.count > 0 && nameOnly.count <= 10) { res = nameOnly; match = "name"; }
  }
  let articles: any[] = [];
  if (res.ids.length) {
    const s = await getJson(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${res.ids.join(",")}`);
    articles = res.ids.map((id) => s?.result?.[id]).filter(Boolean).map((a: any) => ({
      pmid: a.uid, title: a.title, journal: a.fulljournalname || a.source, year: String(a.pubdate ?? "").slice(0, 4),
      url: `https://pubmed.ncbi.nlm.nih.gov/${a.uid}/`,
    }));
  }
  return { count: res.count, match, articles };
}

async function trials(p: P) {
  const q = new URLSearchParams({
    "query.term": clinicalTrialsNameQuery(clean(p.first), clean(p.last)),
    pageSize: "20",
    fields: "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,OverallOfficialName,OverallOfficialRole,LocationContactName,LocationContactRole,LocationState,StartDate",
  });
  const d = await getJson(`https://clinicaltrials.gov/api/v2/studies?${q}`);
  const st = stateCode(p.state);
  const stName = st ? Object.entries(STATES).find(([, c]) => c === st)?.[0] : null;
  return extractClinicalTrials(d ?? {}, p, stName);
}

async function build(p: P) {
  const settle = async <T>(f: () => Promise<T>) => { try { return await f(); } catch { return null; } };
  const [npi, pubs, tri] = await Promise.all([settle(() => resolveNpi(p)), settle(() => pubmed(p)), settle(() => trials(p))]);
  const payments = npi?.npi ? await settle(() => openPayments(npi.npi!)) : null;
  return { npi, payments, publications: pubs, trials: tri, fetched_at: new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: claims } = await admin.auth.getClaims(token);
    if (!claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten() }, 400);
    const people = parsed.data.people;
    const keys = people.map(keyOf);
    const out: Record<string, unknown> = {};

    if (!parsed.data.refresh) {
      const { data: hits } = await admin.from("doctor_intel_cache").select("cache_key,data,created_at").in("cache_key", keys);
      for (const h of hits ?? []) if (Date.now() - new Date(h.created_at).getTime() < TTL_MS) out[h.cache_key] = h.data;
    }
    const missing = people.filter((p, i) => !out[keys[i]]);
    // Gentle on federal servers: 4 people at a time.
    for (let i = 0; i < missing.length; i += 4) {
      const chunk = missing.slice(i, i + 4);
      const built = await Promise.all(chunk.map(build));
      const rows = chunk.map((p, j) => ({ cache_key: keyOf(p), data: built[j], created_at: new Date().toISOString() }));
      rows.forEach((r) => { out[r.cache_key] = r.data; });
      // Never turn a temporary PubMed, trials, NPI or payments failure into a
      // year-long blank answer. Successful empty results remain cacheable.
      const ok = rows.filter((r) => doctorIntelCacheComplete(r.data as Record<string, unknown>));
      if (ok.length) await admin.from("doctor_intel_cache").upsert(ok);
    }
    return json({ results: keys.map((k) => out[k] ?? null) });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
