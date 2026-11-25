import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { emailMatchesName, mergeContacts, missingAfterMerged, missingAfterPrimary, parsePdlPerson, pdlQuery, pdlRequired } from "./contact-waterfall.ts";
import { contactOutEnrichContact, contactOutQuery, normalizeContactOutProfileUrl, parseContactOutProfile } from "./contactout.ts";
import type { BatchEnrichResult } from "./crustdata-v2.ts";

const primary = (o: Partial<BatchEnrichResult>): BatchEnrichResult => ({
  linkedin_url: "x", business_email: null, business_email_verified: true, personal_emails: [],
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

Deno.test("an unverified primary work email is not accepted as sourced contact data", () => {
  const unverified = primary({ business_email: "guess@novant.org", business_email_verified: false });
  assertEquals(missingAfterPrimary(["work_email"], unverified), ["work_email"]);
  assertEquals(mergeContacts(["work_email"], unverified, null).work_email, undefined);
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

Deno.test("an unconfirmed personal email is discarded, never guessed", () => {
  const m = mergeContacts(["personal_email"], primary({ personal_emails: ["deleonjohana@aol.com"] }), null, "Leesa Galatz");
  assertEquals(m.personal_email, undefined);
});

Deno.test("a nickname address is kept when the record matched on their own LinkedIn profile", () => {
  const s = parsePdlPerson({ recommended_personal_email: "mountainrunner@yahoo.com" }, ["profile", "name"]);
  const m = mergeContacts(["personal_email"], primary({ personal_emails: ["deleonjohana@aol.com"] }), s, "Leesa Galatz");
  assertEquals(m.personal_email, "mountainrunner@yahoo.com");
});

Deno.test("a nickname address is dropped when the record matched on name only", () => {
  const s = parsePdlPerson({ recommended_personal_email: "mountainrunner@yahoo.com" }, ["name"]);
  assertEquals(mergeContacts(["personal_email"], null, s, "Leesa Galatz").personal_email, undefined);
});

Deno.test("fallback lookup sends profile, name, employer and city, and reports what matched", () => {
  const q = pdlQuery("linkedin.com/in/leesa", ["personal_email"], null, { name: "Leesa Galatz, MD", company: "Mount Sinai", location: "New York" });
  assertEquals(q.get("profile"), "linkedin.com/in/leesa");
  assertEquals(q.get("name"), "Leesa Galatz");
  assertEquals(q.get("company"), "Mount Sinai");
  assertEquals(q.get("location"), "New York");
  assertEquals(q.get("include_if_matched"), "true");
  assertEquals(q.get("min_likelihood"), "6");
  assertEquals(pdlQuery("x", ["phone"], "abc").get("profile"), null);
});

Deno.test("ContactOut query requests only missing fields and saves email credits on phone-only", () => {
  assertEquals(normalizeContactOutProfileUrl("linkedin.com/in/jane-doe/"), "https://www.linkedin.com/in/jane-doe");
  assertEquals(normalizeContactOutProfileUrl("https://www.linkedin.com/sales/people/123"), null);

  const phoneOnly = contactOutQuery("linkedin.com/in/jane-doe", ["phone"])!;
  assertEquals(phoneOnly.get("email_type"), "none");
  assertEquals(phoneOnly.get("include_phone"), "true");

  const personalOnly = contactOutQuery("https://linkedin.com/in/jane-doe", ["personal_email"])!;
  assertEquals(personalOnly.get("email_type"), "personal");
  assertEquals(personalOnly.get("include_phone"), null);

  const workOnly = contactOutQuery("https://linkedin.com/in/jane-doe", ["work_email"])!;
  assertEquals(workOnly.get("email_type"), "work");

  const both = contactOutQuery("https://linkedin.com/in/jane-doe", ["work_email", "personal_email", "phone"])!;
  assertEquals(both.get("email_type"), "personal,work");
  assertEquals(both.get("include_phone"), "true");
});

Deno.test("ContactOut tertiary fills missing personal email, verified work email, and phone without overriding earlier tiers", () => {
  const tertiary = parseContactOutProfile({
    work_email: ["jdoe@hospital.org"],
    work_email_status: { "jdoe@hospital.org": "Verified" },
    personal_email: ["janedoe@gmail.com"],
    phone: ["+13055551212"],
  }, "hospital.org");

  // When primary and secondary are empty, tertiary fills everything
  const filled = mergeContacts(["work_email", "personal_email", "phone"], null, null, "Jane Doe", tertiary);
  assertEquals(filled.work_email, "jdoe@hospital.org");
  assertEquals(filled.personal_email, "janedoe@gmail.com");
  assertEquals(filled.phones, ["+13055551212"]);
  assertEquals(filled.sources, { work_email: "tertiary", personal_email: "tertiary", phone: "tertiary" });

  // Earlier tiers always win
  const withPrimary = mergeContacts(
    ["work_email", "personal_email", "phone"],
    primary({ business_email: "primary@hospital.org" }),
    parsePdlPerson({ recommended_personal_email: "jane.doe@yahoo.com" }, ["profile"]),
    "Jane Doe",
    tertiary,
  );
  assertEquals(withPrimary.work_email, "primary@hospital.org");
  assertEquals(withPrimary.personal_email, "jane.doe@yahoo.com");
  assertEquals(withPrimary.phones, ["+13055551212"]);
  assertEquals(withPrimary.sources, { work_email: "primary", personal_email: "secondary", phone: "tertiary" });
});

Deno.test("ContactOut rejects unverified work emails and mismatched employer domains", () => {
  const unverified = parseContactOutProfile({
    work_email: ["jdoe@hospital.org"],
    work_email_status: { "jdoe@hospital.org": "Unverified" },
  }, "hospital.org");
  assertEquals(unverified.work_email, null);

  const wrongDomain = parseContactOutProfile({
    work_email: ["jdoe@oldclinic.org"],
    work_email_status: { "jdoe@oldclinic.org": "Verified" },
  }, "newhospital.org");
  assertEquals(wrongDomain.work_email, null);
});

Deno.test("missingAfterMerged skips tertiary for fields already filled by primary or secondary", () => {
  const pre = mergeContacts(["work_email", "personal_email", "phone"], primary({ business_email: "dr@hospital.org" }), pdl, "Best Name");
  assertEquals(missingAfterMerged(["work_email", "personal_email", "phone"], pre), []);

  const partial = mergeContacts(["work_email", "personal_email", "phone"], primary({ business_email: "dr@hospital.org" }), null, "Jane Doe");
  assertEquals(missingAfterMerged(["work_email", "personal_email", "phone"], partial), ["personal_email", "phone"]);
});

Deno.test("contactOutEnrichContact handles 404, 403 out-of-credits, and 200 cleanly", async () => {
  const prev = Deno.env.get("CONTACTOUT_API_KEY");
  Deno.env.set("CONTACTOUT_API_KEY", "test-token");
  try {
    const notFound = await contactOutEnrichContact(
      "https://www.linkedin.com/in/nobody",
      ["personal_email"],
      () => Promise.resolve(new Response(JSON.stringify({ status_code: 404, message: "Not Found" }), { status: 404 })),
    );
    assertEquals(notFound, { ok: true, contact: null });

    const outOfCredits = await contactOutEnrichContact(
      "https://www.linkedin.com/in/someone",
      ["personal_email"],
      () => Promise.resolve(new Response("out of credits", { status: 403 })),
    );
    assertEquals(outOfCredits, { ok: false, reason: "out_of_credits" });

    const hit = await contactOutEnrichContact(
      "https://www.linkedin.com/in/jane-doe",
      ["personal_email", "phone"],
      (input, init) => {
        const url = String(input);
        assertEquals(url.includes("email_type=personal"), true);
        assertEquals(url.includes("include_phone=true"), true);
        assertEquals((init?.headers as Record<string, string>).token, "test-token");
        return Promise.resolve(new Response(JSON.stringify({
          status_code: 200,
          profile: { personal_email: ["jane@gmail.com"], phone: ["+13055551212"] },
        }), { status: 200 }));
      },
    );
    assertEquals(hit.ok, true);
    if (hit.ok) {
      assertEquals(hit.contact?.personal_emails, ["jane@gmail.com"]);
      assertEquals(hit.contact?.phone_numbers, ["+13055551212"]);
    }
  } finally {
    if (prev === undefined) Deno.env.delete("CONTACTOUT_API_KEY");
    else Deno.env.set("CONTACTOUT_API_KEY", prev);
  }
});
