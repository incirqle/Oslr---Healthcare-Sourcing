import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_PRICES, enrichContact, type ContactKind } from "@/hooks/useContactEnrich";

interface Person { id: string; full_name: string; linkedin_url: string | null }

const OPTIONS: { kind: ContactKind; label: string }[] = [
  { kind: "work_email", label: "Work email" },
  { kind: "personal_email", label: "Personal email" },
  { kind: "phone", label: "Phone number" },
];

export function BulkEnrichDialog({ open, onOpenChange, people, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; people: Person[]; onDone: () => void;
}) {
  const [kinds, setKinds] = useState<ContactKind[]>(["work_email"]);
  const [done, setDone] = useState(0);
  const [running, setRunning] = useState(false);
  const eligible = people.filter((p) => p.linkedin_url);
  const maxCost = eligible.length * kinds.reduce((s, k) => s + CONTACT_PRICES[k], 0);

  const run = async () => {
    setRunning(true); setDone(0);
    let spent = 0, found = 0, stopped = false;
    for (const p of eligible) {
      try {
        const r = await enrichContact(p.linkedin_url!, kinds, p.full_name);
        if (r.error === "insufficient_credits") { stopped = true; break; }
        spent += r.charged ?? 0;
        if (r.found?.length) found++;
        const email = r.contact?.work_email || r.contact?.personal_emails?.[0];
        const phone = r.contact?.phone_numbers?.[0];
        const patch: Record<string, string> = {};
        if (email) patch.email = email;
        if (phone) patch.phone = phone;
        if (Object.keys(patch).length) await supabase.from("candidates").update(patch).eq("id", p.id);
      } catch { /* skip this person */ }
      setDone((d) => d + 1);
    }
    window.dispatchEvent(new Event("oslr:credits"));
    setRunning(false);
    if (stopped) toast.error("Ran out of credits. The rest were skipped.");
    toast.success(`Found contact info for ${found} of ${eligible.length} · ${spent} credits used`);
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Find contact info for {eligible.length} people</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          {OPTIONS.map((o) => (
            <label key={o.kind} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={kinds.includes(o.kind)}
                  disabled={running}
                  onCheckedChange={(v) => setKinds((k) => (v ? [...k, o.kind] : k.filter((x) => x !== o.kind)))}
                />
                {o.label}
              </span>
              <span className="text-muted-foreground">{CONTACT_PRICES[o.kind]} credits each</span>
            </label>
          ))}
          {people.length > eligible.length && (
            <p className="text-xs text-muted-foreground">{people.length - eligible.length} people have no profile link and will be skipped.</p>
          )}
          {running && <Progress value={(done / Math.max(1, eligible.length)) * 100} />}
          <p className="text-xs text-muted-foreground">
            Up to {maxCost} credits. You're only charged for what we find, and people already looked up cost nothing.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={running} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={running || !kinds.length || !eligible.length} onClick={run}>
            {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{done} / {eligible.length}</> : "Find contact info"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
