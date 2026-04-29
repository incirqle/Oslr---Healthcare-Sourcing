import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Download,
  Info,
  Search as SearchIcon,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AnalyticsLayout } from "@/components/analytics/AnalyticsLayout";
import { MultiSelect } from "@/components/analytics/MultiSelect";
import { RateKpiStrip, fmtRate } from "@/components/analytics/RateKpiStrip";
import {
  ANALYTICS_INBOXES,
  ANALYTICS_PROJECTS,
  ANALYTICS_USERS,
  DATE_PRESETS,
  buildEngagementRatesOverTime,
  getOutreachFunnel,
  getLeaderboard,
  getOutreachKpis,
  type DateRangePreset,
  type GroupBy,
  type LeaderboardRow,
} from "@/data/mock-analytics";
import { MOCK_CAMPAIGNS } from "@/data/mock-campaigns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PURPLE = "#8B5CF6";
const SERIES = {
  open: "#8B5CF6",
  click: "#10B981",
  reply: "#3B82F6",
  bounce: "#EF4444",
};

type SortKey = keyof LeaderboardRow;
type LeaderboardTab = "active" | "closed" | "all";

export default function AnalyticsOutreach() {
  const navigate = useNavigate();
  const [campaignSel, setCampaignSel] = useState<string[]>([]);
  const [projectSel, setProjectSel] = useState<string[]>([]);
  const [userSel, setUserSel] = useState<string[]>([]);
  const [inboxSel, setInboxSel] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("1y");
  const [group, setGroup] = useState<GroupBy>("Months");

  const [tableTab, setTableTab] = useState<LeaderboardTab>("active");
  const [tableSearch, setTableSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "createdAt",
    dir: "desc",
  });

  const days = DATE_PRESETS.find((p) => p.value === datePreset)?.days ?? 365;
  const kpis = useMemo(() => getOutreachKpis(), []);

  const ratesData = useMemo(
    () => buildEngagementRatesOverTime(days, group),
    [days, group]
  );
  const funnelData = useMemo(() => getOutreachFunnel(), []);
  const funnelMax = Math.max(...funnelData.map((s) => s.count), 1);

  const leaderboard = useMemo(() => getLeaderboard(), []);
  const visible = useMemo(() => {
    let rows = leaderboard;
    if (tableTab !== "all") rows = rows.filter((r) => r.status === tableTab);
    if (tableSearch.trim()) {
      const q = tableSearch.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.owner.toLowerCase().includes(q) ||
          r.inboxEmail.toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [leaderboard, tableTab, tableSearch, sort]);

  const exportCsv = () => {
    const headers = [
      "Campaign",
      "Status",
      "Owner",
      "Inbox",
      "Runs",
      "Steps",
      "Emails",
      "Opened",
      "Clicked",
      "Replied",
      "Interested",
      "Created",
    ];
    const rows = visible.map((r) =>
      [
        r.name,
        r.status,
        r.owner,
        r.inboxEmail,
        r.runs,
        r.steps,
        r.emails,
        r.opened,
        r.clicked,
        r.replied,
        r.interested,
        new Date(r.createdAt).toISOString().slice(0, 10),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach-${tableTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }
    );
  };

  return (
    <AnalyticsLayout title="Outreach" crumb="Outreach">
      {/* Filter row */}
      <div className="sticky top-[49px] z-10 -mx-6 px-6 py-3 mb-5 bg-background border-b border-border flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <MultiSelect
            label="Campaign"
            options={leaderboard.map((c) => ({ value: c.id, label: c.name }))}
            value={campaignSel}
            onChange={setCampaignSel}
            allLabel="All campaigns"
          />
          <MultiSelect
            label="Project"
            options={ANALYTICS_PROJECTS.map((p) => ({ value: p.id, label: p.name }))}
            value={projectSel}
            onChange={setProjectSel}
            allLabel="All projects"
          />
          <MultiSelect
            label="Started by"
            options={ANALYTICS_USERS.map((u) => ({ value: u, label: u }))}
            value={userSel}
            onChange={setUserSel}
            allLabel="All users"
          />
          <MultiSelect
            label="Inboxes"
            options={ANALYTICS_INBOXES.map((i) => ({ value: i.email, label: i.display }))}
            value={inboxSel}
            onChange={setInboxSel}
            allLabel="All inboxes"
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
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
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground font-medium">Grouped by</label>
            <Select value={group} onValueChange={(v) => setGroup(v as GroupBy)}>
              <SelectTrigger className="h-9 w-[120px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Days">Days</SelectItem>
                <SelectItem value="Weeks">Weeks</SelectItem>
                <SelectItem value="Months">Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <RateKpiStrip
        cards={[
          { label: "Total Runs", value: kpis.totalRuns.toLocaleString() },
          {
            label: "Open Rate",
            value: fmtRate(kpis.opens.num, kpis.opens.den),
            raw: `(${kpis.opens.num}/${kpis.opens.den})`,
          },
          {
            label: "Click Rate",
            value: fmtRate(kpis.clicks.num, kpis.clicks.den),
            raw: `(${kpis.clicks.num}/${kpis.clicks.den})`,
          },
          {
            label: "Reply Rate",
            value: fmtRate(kpis.replies.num, kpis.replies.den),
            raw: `(${kpis.replies.num}/${kpis.replies.den})`,
          },
          {
            label: "Interest Rate",
            value: fmtRate(kpis.interested.num, kpis.interested.den),
            raw: `(${kpis.interested.num}/${kpis.interested.den})`,
          },
          {
            label: "Bounce Rate",
            value: fmtRate(kpis.bounces.num, kpis.bounces.den),
            raw: `(${kpis.bounces.num}/${kpis.bounces.den})`,
          },
        ]}
      />

      {/* Two charts: engagement rates over time + outreach funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Engagement rates over time</h3>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap justify-end">
                <LegendDot color={SERIES.open} label="Open Rate" />
                <LegendDot color={SERIES.click} label="Click Rate" />
                <LegendDot color={SERIES.reply} label="Reply Rate" />
                <LegendDot color={SERIES.bounce} label="Bounce Rate" />
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratesData} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => `${v.toFixed(2)}%`}
                  />
                  <Line type="monotone" dataKey="openRate" stroke={SERIES.open} strokeWidth={2} dot={false} name="Open Rate" />
                  <Line type="monotone" dataKey="clickRate" stroke={SERIES.click} strokeWidth={2} dot={false} name="Click Rate" />
                  <Line type="monotone" dataKey="replyRate" stroke={SERIES.reply} strokeWidth={2} dot={false} name="Reply Rate" />
                  <Line type="monotone" dataKey="bounceRate" stroke={SERIES.bounce} strokeWidth={2} dot={false} name="Bounce Rate" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Outreach funnel</h3>
              <span className="text-[11px] text-muted-foreground">All time</span>
            </div>
            <div className="space-y-2.5">
              {funnelData.map((s, i) => {
                const widthPct = (s.count / funnelMax) * 100;
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-foreground">{s.label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.count.toLocaleString()}
                        {i > 0 && (
                          <span className="ml-2 text-[11px]">
                            {s.pctOfPrev.toFixed(1)}% of prev
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-7 rounded-md bg-secondary/40 overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width: `${Math.max(widthPct, 2)}%`,
                          background: PURPLE,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card className="rounded-xl shadow-sm mt-5">
        <CardContent className="p-0">
          <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
            <Tabs value={tableTab} onValueChange={(v) => setTableTab(v as LeaderboardTab)}>
              <TabsList className="h-8">
                <TabsTrigger value="active" className="text-xs h-7">
                  Active
                </TabsTrigger>
                <TabsTrigger value="closed" className="text-xs h-7">
                  Closed
                </TabsTrigger>
                <TabsTrigger value="all" className="text-xs h-7">
                  All
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Search campaigns..."
                  className="pl-8 h-8 text-sm w-[220px]"
                />
              </div>
              <Button variant="outline" size="sm" className="h-8" onClick={exportCsv}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                <SortHead label="Campaign Name" k="name" sort={sort} onSort={toggleSort} />
                <SortHead label="Owner" k="owner" sort={sort} onSort={toggleSort} />
                <TableHead className="text-xs font-medium">Inbox</TableHead>
                <SortHead
                  label="Runs"
                  k="runs"
                  sort={sort}
                  onSort={toggleSort}
                  info="Total contacts enrolled in this campaign"
                  align="center"
                />
                <SortHead label="Steps" k="steps" sort={sort} onSort={toggleSort} align="center" />
                <SortHead
                  label="Emails"
                  k="emails"
                  sort={sort}
                  onSort={toggleSort}
                  info="Total emails sent across all steps"
                  align="center"
                />
                <SortHead label="Opened" k="opened" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Clicked" k="clicked" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Replied" k="replied" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Interested" k="interested" sort={sort} onSort={toggleSort} align="center" />
                <SortHead label="Created" k="createdAt" sort={sort} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12 text-sm text-muted-foreground">
                    No campaigns match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => {
                  const isMock = MOCK_CAMPAIGNS.some((m) => m.id === r.id);
                  return (
                    <TableRow
                      key={r.id}
                      className={cn("text-sm", isMock && "cursor-pointer hover:bg-secondary/30")}
                      onClick={() => isMock && navigate(`/campaigns/${r.id}`)}
                    >
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              r.status === "active"
                                ? "bg-success"
                                : r.status === "closed"
                                ? "bg-muted-foreground/40"
                                : "bg-warning"
                            )}
                          />
                          <span className="font-medium truncate max-w-[220px]">{r.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.owner}</TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium">{r.inboxDisplay}</span>
                          <span className="text-[10px] text-muted-foreground">{r.inboxEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.runs}</TableCell>
                      <TableCell className="text-center text-xs">{r.steps}</TableCell>
                      <TableCell className="text-center text-xs font-medium">{r.emails}</TableCell>
                      <TableCell className="text-center text-xs">{r.opened}</TableCell>
                      <TableCell className="text-center text-xs">{r.clicked}</TableCell>
                      <TableCell className="text-center text-xs">{r.replied}</TableCell>
                      <TableCell className="text-center text-xs">{r.interested}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AnalyticsLayout>
  );
}

function SortHead({
  label,
  k,
  sort,
  onSort,
  info,
  align,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  info?: string;
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
        {info && (
          <TooltipProvider>
            <UITooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-[200px]">{info}</TooltipContent>
            </UITooltip>
          </TooltipProvider>
        )}
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
