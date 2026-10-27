// Doctor intel: CMS Open Payments (exact via NPI), PubMed, ClinicalTrials.gov.
// Free federal sources only. Results cached platform-wide for 365 days.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const TTL_MS = 365 * 24 * 60 * 60 * 1000;
const VERSION = "v2";
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

async function getJson(url: string, ms = 8000): Promise<any> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "User-Agent": "Oslr/1.0 (oslr.health)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

const tokens = (s?: string | null) => (s ?? "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);

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
  // PubMed indexes authors as "Last FirstInitial" (e.g. "Brandon J"), so the
  // full-name search alone misses most papers.
  const initials = `${clean(p.last)} ${clean(p.first).charAt(0)}`;
  const stName = (() => { const c = stateCode(p.state); return c ? Object.entries(STATES).find(([, v]) => v === c)?.[0] : null; })();
  const affAll = [...aff, ...(stName ? [`"${stName}"[ad]`] : [])];
  let match: "affiliation" | "name" = "affiliation";
  let res = aff.length ? await run(`("${name}"[au] OR "${initials}"[au]) AND (${aff.join(" OR ")})`) : { count: 0, ids: [] as string[] };
  if (res.count === 0) {
    const nameOnly = await run(`"${name}"[au]`);
    // Name-only is only trusted when small (uncommon name); otherwise shown as zero.
    if (nameOnly.count > 0 && nameOnly.count <= 60) { res = nameOnly; match = "name"; }
  }
  if (res.count === 0 && affAll.length) {
    const byState = await run(`"${initials}"[au] AND (${affAll.join(" OR ")})`);
    if (byState.count > 0 && byState.count <= 15) { res = byState; match = "name"; }
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
  const name = `${clean(p.first)} ${clean(p.last)}`;
  const q = new URLSearchParams({ "query.term": `AREA[OverallOfficialName]"${name}"`, pageSize: "20", fields: "NCTId,BriefTitle,OverallStatus,Phase,LeadSponsorName,OverallOfficialName,LocationState,StartDate" });
  const d = await getJson(`https://clinicaltrials.gov/api/v2/studies?${q}`);
  const st = stateCode(p.state);
  const stName = st ? Object.entries(STATES).find(([, c]) => c === st)?.[0] : null;
  const list = (d?.studies ?? []).map((s: any) => {
    const ps = s.protocolSection ?? {};
    const states: string[] = (ps.contactsLocationsModule?.locations ?? []).map((l: any) => String(l.state ?? "").toLowerCase());
    const officials = (ps.contactsLocationsModule?.overallOfficials ?? []).map((o: any) => String(o.name ?? "").toLowerCase());
    return {
      nctId: ps.identificationModule?.nctId, title: ps.identificationModule?.briefTitle,
      status: ps.statusModule?.overallStatus, phase: (ps.designModule?.phases ?? []).join(", ") || null,
      sponsor: ps.sponsorCollaboratorsModule?.leadSponsor?.name ?? null, start: ps.statusModule?.startDateStruct?.date ?? null,
      url: `https://clinicaltrials.gov/study/${ps.identificationModule?.nctId}`,
      _ok: officials.some((o: string) => o.includes(clean(p.last).toLowerCase())) && (!stName || states.length === 0 || states.includes(stName)),
    };
  }).filter((t: any) => t._ok).map(({ _ok, ...t }: any) => t);
  return { count: list.length, studies: list.slice(0, 10) };
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
      // Cache only when at least one source answered.
      const ok = rows.filter((r) => (r.data as any).npi || (r.data as any).publications || (r.data as any).trials);
      if (ok.length) await admin.from("doctor_intel_cache").upsert(ok);
    }
    return json({ results: keys.map((k) => out[k] ?? null) });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});
