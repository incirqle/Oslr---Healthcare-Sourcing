import { useEffect, useState } from "react";
import { Loader2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Navigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useCreditBalance } from "@/hooks/useContactEnrich";
import { EmbeddedCheckoutDialog } from "@/components/EmbeddedCheckoutDialog";
import { stripePromise } from "@/lib/stripe";

const LABEL: Record<string, string> = {
  work_email: "Work email found",
  personal_email: "Personal email found",
  phone: "Phone number found",
  grant: "Credits added",
  expired: "Unused credits expired",
  agent_build: "Agent created",
};

interface Tx { id: string; kind: string; credits: number; candidate_name: string | null; note: string | null; created_at: string }

export function CreditsPanel() {
  const { companyId } = useCompany();
  const balance = useCreditBalance(companyId);
  const [rows, setRows] = useState<Tx[]>([]);
  const [plan, setPlan] = useState<{ subscribed: boolean; plan?: "starter" | "pro" | "beta" | null; interval?: "month" | "year" | null; renews_at: string | null; cancel_at_period_end: boolean; beta_eligible?: boolean; seats_used?: number; monthly_credits?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<"starter" | "pro" | "beta">("starter");
  const [yearly, setYearly] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const planName = plan?.plan === "pro" ? "Pro" : plan?.plan === "beta" ? "Early access" : "Starter";
  const [exempt, setExempt] = useState(false);
  const [unlimited, setUnlimited] = useState(false);
  useEffect(() => {
    if (!companyId) return;
    supabase.from("billing_exemptions").select("company_id, unlimited_access").eq("company_id", companyId).maybeSingle()
      .then(({ data }) => { setExempt(!!data); setUnlimited(data?.unlimited_access === true); });
  }, [companyId]);

  const loadStatus = () => supabase.functions.invoke("billing", { body: { action: "status" } }).then(({ data }) => {
    if (data && !data.error) {
      setPlan(data);
      if (data.beta_eligible && !data.subscribed) setPick("beta");
      if (data.granted > 0) {
        toast.success(`${data.granted} credits added for this month`);
        window.dispatchEvent(new Event("oslr:credits"));
      }
    }
  });
  useEffect(() => { loadStatus(); }, []);

  const go = async (action: "checkout" | "portal" | "upgrade") => {
    if (action === "checkout" && stripePromise) { setCheckoutOpen(true); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("billing", { body: { action, origin: window.location.origin, plan: pick, interval: yearly && pick !== "beta" ? "year" : "month" } });
    setBusy(false);
    if (action === "upgrade") {
      if (error || !data?.ok) return toast.error(data?.error || "Upgrade didn't go through. Try again shortly.");
      toast.success("You're on Pro now");
      return loadStatus();
    }
    if (error || !data?.url) return toast.error(data?.error || "Billing is unavailable right now.");
    window.location.href = data.url;
  };

  useEffect(() => {
    if (!companyId) return;
    supabase.from("credit_transactions")
      .select("id, kind, credits, candidate_name, note, created_at")
      .eq("company_id", companyId).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data as Tx[]) ?? []));
  }, [companyId, balance]);

  const priceText = (p: string | null | undefined, year: boolean) =>
    p === "beta" ? "$115 a month" : p === "pro" ? (year ? "$2,336 a year" : "$229 a month") : (year ? "$1,316 a year" : "$129 a month");

  return (
    <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Available credits</p>
              <p className="mt-1 flex items-center gap-2 text-3xl font-semibold">
                 <Zap className="h-6 w-6 text-primary" />{unlimited ? "Unlimited" : balance ?? "-"}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
               {unlimited ? <p>Contact lookups included · no expiry</p> : <>
                 <p>{planName} plan · {(plan?.monthly_credits ?? (plan?.plan === "pro" ? 500 : 150)).toLocaleString()} credits a month{plan?.plan === "pro" ? ` · ${plan.seats_used ?? 1} ${(plan.seats_used ?? 1) === 1 ? "seat" : "seats"} × 500, one shared pool` : ""}</p>
                 <p>{plan?.plan === "pro" ? "Work email 1 · Personal email 2 · Phone 3" : "Work email 2 · Personal email 3 · Phone 3"}</p>
                 <p>Credits reset each month. Unused credits don't roll over.</p>
               </>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div>
               <p className="text-base font-semibold">{unlimited ? "Unlimited pass · free" : plan?.subscribed
                 ? `${planName} plan · ${priceText(plan.plan, plan.interval === "year")}`
                 : "Choose a plan"}</p>
              <p className="text-sm text-muted-foreground">
                 {unlimited ? "Permanent approved access, no payment needed" : plan === null ? "Checking your plan…"
                  : plan.subscribed
                    ? plan.cancel_at_period_end
                      ? `Ends ${plan.renews_at ? new Date(plan.renews_at).toLocaleDateString() : "soon"}`
                      : `Active · renews ${plan.renews_at ? new Date(plan.renews_at).toLocaleDateString() : ""}`
                    : exempt ? "Approved access, no payment needed"
                    : "Starter: 150 credits a month. Pro: 500 credits a month per seat (up to 5 seats), Agents included."}
              </p>
            </div>
            {plan?.subscribed ? (
              <div className="flex flex-wrap justify-end gap-2">
                {plan.plan !== "pro" && (
                  <Button disabled={busy} onClick={() => go("upgrade")}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upgrade to Pro · $229 a month"}
                  </Button>
                )}
                <Button variant="outline" disabled={busy} onClick={() => go("portal")}>Manage billing</Button>
              </div>
            ) : exempt ? null : (
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-1 rounded-md border border-border p-1 text-sm">
                  {([...(plan?.beta_eligible ? ["beta"] as const : []), "starter", "pro"] as const).map((p) => (
                    <button key={p} type="button" onClick={() => setPick(p)}
                      className={`rounded px-3 py-1 ${pick === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                      {p === "pro" ? "Pro" : p === "beta" ? "Early access" : "Starter"}
                    </button>
                  ))}
                </div>
                {pick !== "beta" && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={yearly} onChange={(e) => setYearly(e.target.checked)} />
                    Pay yearly, save 15%
                  </label>
                )}
                <EmbeddedCheckoutDialog open={checkoutOpen} onOpenChange={setCheckoutOpen} plan={pick} interval={yearly && pick !== "beta" ? "year" : "month"} />
                <Button disabled={busy || plan === null} onClick={() => go("checkout")}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Subscribe · ${priceText(pick, yearly && pick !== "beta")}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Where your credits went</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Date</TableHead><TableHead>What</TableHead><TableHead>Person</TableHead><TableHead className="text-right">Credits</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No credit activity yet.</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{r.note || LABEL[r.kind] || r.kind}</TableCell>
                    <TableCell className="text-sm">{r.candidate_name || "-"}</TableCell>
                    <TableCell className={`text-right text-sm font-medium ${r.credits > 0 ? "text-primary" : ""}`}>
                      {r.credits > 0 ? `+${r.credits}` : r.credits}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
}

export default function Credits() {
  const { search } = useLocation();
  const q = new URLSearchParams(search); q.set("tab", "billing");
  return <Navigate to={`/settings?${q.toString()}`} replace />;
}
