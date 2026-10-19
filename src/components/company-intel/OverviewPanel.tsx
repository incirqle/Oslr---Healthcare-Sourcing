/**
 * Company overview: the company-level facts first, then who works there.
 * Data comes from the base + preview calls the panel already makes on open.
 */
import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ArrowUpRight, Globe, MapPin, TrendingDown, TrendingUp, UserMinus, UserPlus } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyBase, CompanyBriefState, PullGroup } from "@/hooks/useCompanyBrief";
import { LinkedInBadge } from "./LinkedInBadge";
import { fmtCount, fmtMonth, GROUP_LABEL, GROUP_ORDER, OWNERSHIP_LABEL } from "./brief-utils";
import { cn } from "@/lib/utils";

function initialsOf(name: string) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(and|of|the)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

export function CompanyLogo({ base, name, size = 64 }: { base: CompanyBase | null; name: string; size?: number }) {
  const domain = base?.company_website_domain ?? null;
  const sources = useMemo(
    () => [base?.logo_url ?? null, domain ? `https://logo.clearbit.com/${domain}` : null, domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null].filter((s): s is string => !!s),
    [base?.logo_url, domain],
  );
  const [i, setI] = useState(0);
  const style = { width: size, height: size };
  if (!sources[i]) {
    return (
      <div style={style} className="flex shrink-0 items-center justify-center rounded-2xl bg-primary/15 font-display text-[22px] font-semibold text-primary shadow-sm ring-1 ring-border">
        {initialsOf(name)}
      </div>
    );
  }
  return <img src={sources[i]} alt="" style={style} onError={() => setI((n) => n + 1)} className="shrink-0 rounded-2xl bg-white object-contain p-2 shadow-sm ring-1 ring-border" />;
}

/** Translucent header shown above every tab. */
export function CompanyHeader({ base, state, fallbackName }: { base: CompanyBase | null; state: string; fallbackName: string }) {
  const name = base?.display_name ?? fallbackName;
  const hq = base ? [base.hq_city, base.hq_state].filter(Boolean).join(", ") : "";
  const ownership = base ? OWNERSHIP_LABEL[base.ownership.model] : null;
  return (
    <div className="flex items-center gap-4 px-7 pb-4 pt-6 pr-14">
      <CompanyLogo base={base} name={name} />
      <div className="min-w-0 flex-1">
        <DialogTitle className="truncate font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{name}</DialogTitle>
        {state === "loading" && !base ? (
          <Skeleton className="mt-2 h-4 w-64" />
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-muted-foreground">
            {ownership && <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-[12.5px] font-medium text-primary" title={base?.ownership.evidence}>{ownership}</span>}
            {base?.industry && <span>{base.industry}</span>}
            {hq && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{hq}</span>}
            {base?.company_website_domain && (
              <a href={`https://${base.company_website_domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                <Globe className="h-3.5 w-3.5" />{base.company_website_domain}<ArrowUpRight className="h-3 w-3" />
              </a>
            )}
            {base && <LinkedInBadge href={base.linkedin_profile_url} size={20} label={`${name} company page`} />}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1.5 font-display text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground", tone === "up" && "text-primary")}>{value}</p>
      {sub && <p className="mt-2 text-[12.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Card({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-5 shadow-sm", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function OverviewPanel({ s, onOpenGroup, onOpenMovement }: { s: CompanyBriefState; onOpenGroup: (g: PullGroup) => void; onOpenMovement: () => void }) {
  const [more, setMore] = useState(false);
  const base = s.base;

  if (!base) {
    if (s.baseState === "empty" || s.baseState === "error") {
      return (
        <div className="mx-auto max-w-md py-24 text-center">
          <p className="text-[17px] font-semibold text-foreground">{s.baseState === "empty" ? "We couldn't find this company" : "Company details didn't load"}</p>
          <p className="mt-2 text-[14px] text-muted-foreground">{s.baseState === "empty" ? "No company record matched this employer name." : "Close this window and open it again to retry."}</p>
        </div>
      );
    }
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-2xl" />)}</div>
        <Skeleton className="h-56 rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      </div>
    );
  }

  const hc = base.headcount;
  const yoy = hc.yoy_percent;
  const series = hc.timeseries.slice(-36);
  const maxSite = Math.max(1, ...base.sites.map((x) => x.count));
  const groups = GROUP_ORDER.map((g) => ({ g, count: s.preview?.groups.find((x) => x.group === g)?.count ?? null }));
  const mv = s.preview?.movement;

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-300">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Employees" value={fmtCount(hc.total)} sub={base.employee_count_range ? `Size range ${base.employee_count_range}` : undefined} />
        <Stat
          label="Change in 1 year"
          tone={yoy !== null && yoy >= 0 ? "up" : undefined}
          value={yoy === null ? "–" : <span className="inline-flex items-center gap-1.5">{yoy >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%</span>}
          sub={hc.yoy_absolute !== null ? `${hc.yoy_absolute >= 0 ? "+" : ""}${hc.yoy_absolute} people` : undefined}
        />
        <Stat label="Founded" value={base.year_founded ?? "–"} sub={base.year_founded ? `${new Date().getFullYear() - base.year_founded} years in business` : undefined} />
        <Stat label="Locations" value={fmtCount(base.sites.length || null)} sub={base.sites[0] ? `Most staff in ${base.sites[0].place}` : undefined} />
      </div>

      {series.length > 1 && (
        <Card title="Headcount" action={<span className="text-[12.5px] text-muted-foreground">Since {fmtMonth(series[0].date)}</span>}>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hcFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={(d) => fmtMonth(d)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} minTickGap={40} />
                <YAxis width={36} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["dataMin - 1", "dataMax + 1"]} allowDecimals={false} />
                <Tooltip
                  formatter={(v: number) => [fmtCount(v), "Employees"]}
                  labelFormatter={(d: string) => fmtMonth(d)}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="employee_count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#hcFill)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card
        title="Who works here"
        action={s.previewState === "loading" ? <span className="text-[12.5px] text-muted-foreground">Counting…</span> : <span className="text-[12.5px] text-muted-foreground">Tap a group to see the people</span>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {groups.map(({ g, count }) => (
            <button
              key={g}
              type="button"
              disabled={!count}
              onClick={() => onOpenGroup(g)}
              className="group rounded-xl border border-border/70 bg-background/60 px-4 py-3.5 text-left transition-all duration-150 hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98] disabled:cursor-default disabled:opacity-50 disabled:hover:border-border/70 disabled:hover:bg-background/60"
            >
              <span className="block font-display text-[24px] font-semibold leading-none tabular-nums text-foreground">
                {s.previewState === "loading" ? <Skeleton className="h-6 w-10" /> : fmtCount(count ?? 0)}
              </span>
              <span className="mt-1.5 flex items-center justify-between gap-1 text-[13px] text-muted-foreground">
                <span className="truncate">{GROUP_LABEL[g]}</span>
                {!!count && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />}
              </span>
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {base.description && (
          <Card title="About">
            <p className={cn("text-[14px] leading-relaxed text-muted-foreground", !more && "line-clamp-6")}>{base.description}</p>
            {base.description.length > 320 && (
              <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 text-[13px] font-medium text-primary hover:underline">{more ? "Show less" : "Read more"}</button>
            )}
          </Card>
        )}
        {base.sites.length > 0 && (
          <Card title="Where staff work">
            <ul className="space-y-2.5">
              {base.sites.slice(0, 6).map((x) => (
                <li key={x.place} className="grid grid-cols-[minmax(0,1fr)_96px_36px] items-center gap-3">
                  <span className="truncate text-[14px] text-foreground">{x.place}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (x.count / maxSite) * 100)}%` }} />
                  </span>
                  <span className="text-right text-[13px] tabular-nums text-muted-foreground">{fmtCount(x.count)}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {mv && (mv.hires !== null || mv.departures !== null) && (
        <Card title={`Movement in the last ${mv.window_months} months`} action={<button type="button" onClick={onOpenMovement} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">See who <ArrowRight className="h-3.5 w-3.5" /></button>}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 rounded-xl bg-primary/8 px-4 py-3.5">
              <UserPlus className="h-5 w-5 text-primary" />
              <div><p className="font-display text-[22px] font-semibold leading-none tabular-nums text-foreground">{fmtCount(mv.hires ?? 0)}</p><p className="mt-1 text-[13px] text-muted-foreground">Joined</p></div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3.5">
              <UserMinus className="h-5 w-5 text-muted-foreground" />
              <div><p className="font-display text-[22px] font-semibold leading-none tabular-nums text-foreground">{fmtCount(mv.departures ?? 0)}</p><p className="mt-1 text-[13px] text-muted-foreground">Left</p></div>
            </div>
          </div>
        </Card>
      )}

      {base.pages.length > 1 && (
        <Card title={`Combined company pages (${base.pages.length})`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {base.pages.map((p) => (
              <li key={p.company_id} className="flex items-center gap-2">
                <LinkedInBadge href={p.linkedin_url} size={16} label={`${p.name} company page`} />
                <span className="truncate text-[13px] text-muted-foreground" title={p.name}>{p.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
