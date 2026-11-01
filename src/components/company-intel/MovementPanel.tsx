/**
 * Movement tab: who joined and who left in the last 24 months. Shows the
 * counts first; pulls on request.
 */

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyBriefState, MovementPerson } from "@/hooks/useCompanyBrief";
import { PersonAvatar } from "./PersonAvatar";
import { LinkedInBadge } from "./LinkedInBadge";
import { Chip } from "./PeoplePanel";
import { fmtCount, fmtMonth, inMoveFilter, MOVE_FILTERS, type MoveFilter } from "./brief-utils";
import { cn } from "@/lib/utils";
import { FlowSankey } from "./FlowSankey";

/** Profiles pulled per direction at most (matches MOVEMENT_LIMIT in the edge function). */
const MOVEMENT_LIMIT = 100;

export function MovementPanel({ s }: { s: CompanyBriefState }) {
  const mv = s.preview?.movement;

  if (!s.movement) {
    const hires = mv?.hires ?? null;
    const deps = mv?.departures ?? null;
    const net = hires !== null && deps !== null ? hires - deps : null;
    const hc = s.base?.headcount;
    const yoyPct = hc?.yoy_percent ?? null;
    const rows = Math.min(hires ?? 0, MOVEMENT_LIMIT) + Math.min(deps ?? 0, MOVEMENT_LIMIT);
    const loading = s.previewState === "loading";
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <h3 className="font-display text-[15px] font-semibold text-ui-text-primary">Who joined and who left</h3>
          <p className="mt-0.5 text-[12.5px] text-ui-text-secondary">Last {mv?.window_months ?? 24} months, from the company record already loaded.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([
              ["Started here", loading ? null : hires, "up", "people who joined"] as const,
              ["Left", loading ? null : deps, "down", "people who moved on"] as const,
              ["Net change", loading ? null : net, net !== null && net >= 0 ? "up" : "down", "joined minus left"] as const,
              ["Team size today", loading ? null : hc?.total ?? null, "up", yoyPct !== null ? `${yoyPct >= 0 ? "+" : ""}${yoyPct.toFixed(1)}% in 1 year` : "public profiles counted"] as const,
            ]).map(([label, n, tone, sub]) => (
              <div key={label} className="rounded-xl bg-muted/50 px-4 py-3.5">
                <p className="text-[12px] text-ui-text-muted">{label}</p>
                <p className={cn("mt-1.5 font-display text-[24px] font-semibold leading-none tabular-nums", tone === "up" ? "text-primary" : "text-ui-text-primary")}>
                  {loading ? <Skeleton className="h-6 w-10" /> : n === null ? "–" : label === "Net change" ? `${(n as number) >= 0 ? "+" : ""}${(n as number).toLocaleString()}` : fmtCount(n as number | null)}
                </p>
                <p className="mt-1.5 text-[12px] text-ui-text-muted">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-sm">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-ui-text-primary">Want the individuals behind these numbers?</p>
            <p className="mt-0.5 text-[12.5px] text-ui-text-secondary">
              {rows > 0
                ? <>See up to <span className="font-semibold tabular-nums text-ui-text-primary">{rows}</span> people with names, employers, titles and dates, plus the talent flow chart.</>
                : "No movement found in this window."}
            </p>
          </div>
          <button
            type="button"
            onClick={s.pullMovement}
            disabled={rows === 0 || !!s.busy.movement}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#0A1F44] px-4 text-[13px] font-medium text-white transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40"
          >
            {s.busy.movement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            See the individuals
          </button>
        </div>
        {s.errors.movement && <p className="px-1 text-[12px] text-destructive">Couldn't load movement. {s.errors.movement}</p>}
      </section>
    );
  }

  return <MovementResults s={s} />;
}

function MovementResults({ s }: { s: CompanyBriefState }) {
  const m = s.movement!;
  const [dir, setDir] = useState<"joined" | "left">("joined");
  const [f, setF] = useState<MoveFilter>("all");
  const [focus, setFocus] = useState<string | null>(null);
  const hires = m.hires.filter((p) => inMoveFilter(p, f));
  const deps = m.departures.filter((p) => inMoveFilter(p, f));
  const focusName = focus ? focus.slice(focus.indexOf(":") + 1) : null;
  const focusSide = focus?.startsWith("from:") ? "joined" : focus ? "left" : null;
  const effDir = focusSide ?? dir;
  const list = (effDir === "joined" ? hires : deps).filter((p) => !focusName || ((effDir === "joined" ? p.previous_company : p.current_company) ?? "").trim().toLowerCase() === focusName);
  const ex = m.excluded;
  const internal = ex.hires.internal_move + ex.departures.internal_move;
  const students = ex.hires.non_employee + ex.departures.non_employee;
  const side = ex.hires.side_role + ex.departures.side_role;
  const filters = MOVE_FILTERS.map((x) => ({ ...x, n: m.hires.filter((p) => inMoveFilter(p, x.key)).length + m.departures.filter((p) => inMoveFilter(p, x.key)).length }))
    .filter((x) => x.key === "all" || x.n > 0 || x.key === f);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-ui-text-secondary">Last {m.window_months} months{m.cached ? " · loaded from the shared cache" : ""}</p>
        <div className="flex flex-wrap gap-1.5">{filters.map((x) => <Chip key={x.key} active={f === x.key} onClick={() => setF(x.key)} label={x.label} count={x.n} />)}</div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h3 className="font-display text-[15px] font-semibold text-foreground">Talent flow</h3>
              <p className="text-[12.5px] text-muted-foreground">Where people came from and where they went. Tap an employer to see who.</p>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-primary/70" />Came from</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full bg-muted-foreground/50" />Left for</span>
            </div>
          </div>
          <FlowSankey base={s.base} name={s.base?.display_name ?? "This company"} hires={hires} departures={deps} focus={focus} onFocus={setFocus} />
        </div>
        {focus && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/8 px-4 py-2.5 text-[13px]">
            <span className="text-foreground">Showing {list.length} {focusSide === "joined" ? "who came from" : "who left for"} <span className="font-semibold">{list[0] ? (focusSide === "joined" ? list[0].previous_company : list[0].current_company) : focusName}</span></span>
            <button type="button" onClick={() => setFocus(null)} className="font-medium text-primary hover:underline">Clear</button>
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex border-b border-ui-border-light p-1.5">
            {(["joined", "left"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDir(d); setFocus(null); }}
                className={cn("flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition-colors duration-150", effDir === d ? "bg-ui-surface-subtle text-ui-text-primary" : "text-ui-text-muted hover:text-ui-text-primary")}
              >
                {d === "joined" ? "Started here" : "Left"} <span className="tabular-nums text-ui-text-muted">{d === "joined" ? hires.length : deps.length}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ui-text-muted">Nobody for this filter.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-ui-border-light overflow-y-auto">{list.map((p, i) => <MoveRow key={`${p.name}-${i}`} p={p} dir={effDir} />)}</ul>
          )}
        </div>
      </div>

      <p className="text-[11.5px] leading-relaxed text-ui-text-muted">
        Checked {m.hires_returned} people who started and {m.departures_returned} who left.
        {internal + students + side > 0 && ` Not counted: ${[internal && `${internal} promotions and internal moves`, side && `${side} side jobs`, students && `${students} students, interns and visitors`].filter(Boolean).join(", ")}.`}
      </p>
    </section>
  );
}

function MoveRow({ p, dir }: { p: MovementPerson; dir: "joined" | "left" }) {
  const date = dir === "joined" ? p.current_company_start_date : p.previous_end_date;
  const role = dir === "joined" ? p.current_title : p.previous_title;
  const other = dir === "joined" ? p.previous_company : p.current_company;
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <PersonAvatar name={p.name} src={p.profile_picture_url} size={30} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-ui-text-primary">{p.name}</span>
            <LinkedInBadge href={p.linkedin_profile_url} size={15} label={`${p.name} profile`} />
          </span>
          <span className="shrink-0 text-[11.5px] tabular-nums text-ui-text-muted">{fmtMonth(date)}</span>
        </div>
        <p className="truncate text-[12px] text-ui-text-secondary">{role ?? "–"}</p>
        <p className="truncate text-[11.5px] text-ui-text-muted">
          {dir === "joined" ? (other ? `From ${other}` : "No recent prior employer listed") : other ? `Now at ${other}` : "New employer not listed"}
        </p>
      </div>
    </li>
  );
}
