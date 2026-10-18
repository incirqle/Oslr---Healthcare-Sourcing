/**
 * rank-actions.test.ts: rank_criteria / explain_criteria / suggestions
 * (docs/oslr-criteria-ranking-spec.md 6.2, 6.3, 6.4).
 */
import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { cleanSuggestions, cleanTitle, explainCriteria, rankCriteria, type RankDeps, type RunSnapshot } from "./rank-actions.ts";
import type { AuditTransport } from "./audit.ts";
import type { RankingCriterion } from "./ranking-criteria.ts";

const snap: RunSnapshot = {
  user_id: "u1",
  query: "orthopedic surgeons in Nashville",
  criteria: [],
  rows: [
    { id: "a", full_name: "A", job_title: "Orthopedic Surgeon", job_company_name: "X", headline: "Robotic knee surgeon" },
    { id: "b", full_name: "B", job_title: "Orthopedic Surgeon", job_company_name: "Y", headline: "Sports medicine" },
  ],
};
const crit: RankingCriterion = { id: "u12345678", text: "Uses robotic assisted surgery", title: "", position: 0, must_have: false, origin: "user" };

function deps(transport: AuditTransport, store = new Map<string, unknown>()): RankDeps & { calls: () => number } {
  let calls = 0;
  const t: AuditTransport = (...a) => { calls++; return transport(...a); };
  return {
    transport: t, model: "m",
    cacheGet: async (k) => store.get(k) ?? null,
    cacheSet: async (k, v) => { store.set(k, v); },
    sha1: async (s) => s,
    calls: () => calls,
  };
}

const grader: AuditTransport = async <T>() => ({
  verdicts: [
    { i: 0, verdict: "strong", score: 90, reason: "r", evidence: null, criteria: [{ id: "u12345678", status: "yes", evidence: "Robotic knee surgeon", section: "headline" }] },
    { i: 1, verdict: "weak", score: 50, reason: "r", evidence: null, criteria: [{ id: "u12345678", status: "not_shown", evidence: null, section: null }] },
  ],
  titles: { u12345678: "Robotic" },
}) as unknown as T;

Deno.test("rank_criteria grades rows, takes the grader title, and never touches the network", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network call in rank_criteria"); };
  try {
    const d = deps(grader);
    const r = await rankCriteria("run1", snap, [crit], d);
    assertEquals(r.criteria_results_by_row.a[0].status, "met");
    assertEquals(r.criteria_results_by_row.b[0].status, "unknown");
    assertEquals(r.titles.u12345678, "Robotic");
    assertEquals(r.failed, []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

Deno.test("the same text on the same run never re-grades", async () => {
  const store = new Map<string, unknown>();
  const d = deps(grader, store);
  await rankCriteria("run1", snap, [crit], d);
  await rankCriteria("run1", snap, [{ ...crit, id: "u99999999", text: "  USES robotic assisted surgery " }], d);
  assertEquals(d.calls(), 1);
  assert([...store.keys()].includes("clin:crit:run1:uses robotic assisted surgery"));
});

Deno.test("a grader failure marks the criterion failed and caches nothing", async () => {
  const store = new Map<string, unknown>();
  const r = await rankCriteria("run1", snap, [crit], deps(async <T>() => null as unknown as T, store));
  assertEquals(r.failed, ["u12345678"]);
  assertEquals(store.size, 0);
});

Deno.test("rank and explain modules import nothing from the people-data provider", async () => {
  for (const f of ["rank-actions.ts", "rank-route.ts"]) {
    const src = await Deno.readTextFile(new URL(`./${f}`, import.meta.url));
    assert(!/crustdata-v2|personSearch|personEnrich|companyIdentify|batchContactEnrich/.test(src), f);
  }
});

Deno.test("short title falls back to the text-derived one", () => {
  assertEquals(cleanTitle("Robotic", "x"), "Robotic");
  assertEquals(cleanTitle("Far too many words here", "Fellowship trained"), "Fellowship");
});

Deno.test("suggestions drop what Oslr cannot check", () => {
  const out = cleanSuggestions({ suggestions: ["Hospital privileges at X", "Fellowship trained", "Has an NPI", "Revision arthroplasty", "Published research", "Outpatient joints", "Level II trauma call", "State license in TN"] });
  assertEquals(out, ["Fellowship trained", "Revision arthroplasty", "Outpatient joints", "Level II trauma call"]);
});

Deno.test("explanations are cached per run, row and criterion", async () => {
  const store = new Map<string, unknown>();
  const t: AuditTransport = async <T>() => ({ explanations: [{ k: 0, text: "Headline says robotic knee surgeon \u2014 a direct match." }] }) as unknown as T;
  const d = deps(t, store);
  const item = { row_id: "a", criterion_id: "u1", text: "Robotic", status: "met", evidence: "Robotic knee surgeon" };
  const a = await explainCriteria("run1", snap, [item], d);
  const b = await explainCriteria("run1", snap, [item], d);
  assertEquals(a["a|u1"], "Headline says robotic knee surgeon, a direct match.");
  assertEquals(b["a|u1"], a["a|u1"]);
  assertEquals(d.calls(), 1);
});
