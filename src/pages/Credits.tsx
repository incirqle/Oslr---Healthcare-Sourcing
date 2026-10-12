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

const LABEL: Record<string, string> = {
  work_email: "Work email found",
  personal_email: "Personal email found",
  phone: "Phone number found",
  grant: "Credits added",
};

interface Tx { id: string; kind: string; credits: number; candidate_name: string | null; note: string | null; created_at: string }

export function CreditsPanel() {
  const { companyId } = useCompany();
  const balance = useCreditBalance(companyId);
  const [rows, setRows] = useState<Tx[]>([]);
  const [plan, setPlan] = useState<{ subscribed: boolean; renews_at: string | null; cancel_at_period_end: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.functions.invoke("billing", { body: { action: "status" } }).then(({ data }) => {
      if (data && !data.error) {
        setPlan(data);
        if (data.granted > 0) {
          toast.success(`${data.granted} credits added to your workspace`);
          window.dispatchEvent(new Event("oslr:credits"));
        }
      }
    });
  }, []);

  const go = async (action: "checkout" | "portal") => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("billing", { body: { action, origin: window.location.origin } });
    setBusy(false);
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

  return (
    <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-muted-foreground">Available credits</p>
              <p className="mt-1 flex items-center gap-2 text-3xl font-semibold">
                <Zap className="h-6 w-6 text-primary" />{balance ?? "—"}
              </p>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Starter plan · 150 credits a month</p>
              <p>Work email 2 · Personal email 3 · Phone 5</p>
              <p>Only charged when something is found</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-base font-semibold">Starter plan · $115 a month</p>
              <p className="text-sm text-muted-foreground">
                {plan === null ? "Checking your plan…"
                  : plan.subscribed
                    ? plan.cancel_at_period_end
                      ? `Ends ${plan.renews_at ? new Date(plan.renews_at).toLocaleDateString() : "soon"}`
                      : `Active · renews ${plan.renews_at ? new Date(plan.renews_at).toLocaleDateString() : ""}`
                    : "150 contact credits every month"}
              </p>
            </div>
            {plan?.subscribed ? (
              <Button variant="outline" disabled={busy} onClick={() => go("portal")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage billing"}
              </Button>
            ) : (
              <Button disabled={busy || plan === null} onClick={() => go("checkout")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Subscribe"}
              </Button>
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
                    <TableCell className="text-sm">{r.candidate_name || "—"}</TableCell>
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
