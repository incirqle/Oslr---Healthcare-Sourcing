import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search as SearchIcon,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  Trash2,
  BarChart3,
} from "lucide-react";
import { KpiStrip } from "@/components/campaigns/KpiStrip";
import { ScheduleChart } from "@/components/campaigns/ScheduleChart";
import { NewCampaignModal } from "@/components/campaigns/NewCampaignModal";
import { MOCK_CAMPAIGNS, aggregateKpis } from "@/data/mock-campaigns";
import { toast } from "sonner";

function pct(num: number, den: number): string {
  if (!den) return "0%";
  return `${Math.round((num / den) * 100)}%`;
}

function statusDot(status: string) {
  const map: Record<string, string> = {
    active: "bg-success",
    draft: "bg-muted-foreground",
    paused: "bg-warning",
    archived: "bg-muted-foreground/40",
  };
  return map[status] ?? "bg-muted-foreground";
}

export default function CampaignsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("all");
  const [period, setPeriod] = useState("30");
  const [showArchived, setShowArchived] = useState(false);
  const [newOpen, setNewOpen] = useState(false);

  const owners = useMemo(
    () => Array.from(new Set(MOCK_CAMPAIGNS.map((c) => c.ownerName))),
    []
  );

  const visible = useMemo(() => {
    return MOCK_CAMPAIGNS.filter((c) => {
      if (!showArchived && c.status === "archived") return false;
      if (owner !== "all" && c.ownerName !== owner) return false;
      if (search.trim() && !c.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [search, owner, showArchived]);

  const agg = aggregateKpis(visible);

  // Mock prior-period deltas
  const kpiCards = [
    { label: "Total", value: agg.total, delta: 12.4 },
    { label: "Active", value: agg.active, delta: 8.1 },
    { label: "Opened", value: agg.opened, delta: -3.2 },
    { label: "Clicked", value: agg.clicked, delta: 5.6 },
    { label: "Replied", value: agg.replied, delta: 14.0 },
    { label: "Interested", value: agg.interested, delta: -1.8 },
  ];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Overview header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Overview</h1>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-[150px] text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => navigate("/analytics/outreach")}>
              <BarChart3 className="h-4 w-4 mr-2" />
              View analytics
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New campaign
            </Button>
          </div>
        </div>

        <KpiStrip cards={kpiCards} />

        <ScheduleChart />

        {/* Campaigns table */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-2 p-3 border-b border-border">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative max-w-xs flex-1">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search for a campaign"
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Select value={owner} onValueChange={setOwner}>
                  <SelectTrigger className="h-9 w-[160px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    {owners.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead className="font-medium">Campaign</TableHead>
                  <TableHead className="font-medium text-center">Total</TableHead>
                  <TableHead className="font-medium text-center">Active</TableHead>
                  <TableHead className="font-medium text-center">Opened</TableHead>
                  <TableHead className="font-medium text-center">Clicked</TableHead>
                  <TableHead className="font-medium text-center">Replied</TableHead>
                  <TableHead className="font-medium text-center">Interested</TableHead>
                  <TableHead className="font-medium text-center">Bounced</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-sm text-muted-foreground">
                      No campaigns match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  visible.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-secondary/30 group"
                      onClick={() => navigate(`/campaigns/${c.id}`)}
                    >
                      <TableCell className="py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-sm flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${statusDot(c.status)}`} />
                            {c.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Avatar className="h-4 w-4">
                              <AvatarFallback className="text-[8px] bg-secondary">
                                {c.ownerName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {c.ownerName} on{" "}
                            {new Date(c.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            · {c.steps.length} steps
                          </span>
                        </div>
                      </TableCell>
                      <Stat value={c.total} pct="100%" />
                      <Stat value={c.active} pct={pct(c.active, c.total)} />
                      <Stat value={c.opened} pct={pct(c.opened, c.total)} />
                      <Stat value={c.clicked} pct={pct(c.clicked, c.total)} />
                      <Stat value={c.replied} pct={pct(c.replied, c.total)} />
                      <Stat value={c.interested} pct={pct(c.interested, c.total)} />
                      <Stat value={c.bounced} pct={pct(c.bounced, c.total)} />
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 transition">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/campaigns/${c.id}?step=edit`)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success("Duplicated — stub")}>
                              <Copy className="h-3.5 w-3.5 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.success("Archived — stub")}>
                              <Archive className="h-3.5 w-3.5 mr-2" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => toast.info("Delete — stub")}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <NewCampaignModal open={newOpen} onOpenChange={setNewOpen} />
    </AppLayout>
  );
}

function Stat({ value, pct }: { value: number; pct: string }) {
  return (
    <TableCell className="text-center">
      <div className="text-sm font-semibold">{value.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground">{pct}</div>
    </TableCell>
  );
}
