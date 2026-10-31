import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Loader2, Minus, Plus, Target, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjects } from "@/hooks/useProjects";
import { useAgentMetering, useCreateAgent } from "@/hooks/useAgents";
import { useCompany } from "@/hooks/useCompany";
import { useCreditBalance } from "@/hooks/useContactEnrich";
import { toast } from "sonner";

const MAX_PER_DAY = 10;

export function AgentBriefDialog({
  open, onOpenChange, defaultProjectId,
}: { open: boolean; onOpenChange: (o: boolean) => void; defaultProjectId?: string }) {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const create = useCreateAgent();
  const { companyId } = useCompany();
  const balance = useCreditBalance(companyId);
  const { data: metering } = useAgentMetering(open);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [perDay, setPerDay] = useState(10);
  const [goal, setGoal] = useState("");
  const [finish, setFinish] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? "new");

  const atLimit = !!metering && metering.limit !== null && metering.active >= metering.limit;
  const ready = name.trim().length > 0 && brief.trim().length >= 8 && !create.isPending && !!metering && !atLimit && (balance ?? 0) >= metering.build_credits;

  const submit = async () => {
    try {
      const r = await create.mutateAsync({
        request_id: requestId, name: name.trim(), brief: brief.trim(), per_day: perDay,
        goal: goal ? Number(goal) : null, finish_date: finish || null,
        project_id: projectId === "new" ? null : projectId,
      });
      if (r.warning) toast.error(r.warning);
      else toast.success(r.served ? `Your first ${r.served} matches are ready` : "Agent started");
      onOpenChange(false);
      setName(""); setBrief(""); setGoal(""); setFinish("");
      setRequestId(crypto.randomUUID());
      navigate(`/agents/${r.agent_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the agent");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !create.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-xl overflow-hidden border-border/70 bg-card/95 p-0 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18),transparent_70%)]" />
        <div className="relative space-y-5 p-7">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="font-display text-2xl tracking-tight">Start a new agent</DialogTitle>
            <DialogDescription className="text-[15px]">Tell it who to find. It brings you fresh matches every day.</DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground" aria-live="polite">
            <p>Build an agent: {metering?.build_credits ?? 30} credits. Contact enrichment is charged separately.</p>
            <p>{metering ? `${metering.active} active · ${metering.limit === null ? "Unlimited" : metering.limit} allowed ${metering.scope === "user" ? "per user" : "per workspace"}` : "Checking your allowance…"}</p>
            {atLimit && <p className="text-destructive">Pause or close an active agent before starting another.</p>}
            {balance !== null && balance !== undefined && balance < 30 && <p className="text-destructive">You need 30 available workspace credits.</p>}
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Target className="h-3.5 w-3.5" />Saving goal <span className="font-normal text-muted-foreground">optional</span></Label>
              <Input type="number" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Number of people" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Finish date <span className="font-normal text-muted-foreground">optional</span></Label>
              <Input type="date" value={finish} onChange={(e) => setFinish(e.target.value)} className="h-11" />
            </div>
          </div>
          <p className="-mt-2 text-[12px] text-muted-foreground">Stops when either is reached. Without them, it runs until you close it.</p>

          <div className="space-y-2">
            <Label>Save approved people into</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">A new project named after this agent</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/60 bg-background/40 px-7 py-4">
          <p className="text-[12px] text-muted-foreground">{create.isPending ? "Finding your first matches. This can take a minute." : "Your first 6 matches arrive right away."}</p>
          <Button onClick={submit} disabled={!ready} className="h-11 rounded-full px-6">
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start agent <ArrowUpRight className="ml-1.5 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
