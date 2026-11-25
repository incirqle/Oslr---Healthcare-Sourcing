import { useState } from "react";
import { Download, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_PRICES, enrichContact, type ContactKind } from "@/hooks/useContactEnrich";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const OPTIONS: { kind: ContactKind; label: string }[] = [
  { kind: "work_email", label: "Work email" },
  { kind: "personal_email", label: "Personal email" },
  { kind: "phone", label: "Mobile phone" },
];
import type { DecisionRow, PoolItem } from "@/hooks/useAgents";

export type FoundContact = { email: string | null; phone: string | null };

const cell = (v: unknown) => {
  const s = String(v ?? "");
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

/** Approved bar: look up contact info for everyone approved, in one click, then download. */
export function ApprovedTools({ agentName, items, decisions, projectId, contacts, onFound }: {
  agentName: string; items: PoolItem[]; decisions: DecisionRow[]; projectId: string | null;
  contacts: Map<string, FoundContact>; onFound: (personId: string, c: FoundContact) => void;
}) {
  const note = new Map(decisions.map((d) => [d.pool_id, d.note ?? ""]));
  const [kinds, setKinds] = useState<ContactKind[]>(["work_email"]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(false);

  const hasContact = (i: PoolItem) => { const c = contacts.get(i.person_id); return !!(c?.email || c?.phone); };
  const eligible = items.filter((i) => (i.profile as Record<string, unknown>).linkedin_url);
  const todo = eligible.filter((i) => !hasContact(i));
  const perPerson = kinds.reduce((s, k) => s + CONTACT_PRICES[k], 0);
  const maxCost = todo.length * perPerson;

  const run = async () => {
    if (!kinds.length || !todo.length) return;
    setRunning(true); setDone(0);
    let spent = 0, found = 0, stopped = false;
    for (const i of todo) {
      const p = i.profile as Record<string, unknown>;
      try {
        const r = await enrichContact(String(p.linkedin_url), kinds, String(p.full_name ?? ""), {
          company: typeof p.current_employer === "string" ? p.current_employer : null,
          location: typeof p.location === "string" ? p.location : null,
          title: typeof p.title === "string" ? p.title : null,
          companyDomain: typeof p.company_domain === "string" ? p.company_domain : null,
        });
        if (r.error === "insufficient_credits") { stopped = true; break; }
        spent += r.charged ?? 0;
        if (r.found?.length) {
          found++;
          const c = { email: r.contact.work_email || r.contact.personal_emails?.[0] || null, phone: r.contact.phone_numbers?.[0] || null };
          onFound(i.person_id, c);
          const patch: Record<string, string> = {};
          if (c.email) patch.email = c.email;
          if (c.phone) patch.phone = c.phone;
          if (projectId && Object.keys(patch).length) {
            await supabase.from("candidates").update(patch).eq("project_id", projectId).eq("person_id", i.person_id);
          }
        }
      } catch { /* skip this person */ }
      setDone((d) => d + 1);
    }
    window.dispatchEvent(new Event("oslr:credits"));
    setRunning(false);
    setOpen(false);
    if (stopped) toast.error("Ran out of credits. The rest were skipped.");
    else if (found) toast.success(`Found contact info for ${found} of ${todo.length} · ${spent} credits used`);
    else toast("Nothing was found. We're sorry. You aren't charged a credit.");
  };

  const download = () => {
    const head = ["Name", "Title", "Employer", "Location", "Email", "Phone", "Your note", "Approved on"];
    const rows = items.map((i) => {
      const p = i.profile as Record<string, unknown>;
      const c = contacts.get(i.person_id);
      return [p.full_name, p.title, p.current_employer, p.location, c?.email ?? "", c?.phone ?? "", note.get(i.id), i.decided_at?.slice(0, 10)];
    });
    const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${agentName.replace(/[^\w]+/g, "-").toLowerCase()}-approved.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  if (!items.length) return null;
  const withContact = items.filter(hasContact).length;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-sm">
        <p className="mr-auto text-[13px] text-muted-foreground">
          <span className="font-semibold text-foreground">{items.length}</span> approved · {withContact} with contact info
        </p>
        <Button size="sm" variant="ghost" className="h-8 rounded-full active:scale-[0.97]" onClick={download} disabled={running}>
          <Download className="mr-1.5 h-3.5 w-3.5" />Download
        </Button>
        <Button size="sm" className="h-8 rounded-full bg-mint px-3.5 font-semibold text-mint-foreground hover:bg-mint/90 active:scale-[0.97]"
          disabled={running || !todo.length} onClick={() => setOpen(true)}>
          {running ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{done} of {todo.length}</>
            : <><Mail className="mr-1.5 h-3.5 w-3.5" />{todo.length ? "Find contact info" : "Everyone has contact info"}</>}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => !running && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Find contact info for {todo.length} {todo.length === 1 ? "person" : "people"}</DialogTitle>
            <DialogDescription>Charged only for what we find. Results save to your project right away.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            {OPTIONS.map((o) => (
              <label key={o.kind} className="flex cursor-pointer items-center justify-between rounded-xl border border-border px-3.5 py-3 text-[14px] transition-colors hover:bg-secondary/60">
                <span className="flex items-center gap-2.5">
                  <Checkbox checked={kinds.includes(o.kind)} disabled={running}
                    onCheckedChange={(v) => setKinds((k) => (v ? [...k, o.kind] : k.filter((x) => x !== o.kind)))} />
                  {o.label}
                </span>
                <span className="text-[13px] text-muted-foreground">{CONTACT_PRICES[o.kind]} credits each</span>
              </label>
            ))}
            {running && <Progress value={(done / Math.max(1, todo.length)) * 100} className="h-1.5" />}
            <p className="pt-1 text-[13px] font-medium">{kinds.length ? `Up to ${maxCost} credits` : "Choose at least one"}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" disabled={running} onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="rounded-full bg-mint font-semibold text-mint-foreground hover:bg-mint/90" disabled={running || !kinds.length} onClick={run}>
              {running ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{done} of {todo.length}</> : "Find contact info"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
