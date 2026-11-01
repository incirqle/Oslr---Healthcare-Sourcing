/**
 * People tab insights: team makeup, departments, where staff work and the
 * places recent hires came from. Built only from data already loaded for the
 * company (base record, preview counts, the shared movement pull), so opening
 * it never pulls individual profiles.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { OrgLogo } from "@/components/search/Avatars";
import type { CompanyBriefState, PullGroup } from "@/hooks/useCompanyBrief";
import { fmtCount, GROUP_LABEL, GROUP_ORDER } from "./brief-utils";
import { splitRegions } from "./regions";
import { buildNodes } from "./FlowSankey";
import { cn } from "@/lib/utils";

const SLICE = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.72)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.32)",
  "hsl(var(--muted-foreground) / 0.55)",
  "hsl(var(--muted-foreground) / 0.38)",
  "hsl(var(--muted-foreground) / 0.24)",
];

function Card({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-5 shadow-sm", className)}>
      <h3 className="font-display text-[15px] font-semibold text-foreground">{title}</h3>
      {sub && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

function RankList({ rows, total, logos }: { rows: { name: string; count: number; logo?: string | null; domain?: string | null }[]; total: number; logos?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">Not enough data yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.name} className="group flex items-center gap-3">
          <span className="w-4 text-right text-[11.5px] tabular-nums text-muted-foreground">{i + 1}</span>
          {logos && (
            <OrgLogo
              name={r.name}
              src={r.logo ?? null}
              fallbackSrc={r.domain ? `https://www.google.com/s2/favicons?domain=${r.domain}&sz=128` : null}
              className="h-8 w-8 shrink-0 rounded-lg"
              textClassName="text-[10px]"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[13px] font-medium text-foreground" title={r.name}>{r.name}</span>
              <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{r.count.toLocaleString()}</span>
                {total > 0 && <> · {Math.round((r.count / total) * 100)}%</>}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/80 transition-[width] duration-500 ease-out group-hover:bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PeopleInsights({ s, onBrowse }: { s: CompanyBriefState; onBrowse: (g: PullGroup) => void }) {
  // The movement pull is one capped, shared pull per company (same as the Movement tab).
  const started = useRef(false);
  useEffect(() => {
    if (s.movement || started.current || !s.base || s.busy.movement || s.errors.movement) return;
    started.current = true;
    void s.pullMovement();
  }, [s.base, s.movement, s.busy.movement, s.errors.movement, s]);

  const loading = s.previewState === "loading";
  const groups = useMemo(
    () => GROUP_ORDER.map((g) => ({ g, name: GROUP_LABEL[g], count: s.preview?.groups.find((x) => x.group === g)?.count ?? 0 })).filter((x) => x.count > 0),
    [s.preview],
  );
  const groupTotal = groups.reduce((n, x) => n + x.count, 0);
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover !== null ? groups[hover] : null;

  const fn = s.base?.headcount_by_function ?? [];
  const fnTotal = fn.reduce((n, x) => n + x.count, 0);
  const regions = useMemo(() => splitRegions(s.base?.headcount?.by_region), [s.base]);
  const stateTotal = regions.states.reduce((n, x) => n + x.count, 0);

  const feeders = useMemo(() => (s.movement ? buildNodes(s.movement.hires, "from", 8) : []), [s.movement]);
  const feederTotal = s.movement?.hires.length ?? 0;
  const training = feeders.filter((f) => f.training > 0 || f.kind === "Academic center");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card title="Clinical team makeup" sub="Everyone on staff, grouped by role. Tap a group to see who.">
          {loading ? (
            <Skeleton className="mx-auto h-52 w-52 rounded-full" />
          ) : groupTotal === 0 ? (
            <p className="py-10 text-center text-[13px] text-muted-foreground">Counts didn't load. Reopen the company to try again.</p>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <div className="relative h-52 w-52 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={groups}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={66}
                      outerRadius={98}
                      paddingAngle={2}
                      stroke="hsl(var(--card))"
                      strokeWidth={2}
                      onMouseEnter={(_, i) => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onClick={(_, i) => onBrowse(groups[i].g)}
                      isAnimationActive
                    >
                      {groups.map((x, i) => (
                        <Cell key={x.g} fill={SLICE[i % SLICE.length]} className="cursor-pointer outline-none" opacity={hover === null || hover === i ? 1 : 0.4} />
                      ))}
                    </Pie>
                    <Tooltip content={() => null} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-foreground">{fmtCount(shown?.count ?? groupTotal)}</span>
                  <span className="mt-1 max-w-[110px] text-[11.5px] leading-tight text-muted-foreground">{shown ? shown.name : "people counted"}</span>
                </div>
              </div>
              <ul className="w-full space-y-1">
                {groups.map((x, i) => (
                  <li key={x.g}>
                    <button
                      type="button"
                      onMouseEnter={() => setHover(i)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onBrowse(x.g)}
                      className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150", hover === i ? "bg-muted" : "hover:bg-muted/60")}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SLICE[i % SLICE.length] }} />
                      <span className="flex-1 truncate text-[13px] text-foreground">{x.name}</span>
                      <span className="text-[12.5px] font-semibold tabular-nums text-foreground">{fmtCount(x.count)}</span>
                      <span className="w-9 text-right text-[11.5px] tabular-nums text-muted-foreground">{Math.round((x.count / groupTotal) * 100)}%</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Where recent hires trained and worked" sub="Top places people came from in the last two years.">
          {!s.movement ? (
            s.errors.movement ? <p className="py-6 text-center text-[13px] text-muted-foreground">Not available for this company.</p> : <div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}</div>
          ) : (
            <>
              <RankList rows={feeders.map((f) => ({ name: f.name, count: f.count, logo: f.logo, domain: f.domain }))} total={feederTotal} logos />
              {training.length > 0 && (
                <p className="mt-4 rounded-lg bg-primary/10 px3 px-3 py-2 text-[12px] text-foreground">
                  <span className="font-semibold">Training pipeline:</span> {training.slice(0, 3).map((t) => t.name).join(", ")}
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Departments" sub="Staff by job function.">
          {!s.base ? <Skeleton className="h-40 w-full" /> : <RankList rows={fn.slice(0, 8).map((x) => ({ name: x.label, count: x.count }))} total={fnTotal} />}
        </Card>
        <Card title="Where staff work" sub="By state, from public profiles.">
          {!s.base ? <Skeleton className="h-40 w-full" /> : <RankList rows={regions.states.slice(0, 8).map((x) => ({ name: x.place, count: x.count }))} total={stateTotal} />}
        </Card>
      </div>
    </div>
  );
}
