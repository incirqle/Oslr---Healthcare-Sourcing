import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ConnectorKey = "greenhouse" | "lever" | "gmail" | "outlook";
const CONNECTORS: { key: ConnectorKey; label: string; blurb: string }[] = [
  { key: "greenhouse", label: "Greenhouse", blurb: "Sync candidates and jobs from your ATS." },
  { key: "lever", label: "Lever", blurb: "Push sourced candidates into Lever pipelines." },
  { key: "gmail", label: "Gmail", blurb: "Send and track outreach from your Gmail account." },
  { key: "outlook", label: "Outlook", blurb: "Send and track outreach from Outlook / Microsoft 365." },
];

export function Step4Connectors({ onComplete }: { onComplete: () => void }) {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const { completeStep } = useOnboarding();
  const qc = useQueryClient();
  const [pending, setPending] = useState<ConnectorKey | null>(null);

  const { data: registered = [] } = useQuery({
    queryKey: ["connector_interest", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("connector_interest")
        .select("connector")
        .eq("company_id", companyId!);
      return (data ?? []).map((d) => d.connector as ConnectorKey);
    },
  });

  const registerInterest = async (key: ConnectorKey) => {
    if (!companyId || !user) return;
    const { error } = await supabase
      .from("connector_interest")
      .insert({ company_id: companyId, user_id: user.id, connector: key });
    if (error && !error.message.includes("duplicate")) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["connector_interest", companyId] });
    toast.success(`We'll let you know when ${CONNECTORS.find((c) => c.key === key)?.label} is ready.`);
    await completeStep.mutateAsync("connectors");
    setPending(null);
    onComplete();
  };

  const handleSkip = async () => {
    await completeStep.mutateAsync("connectors");
    onComplete();
  };

  return (
    <div className="space-y-4 pl-10">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CONNECTORS.map((c) => {
          const isRegistered = registered.includes(c.key);
          return (
            <div
              key={c.key}
              className="rounded-lg border border-border bg-card p-3 flex flex-col items-start gap-2"
            >
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <Button
                size="sm"
                variant={isRegistered ? "secondary" : "outline"}
                className="w-full"
                onClick={() => setPending(c.key)}
                disabled={isRegistered}
              >
                {isRegistered ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" /> On waitlist
                  </>
                ) : (
                  "Connect"
                )}
              </Button>
            </div>
          );
        })}
      </div>
      <Button variant="ghost" onClick={handleSkip}>
        Skip for now
      </Button>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending ? CONNECTORS.find((c) => c.key === pending)?.label : ""} — coming soon
            </DialogTitle>
            <DialogDescription>
              {pending ? CONNECTORS.find((c) => c.key === pending)?.blurb : ""} Join the waitlist
              and we'll email you the moment it's available.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button onClick={() => pending && registerInterest(pending)}>
              Join waitlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
