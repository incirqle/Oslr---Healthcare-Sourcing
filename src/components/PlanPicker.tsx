import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { billingRequest, money, type PlanOption } from "@/lib/settings-data";

export type CheckoutPlan = "starter" | "pro";
export type CheckoutInterval = "month" | "year";
export interface PlanSelection {
  plan: CheckoutPlan;
  interval: CheckoutInterval;
}

interface CatalogResponse {
  plans: PlanOption[];
}

/** Live Starter and Pro prices from Stripe, via the billing catalog. */
export function usePlanCatalog() {
  const [plans, setPlans] = useState<PlanOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    billingRequest<CatalogResponse>("catalog")
      .then((res) => {
        if (cancelled) return;
        setPlans((res.plans ?? []).filter((p) => p.id === "starter" || p.id === "pro"));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { plans, loading: !plans && !failed, failed, retry: () => setTick((t) => t + 1) };
}

export function priceOf(plan: PlanOption | undefined, interval: CheckoutInterval) {
  return plan?.prices.find((p) => p.interval === interval) ?? null;
}

/** Format a plan's price for the chosen billing period, straight from Stripe amounts. */
export function planPriceLabel(plan: PlanOption | undefined, interval: CheckoutInterval): { main: string; sub: string } | null {
  const p = priceOf(plan, interval);
  if (!plan || p?.amount == null) return null;
  if (interval === "month") return { main: `${money(p.amount, p.currency)}/mo`, sub: "billed monthly" };
  return { main: `${money(p.amount / 12, p.currency)}/mo`, sub: `${money(p.amount, p.currency)} billed yearly` };
}

const EXTRAS: Record<CheckoutPlan, string[]> = {
  starter: ["1 active agent, 10 new results a day", "Exports to CSV, Sheets, Excel and Slack"],
  pro: ["4 active agents each, 25 new results a day", "ATS and CRM connections"],
};

const PLAN_NAMES: Record<CheckoutPlan, string> = { starter: "Starter", pro: "Pro" };

/**
 * Side-by-side Starter / Pro cards with a monthly / yearly switch.
 * Prices, seats and credit pools come from the live billing catalog, never hardcoded.
 */
export function PlanPicker({
  value,
  onChange,
  compact = false,
  className,
}: {
  value: PlanSelection;
  onChange: (sel: PlanSelection) => void;
  compact?: boolean;
  className?: string;
}) {
  const { plans, loading, failed, retry } = usePlanCatalog();
  const byId = useMemo(() => new Map((plans ?? []).map((p) => [p.id as CheckoutPlan, p])), [plans]);

  if (failed) {
    return (
      <div className={cn("flex items-center justify-center gap-3 rounded-xl border border-border p-4 text-sm text-muted-foreground", className)}>
        <span>Plan prices didn't load.</span>
        <button type="button" onClick={retry} className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center gap-2 rounded-xl border border-border p-8 text-sm text-muted-foreground", className)}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading plans…
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="mx-auto flex w-fit items-center rounded-full border border-border bg-muted/40 p-1 text-sm" role="group" aria-label="Billing period">
        {(["month", "year"] as const).map((iv) => (
          <button
            key={iv}
            type="button"
            onClick={() => onChange({ ...value, interval: iv })}
            aria-pressed={value.interval === iv}
            className={cn(
              "rounded-full px-4 py-1.5 font-medium transition-colors",
              value.interval === iv ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {iv === "month" ? "Monthly" : "Yearly"}
          </button>
        ))}
      </div>

      <div className={cn("grid gap-3", compact ? "grid-cols-2" : "sm:grid-cols-2")}>
        {(["starter", "pro"] as const).map((id) => {
          const option = byId.get(id);
          const price = planPriceLabel(option, value.interval);
          const selected = value.plan === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...value, plan: id })}
              aria-pressed={selected}
              className={cn(
                "rounded-2xl border text-left transition-all",
                compact ? "p-3" : "p-5",
                selected
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary))]"
                  : "border-border bg-card hover:border-primary/50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("font-heading font-semibold", compact ? "text-sm" : "text-lg")}>{PLAN_NAMES[id]}</span>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                  )}
                  aria-hidden="true"
                >
                  {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </div>
              {price ? (
                <p className={cn("mt-1 font-semibold tabular-nums", compact ? "text-base" : "text-2xl")}>
                  {price.main}
                  <span className="ml-1.5 align-middle text-xs font-normal text-muted-foreground">{price.sub}</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Price unavailable</p>
              )}
              {!compact && option && (
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{option.seats === 1 ? "1 seat" : `Up to ${option.seats} seats`}</li>
                  <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{id === "pro" ? `${option.monthlyCredits} shared credits per seat, each month` : `${option.monthlyCredits} shared contact credits each month`}</li>
                  {EXTRAS[id].map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{f}</li>
                  ))}
                </ul>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
