import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Users, Mail, Clock, Loader2, Trash2 } from "lucide-react";
import { useAgents, useDeleteAgent } from "@/hooks/useAgents";
import { AgentCreateWizard } from "@/components/agents/AgentCreateWizard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  configuring: { label: "Configuring", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "outline" },
  out_of_leads: { label: "Out of Leads", variant: "secondary" },
  stopped: { label: "Stopped", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function Agents() {
  const { data: agents = [], isLoading } = useAgents();
  const deleteAgent = useDeleteAgent();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const navigate = useNavigate();

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAgent.mutateAsync(deleteTarget.id);
      toast.success("Agent deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete agent");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Agents</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Autonomous sourcing agents that find candidates 24/7
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : agents.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                  <Bot className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">Create your first sourcing agent</p>
                <p className="text-xs mt-1.5 opacity-60 text-center max-w-sm">
                  Set up an autonomous agent to find candidates matching your criteria 24/7
                </p>
                <Button className="mt-4" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Agent
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => {
              const cfg = statusConfig[agent.status] || statusConfig.configuring;
              return (
                <Card
                  key={agent.id}
                  className="group cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                  onClick={() => navigate(`/agents/${agent.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold font-display">{agent.name}</h3>
                          <Badge variant={cfg.variant} className="text-[10px] mt-1">
                            {cfg.label}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: agent.id, name: agent.name });
                        }}
                        className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {agent.leads_total} sourced
                      </span>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {agent.leads_contacted} contacted
                      </span>
                      {agent.last_run_at && (
                        <>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatDistanceToNow(new Date(agent.last_run_at), { addSuffix: true })}
                          </span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AgentCreateWizard open={wizardOpen} onOpenChange={setWizardOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete agent?"
        description={`This will permanently delete "${deleteTarget?.name}" and all its leads. This action cannot be undone.`}
        confirmLabel="Delete Agent"
        onConfirm={handleDeleteConfirm}
      />
    </AppLayout>
  );
}
