import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { MultiSelect } from "@/components/analytics/MultiSelect";
import {
  ANALYTICS_PROJECTS,
  ANALYTICS_USERS,
  DATE_PRESETS,
  getFunnelRows,
  type DateRangePreset,
  type FunnelRow,
} from "@/data/mock-analytics";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";

type SortKey =
  | "name"
  | "newCount"
  | "contacted"
  | "interested"
  | "hired"
  | "rate1"
  | "rate2"
  | "rate3";

export default function AnalyticsProjects() {
  const [projectSel, setProjectSel] = useState<string[]>([]);
  const [ownerSel, setOwnerSel] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("1y");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "newCount",
    dir: "desc",
  });

  const rows = useMemo(() => getFunnelRows(12), []);

  const visible = useMemo(() => {
    let r = rows;
    if (projectSel.length) r = r.filter((row) => projectSel.includes(row.id));
    if (ownerSel.length) r = r.filter((row) => ownerSel.includes(row.owner));

    const withRates = r.map((row) => ({
      ...row,
      rate1: row.newCount ? row.contacted / row.newCount : 0,
      rate2: row.contacted ? row.interested / row.contacted : 0,
      rate3: row.interested ? row.hired / row.interested : 0,
    }));

    return withRates.sort((a, b) => {
      const av = a[sort.key as keyof typeof a];
      const bv = b[sort.key as keyof typeof b];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, projectSel, ownerSel, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  return (
    <AnalyticsLayout title="Projects" crumb="Projects">
      {/* Filter row */}
      <div className="sticky top-[49px] z-10 -mx-6 px-6 py-3 mb-5 bg-background border-b border-border flex flex-wrap items-end gap-3">
        <MultiSelect
          label="Project"
          options={ANALYTICS_PROJECTS.map((p) => ({ value: p.id, label: p.name }))}
          value={projectSel}
          onChange={setProjectSel}
          allLabel="All projects"
        />
        <MultiSelect
          label="Owner"
          options={ANALYTICS_USERS.map((u) => ({ value: u, label: u }))}
          value={ownerSel}
          onChange={setOwnerSel}
          allLabel="All owners"
        />
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground font-medium">Date range</label>
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DateRangePreset)}>
            <SelectTrigger className="h-9 w-[160px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Funnel table */}
      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                <SortHead label="Project Name" k="name" sort={sort} onSort={toggleSort} />
                <SortHead label="New" k="newCount" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Contacted" k="contacted" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Interested" k="interested" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Hired" k="hired" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="New → Contacted" k="rate1" sort={sort} onSort={toggleSort} />
                <SortHead label="Contacted → Interested" k="rate2" sort={sort} onSort={toggleSort} />
                <SortHead label="Interested → Hired" k="rate3" sort={sort} onSort={toggleSort} />
                <TableHead className="text-xs font-medium">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                    No projects match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => (
                  <TableRow key={r.id} className="text-sm">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                          <FolderKanban className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="font-medium truncate max-w-[240px]">{r.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs font-semibold">{r.newCount}</TableCell>
                    <TableCell className="text-center text-xs">{r.contacted}</TableCell>
                    <TableCell className="text-center text-xs">{r.interested}</TableCell>
                    <TableCell className="text-center text-xs">{r.hired}</TableCell>
                    <RateCell value={r.rate1} />
                    <RateCell value={r.rate2} />
                    <RateCell value={r.rate3} />
                    <TableCell className="py-3">
                      <Sparkline data={r.trend} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AnalyticsLayout>
  );
}

function RateCell({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <TableCell className="py-3">
      <div className="flex items-center gap-2">
        <div className="h-1.5 bg-secondary rounded-full flex-1 max-w-[80px] overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
      </div>
    </TableCell>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const series = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series}>
          <Line
            type="monotone"
            dataKey="v"
            stroke="hsl(var(--primary))"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SortHead({
  label,
  k,
  sort,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  align?: "center" | "left";
}) {
  const active = sort.key === k;
  return (
    <TableHead className={cn("text-xs font-medium", align === "center" && "text-center")}>
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
          align === "center" && "justify-center"
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}
