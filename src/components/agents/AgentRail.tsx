import { Check, Clock, Inbox, Pencil, ThumbsUp, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { featureLabel, fmtWhen, type Roster } from "@/hooks/useAgents";

const EVENT_LABEL: Record<string, string> = {
  calibration_started: "First matches requested",
  calibration_completed: "First matches reviewed",
  batch_sourced: "New people found",
  daily_run: "Daily run completed",
  run_failed: "Daily run could not finish",
  goal_reached: "Goal reached",
  status_paused: "Agent paused",
  status_sourcing: "Agent resumed",
  status_completed: "Agent finished",
  status_closed: "Agent closed",
  steering_updated: "Agent instructions updated",
  learning_updated: "Review preferences learned",
};

export function AgentRail({ roster, onUnskip }: { roster: Roster; onUnskip: (city: string) => void }) {
  const { agent, decisions, pool, events, signals } = roster;
  const approved = decisions.filter((d) => d.decision === "approved").length;
  const passed = decisions.length - approved;
  const waiting = pool.filter((p) => !p.decision && p.served_at && !p.pruned).length;
  const byId = new Map(pool.map((p) => [p.id, p]));
  const notes = decisions.filter((d) => d.note).slice(0, 5);
  const timeline = events.filter((e) => EVENT_LABEL[e.event_type]).slice(-20).reverse();
  const passedPeople = decisions.filter((d) => d.decision === "passed").slice(0, 10);

  const Item = ({ icon: Icon, title, sub, when }: { icon: typeof Check; title: string; sub: string; when?: string }) => (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/60"><Icon className="h-3.5 w-3.5 text-muted-foreground" /></div>
      <div>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[13px] text-muted-foreground">{sub}</p>
        {when && <p className="mt-0.5 text-[12px] text-muted-foreground/70">{when}</p>}
      </div>
    </div>
  );

  return (
    <Tabs defaultValue="today" className="w-full">
      <TabsList className="grid w-full grid-cols-4 rounded-full">
        <TabsTrigger value="today" className="rounded-full">Today</TabsTrigger>
        <TabsTrigger value="looks" className="rounded-full">Looks for</TabsTrigger>
        <TabsTrigger value="skips" className="rounded-full">Skips</TabsTrigger>
        <TabsTrigger value="timeline" className="rounded-full">Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="mt-5 space-y-5">
        <Item icon={Check} title="Your decisions" sub={`${approved} saved, ${passed} passed`} when={decisions[0] ? fmtWhen(decisions[0].created_at) : undefined} />
        <Item icon={Inbox} title="Your review list" sub={`${waiting} waiting for you`} />
        <Item icon={Pencil} title="Your search" sub={agent.brief} when={fmtWhen(agent.created_at)} />
        <Item icon={Clock} title="Next search" sub={agent.status === "sourcing" ? fmtWhen(agent.next_run_at) : agent.pause_reason ?? "After you finish your first matches"} />
      </TabsContent>

      <TabsContent value="looks" className="mt-5 space-y-5">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Your brief</p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{agent.brief}</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Ranks higher</p>
          {signals.length === 0 ? <p className="mt-1.5 text-[13px] text-muted-foreground">Approve a few people and this fills in.</p> : (
            <ul className="mt-2 space-y-1.5">
              {signals.map((s) => (
                <li key={s.feature} className="flex items-center gap-2 text-[14px]">
                  <ThumbsUp className="h-3.5 w-3.5 text-primary" />{featureLabel(s.feature)}
                  <span className="text-[12px] text-muted-foreground">{Math.round(s.share * 100)}% of approvals</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {agent.taste_memo && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">What your agent learned</p>
            <p className="mt-1.5 whitespace-pre-line text-[14px] leading-relaxed text-foreground/85">{agent.taste_memo}</p>
          </div>
        )}
        {Object.entries(agent.preferences.weights).some(([, weight]) => weight !== 1) && <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Learned preferences</p>
          <ul className="mt-2 space-y-1.5 text-sm">{Object.entries(agent.preferences.weights).filter(([, weight]) => weight !== 1).map(([feature, weight]) => <li key={feature} className="flex items-start justify-between gap-3"><span>{featureLabel(feature)}</span><span className="shrink-0 text-muted-foreground">{weight > 1 ? "Favor" : "Less often"}</span></li>)}</ul>
        </div>}
        {notes.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">From your notes</p>
            <ul className="mt-2 space-y-2">
              {notes.map((n, i) => (
                <li key={i} className="text-[14px] text-foreground/85">"{n.note}" <span className="text-[12px] text-muted-foreground">{String(byId.get(n.pool_id)?.profile.full_name ?? "")}</span></li>
              ))}
            </ul>
          </div>
        )}
      </TabsContent>

      <TabsContent value="skips" className="mt-5 space-y-5">
        {!!agent.preferences.skip.features?.length && <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Excluded profiles</p>
          <ul className="mt-2 space-y-1 text-sm">{agent.preferences.skip.features.map(f => <li key={f}>{featureLabel(f)}</li>)}</ul>
        </div>}
        {!!agent.preferences.skip.employers.length && <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Organizations you skip</p>
          <ul className="mt-2 space-y-1 text-sm">{agent.preferences.skip.employers.map(e => <li key={e}>{e}</li>)}</ul>
        </div>}
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Towns you skip</p>
          {agent.preferences.skip.cities.length === 0 ? <p className="mt-1.5 text-[13px] text-muted-foreground">None yet.</p> : (
            <div className="mt-2 flex flex-wrap gap-2">
              {agent.preferences.skip.cities.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-[13px]">
                  {c}<button aria-label={`Stop skipping ${c}`} onClick={() => onUnskip(c)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">People you passed</p>
          {passedPeople.length === 0 ? <p className="mt-1.5 text-[13px] text-muted-foreground">None yet.</p> : (
            <ul className="mt-2 space-y-1.5 text-[14px]">
              {passedPeople.map((d) => <li key={d.pool_id}>{String(byId.get(d.pool_id)?.profile.full_name ?? "")}</li>)}
            </ul>
          )}
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="mt-5 space-y-4">
        {timeline.length === 0 ? <p className="text-[13px] text-muted-foreground">Nothing yet.</p> : timeline.map((e, i) => (
          <Item key={i} icon={Clock} title={EVENT_LABEL[e.event_type]}
            sub={typeof e.payload.served === "number" ? `${e.payload.served} people ready` : String(e.payload.reason ?? e.payload.error ?? "")}
            when={fmtWhen(e.created_at)} />
        ))}
      </TabsContent>
    </Tabs>
  );
}
