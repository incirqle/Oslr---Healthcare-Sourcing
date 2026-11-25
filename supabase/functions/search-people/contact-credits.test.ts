import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { browserContact } from "./contact-credits.ts";

Deno.test("internal reconstructed work emails never cross into the browser payload", () => {
  const result = browserContact({
    work_email: null,
    work_email_suggestion: {
      email: "mark.sonderman@example.org",
      organization: "Example Medicine",
      domain: "example.org",
      cohort: "physician",
      pattern: "first.last",
      sampleCount: 3,
      learnedAt: "2026-11-25T00:00:00Z",
      verification: "unverified",
    },
    personal_emails: ["sourced@example.com"],
    phone_numbers: [],
  });
  assertEquals(result, { work_email: null, personal_emails: ["sourced@example.com"], phone_numbers: [] });
  assertEquals("work_email_suggestion" in result, false);
  assertEquals(JSON.stringify(result).includes("mark.sonderman"), false);
});
