import { ArrowRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canUpgradeToPro, money, type PlanOption } from "@/lib/settings-data";

function PlanCard({
  name,
  description,
  option,
  interval,
  current,
  recommended,
  features,
  onUpgrade,
}: {
  name: string;
  description: string;
  option?: PlanOption;
  interval: "month" | "year";
  current: boolean;
  recommended?: boolean;
  features: string[];
  onUpgrade?: () => void;
}) {
  const price = option?.prices.find((item) => item.interval === interval);
  const hasPrice = price?.amount !== null && price?.amount !== undefined;

  return (
    <article
      className={`relative flex h-full flex-col rounded-xl border p-6 ${
        recommended
          ? "border-primary/40 bg-primary/[0.055]"
          : "border-border bg-card"
      }`}
    >
      <div className="mb-5 flex min-h-7 items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-bold">{name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {current ? (
          <Badge variant="secondary" className="shrink-0">Current plan</Badge>
        ) : recommended ? (
          <Badge className="shrink-0">Recommended</Badge>
        ) : null}
      </div>

      <div className="mb-6 min-h-12">
        {hasPrice ? (
          <p className="font-display text-3xl font-bold tracking-tight">
            {money(price.amount, price.currency)}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              / {interval}
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Current price unavailable</p>
        )}
      </div>

      <ul className="mb-7 flex-1 space-y-3.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm leading-relaxed">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {onUpgrade && (
        <Button className="w-full" size="lg" onClick={onUpgrade}>
          Upgrade to Pro
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
      {current && !onUpgrade && (
        <p className="text-center text-sm text-muted-foreground">
          This is your workspace&apos;s current plan.
        </p>
      )}
    </article>
  );
}

export function PlanComparison({
  options,
  currentPlan,
  interval,
  onUpgrade,
}: {
  options?: PlanOption[];
  currentPlan?: string | null;
  interval: "month" | "year";
  onUpgrade?: () => void;
}) {
  const starter = options?.find(
    (option) => option.id === (currentPlan === "beta" ? "beta" : "starter"),
  );
  const pro = options?.find((option) => option.id === "pro");
  const upgrade = onUpgrade && canUpgradeToPro(currentPlan) ? onUpgrade : undefined;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <PlanCard
        name={currentPlan === "beta" ? "Early access" : "Starter"}
        description="For an individual recruiter"
        option={starter}
        interval={interval}
        current={currentPlan === "starter" || currentPlan === "beta"}
        features={[
          "1 workspace seat",
          `${starter?.monthlyCredits ?? 150} shared credits each month`,
          "1 active agent for the workspace, with up to 10 matches a day",
          `Work email ${starter?.contact_costs.work_email ?? 2} credits · personal email ${starter?.contact_costs.personal_email ?? 3} · phone ${starter?.contact_costs.phone ?? 3}`,
        ]}
      />
      <PlanCard
        name="Pro"
        description="For a recruiting team"
        option={pro}
        interval={interval}
        current={currentPlan === "pro"}
        recommended={currentPlan !== "pro"}
        onUpgrade={upgrade}
        features={[
          `Up to ${pro?.seats ?? 5} seats for admins, recruiters, and viewers`,
          `${pro?.monthlyCredits ?? 500} credits per active seat each month, all in one shared pool`,
          "4 active agents per teammate, each with up to 25 matches a day",
          `Work email ${pro?.contact_costs.work_email ?? 1} credit · personal email ${pro?.contact_costs.personal_email ?? 2} · phone ${pro?.contact_costs.phone ?? 3}`,
        ]}
      />
    </div>
  );
}
