import { useState } from "react";
import { Bot, Check, Loader2, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { billingRequest, money, type PlanOption } from "@/lib/settings-data";

const benefits = [
  {
    icon: Users,
    title: "Up to 5 seats",
    description: "Invite admins, recruiters, or read-only viewers.",
  },
  {
    icon: Bot,
    title: "4 active agents per teammate",
    description: "Each agent can surface up to 25 matches a day.",
  },
  {
    icon: Zap,
    title: "500 credits per active seat",
    description: "Every credit goes into one shared monthly workspace pool.",
  },
  {
    icon: Check,
    title: "Lower contact lookup rates",
    description: "Work emails cost 1 credit and personal emails cost 2.",
  },
];

export function UpgradeToProDialog({
  open,
  onOpenChange,
  options,
  interval,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options?: PlanOption[];
  interval?: string | null;
  onChanged: () => void | Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const billingInterval = interval === "year" ? "year" : "month";
  const price = options
    ?.find((option) => option.id === "pro")
    ?.prices.find((option) => option.interval === billingInterval);
  const hasPrice = price?.amount !== null && price?.amount !== undefined;

  const upgrade = async () => {
    setBusy(true);
    try {
      await billingRequest("upgrade", { interval: billingInterval });
      await onChanged();
      onOpenChange(false);
      toast.success("You're now on Pro. Your team capacity is ready.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <div className="border-b border-border bg-primary/[0.06] p-6 pr-12 sm:p-7">
          <DialogHeader className="space-y-3">
            <Badge variant="outline" className="w-fit border-primary/30 bg-background/60">
              For growing recruiting teams
            </Badge>
            <DialogTitle className="font-display text-2xl font-bold tracking-tight">
              Upgrade to Pro
            </DialogTitle>
            <DialogDescription className="max-w-lg leading-relaxed">
              Give every teammate room to source while keeping spending in one
              shared workspace pool.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 p-6 sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="flex gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <benefit.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {benefit.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-secondary/40 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Pro subscription</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your current {billingInterval === "year" ? "annual" : "monthly"}
                  {" "}billing schedule stays the same.
                </p>
              </div>
              <p className="font-display text-xl font-bold">
                {hasPrice ? money(price.amount, price.currency) : "Price unavailable"}
                {hasPrice && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {billingInterval}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              disabled={busy || !hasPrice}
              onClick={upgrade}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {busy ? "Upgrading your workspace…" : "Confirm upgrade to Pro"}
            </Button>
            <p className="text-center text-xs leading-relaxed text-muted-foreground">
              Your billing account invoices the prorated difference to your card
              on file. Your projects, saved clinicians, and agents stay in place.
              No additional per-seat subscription charge is added.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
