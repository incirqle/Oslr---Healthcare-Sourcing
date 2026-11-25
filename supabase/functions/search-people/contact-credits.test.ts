import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { browserContact, foundContactKinds, recentContactMiss, visibleContactChecks } from "./contact-credits.ts";
import { contactCharge } from "./contact-policy.ts";
import { contactPrices } from "../_shared/plans.ts";

Deno.test("a supported reconstruction is returned as the ordinary work email with no internal evidence metadata", () => {
  const result = browserContact({
    work_email: "mmagruder@maimo.org",
    work_email_suggestion: null,
    personal_emails: ["sourced@example.com"],
    phone_numbers: [],
    profile_pic_url: "https://images.example.com/person.jpg",
  });
  assertEquals(result, {
    work_email: "mmagruder@maimo.org",
    personal_emails: ["sourced@example.com"],
    phone_numbers: [],
    profile_pic_url: "https://images.example.com/person.jpg",
  });
  assertEquals("work_email_suggestion" in result, false);
  assertEquals(JSON.stringify(result).includes("sampleCount"), false);
  assertEquals(JSON.stringify(result).includes("verification"), false);
});

Deno.test("a reconstructed work email counts as found and uses the normal Starter two-credit charge", () => {
  const found = foundContactKinds(["work_email"], { work_email: "mmagruder@maimo.org", sources: {} });
  assertEquals(found, ["work_email"]);
  assertEquals(contactCharge(false, found.map((k) => contactPrices("starter")[k])), 2);
  assertEquals(contactCharge(false, foundContactKinds(["work_email"], { sources: {} }).map((k) => contactPrices("starter")[k])), 0);
});

Deno.test("old work-email misses retry once with dynamic research, then honor the 30-day miss cache", () => {
  const checked = { work_email: "2026-11-25T00:00:00.000Z" };
  const now = Date.parse("2026-11-25T01:00:00.000Z");
  assertEquals(recentContactMiss({}, checked, "work_email", now), false);
  assertEquals(recentContactMiss({ research_version: 6 }, checked, "work_email", now), true);
  assertEquals(recentContactMiss({}, checked, "personal_email", now), false);
  assertEquals(recentContactMiss({}, { personal_email: checked.work_email }, "personal_email", now), true);
  assertEquals(visibleContactChecks({}, checked), {});
  assertEquals(visibleContactChecks({ research_version: 6 }, checked), checked);
  assertEquals(visibleContactChecks({ research_version: 6 }, { work_email: "2020-01-01T00:00:00.000Z" }), {});
});
