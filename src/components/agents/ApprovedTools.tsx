import { Copy, Download, FolderOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DecisionRow, PoolItem } from "@/hooks/useAgents";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Tools above the Approved list: copy emails, download, open the project. */
export function ApprovedTools({ agentName, items, decisions, projectId }: { agentName: string; items: PoolItem[]; decisions: DecisionRow[]; projectId: string | null }) {
  const note = new Map(decisions.map((d) => [d.pool_id, d.note ?? ""]));
  const emailOf = (i: PoolItem) => { const p = i.profile as Record<string, unknown>; return (p.email as string) || (p.work_email as string) || ""; };
  const emails = items.map(emailOf).filter(Boolean);

  const copy = async () => {
    if (!emails.length) { toast.message("No emails pulled yet. Open the project to pull contact details."); return; }
    await navigator.clipboard.writeText(emails.join(", "));
    toast.success(`${emails.length} email${emails.length === 1 ? "" : "s"} copied`);
  };
  const download = () => {
    const head = ["Name", "Title", "Employer", "Location", "Email", "Your note", "Approved on"];
    const rows = items.map((i) => { const p = i.profile as Record<string, unknown>; return [p.full_name, p.title, p.current_employer, p.location, emailOf(i), note.get(i.id), i.decided_at?.slice(0, 10)]; });
    const csv = [head, ...rows].map((r) => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${agentName.replace(/[^\w]+/g, "-").toLowerCase()}-approved.csv`;
    a.click(); URL.revokeObjectURL(a.href);
  };
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border agent-sheen-border agent-sheen px-4 py-3">
      <p className="mr-auto text-[13px] text-foreground/80"><span className="font-semibold text-foreground">{items.length}</span> approved, ready for outreach</p>
      <Button size="sm" variant="outline" className="h-8 rounded-full bg-card/80" onClick={copy}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy emails</Button>
      <Button size="sm" variant="outline" className="h-8 rounded-full bg-card/80" onClick={download}><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
      {projectId && <Button asChild size="sm" className="h-8 rounded-full"><Link to={`/projects/${projectId}`}><FolderOpen className="mr-1.5 h-3.5 w-3.5" />Pull contacts</Link></Button>}
    </div>
  );
}
