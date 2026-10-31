import { assertEquals } from "jsr:@std/assert@1";
import { BETA_PRICE, contactPrices, creditsForMonth, creditsForSeats, monthIndex, PLANS, priceFor, PRICE_IDS } from "./plans.ts";

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
Deno.test("Pro credit pool is 500 per seat in use, capped at 5 seats", () => {
  assertEquals(creditsForSeats("pro", 1), 500);
  assertEquals(creditsForSeats("pro", 3), 1500);
  assertEquals(creditsForSeats("pro", 5), 2500);
  assertEquals(creditsForSeats("pro", 9), 2500);
  assertEquals(creditsForSeats("pro", 0), 500);
});
Deno.test("Starter and beta pools never grow with seats", () => {
  assertEquals(creditsForSeats("starter", 5), 150);
  assertEquals(creditsForSeats("beta", 5), 150);
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
  assertEquals(priceFor("starter", "month"), "price_1UWgc7InIoJSr7wv1isXlTeK");
  assertEquals(priceFor("starter", "month", "legacy"), "price_1UUtK3IIdDz6ofU5A65xRxfi");
  assertEquals(priceFor("pro", "year"), "price_1UWgc8InIoJSr7wv6wr1H50n");
  assertEquals(priceFor("beta", "month", "legacy"), BETA_PRICE);
  assertEquals(priceFor("beta", "year"), "price_1UWgc9InIoJSr7wvO2FyCz2D");
});
