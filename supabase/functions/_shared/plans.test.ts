import { assertEquals } from "jsr:@std/assert@1";
import { BETA_PRICE, contactPrices, creditsForMonth, monthIndex, PLANS, priceFor, PRICE_IDS } from "./plans.ts";

Deno.test("Starter: 150 credits, work 2, personal 3, phone 3", () => {
  assertEquals(PLANS.starter.monthlyCredits, 150);
  assertEquals(contactPrices("starter"), { work_email: 2, personal_email: 3, phone: 3 });
});
Deno.test("Pro: 500 credits, work 1, personal 2, phone 3, agents, 5 seats", () => {
  assertEquals(PLANS.pro.monthlyCredits, 500);
  assertEquals(contactPrices("pro"), { work_email: 1, personal_email: 2, phone: 3 });
  assertEquals(PLANS.pro.agents, true);
  assertEquals(PLANS.pro.seats, 5);
});
Deno.test("Starter has 1 seat", () => assertEquals(PLANS.starter.seats, 1));
Deno.test("Missing plan pays Starter prices", () => {
  assertEquals(contactPrices(null), PLANS.starter.prices);
});
Deno.test("Yearly plans only ever get one month of credits at a time", () => {
  assertEquals(creditsForMonth("starter"), 150);
  assertEquals(creditsForMonth("pro"), 500);
});
Deno.test("Month index within a yearly period", () => {
  const start = Date.UTC(2026, 0, 15);
  assertEquals(monthIndex(start, Date.UTC(2026, 0, 20)), 0);
  assertEquals(monthIndex(start, Date.UTC(2026, 1, 14)), 0);
  assertEquals(monthIndex(start, Date.UTC(2026, 1, 15)), 1);
  assertEquals(monthIndex(start, Date.UTC(2027, 0, 14)), 11);
});
Deno.test("$115 beta price is kept, 150 credits a month, and never used for Starter checkout", () => {
  assertEquals(PRICE_IDS[BETA_PRICE], { plan: "beta", interval: "month" });
  assertEquals(PLANS.beta.monthlyCredits, 150);
  assertEquals(priceFor("starter", "month"), "price_1UUtK3IIdDz6ofU5A65xRxfi");
  assertEquals(priceFor("beta", "month"), BETA_PRICE);
});
