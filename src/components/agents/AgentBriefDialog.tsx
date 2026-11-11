import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Minus, Plus, Target, ArrowUpRight } from "lucide-react";
import { SlackLogo, SheetsLogo, ExcelLogo } from "./AgentConnections";
import { call as exportsCall, waitForPopup } from "@/components/LiveSyncDialog";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProjects } from "@/hooks/useProjects";
import { useAgentMetering, useCreateAgent, useBriefInterpretation, call as callAgent } from "@/hooks/useAgents";

type Dest = "slack" | "sheets" | "excel";
import { useCompany } from "@/hooks/useCompany";
import { useCreditBalance } from "@/hooks/useContactEnrich";
import { toast } from "sonner";

export function AgentBriefDialog({
  open, onOpenChange, defaultProjectId,
}: { open: boolean; onOpenChange: (o: boolean) => void; defaultProjectId?: string }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const create = useCreateAgent();
  const { companyId } = useCompany();
  const balance = useCreditBalance(companyId);
  const { data: metering } = useAgentMetering(open);
  const MAX_PER_DAY = metering?.daily_max ?? 10;
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [perDay, setPerDay] = useState(10);
  const [goal, setGoal] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "new");
  const [settledBrief, setSettledBrief] = useState("");
  const [dests, setDests] = useState<Dest[]>([]);
  const [webhook, setWebhook] = useState("");
  const [busyDest, setBusyDest] = useState<Dest | null>(null);
  const passEnd = metering?.pass_ends_at ? metering.pass_ends_at.slice(0, 10) : null;
  const maxFinish = passEnd ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const maxGoal = passEnd ? 15 : 1000;
  const lockedProject = defaultProjectId ? projects.find((p) => p.id === defaultProjectId) : undefined;
  useEffect(() => {
    if (open) setProjectId(defaultProjectId ?? "new");
  }, [open, defaultProjectId]);
  useEffect(() => {
    if (!open || !metering) return;
    setGoal(passEnd ? "15" : "30");

  }, [open, !!metering, passEnd]);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettledBrief(brief.trim()), 900);
    return () => window.clearTimeout(timer);
  }, [brief]);
  const interpretation = useBriefInterpretation(settledBrief, open && settledBrief === brief.trim());
  const parsed = settledBrief === brief.trim() ? interpretation.data?.parsed : undefined;
  const text = (v: unknown) => typeof v === "string" ? v.replace(/_/g, " ") : "";
  const list = (v: unknown) => Array.isArray(v) ? v.filter((s): s is string => typeof s === "string").join(", ") : "";
  const loc = parsed?.location && typeof parsed.location === "object" ? parsed.location as Record<string, unknown> : {};
  const interpreted = parsed ? [
    ["Role", text(parsed.role_class) || list(parsed.job_titles)],
    ["Specialty", list(parsed.specialties) || text(parsed.specialty)],
    ["Area", [text(loc.city), text(loc.state), text(loc.metro), text(loc.region_key), ...(Array.isArray(parsed.locations) ? parsed.locations.map(l => typeof l === "object" && l ? Object.values(l).filter(v => typeof v === "string").join(", ") : "") : [])].filter(Boolean).join(" · ")],
    ["Setting", text(parsed.employment_model) || text(parsed.care_setting)],
    ["Education", list(parsed.credentials)],
    ["Other requirements", list(parsed.required_keywords)],
  ].filter(([, v]) => v) : [];

  const atLimit = !!metering && metering.limit !== null && metering.active >= metering.limit;
  const ready = Number(goal) >= 1 && name.trim().length > 0 && brief.trim().length >= 8 && !create.isPending && !!metering && !atLimit && (balance ?? 0) >= metering.build_credits;

  const toggleDest = async (k: Dest | "none") => {
    if (k === "none") { setDests([]); return; }
    if (dests.includes(k)) { setDests((d) => d.filter((x) => x !== k)); return; }
    if (k === "sheets") {
      setBusyDest("sheets");
      try {
        const g = await exportsCall<{ connected: boolean; reconnectRequired: boolean }>({ action: "google_status" });
        if (!g.connected || g.reconnectRequired) {
          const popup = window.open("", "oslr-google", "width=560,height=720");
          if (!popup) { toast.error("Your browser blocked the Google window. Allow pop-ups and try again."); return; }
          try {
            const { authorizationUrl } = await exportsCall<{ authorizationUrl: string }>({ action: "google_start", origin: window.location.origin });
            const done = waitForPopup(popup);
            popup.location.href = authorizationUrl;
            await done;
          } catch (e) { popup.close(); throw e; }
        }
      } catch (e) { toast.error(e instanceof Error ? e.message : "Could not connect Google"); return; }
      finally { setBusyDest(null); }
    }
    setDests((d) => [...d, k]);
  };

  const connectDestinations = async (agentId: string) => {
    if (dests.length === 0) return;
    const r = await callAgent<{ agent: { project_id: string | null } }>({ action: "roster", agent_id: agentId });
    const pid = r.agent.project_id;
    if (!pid) return;
    const fails: string[] = [];
    if (dests.includes("sheets")) await exportsCall({ action: "create_sheet", project_id: pid }).catch(() => fails.push("Google Sheets"));
    if (dests.includes("excel")) await exportsCall({ action: "create_excel", project_id: pid }).catch(() => fails.push("Excel"));
    if (dests.includes("slack") && webhook.trim()) await exportsCall({ action: "create_slack", project_id: pid, webhook_url: webhook.trim() }).catch(() => fails.push("Slack"));
    if (fails.length) toast.error(`${fails.join(" and ")} did not connect. Use Live sync on the agent to try again.`);
  };

  const submit = async () => {
    try {
      const r = await create.mutateAsync({
        request_id: requestId, name: name.trim(), brief: brief.trim(), per_day: perDay,
        goal: Math.min(maxGoal, Number(goal)), finish_date: maxFinish,
        project_id: projectId === "new" ? null : projectId,
      });
      await connectDestinations(r.agent_id).catch(() => toast.error("Your results destinations did not connect. Use Live sync on the agent."));
      if (r.warning) toast.error(r.warning);
      else toast.success(r.served ? `Your first ${r.served} matches are ready` : "Agent started");
      onOpenChange(false);
      setName(""); setBrief(""); setGoal("");  setDests([]); setWebhook("");
      setRequestId(crypto.randomUUID());
      navigate(`/agents/${r.agent_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the agent");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto border-border/70 bg-card/95 p-0 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--mint)/0.16),transparent_70%)]" />
        <div className="relative space-y-5 p-7">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="font-display text-2xl tracking-tight">Start a new agent</DialogTitle>
            <DialogDescription className="text-[15px]">Tell it who to find. It brings you fresh matches every day.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground" aria-live="polite">
            <p>{metering?.build_credits === 0 ? "Agent creation is included in your workspace access." : `Build an agent: ${metering?.build_credits ?? 15} credits from your shared credits, the same credits used for contact details.`}</p>
            <p>{metering ? `${metering.active} active · ${metering.limit === null ? "Unlimited" : metering.limit} allowed ${metering.scope === "user" ? "per user" : "per workspace"}` : "Checking your allowance…"}</p>
            {atLimit && <AgentLimitNotice limit={metering!.limit!} scope={metering!.scope} />}
            {balance !== null && balance !== undefined && balance < (metering?.build_credits ?? 15) && <p className="text-destructive">You need {metering?.build_credits ?? 15} available workspace credits.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input id="agent-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="e.g. Southwest pain physicians" className="h-11" />
          </div>

          <div className="rounded-xl border border-primary/30 bg-background/60 p-4 shadow-[0_0_0_4px_hsl(var(--primary)/0.06)] transition-shadow focus-within:shadow-[0_0_0_4px_hsl(var(--primary)/0.14)]">
            <Label htmlFor="agent-brief" className="text-[14px]">Describe who to find</Label>
            <Textarea
              id="agent-brief" value={brief} maxLength={500} rows={3}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Interventional pain physicians in Arizona and New Mexico who own or lead a private practice"
              className="mt-2 resize-none border-0 bg-transparent p-0 text-[15px] shadow-none focus-visible:ring-0"
            />
            <div className="mt-2 flex justify-between text-[12px] text-muted-foreground">
              <span>Role, specialty, area and practice setting.</span>
              <span>{brief.length}/500</span>
            </div>
            {brief.trim().length >= 8 && <div className="mt-3 border-t border-border pt-3 text-sm" aria-live="polite">
              {settledBrief !== brief.trim() || interpretation.isFetching ? <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Understanding your brief…</p> : interpretation.error ? <p className="text-destructive">{interpretation.error.message}</p> : <>
                <p className="mb-2 font-medium">Your search brief</p>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
                  {interpreted.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-words capitalize">{value}</dd></div>)}
                </dl>
                {Array.isArray(parsed?.unmapped_concepts) && parsed.unmapped_concepts.length > 0 && <p className="mt-2 text-muted-foreground">Not verified: {list(parsed.unmapped_concepts)}</p>}
              </>}
            </div>}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/40 p-4">
            <div>
              <p className="text-[14px] font-medium">People per day</p>
              <p className="text-[12px] text-muted-foreground">Up to {MAX_PER_DAY} each morning</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Fewer" onClick={() => setPerDay((n) => Math.max(1, n - 1))}><Minus className="h-4 w-4" /></Button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums">{perDay}</span>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="More" onClick={() => setPerDay((n) => Math.min(MAX_PER_DAY, n + 1))}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" />Saving goal</Label>
            <Input type="number" min={1} max={maxGoal} disabled={!!passEnd} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Number of people" className="h-11" />
          </div>
          <p className="-mt-2 text-[12px] text-muted-foreground">{passEnd ? "Matches your 5-day pass. Stops once 15 approved people are saved, or when your pass ends." : "Stops automatically once you reach your goal, or after 30 days."}</p>

          <p className="rounded-xl border border-border/70 bg-background/40 px-4 py-3 text-[13px] text-muted-foreground">
            Approved people are saved into <span className="font-medium text-foreground">{lockedProject ? lockedProject.name : defaultProjectId ? "this project" : "a new project named after this agent"}</span>.
          </p>

          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <p className="text-[14px] font-medium">Where should your results go?</p>
            <p className="text-[12px] text-muted-foreground">Everyone you approve is sent there right away. You can change this later.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["slack", "Slack", SlackLogo],
                ["sheets", "Google Sheets", SheetsLogo],
                ["excel", "Excel", ExcelLogo],
                ["none", "Just here", Minus],
              ] as const).map(([k, label, Icon]) => {
                const on = k === "none" ? dests.length === 0 : dests.includes(k);
                return (
                  <button key={k} type="button" onClick={() => toggleDest(k)} aria-pressed={on}
                    className={cn("flex flex-col items-center gap-1.5 rounded-xl border bg-card px-2 py-3 text-[13px] font-medium transition-colors active:scale-[0.97]",
                      on ? "border-mint bg-mint-soft text-mint-ink" : "border-border text-foreground/80 hover:border-mint/40")}>
                    {busyDest === k ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}{label}
                  </button>
                );
              })}
            </div>
            {dests.includes("slack") && (
              <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} className="mt-3 h-10 text-[13px]"
                placeholder="Paste your Slack webhook link (https://hooks.slack.com/...)" />
            )}
            {dests.includes("sheets") && <p className="mt-2 text-[12px] text-muted-foreground">Google connected. A new sheet is created in your Drive.</p>}
            {dests.includes("excel") && <p className="mt-2 text-[12px] text-muted-foreground">You get a private link that Excel keeps up to date.</p>}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 bg-background/40 px-7 py-4">
          <p className="text-[12px] text-muted-foreground">{create.isPending ? "Finding your first matches. This can take a minute." : "Your first 6 matches arrive right away."}</p>
          <Button onClick={submit} disabled={!ready || (dests.includes("slack") && !webhook.trim().startsWith("https://hooks.slack.com/"))} className="h-11 px-6">
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start agent <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shown when the plan's active agent slots are full: explains the limit and offers the next plan. */
function AgentLimitNotice({ limit, scope }: { limit: number; scope: string }) {
  const onPro = scope === "user";
  return (
    <div className="mt-3 rounded-xl border border-primary/40 bg-primary/10 p-4 text-foreground">
      <p className="font-medium">Your plan is limited to {limit} active agent{limit === 1 ? "" : "s"}{onPro ? " per seat" : ""}.</p>
      <p className="mt-1 text-muted-foreground">
        {onPro
          ? "Pause or close an agent to start another, or talk to us about Enterprise for unlimited agents."
          : "Pause or close your active agent to start another, or upgrade to Pro for 4 active agents per seat and 25 new matches a day."}
      </p>
      <a href={onPro ? "mailto:hello@oslr.health" : "/credits?upgrade=pro"} className="mt-3 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground">
        {onPro ? "Talk to us" : "Upgrade to Pro"}
      </a>
    </div>
  );
}
