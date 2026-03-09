import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Mail,
  MousePointerClick,
  Eye,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  Filter,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useCampaignEvents, type CampaignRow } from "@/hooks/useCampaigns";
import { format } from "date-fns";

interface CampaignAnalyticsDrawerProps {
  campaign: CampaignRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EventFilter = "all" | "opened" | "clicked" | "bounced" | "complained";

const EVENT_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }>; colorClass: string }> = {
  sent: { label: "Sent", icon: Send, colorClass: "text-muted-foreground" },
  delivered: { label: "Delivered", icon: CheckCircle2, colorClass: "text-success" },
  opened: { label: "Opened", icon: Eye, colorClass: "text-primary" },
  clicked: { label: "Clicked", icon: MousePointerClick, colorClass: "text-warning" },
  bounced: { label: "Bounced", icon: AlertCircle, colorClass: "text-destructive" },
  complained: { label: "Spam Report", icon: XCircle, colorClass: "text-destructive" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  colorClass = "text-foreground",
}: {
  icon: React.FC<{ className?: string }>;
  label: string;
  value: number | string;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`text-2xl font-bold font-display ${colorClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RateBar({ label, rate, colorClass }: { label: string; rate: number; colorClass: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${colorClass}`}>{rate.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass.replace("text-", "bg-")}`}
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function CampaignAnalyticsDrawer({ campaign, open, onOpenChange }: CampaignAnalyticsDrawerProps) {
  const [filter, setFilter] = useState<EventFilter>("all");
  const { data: events = [], isLoading } = useCampaignEvents(open && campaign ? campaign.id : null);

  // Group events by candidate - always compute, even if campaign is null
  const byCandidate = useMemo(() => {
    const grouped: Record<string, typeof events> = {};
    for (const ev of events) {
      const key = ev.candidate_id;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    }
    return grouped;
  }, [events]);

  // Count unique candidates per event type (not raw event count)
  const eventCounts = useMemo(() => {
    const seen: Record<string, Set<string>> = {};
    for (const ev of events) {
      if (!seen[ev.event_type]) seen[ev.event_type] = new Set();
      seen[ev.event_type].add(ev.candidate_id);
    }
    const counts: Record<string, number> = {};
    for (const [type, ids] of Object.entries(seen)) {
      counts[type] = ids.size;
    }
    return counts;
  }, [events]);

  const candidateRows = useMemo(() => {
    return Object.entries(byCandidate)
      .map(([, evs]) => {
        const c = evs[0].candidates;
        const eventTypes = new Set(evs.map((e) => e.event_type));
        return { candidate: c, events: evs, eventTypes, lastEvent: evs[0] };
      })
      .filter((row) => {
        if (filter === "all") return true;
        return row.eventTypes.has(filter);
      });
  }, [byCandidate, filter]);

  // Early return after all hooks
  if (!campaign) return null;

  const sentCount = campaign.sent_count || 0;
  const openCount = campaign.open_count || 0;
  const clickCount = campaign.click_count || 0;
  const bounceCount = campaign.bounce_count || 0;
  const openRate = sentCount > 0 ? (openCount / sentCount) * 100 : 0;
  const clickRate = sentCount > 0 ? (clickCount / sentCount) * 100 : 0;
  const bounceRate = sentCount > 0 ? (bounceCount / sentCount) * 100 : 0;
  const clickToOpenRate = openCount > 0 ? (clickCount / openCount) * 100 : 0;

  // Alerts for bounces and complaints
  const bouncedRecipients = Object.values(byCandidate).filter((evs) =>
    evs.some((e) => e.event_type === "bounced")
  );
  const complainedRecipients = Object.values(byCandidate).filter((evs) =>
    evs.some((e) => e.event_type === "complained")
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <Mail className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="font-display text-base truncate">{campaign.name}</SheetTitle>
              <SheetDescription className="text-xs mt-0.5">
                {campaign.email_templates?.name || "No template"} · {campaign.projects?.name || "No project"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {/* Delivery Alerts */}
            {(bouncedRecipients.length > 0 || complainedRecipients.length > 0) && (
              <div className="space-y-2">
                {bouncedRecipients.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-destructive">
                        {bouncedRecipients.length} email{bouncedRecipients.length > 1 ? "s" : ""} bounced
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {bouncedRecipients
                          .slice(0, 3)
                          .map((evs) => evs[0].candidates?.email)
                          .join(", ")}
                        {bouncedRecipients.length > 3 && ` +${bouncedRecipients.length - 3} more`}
                      </p>
                    </div>
                  </div>
                )}
                {complainedRecipients.length > 0 && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <XCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-destructive">
                        {complainedRecipients.length} spam complaint{complainedRecipients.length > 1 ? "s" : ""}
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        Consider removing these recipients from future campaigns
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Overview Stats */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Users}
                  label="Recipients"
                  value={campaign.recipient_count}
                />
                <StatCard
                  icon={Send}
                  label="Sent"
                  value={sentCount}
                  sub={campaign.sent_at ? format(new Date(campaign.sent_at), "MMM d, yyyy h:mm a") : "Not sent yet"}
                />
                <StatCard
                  icon={Eye}
                  label="Unique Opens"
                  value={openCount}
                  colorClass="text-primary"
                />
                <StatCard
                  icon={MousePointerClick}
                  label="Unique Clicks"
                  value={clickCount}
                  colorClass="text-warning"
                />
              </div>
            </div>

            {/* Engagement Rates */}
            {sentCount > 0 && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Engagement</h3>
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <RateBar label="Open Rate" rate={openRate} colorClass="text-primary" />
                  <RateBar label="Click Rate" rate={clickRate} colorClass="text-warning" />
                  <RateBar label="Click-to-Open Rate" rate={clickToOpenRate} colorClass="text-success" />
                  {bounceRate > 0 && (
                    <RateBar label="Bounce Rate" rate={bounceRate} colorClass="text-destructive" />
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* Per-Recipient Activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recipient Activity
                </h3>
                <div className="flex items-center gap-1">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value as EventFilter)}
                    className="text-xs bg-transparent border-none text-muted-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="all">All ({Object.keys(byCandidate).length})</option>
                    <option value="opened">Opened ({eventCounts.opened || 0})</option>
                    <option value="clicked">Clicked ({eventCounts.clicked || 0})</option>
                    <option value="bounced">Bounced ({eventCounts.bounced || 0})</option>
                    <option value="complained">Complaints ({eventCounts.complained || 0})</option>
                  </select>
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : candidateRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Clock className="h-8 w-8 opacity-30 mb-2" />
                  <p className="text-sm">
                    {campaign.status === "draft"
                      ? "Send the campaign to see recipient activity"
                      : filter !== "all"
                      ? `No recipients with "${filter}" events`
                      : "No activity yet"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {candidateRows.map(({ candidate, events: cevs, eventTypes }) => (
                    <div
                      key={cevs[0].candidate_id}
                      className="rounded-lg border border-border bg-card/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{candidate?.full_name || "Unknown"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{candidate?.email || "—"}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {eventTypes.has("delivered") && (
                            <span title="Delivered" className="flex h-6 w-6 items-center justify-center rounded-full bg-success/10">
                              <CheckCircle2 className="h-3 w-3 text-success" />
                            </span>
                          )}
                          {eventTypes.has("opened") && (
                            <span title="Opened" className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                              <Eye className="h-3 w-3 text-primary" />
                            </span>
                          )}
                          {eventTypes.has("clicked") && (
                            <span title="Clicked" className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/10">
                              <MousePointerClick className="h-3 w-3 text-warning" />
                            </span>
                          )}
                          {eventTypes.has("bounced") && (
                            <span title="Bounced" className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                              <AlertCircle className="h-3 w-3 text-destructive" />
                            </span>
                          )}
                          {eventTypes.has("complained") && (
                            <span title="Spam Report" className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10">
                              <XCircle className="h-3 w-3 text-destructive" />
                            </span>
                          )}
                          {!eventTypes.has("opened") &&
                            !eventTypes.has("clicked") &&
                            !eventTypes.has("bounced") &&
                            !eventTypes.has("complained") && (
                              <Badge variant="secondary" className="text-[10px]">Sent</Badge>
                            )}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cevs.slice(0, 6).map((ev) => {
                          const cfg = EVENT_CONFIG[ev.event_type];
                          const Icon = cfg?.icon;
                          const eventData = ev.event_data as Record<string, unknown> | null;
                          const clickedUrl = eventData?.clicked_url as string | undefined;
                          
                          return (
                            <span
                              key={ev.id}
                              title={`${cfg?.label}${clickedUrl ? ` - ${clickedUrl}` : ""} · ${format(new Date(ev.created_at), "MMM d, h:mm a")}`}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5"
                            >
                              {Icon && <Icon className={`h-2.5 w-2.5 ${cfg?.colorClass}`} />}
                              {cfg?.label} · {format(new Date(ev.created_at), "MMM d, h:mm a")}
                            </span>
                          );
                        })}
                        {cevs.length > 6 && (
                          <span className="text-[10px] text-muted-foreground/60">+{cevs.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
