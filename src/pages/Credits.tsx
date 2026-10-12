import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
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

export default function Credits() {
  const { companyId } = useCompany();
  const balance = useCreditBalance(companyId);
  const [rows, setRows] = useState<Tx[]>([]);

  useEffect(() => {
    if (!companyId) return;
    supabase.from("credit_transactions")
      .select("id, kind, credits, candidate_name, note, created_at")
      .eq("company_id", companyId).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setRows((data as Tx[]) ?? []));
  }, [companyId, balance]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <h1 className="font-display text-2xl font-semibold">Credits</h1>
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
    </AppLayout>
  );
}
