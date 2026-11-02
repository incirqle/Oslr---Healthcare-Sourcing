import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FolderKanban, Plus, Trash2, Loader2, Search, Bot, Bookmark, Mail, ThumbsUp, ChevronRight } from "lucide-react";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/useProjects";
import { useProjectStats, useWorkspaceMembers, timeAgo } from "@/hooks/useProjectStats";
import { useCompany } from "@/hooks/useCompany";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";

function initials(name?: string | null) {
  return (name ?? "?").split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

const AGENT_LABEL: Record<string, string> = {
  sourcing: "Sourcing", calibrating: "Learning", paused: "Paused", completed: "Done", closed: "Closed",
};

export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: stats = {} } = useProjectStats();
  const { data: members = [] } = useWorkspaceMembers();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const { isLoading: companyLoading } = useCompany();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filter, setFilter] = useState("");
  const [agentsOnly, setAgentsOnly] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return projects
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q))
      .filter((p) => !agentsOnly || stats[p.id]?.agentStatus)
      .map((p) => {
        const s = stats[p.id];
        const last = Math.max(new Date(p.updated_at).getTime(), s?.lastSearchAt ?? 0);
        return { p, s, last };
      })
      .sort((a, b) => b.last - a.last);
  }, [projects, stats, filter, agentsOnly]);

  const totals = useMemo(() => {
    let candidates = 0, searches = 0, liveAgents = 0;
    for (const s of Object.values(stats)) {
      candidates += s.total; searches += s.searches;
      if (s.agentStatus === "sourcing" || s.agentStatus === "calibrating") liveAgents++;
    }
    return { candidates, searches, liveAgents };
  }, [stats]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const id = await createProject.mutateAsync({ name: name.trim(), description: description.trim() });
      toast.success("Project created");
      setName(""); setDescription(""); setOpen(false);
      navigate(`/projects/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject.mutateAsync(deleteTarget.id);
      toast.success("Project deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
    } finally {
      setDeleteTarget(null);
    }
  };

  const Metric = ({ label, value }: { label: string; value: number }) => (
    <div className="rounded-2xl border border-border/60 bg-card/70 px-5 py-4 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-display text-[1.75rem] font-bold leading-none tracking-[-0.02em] tabular-nums text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[2rem] font-bold leading-tight tracking-[-0.02em] text-foreground">Projects</h1>
            <p className="mt-1 text-sm text-muted-foreground">Every search, shortlist and agent, organized by the role you are hiring for.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/search")} className="active:scale-[0.97] transition-transform duration-100">
              <Search className="mr-2 h-4 w-4" /> New search
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-mint text-mint-foreground hover:bg-mint-ink active:scale-[0.97] transition-[transform,background-color] duration-100">
                  <Plus className="mr-2 h-4 w-4" /> New project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-display">Create project</DialogTitle>
                  <DialogDescription>One project per role you are hiring for.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Project name</Label>
                    <Input placeholder="e.g. ICU Nurses, Q1 hiring" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description (optional)</Label>
                    <Textarea placeholder="What this role needs" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={!name.trim() || createProject.isPending || companyLoading}>
                    {companyLoading ? "Loading..." : createProject.isPending ? "Creating..." : "Create project"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Projects" value={projects.length} />
          <Metric label="Candidates saved" value={totals.candidates} />
          <Metric label="Searches run" value={totals.searches} />
          <Metric label="Agents working" value={totals.liveAgents} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a project" className="h-10 rounded-xl pl-9" />
          </div>
          <button
            onClick={() => setAgentsOnly((v) => !v)}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-xl border px-3.5 text-sm transition-colors duration-150",
              agentsOnly ? "border-mint/50 bg-mint/10 font-medium text-mint-ink" : "border-border/70 text-muted-foreground hover:text-foreground",
            )}
          >
            <Bot className="h-4 w-4" /> With agents
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-mint" /></div>
        ) : rows.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 text-muted-foreground">
            <FolderKanban className="mb-3 h-7 w-7 opacity-40" />
            <p className="text-sm font-medium text-foreground">{projects.length ? "No matching projects" : "No projects yet"}</p>
            <p className="mt-1 text-xs">Run a search and it becomes your first project.</p>
            <Button size="sm" className="mt-4 bg-mint text-mint-foreground hover:bg-mint-ink" onClick={() => navigate("/search")}>Start a search</Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm">
            <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_repeat(3,72px)_96px_40px] items-center gap-3 border-b border-border/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid">
              <span>Project</span><span>Agent</span>
              <span className="text-center">Saved</span><span className="text-center">Contacted</span><span className="text-center">Interested</span>
              <span>Owner</span><span />
            </div>
            {rows.map(({ p, s, last }) => {
              const owner = p.created_by ? memberById.get(p.created_by) : undefined;
              const live = s?.agentStatus === "sourcing" || s?.agentStatus === "calibrating";
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/projects/${p.id}`)}
                  className="group grid cursor-pointer grid-cols-1 gap-2 border-b border-border/40 px-5 py-4 transition-colors duration-150 last:border-b-0 hover:bg-mint/[0.04] active:bg-mint/[0.07] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_repeat(3,72px)_96px_40px] md:items-center md:gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint/10 text-mint-ink">
                      <FolderKanban className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-foreground">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s?.searches ? `${s.searches} search${s.searches === 1 ? "" : "es"} · ` : ""}Active {timeAgo(last)}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm">
                    {s?.agentStatus ? (
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", live ? "bg-mint/12 text-mint-ink" : "bg-muted text-muted-foreground")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-mint" : "bg-muted-foreground/50")} />
                        {AGENT_LABEL[s.agentStatus] ?? s.agentStatus}
                      </span>
                    ) : <span className="text-muted-foreground/50">None</span>}
                  </div>
                  {[
                    { v: s?.total ?? 0, I: Bookmark },
                    { v: s?.contacted ?? 0, I: Mail },
                    { v: s?.interested ?? 0, I: ThumbsUp },
                  ].map(({ v, I }, i) => (
                    <span key={i} className="hidden items-center justify-center gap-1 text-sm tabular-nums text-foreground md:flex">
                      <I className="h-3.5 w-3.5 text-muted-foreground" /> {v}
                    </span>
                  ))}
                  <span className="hidden items-center gap-2 md:flex" title={owner?.full_name ?? owner?.email ?? ""}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint/15 text-[11px] font-semibold text-mint-ink">
                      {initials(owner?.full_name ?? owner?.email)}
                    </span>
                  </span>
                  <div className="hidden items-center justify-end md:flex">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: p.id, name: p.name }); }}
                      aria-label="Delete project"
                      className="rounded-md p-1.5 text-muted-foreground/50 opacity-0 transition-opacity duration-150 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:hidden" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete project?"
        description={`This will permanently delete "${deleteTarget?.name}" and all its candidates. This action cannot be undone.`}
        confirmLabel="Delete project"
        onConfirm={handleDeleteConfirm}
      />
    </AppLayout>
  );
}
