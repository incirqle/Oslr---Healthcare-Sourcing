import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { emailMatchesName, mergeContacts, missingAfterPrimary, parsePdlPerson, pdlRequired } from "./contact-waterfall.ts";
import type { BatchEnrichResult } from "./crustdata-v2.ts";

const primary = (o: Partial<BatchEnrichResult>): BatchEnrichResult => ({
  linkedin_url: "x", business_email: null, business_email_verified: false, personal_emails: [],
  mobile_phone: null, phones: [], raw: {}, has_contact: false, ...o,
});
const pdl = parsePdlPerson({
  id: "pdl123", work_email: "old@duke.edu", job_company_website: "carolinaortho.com",
  recommended_personal_email: "best@gmail.com", personal_emails: ["stale@yahoo.com", "best@gmail.com"],
  mobile_phone: "+17045551234", phone_numbers: ["+17045559999"],
});

Deno.test("primary work email is never overridden by the secondary", () => {
  const m = mergeContacts(["work_email"], primary({ business_email: "dr@novant.org" }), parsePdlPerson({ work_email: "dr@other.com" }));
  assertEquals(m.work_email, "dr@novant.org");
  assertEquals(m.sources.work_email, "primary");
});

Deno.test("stale secondary work email from a past employer is rejected", () => {
  const m = mergeContacts(["work_email"], primary({}), pdl);
  assertEquals(m.work_email, undefined);
});

Deno.test("secondary work email at the current employer fills the gap", () => {
  const m = mergeContacts(["work_email"], primary({}), parsePdlPerson({ work_email: "a@carolinaortho.com", job_company_website: "www.carolinaortho.com" }));
  assertEquals(m.work_email, "a@carolinaortho.com");
});

Deno.test("missing personal email uses the secondary recommended address, only one", () => {
  const m = mergeContacts(["personal_email"], primary({}), pdl);
  assertEquals(m.personal_email, "best@gmail.com");
});

Deno.test("missing phone uses the secondary mobile first", () => {
  const m = mergeContacts(["phone"], primary({}), pdl);
  assertEquals(m.phones?.[0], "+17045551234");
});

Deno.test("only missing kinds are sent to the secondary", () => {
  assertEquals(missingAfterPrimary(["work_email", "personal_email", "phone"], primary({ business_email: "a@b.org" })), ["personal_email", "phone"]);
  assertEquals(pdlRequired(["personal_email"]), "personal_emails");
});

Deno.test("PDL id is kept for future lookups", () => {
  assertEquals(pdl.pdl_id, "pdl123");
});

import { combinePrimary } from "./contact-waterfall.ts";
import { submitWithWait, summarizeResearchProfile, BATCH_MAX_PROFILES, BATCH_MAX_CONCURRENT } from "./crustdata-v2.ts";

Deno.test("batch retry only fills what the instant lookup missed", () => {
  const c = combinePrimary(
    primary({ business_email: "dr@novant.org", has_contact: true }),
    primary({ business_email: "other@x.org", personal_emails: ["me@gmail.com"], phones: ["+17045551234"], mobile_phone: "+17045551234" }),
  )!;
  assertEquals(c.business_email, "dr@novant.org");
  assertEquals(c.personal_emails, ["me@gmail.com"]);
  assertEquals(c.mobile_phone, "+17045551234");
  assertEquals(missingAfterPrimary(["work_email", "personal_email", "phone"], c), []);
});

Deno.test("batch jobs are capped at 300 profiles, 5 at once", () => {
  assertEquals(BATCH_MAX_PROFILES, 300);
  assertEquals(BATCH_MAX_CONCURRENT, 5);
});

Deno.test("a 429 on batch submit waits and resubmits instead of giving up", async () => {
  let calls = 0;
  const r = await submitWithWait(async () => {
    calls++;
    return calls < 3
      ? { ok: false as const, status: 429, insufficientCredits: false, detail: "busy" }
      : { ok: true as const, data: { batch_id: "b1" } };
  }, 1, 1000);
  assertEquals(calls, 3);
  assertEquals(r.ok, true);
});

Deno.test("research profile keeps metrics and the most cited papers", () => {
  const s = summarizeResearchProfile({ research_profiles: [{
    profile_url: "https://scholar.example/u1", designation: "Professor of Surgery",
    citations_count: { all: 5400, recent: 2100, recent_since_year: 2021 }, h_index: { all: 38 }, i10_index: { all: 90 },
    article_count: 120, co_author_count: 40, research_interests: ["Trauma"],
    articles: [{ title: "Low", total_citations: 3 }, { title: "High", total_citations: 900, publication_year: "2019" }],
  }] })!;
  assertEquals(s.h_index, 38);
  assertEquals(s.citations, 5400);
  assertEquals(s.top_articles[0].title, "High");
  assertEquals(summarizeResearchProfile({}), null);
});

Deno.test("personal email that matches the person's name beats one that does not", () => {
  const m = mergeContacts(["personal_email"], primary({ personal_emails: ["deleonjohana@aol.com"] }), parsePdlPerson({ personal_emails: ["lgalatz@gmail.com"] }), "Leesa Galatz");
  assertEquals(m.personal_email, "lgalatz@gmail.com");
});

Deno.test("name check accepts first+last, initial+last and rejects another person's name", () => {
  assertEquals(emailMatchesName("leesa.galatz@gmail.com", "Leesa Galatz"), true);
  assertEquals(emailMatchesName("lgalatz@gmail.com", "Leesa Galatz"), true);
  assertEquals(emailMatchesName("deleonjohana@aol.com", "Leesa Galatz"), false);
});
