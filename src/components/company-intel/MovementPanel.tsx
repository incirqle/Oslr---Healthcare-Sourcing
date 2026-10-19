/**
 * Movement tab: who joined and who left in the last 24 months. Shows the
 * counts first; pulls on request.
 */

import { useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyBriefState, MovementPerson } from "@/hooks/useCompanyBrief";
import { PersonAvatar } from "./PersonAvatar";
import { LinkedInBadge } from "./LinkedInBadge";
import { Chip } from "./PeoplePanel";
import { fmtCount, fmtMonth, inMoveFilter, MOVE_FILTERS, type MoveFilter, netFlow } from "./brief-utils";
import { cn } from "@/lib/utils";

/** Profiles pulled per direction at most (matches MOVEMENT_LIMIT in the edge function). */
const MOVEMENT_LIMIT = 100;

export function MovementPanel({ s }: { s: CompanyBriefState }) {
  const mv = s.preview?.movement;

  if (!s.movement) {
    const hires = mv?.hires ?? null;
    const deps = mv?.departures ?? null;
    const rows = Math.min(hires ?? 0, MOVEMENT_LIMIT) + Math.min(deps ?? 0, MOVEMENT_LIMIT);
    return (
      <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
        <header className="border-b border-ui-border-light px-5 py-3.5">
          <h3 className="font-display text-[15px] font-semibold text-ui-text-primary">Who joined and who left</h3>
          <p className="text-[12.5px] text-ui-text-secondary">Last {mv?.window_months ?? 24} months. Promotions, side jobs and students are removed after the pull.</p>
        </header>
        <div className="grid grid-cols-2 divide-x divide-ui-border-light">
          {[["Started here", hires], ["Left", deps]].map(([label, n]) => (
            <div key={label as string} className="px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-ui-text-muted">{label}</p>
              <div className="mt-1 font-display text-[24px] font-semibold tabular-nums text-ui-text-primary">
                {s.previewState === "loading" ? <Skeleton className="h-7 w-12" /> : <>up to {fmtCount(n as number | null)}</>}
              </div>
            </div>
          ))}
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border-light px-5 py-3.5">
          <p className="text-[12.5px] text-ui-text-secondary">
            {rows > 0 ? <><span className="font-semibold tabular-nums text-ui-text-primary">{rows}</span> profiles</> : "No movement found in this window."}
          </p>
          <button
            type="button"
            onClick={s.pullMovement}
            disabled={rows === 0 || !!s.busy.movement}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#0A1F44] px-4 text-[13px] font-medium text-white transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40"
          >
            {s.busy.movement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Pull movement
          </button>
        </footer>
        {s.errors.movement && <p className="px-5 pb-3 text-[12px] text-destructive">Couldn't pull movement. {s.errors.movement}</p>}
      </section>
    );
  }

  return <MovementResults s={s} />;
}

function MovementResults({ s }: { s: CompanyBriefState }) {
  const m = s.movement!;
  const [dir, setDir] = useState<"joined" | "left">("joined");
  const [f, setF] = useState<MoveFilter>("all");
  const hires = m.hires.filter((p) => inMoveFilter(p, f));
  const deps = m.departures.filter((p) => inMoveFilter(p, f));
  const rows = netFlow(hires, deps);
  const maxSide = Math.max(1, ...rows.map((r) => Math.max(r.joined_from, r.left_to)));
  const list = dir === "joined" ? hires : deps;
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="rounded-lg border border-ui-border-medium bg-white p-5 dark:bg-background">
          <h3 className="text-[13.5px] font-semibold text-ui-text-primary">Trades staff with</h3>
          <div className="mt-1 flex justify-between text-[11px] text-ui-text-muted">
            <span className="inline-flex items-center gap-1"><ArrowLeft className="h-3 w-3" />Left for them</span>
            <span className="inline-flex items-center gap-1">Came from them<ArrowRight className="h-3 w-3" /></span>
          </div>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-ui-text-muted">No moves to or from other companies for this filter.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rows.map((r) => (
                <li key={r.company}>
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] text-ui-text-primary" title={r.company}>{r.company}</span>
                    <LinkedInBadge href={r.linkedin_url} size={14} label={`${r.company} company page`} />
                  </div>
                  <div className="mt-1 grid grid-cols-[22px_minmax(0,1fr)_minmax(0,1fr)_22px] items-center gap-1.5">
                    <span className="text-right text-[11.5px] tabular-nums text-ui-text-secondary">{r.left_to || ""}</span>
                    <span className="flex h-2 justify-end">{r.left_to > 0 && <span className="block h-full rounded-l-sm bg-[#0A1F44] dark:bg-[#8FA3C4]" style={{ width: `${(r.left_to / maxSide) * 100}%` }} />}</span>
                    <span className="flex h-2 border-l border-ui-border-medium">{r.joined_from > 0 && <span className="block h-full rounded-r-sm bg-[#7AC5B0]" style={{ width: `${(r.joined_from / maxSide) * 100}%` }} />}</span>
                    <span className="text-[11.5px] tabular-nums text-ui-text-secondary">{r.joined_from || ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex border-b border-ui-border-light p-1.5">
            {(["joined", "left"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDir(d)}
                className={cn("flex-1 rounded-md py-1.5 text-[12.5px] font-medium transition-colors duration-150", dir === d ? "bg-ui-surface-subtle text-ui-text-primary" : "text-ui-text-muted hover:text-ui-text-primary")}
              >
                {d === "joined" ? "Started here" : "Left"} <span className="tabular-nums text-ui-text-muted">{d === "joined" ? hires.length : deps.length}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ui-text-muted">Nobody for this filter.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-ui-border-light overflow-y-auto">{list.map((p, i) => <MoveRow key={`${p.name}-${i}`} p={p} dir={dir} />)}</ul>
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
