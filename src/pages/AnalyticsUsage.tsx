import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
  ANALYTICS_USERS,
  DATE_PRESETS,
  buildActivityByType,
  buildActivityOverTime,
  buildTopUsers,
  buildUsagePivot,
  type DateRangePreset,
  type GroupBy,
} from "@/data/mock-analytics";

const PURPLE = "#8B5CF6";
const RED = "#EF4444";
const GREEN = "hsl(var(--primary))";
const BLUE = "#3B82F6";

export default function AnalyticsUsage() {
  const [userSel, setUserSel] = useState<string[]>([]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>("1y");
  const [group, setGroup] = useState<GroupBy>("Months");

  const days = DATE_PRESETS.find((p) => p.value === datePreset)?.days ?? 365;

  const activity = useMemo(() => buildActivityOverTime(days, group), [days, group]);
  const topUsers = useMemo(() => buildTopUsers(), []);
  const byType = useMemo(() => buildActivityByType(days, group), [days, group]);
  const pivot = useMemo(() => buildUsagePivot(days), [days]);

  const tooltipStyle = {
    background: "hsl(var(--background))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  };

  return (
    <AnalyticsLayout title="Usage" crumb="Usage">
      {/* Filter row */}
      <div className="sticky top-[49px] z-10 -mx-6 px-6 py-3 mb-5 bg-background border-b border-border flex flex-wrap items-end gap-3">
        <MultiSelect
          label="Started by"
          options={ANALYTICS_USERS.map((u) => ({ value: u, label: u }))}
          value={userSel}
          onChange={setUserSel}
          allLabel="All users"
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

      {/* 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity over time — stacked bars */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Activity over time</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activity} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="searches" stackId="a" fill={PURPLE} name="Searches run" />
                  <Bar dataKey="reveals" stackId="a" fill={GREEN} name="Contacts revealed" />
                  <Bar dataKey="campaigns" stackId="a" fill={RED} name="Campaigns sent" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top users — horizontal bars */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Top users this period</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topUsers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    width={130}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="activity" fill={PURPLE} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity by type — multi-line */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Activity by type</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byType} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="searches" stroke={PURPLE} strokeWidth={2} dot={false} name="Searches" />
                  <Line type="monotone" dataKey="reveals" stroke={GREEN} strokeWidth={2} dot={false} name="Contacts revealed" />
                  <Line type="monotone" dataKey="campaigns" stroke={RED} strokeWidth={2} dot={false} name="Campaigns sent" />
                  <Line type="monotone" dataKey="replies" stroke={BLUE} strokeWidth={2} dot={false} name="Replies received" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pivot table */}
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Activity by user</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                    <TableHead className="text-xs font-medium">User</TableHead>
                    {pivot.months.map((m) => (
                      <TableHead key={m.label} className="text-xs font-medium text-center">
                        {m.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-xs font-medium text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivot.rows.map((r) => (
                    <TableRow key={r.user} className="text-xs">
                      <TableCell className="py-2 font-medium">{r.user}</TableCell>
                      {r.cells.map((c, i) => (
                        <TableCell key={i} className="text-center py-2 text-muted-foreground">
                          {c}
                        </TableCell>
                      ))}
                      <TableCell className="text-center py-2 font-semibold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-secondary/30 hover:bg-secondary/30 text-xs font-semibold">
                    <TableCell className="py-2">Total</TableCell>
                    {pivot.totals.map((t, i) => (
                      <TableCell key={i} className="text-center py-2">
                        {t}
                      </TableCell>
                    ))}
                    <TableCell className="text-center py-2">{pivot.grandTotal}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AnalyticsLayout>
  );
}
