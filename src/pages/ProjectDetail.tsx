import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  Trash2,
  Users,
} from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { STATUS_CONFIG, CandidateStatus, ProjectCandidate } from "@/types/project";
import { toast } from "sonner";
import { useState } from "react";
import { CandidateDrawer } from "@/components/CandidateDrawer";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateCandidateStatus, removeCandidateFromProject } = useProjectStore();
  const project = getProject(id!);
  const [drawerCandidate, setDrawerCandidate] = useState<ProjectCandidate | null>(null);

  if (!project) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p className="text-sm font-medium">Project not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
          </Button>
        </div>
      </AppLayout>
    );
  }

  const statusCounts = {
    new: project.candidates.filter((c) => c.status === "new").length,
    contacted: project.candidates.filter((c) => c.status === "contacted").length,
    interested: project.candidates.filter((c) => c.status === "interested").length,
    hired: project.candidates.filter((c) => c.status === "hired").length,
  };

  const formatTenure = (months: number | null) => {
    if (!months) return "—";
    if (months < 12) return `${months}mo`;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    return remaining > 0 ? `${years}y ${remaining}mo` : `${years}y`;
  };

  const handleStatusChange = (candidateId: string, status: CandidateStatus) => {
    updateCandidateStatus(project.id, candidateId, status);
    toast.success(`Status updated to ${STATUS_CONFIG[status].label}`);
  };

  const handleRemove = (candidateId: string) => {
    removeCandidateFromProject(project.id, candidateId);
    toast.success("Candidate removed");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Projects
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">{project.name}</h1>
              {project.description && (
                <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Pipeline summary */}
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(STATUS_CONFIG) as [CandidateStatus, typeof STATUS_CONFIG.new][]).map(
            ([status, config]) => (
              <Card key={status}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.color}`}>
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold font-display">{statusCounts[status]}</p>
                    <p className="text-xs text-muted-foreground">{config.label}</p>
                  </div>
                </CardContent>
              </Card>
            )
          )}
        </div>

        {/* Candidates table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">
              Candidates ({project.candidates.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {project.candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                  <Users className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No candidates yet</p>
                <p className="text-xs mt-1 opacity-60">
                  Search for candidates and save them to this project
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/search")}>
                  Go to Search
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead className="font-medium">Name</TableHead>
                      <TableHead className="font-medium">Title</TableHead>
                      <TableHead className="font-medium">Employer</TableHead>
                      <TableHead className="font-medium">Location</TableHead>
                      <TableHead className="font-medium">Avg Tenure</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {project.candidates.map((c) => (
                      <TableRow key={c.id} className="group hover:bg-secondary/20 cursor-pointer" onClick={() => setDrawerCandidate(c)}>
                        <TableCell className="font-medium">
                          <div>
                            <p className="text-sm">{c.full_name}</p>
                            {c.email && (
                              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.email}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{c.title || "—"}</span>
                        </TableCell>
                        <TableCell>
                          {c.current_employer ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate max-w-[150px]">{c.current_employer}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.location ? (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm">{c.location}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm">{formatTenure(c.avg_tenure_months)}</span>
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={c.status}
                            onValueChange={(v) => handleStatusChange(c.id, v as CandidateStatus)}
                          >
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.entries(STATUS_CONFIG) as [CandidateStatus, typeof STATUS_CONFIG.new][]).map(
                                ([status, config]) => (
                                  <SelectItem key={status} value={status} className="text-xs">
                                    {config.label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {c.linkedin_url && (
                              <a
                                href={c.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleRemove(c.id)}
                              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <CandidateDrawer
        open={!!drawerCandidate}
        onOpenChange={(open) => !open && setDrawerCandidate(null)}
        candidate={drawerCandidate}
      />
    </AppLayout>
  );
}
