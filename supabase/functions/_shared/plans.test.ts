import { assertEquals } from "jsr:@std/assert@1";
import { contactPrices, creditsForInvoice, PLANS, priceFor, PRICE_IDS } from "./plans.ts";

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
Deno.test("Missing plan pays Starter prices", () => {
  assertEquals(contactPrices(null), PLANS.starter.prices);
});
Deno.test("Yearly invoice grants twelve months of credits", () => {
  assertEquals(creditsForInvoice("starter", "year"), 1800);
  assertEquals(creditsForInvoice("pro", "month"), 500);
});
Deno.test("Checkout never uses the legacy $115 price", () => {
  assertEquals(priceFor("starter", "month"), "price_1UUtK3IIdDz6ofU5A65xRxfi");
  assertEquals(PRICE_IDS[priceFor("pro", "year")], { plan: "pro", interval: "year" });
});
