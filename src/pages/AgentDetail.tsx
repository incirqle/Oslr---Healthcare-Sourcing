import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, PauseCircle, PlayCircle, Square, Play, Settings } from "lucide-react";
import { useAgent, useUpdateAgent, useAgentLeads } from "@/hooks/useAgents";
import { CalibrationPanel } from "@/components/agents/CalibrationPanel";
import { AgentMissionControl } from "@/components/agents/AgentMissionControl";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const statusConfig: Record<string, { label: string; color: string }> = {
  configuring: { label: "Configuring", color: "bg-blue-500/10 text-blue-600" },
  active: { label: "Active", color: "bg-green-500/10 text-green-600" },
  paused: { label: "Paused", color: "bg-amber-500/10 text-amber-600" },
  out_of_leads: { label: "Out of Leads", color: "bg-gray-500/10 text-gray-500" },
  stopped: { label: "Stopped", color: "bg-gray-500/10 text-gray-500" },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-600" },
};

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading } = useAgent(id!);
  const updateAgent = useUpdateAgent();
  const [stopConfirm, setStopConfirm] = useState(false);
  const [running, setRunning] = useState(false);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!agent) {
    return (
      <AppLayout>
        <div className="text-center py-16 text-muted-foreground">
          <p>Agent not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/agents")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back to Agents
          </Button>
        </div>
      </AppLayout>
    );
  }

  const cfg = statusConfig[agent.status] || statusConfig.configuring;

  const handleTogglePause = async () => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      await updateAgent.mutateAsync({ id: agent.id, status: newStatus });
      toast.success(`Agent ${newStatus === "active" ? "resumed" : "paused"}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStop = async () => {
    try {
      await updateAgent.mutateAsync({ id: agent.id, status: "stopped" });
      toast.success("Agent stopped");
    } catch (err: any) {
      toast.error(err.message);
    }
    setStopConfirm(false);
  };

  const handleRestart = async () => {
    try {
      await updateAgent.mutateAsync({
        id: agent.id,
        status: "configuring",
        calibration_approved: 0,
        calibration_locked: false,
      });
      toast.success("Agent restarted — calibration required");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("agent-runner", {
        body: { agent_id: agent.id },
      });
      if (error) throw error;
      toast.success(`Agent sourced ${data?.total_leads_inserted || 0} new leads`);
    } catch (err: any) {
      toast.error(err.message || "Run failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/agents")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-display">{agent.name}</h1>
              <Badge className={`${cfg.color} border-0 text-xs mt-1`}>{cfg.label}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(agent.status === "active" || agent.status === "paused") && (
              <>
                {agent.status === "active" ? (
                  <Button variant="outline" size="sm" onClick={handleTogglePause}>
                    <PauseCircle className="h-4 w-4 mr-1.5" />Pause
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleTogglePause}>
                    <PlayCircle className="h-4 w-4 mr-1.5" />Resume
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleRunNow} disabled={running || agent.status === "paused"}>
                  {running ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Play className="h-4 w-4 mr-1.5" />}
                  Run Now
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => setStopConfirm(true)}>
                  <Square className="h-4 w-4 mr-1.5" />Stop
                </Button>
              </>
            )}
            {(agent.status === "stopped" || agent.status === "failed") && (
              <Button variant="outline" size="sm" onClick={handleRestart}>
                <PlayCircle className="h-4 w-4 mr-1.5" />Restart
              </Button>
            )}
          </div>
        </div>

        {/* Out of leads banner */}
        {agent.status === "out_of_leads" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              This agent has exhausted available candidates matching your criteria. Try broadening your filters and re-running.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={handleRestart}>
              Edit Criteria & Retry
            </Button>
          </div>
        )}

        {/* Calibration mode */}
        {agent.status === "configuring" && (
          <CalibrationPanel agent={agent} />
        )}

        {/* Mission Control for active/paused */}
        {(agent.status === "active" || agent.status === "paused") && (
          <AgentMissionControl agent={agent} />
        )}

        {/* Stopped/failed state */}
        {(agent.status === "stopped" || agent.status === "failed") && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">
              {agent.status === "stopped"
                ? "This agent has been stopped."
                : "This agent encountered an error."}
            </p>
            <Button variant="outline" className="mt-4" onClick={handleRestart}>
              Restart Agent
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={stopConfirm}
        onOpenChange={setStopConfirm}
        title="Stop agent?"
        description="This will stop the agent from sourcing new candidates. You can restart it later."
        confirmLabel="Stop Agent"
        onConfirm={handleStop}
      />
    </AppLayout>
  );
}
