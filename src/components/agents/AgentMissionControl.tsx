import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Clock,
  CheckCircle,
  Mail,
  Eye,
  Star,
  XCircle,
  Loader2,
} from "lucide-react";
import {
  useAgentMetrics,
  useAgentLeads,
  useAgentOutreachMetrics,
} from "@/hooks/useAgents";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

interface AgentMissionControlProps {
  agent: {
    id: string;
    sequence_mode: string;
    last_run_at: string | null;
  };
}

export function AgentMissionControl({ agent }: AgentMissionControlProps) {
  const { data: metrics } = useAgentMetrics(agent.id);
  const { data: pendingLeads = [] } = useAgentLeads(agent.id, "pending");
  const { data: pipelineLeads = [] } = useAgentLeads(agent.id);
  const { data: outreachMetrics } = useAgentOutreachMetrics(agent.id);
  const qc = useQueryClient();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const shortlistedLeads = pipelineLeads.filter((l) =>
    ["approved", "shortlisted", "contacted"].includes(l.status)
  );

  const updateLeadStatus = async (leadId: string, status: string) => {
    setLoadingId(leadId);
    try {
      const { error } = await supabase
        .from("agent_leads")
        .update({ status })
        .eq("id", leadId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["agent_leads", agent.id] });
      qc.invalidateQueries({ queryKey: ["agent_metrics", agent.id] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const matchColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    const n = Number(score);
    if (n >= 0.8) return "text-green-600";
    if (n >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  const matchLabelColor: Record<string, string> = {
    strong_match: "bg-green-500/10 text-green-600",
    good_match: "bg-blue-500/10 text-blue-600",
    potential_fit: "bg-amber-500/10 text-amber-600",
    not_a_match: "bg-red-500/10 text-red-600",
  };

  const metricCards = [
    { icon: Users, label: "Leads Sourced", value: metrics?.total ?? 0, sub: "total" },
    { icon: Clock, label: "Awaiting Review", value: metrics?.pending ?? 0, sub: metrics?.pending ? "need your review" : "all caught up", highlight: (metrics?.pending ?? 0) > 0 },
    { icon: CheckCircle, label: "Approved", value: metrics?.approved ?? 0, sub: "in pipeline" },
    { icon: Mail, label: "Contacted", value: metrics?.contacted ?? 0, sub: "" },
    { icon: Eye, label: "Open Rate", value: `${(metrics?.openRate ?? 0).toFixed(1)}%`, sub: "" },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <m.icon className="h-3.5 w-3.5" />
                <span className="text-xs">{m.label}</span>
              </div>
              <p className="text-xl font-bold font-display">{m.value}</p>
              {m.sub && (
                <p className={`text-xs mt-0.5 ${m.highlight ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {m.sub}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Leads Awaiting Review */}
      {pendingLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display flex items-center gap-2">
              Leads Awaiting Review
              <Badge variant="secondary" className="text-xs">{pendingLeads.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingLeads.slice(0, 10).map((lead) => {
              const profile = lead.profile_snapshot as any;
              return (
                <div key={lead.id} className="flex items-start justify-between border rounded-lg p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{profile?.full_name || "Unknown"}</p>
                      <span className={`text-xs font-bold ${matchColor(lead.match_score ? Number(lead.match_score) : null)}`}>
                        {lead.match_score ? `${Math.round(Number(lead.match_score) * 100)}%` : "—"}
                      </span>
                      {lead.match_label && (
                        <Badge className={`${matchLabelColor[lead.match_label] || ""} border-0 text-[10px]`}>
                          {lead.match_label.replace(/_/g, " ")}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {profile?.job_title} at {profile?.job_company_name}
                    </p>
                    {lead.ai_summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lead.ai_summary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => updateLeadStatus(lead.id, "approved")}
                      disabled={loadingId === lead.id}
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => updateLeadStatus(lead.id, "rejected")}
                      disabled={loadingId === lead.id}
                    >
                      <XCircle className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => updateLeadStatus(lead.id, "shortlisted")}
                      disabled={loadingId === lead.id}
                    >
                      <Star className="h-3.5 w-3.5 text-blue-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {pendingLeads.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">All caught up! Your agent will source new leads on its next run.</p>
            {agent.last_run_at && (
              <p className="text-xs mt-1">
                Last ran {formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sequence Performance */}
      {agent.sequence_mode === "auto_sequence" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display">Sequence Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {outreachMetrics && outreachMetrics.totalSent > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold">{outreachMetrics.totalSent}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${outreachMetrics.openRate > 40 ? "text-green-600" : outreachMetrics.openRate > 20 ? "text-amber-600" : "text-red-600"}`}>
                      {outreachMetrics.openRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Open Rate</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${outreachMetrics.bounceRate > 5 ? "text-red-600" : "text-green-600"}`}>
                      {outreachMetrics.bounceRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Bounce Rate</p>
                  </div>
                </div>
                {outreachMetrics.perStep.length > 1 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Step</TableHead>
                        <TableHead className="text-xs">Sent</TableHead>
                        <TableHead className="text-xs">Open Rate</TableHead>
                        <TableHead className="text-xs">Bounce Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {outreachMetrics.perStep.map((s) => (
                        <TableRow key={s.step}>
                          <TableCell className="text-xs">Step {s.step}</TableCell>
                          <TableCell className="text-xs">{s.sent}</TableCell>
                          <TableCell className="text-xs">{s.openRate.toFixed(1)}%</TableCell>
                          <TableCell className="text-xs">{s.bounceRate.toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No outreach data yet. Connect your email domain and enable auto-sequence to start outreach.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Shortlist Table */}
      {shortlistedLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display">Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Employer</TableHead>
                  <TableHead className="text-xs">Score</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shortlistedLeads.map((lead) => {
                  const profile = lead.profile_snapshot as any;
                  const statusColors: Record<string, string> = {
                    approved: "bg-green-500/10 text-green-600",
                    shortlisted: "bg-blue-500/10 text-blue-600",
                    contacted: "bg-purple-500/10 text-purple-600",
                  };
                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="text-xs font-medium">{profile?.full_name || "—"}</TableCell>
                      <TableCell className="text-xs">{profile?.job_title || "—"}</TableCell>
                      <TableCell className="text-xs">{profile?.job_company_name || "—"}</TableCell>
                      <TableCell className={`text-xs font-bold ${matchColor(lead.match_score ? Number(lead.match_score) : null)}`}>
                        {lead.match_score ? `${Math.round(Number(lead.match_score) * 100)}%` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[lead.status] || ""} border-0 text-[10px]`}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
