import { supabase } from "@/integrations/supabase/client";
export type Member = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  spent: number;
  cap: number | null;
};
export type Invoice = {
  id: string;
  number: string | null;
  created: number;
  amount: number;
  currency: string;
  status: string;
  hosted_url: string | null;
  has_pdf: boolean;
};
export type PlanOption = {
  id: "starter" | "pro" | "beta";
  seats: number;
  monthlyCredits: number;
  prices: { interval: string; amount: number | null; currency: string }[];
  contact_costs: Record<string, number>;
};
export async function billingRequest<T>(
  action: string,
  extra: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("billing", {
    body: { action, origin: window.location.origin, ...extra },
  });
  if (error || data?.error)
    throw new Error(data?.error || "Billing is unavailable. Please try again.");
  return data as T;
}
export function money(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: 2,
  }).format(amount / 100);
}
export function canUpgradeToPro(plan: string | null | undefined) {
  return plan === "starter" || plan === "beta";
}

export function workspaceCreditPool(
  plan: string | null | undefined,
  activeSeats: number,
  options?: PlanOption[],
) {
  if (plan === "enterprise") return null;
  const id = plan === "pro" ? "pro" : plan === "beta" ? "beta" : "starter";
  const option = options?.find((item) => item.id === id);
  const monthlyCredits = option?.monthlyCredits ?? (id === "pro" ? 500 : 150);
  if (id !== "pro") return monthlyCredits;
  const seats = Math.max(1, Math.min(option?.seats ?? 5, Math.floor(activeSeats) || 1));
  return monthlyCredits * seats;
}

export function monthlyMemberSpend(
  rows: { user_id: string | null; credits: number; kind: string }[],
  userId: string,
) {
  return rows
    .filter(
      (r) => r.user_id === userId && r.credits < 0 && r.kind !== "expired",
    )
    .reduce((sum, r) => sum - r.credits, 0);
}
export function saveInvoice(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
