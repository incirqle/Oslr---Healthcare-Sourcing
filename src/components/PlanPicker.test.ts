import { describe, expect, it } from "vitest";
import { planPriceLabel, priceOf } from "./PlanPicker";
import type { PlanOption } from "@/lib/settings-data";

const starter: PlanOption = {
  id: "starter",
  seats: 1,
  monthlyCredits: 150,
  prices: [
    { interval: "month", amount: 12900, currency: "usd" },
    { interval: "year", amount: 131600, currency: "usd" },
  ],
  contact_costs: { work_email: 2, personal_email: 3, phone: 3 },
};

describe("planPriceLabel", () => {
  it("shows the monthly price per month", () => {
    expect(planPriceLabel(starter, "month")).toEqual({ main: "$129.00/mo", sub: "billed monthly" });
  });

  it("shows the yearly price as a per-month figure with the yearly total", () => {
    const label = planPriceLabel(starter, "year");
    expect(label?.sub).toBe("$1,316.00 billed yearly");
    expect(label?.main).toContain("/mo");
  });

  it("returns null when the plan has no price for that period", () => {
    expect(planPriceLabel({ ...starter, prices: [] }, "month")).toBeNull();
    expect(planPriceLabel(undefined, "month")).toBeNull();
  });

  it("finds the price entry matching the billing period", () => {
    expect(priceOf(starter, "year")?.amount).toBe(131600);
    expect(priceOf(starter, "month")?.amount).toBe(12900);
  });
});
