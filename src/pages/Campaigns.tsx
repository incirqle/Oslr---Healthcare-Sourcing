import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Plus,
  Clock,
  Users,
  Play,
  Pause,
  GitBranch,
  ChevronRight,
} from "lucide-react";

type SequenceStatus = "draft" | "active" | "paused";

interface SequenceStep {
  id: string;
  day: number;
  channel: "email";
  subject: string;
}

interface Sequence {
  id: string;
  name: string;
  status: SequenceStatus;
  steps: SequenceStep[];
  enrolled: number;
  replied: number;
  updated_at: string;
}

const PLACEHOLDER_SEQUENCES: Sequence[] = [];

function statusBadge(status: SequenceStatus) {
  switch (status) {
    case "active":
      return (
        <Badge className="text-[10px] bg-success/10 text-success border-success/20">
          Active
        </Badge>
      );
    case "paused":
      return (
        <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20">
          Paused
        </Badge>
      );
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          Draft
        </Badge>
      );
  }
}

export default function Campaigns() {
  const [sequences] = useState<Sequence[]>(PLACEHOLDER_SEQUENCES);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">
              Campaigns
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Multi-step outreach sequences with automated follow-ups
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Sequence
          </Button>
        </div>

        {sequences.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                  <GitBranch className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No sequences yet</p>
                <p className="text-xs mt-1 opacity-60 max-w-sm text-center">
                  Build a multi-step outreach sequence — initial email,
                  timed follow-ups, and conditional branches based on replies.
                </p>
                <Button size="sm" className="mt-4 gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Create your first sequence
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sequences.map((seq) => {
              const replyRate =
                seq.enrolled > 0 ? (seq.replied / seq.enrolled) * 100 : 0;
              return (
                <Card
                  key={seq.id}
                  className="group cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">
                            {seq.name}
                          </h3>
                          {statusBadge(seq.status)}
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {seq.steps.length} steps
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {seq.enrolled} enrolled
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(seq.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            Reply rate
                          </p>
                          <p className="text-sm font-semibold text-primary">
                            {replyRate.toFixed(1)}%
                          </p>
                        </div>
                        <button
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          title={seq.status === "active" ? "Pause" : "Activate"}
                        >
                          {seq.status === "active" ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
