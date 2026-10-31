import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { plansAllowIntegrations, splitName, toAtsCandidate } from "./merge.ts";

Deno.test("Starter cannot connect an ATS or CRM", () => assertEquals(plansAllowIntegrations("starter"), false));
Deno.test("Early access cannot connect an ATS or CRM", () => assertEquals(plansAllowIntegrations("beta"), false));
Deno.test("Pro can connect an ATS or CRM", () => assertEquals(plansAllowIntegrations("pro"), true));
Deno.test("Enterprise can connect an ATS or CRM", () => assertEquals(plansAllowIntegrations("enterprise"), true));
Deno.test("No plan cannot connect", () => assertEquals(plansAllowIntegrations(null), false));
Deno.test("Names split on the last word", () => assertEquals(splitName("Mary Ann Lee"), { first_name: "Mary Ann", last_name: "Lee" }));
Deno.test("ATS candidate carries email and employer", () => {
  const c = toAtsCandidate({ full_name: "Jo Smith", title: "Hand surgeon", current_employer: "Duke", email: "jo@x.com", phone: null, linkedin_url: null, location: null });
  assertEquals(c.company, "Duke");
  assertEquals(c.email_addresses[0].value, "jo@x.com");
});
