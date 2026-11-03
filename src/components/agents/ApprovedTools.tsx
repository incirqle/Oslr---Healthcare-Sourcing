import { useState } from "react";
import { Copy, Download, FolderOpen, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CONTACT_PRICES, enrichContact, type ContactKind } from "@/hooks/useContactEnrich";
import { ContactKindPicker } from "@/components/ContactKindPicker";
import type { DecisionRow, PoolItem } from "@/hooks/useAgents";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const emailOf = (i: PoolItem) => { const p = i.profile as Record<string, unknown>; return (p.email as string) || (p.work_email as string) || ""; };

/** Tools above the Approved list: copy emails, download (with a metered enrich option), open the project. */
export function ApprovedTools({ agentName, items, decisions, projectId }: { agentName: string; items: PoolItem[]; decisions: DecisionRow[]; projectId: string | null }) {
  const note = new Map(decisions.map((d) => [d.pool_id, d.note ?? ""]));
  const emails = items.map(emailOf).filter(Boolean);
  const [exportOpen, setExportOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const exportCsv = (enriched: Map<string, { email: string | null; phone: string | null }>) => {
    const head = ["Name", "Title", "Employer", "Location", "Email", "Phone", "Your note", "Approved on"];
    const rows = items.map((i) => {
      const p = i.profile as Record<string, unknown>;
      const c = enriched.get(i.id);
      return [p.full_name, p.title, p.current_employer, p.location, c?.email ?? emailOf(i), c?.phone ?? (p.phone as string) ?? "", note.get(i.id), i.decided_at?.slice(0, 10)];
    });
    const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${agentName.replace(/[^\w]+/g, "-").toLowerCase()}-approved.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    if (!emails.length) { toast.message("No emails pulled yet. Use Find contact info on a card, or Enrich & Export."); return; }
    await navigator.clipboard.writeText(emails.join(", "));
    toast.success(`${emails.length} email${emails.length === 1 ? "" : "s"} copied`);
  };

  const eligible = items.filter((i) => (i.profile as Record<string, unknown>).linkedin_url);
  const [kinds, setKinds] = useState<ContactKind[]>(["work_email"]);
  const perPerson = kinds.reduce((s, k) => s + CONTACT_PRICES[k], 0);
  const maxCost = eligible.length * perPerson;

  const enrichAndExport = async () => {
    if (!kinds.length) return;
    setRunning(true); setDone(0);
    const enriched = new Map<string, { email: string | null; phone: string | null }>();
    let spent = 0, found = 0, stopped = false;
    for (const i of eligible) {
      const p = i.profile as Record<string, unknown>;
      try {
        const r = await enrichContact(String(p.linkedin_url), kinds, String(p.full_name ?? ""));
        if (r.error === "insufficient_credits") { stopped = true; break; }
        spent += r.charged ?? 0;
        if (r.found?.length) {
          found++;
          enriched.set(i.id, { email: r.contact.work_email || r.contact.personal_emails?.[0] || null, phone: r.contact.phone_numbers?.[0] || null });
        }
      } catch { /* skip this person */ }
      setDone((d) => d + 1);
    }
    window.dispatchEvent(new Event("oslr:credits"));
    setRunning(false);
    if (stopped) toast.error("Ran out of credits. The rest were exported with what we already had.");
    else toast.success(`Found contact info for ${found} of ${eligible.length} · ${spent} credits used`);
    exportCsv(enriched);
    setExportOpen(false);
  };

  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border agent-sheen-border agent-sheen px-4 py-3">
      <p className="mr-auto text-[13px] text-foreground/80"><span className="font-semibold text-foreground">{items.length}</span> approved, ready for outreach</p>
      <Button size="sm" variant="outline" className="h-8 rounded-full bg-card/80" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy emails</Button>
      <Button size="sm" variant="outline" className="h-8 rounded-full bg-card/80" onClick={() => setExportOpen(true)}><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
      {projectId && <Button asChild size="sm" className="h-8 rounded-full"><Link to={`/projects/${projectId}`}><FolderOpen className="mr-1.5 h-3.5 w-3.5" />Open project</Link></Button>}

      <Dialog open={exportOpen} onOpenChange={(o) => !running && setExportOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Download {items.length} approved {items.length === 1 ? "person" : "people"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-xl border border-mint/40 bg-mint-soft/40 p-3.5">
              <p className="font-medium">Enrich & Export</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Choose what to look up for everyone, then download the filled-in file.
              </p>
              <div className="mt-2.5"><ContactKindPicker value={kinds} onChange={setKinds} disabled={running} /></div>
              <p className="mt-2.5 text-[13px] font-medium">
                {kinds.length ? `${eligible.length} ${eligible.length === 1 ? "person" : "people"} × ${perPerson} credits = up to ${maxCost} credits` : "Choose at least one"}
              </p>
              <p className="text-[12px] text-muted-foreground">Charged only for what we find. People already looked up cost nothing.</p>
              {running && <Progress className="mt-3" value={(done / Math.max(1, eligible.length)) * 100} />}
              {items.length > eligible.length && <p className="mt-1.5 text-xs text-muted-foreground">{items.length - eligible.length} have no profile link and keep their current details.</p>}
            </div>
            <div className="rounded-xl border border-border p-3.5">
              <p className="font-medium">Export Current Data</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">Download right away with the details already on file. Free.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" disabled={running} onClick={() => { exportCsv(new Map()); setExportOpen(false); }}>Export Current Data</Button>
            <Button disabled={running || !eligible.length || !kinds.length} onClick={enrichAndExport} className="bg-mint text-mint-foreground hover:bg-mint/90">
              {running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{done} / {eligible.length}</> : `Enrich & Export${kinds.length ? ` · up to ${maxCost}` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
