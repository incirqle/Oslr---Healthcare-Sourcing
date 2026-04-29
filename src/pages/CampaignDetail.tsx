import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search as SearchIcon,
  Filter,
  Plus,
  Pencil,
  Pause,
  SkipForward,
  Trash2,
  Mail,
  MousePointerClick,
  ChevronRight,
} from "lucide-react";
import { KpiStrip } from "@/components/campaigns/KpiStrip";
import { ScheduleChart } from "@/components/campaigns/ScheduleChart";
import { CampaignBuilder } from "@/components/campaigns/CampaignBuilder";
import { MOCK_CAMPAIGNS, type CampaignContact, type ResponseType } from "@/data/mock-campaigns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RESPONSE_OPTIONS: ResponseType[] = [
  "No response",
  "Replied",
  "Interested",
  "Not interested",
  "Out of office",
  "Wrong person",
];

const STATUS_DOT: Record<string, string> = {
  Active: "bg-success",
  Paused: "bg-warning",
  Completed: "bg-primary",
  Bounced: "bg-destructive",
};

const ENGAGEMENT_COLOR: Record<string, string> = {
  Low: "bg-warning/15 text-warning border-warning/30",
  Med: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  High: "bg-success/15 text-success border-success/30",
};

type SortKey = "fullName" | "step" | "status" | "response" | "engagement" | "addedBy";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("fullName");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const campaign = useMemo(
    () => MOCK_CAMPAIGNS.find((c) => c.id === id) ?? MOCK_CAMPAIGNS[0],
    [id]
  );

  const builderOpen = searchParams.get("step") === "edit";

  const closeBuilder = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("step");
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const list = campaign.contacts.filter((c) =>
      !search.trim() ? true : c.fullName.toLowerCase().includes(search.trim().toLowerCase())
    );
    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [campaign.contacts, search, sortKey, sortAsc]);

  const allChecked = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const setSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(true);
    }
  };

  const kpiCards = [
    { label: "Contacts", value: campaign.total },
    { label: "Active", value: campaign.active },
    { label: "Opened", value: campaign.opened },
    { label: "Clicked", value: campaign.clicked },
    { label: "Replied", value: campaign.replied },
    { label: "Interested", value: campaign.interested },
    { label: "Bounced", value: campaign.bounced },
  ];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Breadcrumb + header */}
        <div>
          <div className="flex items-center text-xs text-muted-foreground mb-1">
            <Link to="/campaigns" className="hover:text-foreground">
              Campaigns
            </Link>
            <ChevronRight className="h-3 w-3 mx-1" />
            <span className="text-foreground/80 truncate max-w-[400px]">{campaign.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-display">{campaign.name}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setSearchParams({ step: "edit" }, { replace: true })}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit campaign
              </Button>
              <Button onClick={() => toast.info("Add contacts — stub")}>
                <Plus className="h-4 w-4 mr-2" />
                Add contacts
              </Button>
            </div>
          </div>
        </div>

        <KpiStrip cards={kpiCards} />

        <ScheduleChart scoped={campaign} />

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <div className="relative max-w-xs flex-1">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search for a profile"
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => toast("Filter wiring lands next pass.")}
              >
                <Filter className="h-3.5 w-3.5" />
                Add filter
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                  <TableHead className="w-10">
                    <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
                  </TableHead>
                  <SortHead label="Full Name" k="fullName" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                  <SortHead label="Step" k="step" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                  <SortHead label="Status" k="status" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                  <SortHead label="Response" k="response" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                  <SortHead label="Engagement" k="engagement" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                  <SortHead label="Added by" k="addedBy" sortKey={sortKey} sortAsc={sortAsc} onSort={setSort} />
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <ContactRow
                    key={c.id}
                    contact={c}
                    totalSteps={campaign.steps.length}
                    selected={selected.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {builderOpen && (
        <CampaignBuilder
          campaign={campaign}
          open={builderOpen}
          onClose={closeBuilder}
        />
      )}
    </AppLayout>
  );
}

function SortHead({
  label,
  k,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button
        onClick={() => onSort(k)}
        className={cn("font-medium hover:text-foreground transition", active ? "text-foreground" : "text-muted-foreground")}
      >
        {label}
        {active && <span className="ml-1 text-[10px]">{sortAsc ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}

function ContactRow({
  contact,
  totalSteps,
  selected,
  onToggle,
}: {
  contact: CampaignContact;
  totalSteps: number;
  selected: boolean;
  onToggle: () => void;
}) {
  const [response, setResponse] = useState<ResponseType>(contact.response);

  return (
    <TableRow className="hover:bg-secondary/20" data-state={selected ? "selected" : undefined}>
      <TableCell>
        <Checkbox checked={selected} onCheckedChange={onToggle} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{contact.fullName}</span>
          <span className="text-[11px] text-muted-foreground">
            {contact.role} · {contact.employer}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {contact.step} of {totalSteps}
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-sm">
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[contact.status]}`} />
          {contact.status}
        </span>
      </TableCell>
      <TableCell>
        <Select value={response} onValueChange={(v) => setResponse(v as ResponseType)}>
          <SelectTrigger className="h-7 text-xs w-[140px] border-transparent hover:border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESPONSE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r} className="text-xs">
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${ENGAGEMENT_COLOR[contact.engagement]}`}>
            {contact.engagement}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground" title={`${contact.opens} opens`}>
            <Mail className="h-3 w-3" /> {contact.opens}
          </span>
          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground" title={`${contact.clicks} clicks`}>
            <MousePointerClick className="h-3 w-3" /> {contact.clicks}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Avatar className="h-4 w-4">
            <AvatarFallback className="text-[8px] bg-secondary">
              {contact.addedBy.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {contact.addedBy.split(" ")[0]} ·{" "}
          {new Date(contact.addedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-0.5">
          <button
            onClick={() => toast.info("Pause — stub")}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Pause"
          >
            <Pause className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => toast.info("Skip step — stub")}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Skip step"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => toast.info("Remove — stub")}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Remove"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  );
}
