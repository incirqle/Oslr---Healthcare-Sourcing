import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  ExternalLink,
  Globe,
  MapPin,
  Star,
  TrendingDown,
  TrendingUp,
  Users,


} from "lucide-react";
import {
  useCompanyEnrichment,
  type CompanyIntel,
  type HeadcountTimeseriesPoint,
} from "@/hooks/useCompanyEnrichment";
import { TalentFlowTab } from "./company-intel/TalentFlowTab";
import { normalizeDomain, resolveCompanyDomain } from "@/lib/company-domains";
import { cn } from "@/lib/utils";

interface CompanyIntelModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyName: string | null | undefined;
  domain?: string | null;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                           */
/* ------------------------------------------------------------------ */

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(Math.abs(n) >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function formatGrowth(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatAbsGrowth(n: number | null | undefined): string | null {
  if (n === null || n === undefined || Number.isNaN(n)) return null;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString()}`;
}

function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}

/* ------------------------------------------------------------------ */
/* Logo                                                                 */
/* ------------------------------------------------------------------ */

function CompanyLogo({
  name,
  domain,
  logoUrl,
  size = 72,
}: {
  name: string;
  domain: string | null;
  logoUrl?: string | null;
  size?: number;
}) {
  const sources = useMemo(() => {
    const list: string[] = [];
    if (logoUrl) list.push(logoUrl);
    if (domain) {
      list.push(`https://logo.clearbit.com/${domain}`);
      list.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    }
    return list;
  }, [logoUrl, domain]);
  const [idx, setIdx] = useState(0);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const src = sources[idx];
  if (!src) {
    return (
      <div
        style={{ width: size, height: size, fontSize: size * 0.38 }}
        className="flex shrink-0 items-center justify-center rounded-2xl border border-ui-border-light/60 bg-primary/10 font-semibold text-primary shadow-sm"
      >
        {initial}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={`${name} logo`}
      width={size}
      height={size}
      onError={() => setIdx((i) => i + 1)}
      className="shrink-0 rounded-2xl border border-ui-border-light/60 bg-white object-contain p-2 shadow-sm"
      style={{ width: size, height: size }}
    />
  );
}


/* ------------------------------------------------------------------ */
/* KPI card                                                             */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon,
  label,
  value,
  delta,
  deltaTone = "neutral",
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  deltaTone?: "positive" | "negative" | "neutral";
  hint?: React.ReactNode;
}) {
  const toneClass =
    deltaTone === "positive"
      ? "text-primary"
      : deltaTone === "negative"
        ? "text-destructive"
        : "text-ui-text-muted";
  return (
    <div className="rounded-xl border border-ui-border-light bg-ui-surface-subtle p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ui-text-muted">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-[22px] font-semibold tracking-tight text-ui-text-primary">
        {value}
      </p>
      {delta !== undefined && (
        <p className={cn("mt-0.5 text-[12px] font-medium", toneClass)}>{delta}</p>
      )}
      {hint && <p className="mt-0.5 text-[11px] text-ui-text-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section card                                                         */
/* ------------------------------------------------------------------ */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ui-border-light bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
          {title}
        </p>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Charts                                                               */
/* ------------------------------------------------------------------ */

const RANGE_MONTHS: Record<string, number | null> = {
  "3M": 3,
  "1Y": 12,
  "5Y": 60,
  All: null,
};

function filterTimeseries(
  ts: HeadcountTimeseriesPoint[],
  months: number | null,
): HeadcountTimeseriesPoint[] {
  if (!ts?.length) return [];
  if (months === null) return ts;
  const cutoff = Date.now() - months * 30 * 86_400_000;
  return ts.filter((p) => new Date(p.date).getTime() >= cutoff);
}

function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function HeadcountChart({ data }: { data: HeadcountTimeseriesPoint[] }) {
  const [range, setRange] = useState<keyof typeof RANGE_MONTHS>("1Y");
  const filtered = useMemo(
    () => filterTimeseries(data, RANGE_MONTHS[range]),
    [data, range],
  );

  const summary = useMemo(() => {
    if (!filtered.length) return null;
    const first = filtered[0];
    const last = filtered[filtered.length - 1];
    const counts = filtered.map((p) => p.employee_count);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const delta = last.employee_count - first.employee_count;
    const pct =
      first.employee_count > 0 ? (delta / first.employee_count) * 100 : 0;
    return { first, last, min, max, delta, pct };
  }, [filtered]);

  // 4 evenly-spaced ticks across the range, always including first + last
  const xTicks = useMemo(() => {
    if (filtered.length <= 1) return filtered.map((p) => p.date);
    const n = Math.min(4, filtered.length);
    const step = (filtered.length - 1) / (n - 1);
    return Array.from(
      new Set(
        Array.from({ length: n }, (_, i) =>
          filtered[Math.round(i * step)].date,
        ),
      ),
    );
  }, [filtered]);

  return (
    <Section
      title="Headcount over time"
      action={
        <div className="flex items-center gap-1 rounded-full border border-ui-border-light bg-ui-surface-subtle p-0.5">
          {(Object.keys(RANGE_MONTHS) as Array<keyof typeof RANGE_MONTHS>).map(
            (r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  range === r
                    ? "bg-white text-ui-text-primary shadow-sm"
                    : "text-ui-text-muted hover:text-ui-text-primary",
                )}
              >
                {r}
              </button>
            ),
          )}
        </div>
      }
    >
      {summary && (
        <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-1">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ui-text-muted">
              Now · {formatMonthYear(summary.last.date)}
            </p>
            <p className="text-[26px] font-semibold leading-tight tracking-tight text-ui-text-primary tabular-nums">
              {summary.last.employee_count.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-ui-text-muted">
              vs {formatMonthYear(summary.first.date)}
            </p>
            <p
              className={cn(
                "text-[16px] font-semibold tabular-nums",
                summary.delta >= 0 ? "text-primary" : "text-destructive",
              )}
            >
              {summary.delta >= 0 ? "+" : ""}
              {summary.delta.toLocaleString()}
              <span className="ml-1.5 text-[12px] font-medium">
                ({summary.delta >= 0 ? "+" : ""}
                {summary.pct.toFixed(1)}%)
              </span>
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[11px] uppercase tracking-wide text-ui-text-muted">
              Range
            </p>
            <p className="text-[12px] text-ui-text-secondary tabular-nums">
              {summary.min.toLocaleString()} – {summary.max.toLocaleString()}
            </p>
          </div>
        </div>
      )}
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={filtered} margin={{ top: 16, right: 64, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="hcGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--ui-border-light))" vertical={false} />
            <XAxis
              dataKey="date"
              ticks={xTicks}
              tickFormatter={(d) => formatMonthYear(d as string)}
              tick={{ fontSize: 11, fill: "hsl(var(--ui-text-muted))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--ui-text-muted))" }}
              tickFormatter={(v) => formatNumber(v)}
              axisLine={false}
              tickLine={false}
              width={42}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--ui-border-light))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(d) => formatMonthYear(d as string)}
              formatter={(v: number) => [v.toLocaleString(), "Employees"]}
            />
            <Area
              type="monotone"
              dataKey="employee_count"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              fill="url(#hcGrad)"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Section>
  );
}

const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.75)",
  "hsl(var(--primary) / 0.55)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.28)",
  "hsl(var(--ui-border-medium))",
];

function DepartmentDonut({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const top = entries.slice(0, 5);
  const restPct = entries.slice(5).reduce((s, [, v]) => s + v, 0);
  const slices = [
    ...top.map(([name, value]) => ({ name: titleCase(name), value })),
    ...(restPct > 0.5 ? [{ name: "Other", value: restPct }] : []),
  ];
  const leader = slices[0];
  return (
    <Section title="Department breakdown">
      <div className="flex items-center gap-4">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={48}
                outerRadius={76}
                paddingAngle={2}
                strokeWidth={0}
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number) => `${v.toFixed(1)}%`}
                contentStyle={{
                  background: "hsl(var(--background))",
                  border: "1px solid hsl(var(--ui-border-light))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {leader && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[18px] font-semibold leading-none text-ui-text-primary tabular-nums">
                {leader.value.toFixed(0)}%
              </p>
              <p className="mt-1 max-w-[90px] truncate text-center text-[10px] uppercase tracking-wide text-ui-text-muted">
                {leader.name}
              </p>
            </div>
          )}
        </div>
        <ul className="flex-1 space-y-1.5">
          {slices.map((s, i) => (
            <li
              key={s.name}
              className="flex items-center justify-between text-[12px]"
            >
              <span className="flex items-center gap-2 text-ui-text-secondary">
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }}
                />
                {s.name}
              </span>
              <span className="font-medium text-ui-text-primary tabular-nums">
                {s.value.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function DepartmentGrowth({
  yoy,
  sixMo,
  title = "Department growth",
}: {
  yoy?: Record<string, number> | null;
  sixMo?: Record<string, number> | null;
  title?: string;
}) {
  const source = yoy ?? sixMo ?? {};
  const entries = Object.entries(source)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);
  if (!entries.length) return null;
  const maxAbs = Math.max(...entries.map(([, v]) => Math.abs(v)), 1);
  return (
    <Section title={title}>
      <ul className="space-y-2.5">
        {entries.map(([dept, pct]) => {
          const positive = pct >= 0;
          const width = (Math.abs(pct) / maxAbs) * 100;
          const sixMoVal = sixMo?.[dept];
          return (
            <li key={dept}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ui-text-secondary">{titleCase(dept)}</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    positive ? "text-primary" : "text-destructive",
                  )}
                >
                  {formatGrowth(pct)}
                  {sixMoVal !== undefined && (
                    <span className="ml-2 text-[11px] font-normal text-ui-text-muted">
                      {formatGrowth(sixMoVal)} 6mo
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ui-surface-subtle">
                <div
                  className={cn(
                    "h-full rounded-full",
                    positive ? "bg-primary" : "bg-destructive",
                  )}
                  style={{ width: `${Math.max(2, width)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function RegionDistribution({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const top = entries.slice(0, 8);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const max = top[0]?.[1] ?? 1;
  if (!top.length) return null;
  return (
    <Section title="Location distribution">
      <ul className="space-y-2">
        {top.map(([region, count]) => {
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <li key={region} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-[12px] text-ui-text-secondary">
                {titleCase(region)}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-ui-surface-subtle">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-[12px] font-medium tabular-nums text-ui-text-primary">
                {formatNumber(count)}
              </span>
              <span className="w-10 shrink-0 text-right text-[11px] text-ui-text-muted">
                {pct.toFixed(0)}%
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function FunctionTimeseriesChart({
  data,
}: {
  data: Record<string, HeadcountTimeseriesPoint[]>;
}) {
  const RANGES = { "6mo": 6, "1Y": 12, "2Y": 24 } as const;
  const [range, setRange] = useState<keyof typeof RANGES>("1Y");
  const months = RANGES[range];

  const COLORS = [
    "hsl(var(--primary))",
    "#7c5cff",
    "#22c55e",
    "#f59e0b",
    "#ef4444",
  ];

  // Per-department filtered series + summary
  const rows = useMemo(() => {
    const cutoff = Date.now() - months * 30 * 86_400_000;
    return Object.entries(data)
      .map(([dept, series]) => {
        const filtered = (series ?? []).filter(
          (p) => new Date(p.date).getTime() >= cutoff,
        );
        const latest = filtered[filtered.length - 1]?.employee_count ?? 0;
        const first = filtered[0]?.employee_count ?? 0;
        const delta = latest - first;
        const pct = first > 0 ? (delta / first) * 100 : 0;
        return { dept, filtered, latest, first, delta, pct };
      })
      .sort((a, b) => b.latest - a.latest)
      .slice(0, 5);
  }, [data, months]);

  return (
    <Section
      title="Headcount by department"
      action={
        <div className="flex items-center gap-1 rounded-full border border-ui-border-light bg-ui-surface-subtle p-0.5">
          {(Object.keys(RANGES) as Array<keyof typeof RANGES>).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                range === r
                  ? "bg-white text-ui-text-primary shadow-sm"
                  : "text-ui-text-muted hover:text-ui-text-primary",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      }
    >
      <ul className="divide-y divide-ui-border-light">
        {rows.map((row, i) => {
          const color = COLORS[i % COLORS.length];
          const positive = row.delta >= 0;
          return (
            <li
              key={row.dept}
              className="grid grid-cols-[1fr_120px_auto] items-center gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ui-text-primary">
                    {titleCase(row.dept)}
                  </p>
                  <p
                    className={cn(
                      "text-[11px] tabular-nums",
                      positive ? "text-primary" : "text-destructive",
                    )}
                  >
                    {positive ? "+" : ""}
                    {row.delta.toLocaleString()} ({positive ? "+" : ""}
                    {row.pct.toFixed(1)}%)
                  </p>
                </div>
              </div>
              <div className="h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={row.filtered}
                    margin={{ top: 2, right: 0, left: 0, bottom: 2 }}
                  >
                    <defs>
                      <linearGradient
                        id={`spark-${i}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="employee_count"
                      stroke={color}
                      strokeWidth={1.75}
                      fill={`url(#spark-${i})`}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="w-20 text-right text-[15px] font-semibold tabular-nums text-ui-text-primary">
                {row.latest.toLocaleString()}
              </p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}


/* ------------------------------------------------------------------ */
/* Modal                                                                */
/* ------------------------------------------------------------------ */

export function CompanyIntelModal({
  open,
  onOpenChange,
  companyName,
  domain,
}: CompanyIntelModalProps) {
  const seedDomain = useMemo(
    () => normalizeDomain(domain) ?? resolveCompanyDomain(companyName),
    [domain, companyName],
  );

  const { data, loading } = useCompanyEnrichment(
    open ? companyName ?? null : null,
    open ? seedDomain : null,
  );

  const [showAllJobs, setShowAllJobs] = useState(false);

  const resolvedDomain = useMemo(
    () => normalizeDomain(data?.company_website_domain) ?? seedDomain ?? null,
    [data?.company_website_domain, seedDomain],
  );

  if (!companyName) return null;
  const displayName = data?.company_name ?? companyName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[64rem] gap-0 overflow-hidden border border-ui-border-light bg-white p-0 shadow-2xl sm:rounded-2xl max-h-[92vh] !grid-cols-none !grid-rows-none !flex !flex-col">
        <Header
          data={data}
          displayName={displayName}
          resolvedDomain={resolvedDomain}
          onClose={() => onOpenChange(false)}
        />

        {loading ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Loading />
          </div>
        ) : !data ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <Empty name={displayName} />
          </div>
        ) : (
          <Tabs defaultValue="insights" className="flex flex-1 min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-ui-border-light px-6">
              <TabsList className="h-11 bg-transparent p-0">
                <TabsTrigger
                  value="insights"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[13px] font-medium text-ui-text-secondary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-ui-text-primary data-[state=active]:shadow-none"
                >
                  Company insights
                </TabsTrigger>
                <TabsTrigger
                  value="hiring"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[13px] font-medium text-ui-text-secondary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-ui-text-primary data-[state=active]:shadow-none"
                >
                  Hiring activity
                  {data.jobs_total > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      {data.jobs_total}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="talent"
                  className="rounded-none border-b-2 border-transparent bg-transparent px-3 py-2.5 text-[13px] font-medium text-ui-text-secondary data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-ui-text-primary data-[state=active]:shadow-none"
                >
                  Talent flow
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              <TabsContent value="insights" className="mt-0 space-y-4">
                <InsightsTab data={data} />
              </TabsContent>
              <TabsContent value="hiring" className="mt-0 space-y-4">
                <HiringTab
                  data={data}
                  showAllJobs={showAllJobs}
                  onToggleJobs={() => setShowAllJobs((v) => !v)}
                />
              </TabsContent>
              <TabsContent value="talent" className="mt-0">
                <TalentFlowTab data={data} />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Header / states                                                      */
/* ------------------------------------------------------------------ */

function Header({
  data,
  displayName,
  resolvedDomain,
  onClose,
}: {
  data: CompanyIntel | null;
  displayName: string;
  resolvedDomain: string | null;
  onClose: () => void;
}) {
  const founded = data?.year_founded;
  const hqParts = [data?.hq_city, data?.hq_state, data?.hq_country].filter(
    Boolean,
  );
  return (
    <div className="relative shrink-0 bg-gradient-to-br from-ui-surface-subtle via-white to-ui-surface-subtle px-6 pb-5 pt-6 pr-14">
      <div className="flex items-start gap-4">
        <CompanyLogo
          name={displayName}
          domain={resolvedDomain}
          logoUrl={data?.linkedin_logo_url}
          size={72}
        />

        <div className="mt-1 min-w-0 flex-1">
          <DialogTitle className="text-[22px] font-semibold tracking-tight text-ui-text-primary">
            {displayName}
          </DialogTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ui-text-muted">
            {data?.industry && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {data.industry}
              </span>
            )}
            {hqParts.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {hqParts.join(", ")}
              </span>
            )}
            {founded && <span>Founded {founded}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {resolvedDomain && (
              <a
                href={`https://${resolvedDomain}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ui-border-light bg-white px-2.5 py-1 text-[12px] font-medium text-ui-text-secondary transition-colors hover:border-primary/30 hover:text-primary"
              >
                <Globe className="h-3 w-3" />
                {resolvedDomain}
                <ArrowUpRight className="h-2.5 w-2.5" />
              </a>
            )}
            {data?.linkedin_profile_url && (
              <a
                href={data.linkedin_profile_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-ui-border-light bg-white px-2.5 py-1 text-[12px] font-medium text-[#0A66C2] transition-colors hover:border-[#0A66C2]/30"
              >
                LinkedIn
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
          {data?.description && (
            <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-ui-text-secondary line-clamp-2">
              {data.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-4 px-6 py-6">
      <div className="grid grid-cols-4 gap-3">
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
        <Skeleton className="h-[88px] rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-44 rounded-xl" />
        <Skeleton className="h-44 rounded-xl" />
      </div>
    </div>
  );
}

function Empty({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ui-surface-subtle">
        <Globe className="h-6 w-6 text-ui-text-muted" />
      </div>
      <p className="mt-4 text-[15px] font-medium text-ui-text-primary">
        No public intel found for {name}
      </p>
      <p className="mt-1 max-w-xs text-[13px] text-ui-text-muted">
        We couldn't locate employer data. This company may be too small or not
        publicly listed.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Insights tab                                                         */
/* ------------------------------------------------------------------ */

function InsightsTab({ data }: { data: CompanyIntel }) {
  const hc = data.headcount;
  const yoyPct = hc?.linkedin_headcount_total_growth_percent?.yoy ?? null;
  const yoyAbs = hc?.linkedin_headcount_total_growth_absolute?.yoy ?? null;
  const headcount = hc?.linkedin_headcount ?? null;
  const ts = hc?.linkedin_headcount_timeseries ?? [];
  const roles = hc?.linkedin_headcount_by_role_percent ?? null;
  const rolesYoy = hc?.linkedin_headcount_by_role_yoy_growth_percent ?? null;
  const rolesSixMo = hc?.linkedin_headcount_by_role_six_months_growth_percent ?? null;
  const regions = hc?.linkedin_headcount_by_region_absolute ?? null;
  const skills = hc?.linkedin_headcount_by_skill_percent ?? null;

  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {headcount !== null && (
          <KpiCard
            icon={<Users className="h-3.5 w-3.5" />}
            label="Employees"
            value={formatNumber(headcount)}
            delta={
              formatGrowth(yoyPct) && (
                <>
                  {formatGrowth(yoyPct)}{" "}
                  <span className="font-normal text-ui-text-muted">YoY</span>
                </>
              )
            }
            deltaTone={
              yoyPct === null ? "neutral" : yoyPct >= 0 ? "positive" : "negative"
            }
          />
        )}
        {data.glassdoor?.overall_rating != null && (
          <KpiCard
            icon={<Star className="h-3.5 w-3.5" />}
            label="Glassdoor"
            value={
              <>
                {data.glassdoor.overall_rating.toFixed(1)}
                <span className="ml-1 text-[14px] text-ui-text-muted">★</span>
              </>
            }
            hint={
              data.glassdoor.review_count != null
                ? `${formatNumber(data.glassdoor.review_count)} reviews`
                : null
            }
          />
        )}
        {data.web_traffic?.monthly_visitors != null && (
          <KpiCard
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Visitors / mo"
            value={formatNumber(data.web_traffic.monthly_visitors)}
            delta={
              formatGrowth(data.web_traffic.growth_mom_percent) && (
                <>
                  {formatGrowth(data.web_traffic.growth_mom_percent)}{" "}
                  <span className="font-normal text-ui-text-muted">MoM</span>
                </>
              )
            }
            deltaTone={
              (data.web_traffic.growth_mom_percent ?? 0) >= 0
                ? "positive"
                : "negative"
            }
          />
        )}
        {yoyPct !== null && (
          <KpiCard
            icon={
              yoyPct >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )
            }
            label="YoY growth"
            value={formatGrowth(yoyPct)}
            hint={
              yoyAbs !== null ? `${formatAbsGrowth(yoyAbs)} people` : null
            }
          />
        )}
      </div>

      {/* Headcount timeseries */}
      {ts.length > 1 && <HeadcountChart data={ts} />}

      {/* Department breakdown + growth */}
      {(roles || rolesYoy) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {roles && Object.keys(roles).length > 0 && (
            <DepartmentDonut data={roles} />
          )}
          {(rolesYoy || rolesSixMo) && (
            <DepartmentGrowth yoy={rolesYoy} sixMo={rolesSixMo} />
          )}
        </div>
      )}

      {/* Regions */}
      {regions && Object.keys(regions).length > 0 && (
        <RegionDistribution data={regions} />
      )}

      {/* Skills */}
      {skills && Object.keys(skills).length > 0 && (
        <Section title="Top skills">
          <div className="flex flex-wrap gap-2">
            {Object.entries(skills)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 12)
              .map(([skill, pct]) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ui-border-light bg-ui-surface-subtle px-3 py-1.5 text-[12px] text-ui-text-secondary"
                >
                  <span className="font-medium text-ui-text-primary">
                    {skill}
                  </span>
                  <span className="text-ui-text-muted">{pct.toFixed(1)}%</span>
                </span>
              ))}
          </div>
        </Section>
      )}

      {/* Leadership */}
      {(data.cxos?.length ?? 0) > 0 && (
        <Section title="Leadership">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[...data.cxos]
              .sort((a, b) => {
                const rank = (t: string) => {
                  const s = (t || "").toLowerCase();
                  if (/\bceo\b|chief executive/.test(s)) return 0;
                  if (/president/.test(s)) return 1;
                  if (/\bcoo\b|chief operating/.test(s)) return 2;
                  if (/\bcfo\b|chief financial/.test(s)) return 3;
                  if (/\bcmo\b|chief medical|chief marketing/.test(s)) return 4;
                  if (/\bcto\b|chief technology/.test(s)) return 5;
                  if (/chief/.test(s)) return 6;
                  return 9;
                };
                const r = rank(a.title) - rank(b.title);
                return r !== 0 ? r : a.name.localeCompare(b.name);
              })
              .slice(0, 8)
              .map((p, i) => (
                <li
                  key={`${p.name}-${i}`}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-ui-surface-subtle"
                >
                  {p.profile_picture_url ? (
                    <img
                      src={p.profile_picture_url}
                      alt={p.name}
                      width={32}
                      height={32}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                      className="h-8 w-8 shrink-0 rounded-lg border border-ui-border-light/60 object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[12px] font-semibold text-primary">
                      {p.name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ui-text-primary">
                      {p.name}
                    </p>
                    <p className="truncate text-[12px] text-ui-text-muted">
                      {p.title}
                    </p>
                  </div>
                  {p.linkedin_url && (
                    <a
                      href={p.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-ui-text-muted transition-colors hover:text-[#0A66C2]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </li>
              ))}
          </ul>
        </Section>
      )}

      {/* Competitors */}
      {(data.competitors?.length ?? 0) > 0 && (
        <Section title="Similar companies">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {data.competitors.slice(0, 6).map((c) => {
              const cDomain = normalizeDomain(c.company_website_domain);
              return (
                <li
                  key={c.company_id}
                  className="flex items-center gap-2.5 rounded-lg border border-ui-border-light bg-white p-2.5"
                >
                  <CompanyLogo
                    name={c.company_name}
                    domain={cDomain}
                    logoUrl={c.linkedin_logo_url}
                    size={32}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ui-text-primary">
                      {c.company_name}
                    </p>
                    {c.headcount != null && c.headcount > 0 && (
                      <p className="text-[11px] text-ui-text-muted">
                        {formatNumber(c.headcount)} employees
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Hiring tab                                                           */
/* ------------------------------------------------------------------ */

function HiringTab({
  data,
  showAllJobs,
  onToggleJobs,
}: {
  data: CompanyIntel;
  showAllJobs: boolean;
  onToggleJobs: () => void;
}) {
  const jobs = data.jobs ?? [];
  const visibleJobs = showAllJobs ? jobs : jobs.slice(0, 5);
  const fnTs =
    data.headcount?.linkedin_headcount_by_function_timeseries?.CURRENT_FUNCTION;
  const hasFnTs = fnTs && Object.keys(fnTs).length > 0;
  const rolesYoy = data.headcount?.linkedin_headcount_by_role_yoy_growth_percent;
  const rolesSixMo =
    data.headcount?.linkedin_headcount_by_role_six_months_growth_percent;

  return (
    <>
      <Section
        title={`Open positions${data.jobs_total ? ` · ${data.jobs_total}` : ""}`}
      >
        {jobs.length === 0 ? (
          <p className="py-3 text-[13px] text-ui-text-muted">
            No public job listings found.
          </p>
        ) : (
          <ul className="divide-y divide-ui-border-light">
            {visibleJobs.map((job, i) => (
              <li
                key={`${job.title}-${i}`}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ui-text-primary">
                    {job.title}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ui-text-muted">
                    {job.location_text && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location_text}
                      </span>
                    )}
                    {job.workplace_type && (
                      <span className="capitalize">
                        · {job.workplace_type.toLowerCase()}
                      </span>
                    )}
                    {job.date_added && <span>· Posted {timeAgo(job.date_added)}</span>}
                  </div>
                </div>
                {job.url && (
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ui-border-light bg-white px-2.5 py-1 text-[12px] font-medium text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        {jobs.length > 5 && (
          <button
            onClick={onToggleJobs}
            className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            {showAllJobs ? "Show less" : `Show all ${jobs.length}`}
            <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </Section>

      {hasFnTs && <FunctionTimeseriesChart data={fnTs!} />}

      {(rolesYoy || rolesSixMo) && (
        <DepartmentGrowth
          yoy={rolesYoy}
          sixMo={rolesSixMo}
          title="Growth by department"
        />
      )}

      {!hasFnTs && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ui-surface-subtle">
            <Briefcase className="h-5 w-5 text-ui-text-muted" />
          </div>
          <p className="mt-3 text-[13px] font-medium text-ui-text-primary">
            No hiring data available
          </p>
        </div>
      )}
    </>
  );
}
