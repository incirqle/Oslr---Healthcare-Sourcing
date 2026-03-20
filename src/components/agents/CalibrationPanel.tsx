import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckCircle, XCircle, SkipForward, ChevronDown, Loader2 } from "lucide-react";
import { useAgentCalibration } from "@/hooks/useAgents";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CalibrationPanelProps {
  agent: {
    id: string;
    calibration_approved: number;
    calibration_locked: boolean;
    role_description: string;
  };
}

export function CalibrationPanel({ agent }: CalibrationPanelProps) {
  const { pendingLeads, approveLead, rejectLead } = useAgentCalibration(agent.id);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const leads = pendingLeads.data || [];
  const currentLead = leads[currentIndex];

  // Auto-seed on first load if no pending leads
  useEffect(() => {
    if (pendingLeads.data && pendingLeads.data.length === 0 && !seeding) {
      seedProfiles();
    }
  }, [pendingLeads.data]);

  const seedProfiles = async () => {
    setSeeding(true);
    try {
      const { error } = await supabase.functions.invoke("agent-seed", {
        body: { agent_id: agent.id },
      });
      if (error) throw error;
      pendingLeads.refetch();
    } catch (err: any) {
      toast.error("Failed to fetch seed profiles: " + (err.message || ""));
    } finally {
      setSeeding(false);
    }
  };

  const handleApprove = async () => {
    if (!currentLead) return;
    try {
      const result = await approveLead.mutateAsync(currentLead.id);
      if (result?.calibration_locked) {
        toast.success("🎉 Agent activated! Calibration complete.");
      }
      moveToNext();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReject = async () => {
    if (!currentLead || !rejectFeedback.trim()) return;
    try {
      await rejectLead.mutateAsync({ leadId: currentLead.id, feedback: rejectFeedback });
      setRejectFeedback("");
      setShowRejectInput(false);
      setCurrentIndex(0);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const moveToNext = () => {
    if (currentIndex < leads.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
    setShowRejectInput(false);
    setRejectFeedback("");
  };

  const matchColor = (score: number | null) => {
    if (!score) return "text-muted-foreground";
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  const matchLabelColor: Record<string, string> = {
    strong_match: "bg-green-500/10 text-green-600",
    good_match: "bg-blue-500/10 text-blue-600",
    potential_fit: "bg-amber-500/10 text-amber-600",
    not_a_match: "bg-red-500/10 text-red-600",
  };

  if (seeding || pendingLeads.isLoading) {
    return (
      <div className="space-y-4">
        <CalibrationProgress approved={agent.calibration_approved} />
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Finding initial candidates for calibration...</p>
            </div>
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentLead) {
    return (
      <div className="space-y-4">
        <CalibrationProgress approved={agent.calibration_approved} />
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <p className="text-sm">No more candidates to review. Fetching more...</p>
            <Button variant="outline" className="mt-3" onClick={seedProfiles}>
              Fetch More Profiles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profile = currentLead.profile_snapshot as any;

  return (
    <div className="space-y-4">
      <CalibrationProgress approved={agent.calibration_approved} />

      <Card className="shadow-md">
        <CardContent className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold font-display">
                {profile?.full_name || "Unknown"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {profile?.job_title || "N/A"} at {profile?.job_company_name || "N/A"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile?.location_locality}{profile?.location_region ? `, ${profile.location_region}` : ""}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold ${matchColor(Number(currentLead.match_score))}`}>
                {currentLead.match_score ? `${Math.round(Number(currentLead.match_score) * 100)}%` : "—"}
              </span>
              {currentLead.match_label && (
                <Badge className={`${matchLabelColor[currentLead.match_label] || ""} border-0 text-xs mt-1 block`}>
                  {currentLead.match_label?.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
          </div>

          {/* AI Summary */}
          {currentLead.ai_summary && (
            <p className="text-sm border-l-2 border-primary/30 pl-3 text-foreground">
              {currentLead.ai_summary}
            </p>
          )}

          {/* Match Reasoning */}
          {currentLead.match_reasoning && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-3 w-3" />
                View match reasoning
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-xs text-muted-foreground mt-2 bg-secondary/50 rounded-lg p-3">
                  {currentLead.match_reasoning}
                </p>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              onClick={handleApprove}
              disabled={approveLead.isPending}
              className="flex-1"
            >
              <CheckCircle className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive hover:text-destructive"
              onClick={() => setShowRejectInput(!showRejectInput)}
              disabled={rejectLead.isPending}
            >
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
            <Button variant="ghost" size="sm" onClick={moveToNext}>
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Reject feedback */}
          {showRejectInput && (
            <div className="space-y-2">
              <Textarea
                placeholder="Why doesn't this candidate fit? This feedback helps calibrate the agent."
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
                rows={2}
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                disabled={!rejectFeedback.trim() || rejectLead.isPending}
              >
                {rejectLead.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Submit Rejection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Reviewing {currentIndex + 1} of {leads.length} candidates
      </p>
    </div>
  );
}

function CalibrationProgress({ approved }: { approved: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-6 w-6 rounded-full border-2 transition-colors ${
              i < approved
                ? "bg-green-500 border-green-500"
                : "bg-transparent border-border"
            }`}
          />
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {approved}/3 consecutive approvals
        {approved === 2 && " — one more to activate!"}
      </p>
    </div>
  );
}
