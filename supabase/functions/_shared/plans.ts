// Oslr plans: Stripe prices, monthly credits and contact lookup costs.
// One source for billing (checkout, credit grants) and contact lookups.
// Credits are always granted one month at a time and expire at the end of that month (no rollover),
// including on yearly billing.
export type PlanId = "starter" | "pro" | "beta";
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
  // Invite-only early-user plan ($115 a month). Never shown publicly.
  beta: { monthlyCredits: 150, agents: false, seats: 1, prices: { work_email: 2, personal_email: 3, phone: 3 } },
};

export const BETA_PRICE = "price_1UPqrsIIdDz6ofU5w98C1smQ";

// Stripe price id -> plan and billing interval.
export const PRICE_IDS: Record<string, { plan: PlanId; interval: Interval }> = {
  price_1UUtK3IIdDz6ofU5A65xRxfi: { plan: "starter", interval: "month" },
  price_1UUtK3IIdDz6ofU5w3c9iX8o: { plan: "starter", interval: "year" },
  price_1UUtK4IIdDz6ofU5GaoEuBDX: { plan: "pro", interval: "month" },
  price_1UUtK4IIdDz6ofU5T91Yq4Gz: { plan: "pro", interval: "year" },
  [BETA_PRICE]: { plan: "beta", interval: "month" },
};

export function priceFor(plan: PlanId, interval: Interval): string {
  if (plan === "beta") return BETA_PRICE;
  const hit = Object.entries(PRICE_IDS).find(([, v]) => v.plan === plan && v.interval === interval);
  return hit![0];
}

/** Credits granted for one month of a plan. Yearly plans never get more than one month at a time. */
export function creditsForMonth(plan: PlanId): number {
  return PLANS[plan].monthlyCredits;
}

/**
 * Monthly credit pool for a workspace. Credits are shared by the whole team.
 * Pro adds 500 credits per seat in use (up to its 5-seat cap); other plans are a flat pool.
 */
export function creditsForSeats(plan: PlanId, seats: number): number {
  if (plan !== "pro") return PLANS[plan].monthlyCredits;
  const used = Math.max(1, Math.min(PLANS.pro.seats, Math.floor(seats) || 1));
  return PLANS.pro.monthlyCredits * used;
}

/** Whole months elapsed since a yearly period started (0 = first month). */
export function monthIndex(periodStartMs: number, nowMs: number): number {
  const a = new Date(periodStartMs), b = new Date(nowMs);
  let m = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) m -= 1;
  return Math.max(0, Math.min(11, m));
}

/** Contact lookup prices for a workspace plan. Unknown or missing plan pays Starter prices. */
export function contactPrices(plan: string | null | undefined): Record<ContactKind, number> {
  return plan === "pro" ? PLANS.pro.prices : PLANS.starter.prices;
}
