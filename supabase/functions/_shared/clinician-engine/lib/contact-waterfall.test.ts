import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeContacts, missingAfterPrimary, parsePdlPerson, pdlRequired } from "./contact-waterfall.ts";
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
