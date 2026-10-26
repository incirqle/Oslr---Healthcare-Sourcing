// Oslr plans: Stripe prices, monthly credits and contact lookup costs.
// One source for billing (checkout, credit grants) and contact lookups.
export type PlanId = "starter" | "pro";
export type Interval = "month" | "year";
export type ContactKind = "work_email" | "personal_email" | "phone";

export interface Plan {
  monthlyCredits: number;
  agents: boolean;
  seats: number;
  prices: Record<ContactKind, number>;
}

export const PLANS: Record<PlanId, Plan> = {
  starter: { monthlyCredits: 150, agents: false, seats: 1, prices: { work_email: 2, personal_email: 3, phone: 3 } },
  pro: { monthlyCredits: 500, agents: true, seats: 5, prices: { work_email: 1, personal_email: 2, phone: 3 } },
};

// Stripe price id -> plan and billing interval. The $115 legacy price still counts as Starter monthly.
export const PRICE_IDS: Record<string, { plan: PlanId; interval: Interval }> = {
  price_1UUtK3IIdDz6ofU5A65xRxfi: { plan: "starter", interval: "month" },
  price_1UUtK3IIdDz6ofU5w3c9iX8o: { plan: "starter", interval: "year" },
  price_1UUtK4IIdDz6ofU5GaoEuBDX: { plan: "pro", interval: "month" },
  price_1UUtK4IIdDz6ofU5T91Yq4Gz: { plan: "pro", interval: "year" },
  price_1UPqrsIIdDz6ofU5w98C1smQ: { plan: "starter", interval: "month" },
};

export function priceFor(plan: PlanId, interval: Interval): string {
  const hit = Object.entries(PRICE_IDS).find(([id, v]) =>
    v.plan === plan && v.interval === interval && id !== "price_1UPqrsIIdDz6ofU5w98C1smQ");
  return hit![0];
}

/** Credits granted for one paid invoice. A yearly invoice grants twelve months up front. */
export function creditsForInvoice(plan: PlanId, interval: Interval): number {
  return PLANS[plan].monthlyCredits * (interval === "year" ? 12 : 1);
}

/** Contact lookup prices for a workspace plan. Unknown or missing plan pays Starter prices. */
export function contactPrices(plan: string | null | undefined): Record<ContactKind, number> {
  return plan === "pro" ? PLANS.pro.prices : PLANS.starter.prices;
}
