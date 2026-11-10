import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUp, CheckCircle2, ChevronDown, CircleDashed, Loader2, MessageSquare, MoreHorizontal, Target } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AgentProfileDialog } from "@/components/agents/AgentProfileDialog";
import { AgentReviewCard } from "@/components/agents/AgentReviewCard";
import { AgentRail } from "@/components/agents/AgentRail";
import { AgentStatusDot, STATUS_LABEL } from "@/components/agents/AgentStatusDot";
import { AgentCountdown } from "@/components/agents/AgentCountdown";
import { ApprovedTools } from "@/components/agents/ApprovedTools";
import { AgentsLocked } from "@/components/agents/AgentsLocked";
import { fmtWhen, useAgentsEnabled, useDecide, useRoster, useRunAgentNow, useSteer, useUpdateAgent, type PoolItem } from "@/hooks/useAgents";
import { AgentConnections } from "@/components/agents/AgentConnections";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useProject } from "@/hooks/useProjects";
import { projectPath } from "@/lib/project-navigation";

type Tab = "review" | "approved" | "passed";

function toCandidate(item: PoolItem) {
  const p = item.profile as Record<string, unknown>;
  return {
    id: item.person_id,
    full_name: String(p.full_name ?? ""),
    title: (p.title as string) ?? null,
    current_employer: (p.current_employer as string) ?? null,
    location: (p.location as string) ?? null,
    linkedin_url: (p.linkedin_url as string) ?? null,
    email: null,
    phone: null,
    skills: (p.skills as string[]) ?? [],
    avg_tenure_months: (p.avg_tenure_months as number) ?? null,
    profile_pic_url: (p.profile_pic_url as string) ?? null,
    years_experience: p.years_experience as number | undefined,
    summary: (p.summary as string) ?? null,
    raw: (p.raw as Record<string, unknown>) ?? p,
  };
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: enabled, isLoading: el } = useAgentsEnabled();
  const { data: roster, isLoading, error } = useRoster(enabled ? id : undefined);
  const { data: project } = useProject(roster?.agent.project_id ?? "");
  const decide = useDecide(id ?? "");
  const steer = useSteer(id ?? "");
  const update = useUpdateAgent(id ?? "");
  const runNow = useRunAgentNow(id ?? "");
  const [tab, setTab] = useState<Tab>("review");
  const [drafts, setDrafts] = useState<Record<string, "approved" | "passed" | null>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);

  const decById = useMemo(() => new Map((roster?.decisions ?? []).map((d) => [d.pool_id, d])), [roster]);
  const lists = useMemo(() => {
    const pool = roster?.pool ?? [];
    return {
      review: pool.filter((p) => !p.decision && p.served_at && !p.pruned),
      approved: pool.filter((p) => p.decision === "approved").sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "")),
      passed: pool.filter((p) => p.decision === "passed").sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? "")),
    };
  }, [roster]);
  const visible = lists[tab];
  const chat = (roster?.events ?? []).filter((e) => e.event_type === "chat");

  useEffect(() => { threadEnd.current?.scrollIntoView({ block: "nearest" }); }, [chat.length]);

  // Keyboard: A approve, P pass on the first waiting person, Escape cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [contenteditable]") || openId) return;
      const first = lists.review[0];
      if (tab !== "review" || !first) return;
      if (e.key === "a" || e.key === "A") setDrafts((d) => ({ ...d, [first.id]: "approved" }));
      if (e.key === "p" || e.key === "P") setDrafts((d) => ({ ...d, [first.id]: "passed" }));
      if (e.key === "Escape") setDrafts((d) => ({ ...d, [first.id]: null }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lists.review, tab, openId]);

  if (el || (enabled && isLoading)) {
    return <AppLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></AppLayout>;
  }
  if (!enabled) return <AppLayout><AgentsLocked /></AppLayout>;
  if (error || !roster) {
    return <AppLayout><div className="py-24 text-center text-muted-foreground">{error instanceof Error ? error.message : "Agent not found."} <Link to="/agents" className="text-primary underline">Back to agents</Link></div></AppLayout>;
  }

  const { agent } = roster;
  const saved = lists.approved.length;
  const pct = agent.goal ? Math.min(100, Math.round((saved / agent.goal) * 100)) : 0;
  const openItem = openId ? roster.pool.find((p) => p.id === openId) ?? null : null;
  const openIdx = openItem ? visible.findIndex((p) => p.id === openItem.id) : -1;

  const sendSteer = async () => {
    const m = msg.trim();
    if (!m || steer.isPending) return;
    try { await steer.mutateAsync(m); setMsg(""); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send"); }
  };

  return (
    <AppLayout>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Header */}
          <div className="agent-glow rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label={agent.project_id ? "Back to project agents" : "Back to all agents"} onClick={() => navigate(agent.project_id ? projectPath(agent.project_id, "agents") : "/agents")}><ArrowLeft className="h-4 w-4" /></Button>
              <AgentStatusDot status={agent.status} waiting={lists.review.length} />
              <h1 className="min-w-0 flex-1 truncate font-display text-xl font-semibold tracking-tight">{agent.name}</h1>
              <span className="hidden rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted-foreground sm:inline">{STATUS_LABEL[agent.status]}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Agent options"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {agent.status === "paused"
                    ? <DropdownMenuItem onClick={() => update.mutate({ status: "resume" })}>Resume agent</DropdownMenuItem>
                    : (agent.status === "sourcing" || agent.status === "calibrating") && <DropdownMenuItem onClick={() => update.mutate({ status: "paused" })}>Pause agent</DropdownMenuItem>}
                  {agent.status === "sourcing" && (
                    <DropdownMenuItem disabled={runNow.isPending} onClick={async () => {
                      try {
                        const r = await runNow.mutateAsync();
                        toast.success(r.served > 0 ? `${r.served} new people ready to review.` : "No new people right now. The agent will keep looking.");
                      } catch (e) { toast.error(e instanceof Error ? e.message : "Could not run the agent"); }
                    }}>Find more people now</DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => update.mutate({ email_updates: !agent.email_updates })}>
                    {agent.email_updates ? "Turn off email updates" : "Turn on email updates"}
                  </DropdownMenuItem>
                  {agent.project_id && <DropdownMenuItem onClick={() => navigate(`/projects/${agent.project_id}`)}>Open project</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={async () => { await update.mutateAsync({ status: "closed" }); navigate(agent.project_id ? projectPath(agent.project_id, "agents") : "/agents"); }}>Close agent</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-2 text-[13px]">
              <div>
                <p className="font-medium">Job progress</p>
                <p className="text-muted-foreground">
                  {saved}{agent.goal ? ` of ${agent.goal}` : ""} people saved{agent.finish_date ? `, finishes ${new Date(agent.finish_date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                </p>
              </div>
              <p className="text-right text-muted-foreground">
                Next search: {agent.status === "sourcing" ? fmtWhen(agent.next_run_at) : agent.status === "calibrating" ? "after your first review" : "on hold"}
                <br />Email updates {agent.email_updates ? "on" : "off"}
              </p>
            </div>
            {agent.goal ? <Progress value={pct} className="mt-2 h-1.5" /> : null}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {agent.status === "sourcing" && <AgentCountdown at={agent.next_run_at} />}
            </div>
          </div>

          {agent.project_id && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Approved clinicians save to <Link className="font-semibold text-primary hover:underline" to={projectPath(agent.project_id)}>{project?.name ?? "this project"}</Link></p>
              <AgentConnections projectId={agent.project_id} />
            </div>
          )}


          {agent.pause_reason && agent.status === "paused" && (
            <div className="rounded-xl border border-border bg-secondary/60 px-4 py-3 text-[14px]">
              {agent.pause_reason}. <button className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => update.mutate({ status: "resume" })}>Resume</button>
            </div>
          )}

          {/* Conversation: collapsible, input inside the card so nothing floats over the list */}
          <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
            <button onClick={() => setChatOpen((v) => !v)} aria-expanded={chatOpen}
              className="flex w-full items-center gap-2 px-5 py-3.5 text-left">
              <MessageSquare className="h-4 w-4 text-mint" />
              <span className="text-[14px] font-medium">Talk to your agent</span>
              <span className="text-[12px] text-muted-foreground">{chat.length ? `${chat.length} messages` : "Change volume, pause, or steer it"}</span>
              <ChevronDown className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform duration-200", chatOpen && "rotate-180")} />
            </button>
            {chatOpen && (
              <div className="border-t border-border/60 px-4 pb-4 pt-3">
                <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {chat.length === 0 && <p className="py-3 text-center text-[13px] text-muted-foreground">Try "send five per day" or "favor private practice".</p>}
                  {chat.map((e, i) => {
                    const mine = e.payload.role === "user";
                    return (
                      <div key={i} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed",
                          mine ? "bg-mint-soft text-mint-ink" : "bg-secondary text-foreground")}>
                          {String(e.payload.text ?? "")}
                        </div>
                      </div>
                    );
                  })}
                  {steer.isPending && <div className="flex"><div className="rounded-2xl bg-secondary px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div></div>}
                  <div ref={threadEnd} />
                </div>
                <div className="mt-3 flex items-end gap-2 rounded-xl border border-border bg-background/60 p-1.5 focus-within:border-mint/50">
                  <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={1} maxLength={600}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendSteer(); } }}
                    placeholder="e.g. Send five per day, pause, or favor private practice"
                    className="min-h-[40px] resize-none border-0 bg-transparent text-[14px] shadow-none focus-visible:ring-0" />
                  <Button size="icon" className="h-9 w-9 shrink-0 rounded-full bg-mint text-mint-foreground hover:bg-mint/90" aria-label="Send" disabled={!msg.trim() || steer.isPending} onClick={sendSteer}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Milestones */}
          <div className="space-y-4 rounded-2xl border border-border/70 bg-card/70 p-5">
            <div className="flex gap-3">
              {agent.status === "calibrating" ? <CircleDashed className="mt-0.5 h-5 w-5 text-primary" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />}
              <div>
                <p className="font-medium">{agent.status === "calibrating" ? "Review your first matches" : "First matches reviewed"}</p>
                <p className="text-[13px] text-muted-foreground">
                  {agent.status === "calibrating"
                    ? `${lists.review.length} waiting. Your agent learns from every reason and note.`
                    : `${saved} approved, ${lists.passed.length} passed. Your agent learned from every reason and note.`}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <CircleDashed className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Next batch</p>
                <p className="text-[13px] text-muted-foreground">
                  {agent.status === "sourcing" ? `${fmtWhen(agent.next_run_at)}, up to ${agent.per_day} new people, ranked by what you liked.` : "Starts once your first matches are reviewed."}
                </p>
              </div>
            </div>
            {agent.goal ? (
              <div className="flex gap-3">
                <Target className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Goal</p>
                  <p className="text-[13px] text-muted-foreground">{saved} of {agent.goal} people saved. The agent stops when you reach it.</p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Review tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {([["review", "To review"], ["approved", "Approved"], ["passed", "Passed"]] as [Tab, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)}
                className={cn("rounded-full px-3.5 py-1.5 text-[14px] transition-colors active:scale-[0.97]",
                  tab === k ? "bg-mint text-mint-foreground shadow-sm" : "text-muted-foreground hover:bg-secondary")}>
                {label} ({lists[k].length})
              </button>
            ))}
            {tab === "review" && lists.review.length > 0 && <span className="ml-auto hidden text-[12px] text-muted-foreground md:inline">Press A to approve, P to pass</span>}
          </div>

          {tab === "approved" && <ApprovedTools agentName={agent.name} items={lists.approved} decisions={roster.decisions} projectId={agent.project_id} />}
          <div className="space-y-3">
            {visible.length === 0 ? (
              <p className="py-10 text-center text-[15px] text-muted-foreground">
                {tab === "review" ? "You're all caught up. New people arrive with the next batch." : tab === "approved" ? "No one saved yet." : "No one passed yet."}
              </p>
            ) : visible.map((item, i) => (
              <AgentReviewCard
                key={item.id}
                item={item}
                decision={decById.get(item.id)}
                tags={roster.tags}
                active={tab === "review" && i === 0}
                draft={drafts[item.id] ?? null}
                onDraft={(d) => setDrafts((x) => ({ ...x, [item.id]: d }))}
                onFound={async ({ email, phone }) => {
                  if (!agent.project_id) return;
                  const patch: Record<string, string> = {};
                  if (email) patch.email = email;
                  if (phone) patch.phone = phone;
                  if (Object.keys(patch).length) await supabase.from("candidates").update(patch).eq("project_id", agent.project_id).eq("person_id", item.person_id);
                }}
                onOpen={() => setOpenId(item.id)}
                onSubmit={async (b) => {
                  try {
                    await decide.mutateAsync({ pool_id: item.id, ...b });
                    toast.success(b.decision === "approved" ? `Saved to ${project?.name ?? "your project"}` : "Passed. Your agent will adjust.");
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
                }}
              />
            ))}
          </div>

        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <AgentRail roster={roster} onUnskip={(c) => update.mutate({ unskip_city: c })} />
          </div>
        </aside>
      </div>

      <AgentProfileDialog
        item={openItem}
        candidate={openItem ? toCandidate(openItem) : null}
        decision={openItem ? decById.get(openItem.id) : undefined}
        tags={roster.tags}
        hasPrev={openIdx > 0}
        hasNext={openIdx >= 0 && openIdx < visible.length - 1}
        onPrev={() => openIdx > 0 && setOpenId(visible[openIdx - 1].id)}
        onNext={() => openIdx < visible.length - 1 && setOpenId(visible[openIdx + 1].id)}
        onClose={() => setOpenId(null)}
        onSubmit={async (b) => {
          if (!openItem) return;
          const nextId = visible[openIdx + 1]?.id ?? null;
          try {
            await decide.mutateAsync({ pool_id: openItem.id, ...b });
            toast.success(b.decision === "approved" ? `Saved to ${project?.name ?? "your project"}` : "Passed. Your agent will adjust.");
            setOpenId(nextId);
          } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
        }}
      />
    </AppLayout>
  );
}
