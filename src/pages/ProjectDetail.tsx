import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  Trash2,
  Users,
  Loader2,
  Pencil,
  Search,
  ArrowUpDown,
  Mail,
  ChevronDown,
  Send,
} from "lucide-react";
import {
  useProject,
  useProjectCandidates,
  useUpdateCandidateStatus,
  useRemoveCandidate,
  useUpdateProject,
  useProjectCampaigns,
  useBulkUpdateCandidateStatus,
  useBulkRemoveCandidates,
} from "@/hooks/useProjects";
import { STATUS_CONFIG, CandidateStatus } from "@/types/project";
import { toast } from "sonner";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";

type SortField = "full_name" | "title" | "current_employer" | "location" | "avg_tenure_months" | "status";
type SortDir = "asc" | "desc";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading: projectLoading } = useProject(id!);
  const { data: candidates = [], isLoading: candidatesLoading } = useProjectCandidates(id!);
  const { data: campaigns = [] } = useProjectCampaigns(id!);
  const updateStatus = useUpdateCandidateStatus();
  const removeCandidate = useRemoveCandidate();
  const updateProject = useUpdateProject();
  const bulkUpdateStatus = useBulkUpdateCandidateStatus();
  const bulkRemove = useBulkRemoveCandidates();

  const [drawerCandidate, setDrawerCandidate] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Filtering & sorting
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("full_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const isLoading = projectLoading || candidatesLoading;

  // Filtered & sorted candidates
  const filteredCandidates = useMemo(() => {
    let result = [...candidates];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.title && c.title.toLowerCase().includes(q)) ||
          (c.current_employer && c.current_employer.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      const aVal = a[sortField] ?? "";
      const bVal = b[sortField] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [candidates, searchQuery, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCandidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCandidates.map((c) => c.id)));
    }
  };

  const openEditDialog = () => {
    setEditName(project?.name || "");
    setEditDesc(project?.description || "");
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await updateProject.mutateAsync({ id: id!, name: editName.trim(), description: editDesc.trim() || null });
      toast.success("Project updated");
      setEditOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update project");
    }
  };

  const handleStatusChange = async (candidateId: string, status: CandidateStatus) => {
    try {
      await updateStatus.mutateAsync({ id: candidateId, status, projectId: id! });
      toast.success(`Status updated to ${STATUS_CONFIG[status].label}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const handleRemoveConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await removeCandidate.mutateAsync({ id: deleteTarget.id, projectId: id! });
      toast.success("Candidate removed");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to remove candidate");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleBulkStatusChange = async (status: CandidateStatus) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await bulkUpdateStatus.mutateAsync({ ids, status, projectId: id! });
      toast.success(`${ids.length} candidate${ids.length > 1 ? "s" : ""} updated to ${STATUS_CONFIG[status].label}`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to update candidates");
    }
  };

  const handleBulkRemoveConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await bulkRemove.mutateAsync({ ids, projectId: id! });
      toast.success(`${ids.length} candidate${ids.length > 1 ? "s" : ""} removed`);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to remove candidates");
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const statusCounts = {
    new: candidates.filter((c) => c.status === "new").length,
    contacted: candidates.filter((c) => c.status === "contacted").length,
    interested: candidates.filter((c) => c.status === "interested").length,
    hired: candidates.filter((c) => c.status === "hired").length,
  };

  const formatTenure = (months: number | null) => {
    if (!months) return "—";
    if (months < 12) return `${months}mo`;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    return remaining > 0 ? `${years}y ${remaining}mo` : `${years}y`;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

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

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={cn("h-3 w-3", sortField === field ? "text-foreground" : "text-muted-foreground/40")} />
    </button>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate("/projects")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Projects
          </button>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-2xl font-bold font-display text-foreground">{project.name}</h1>
                {project.description && (
                  <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
                )}
              </div>
              <button
                onClick={openEditDialog}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => navigate(`/projects/${id}/search`)}>
              <Search className="h-4 w-4 mr-2" />
              Source Candidates
            </Button>
          </div>
        </div>

        {/* Pipeline summary */}
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(STATUS_CONFIG) as [CandidateStatus, typeof STATUS_CONFIG.new][]).map(
            ([status, config]) => (
              <Card
                key={status}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-sm",
                  statusFilter === status && "ring-1 ring-primary"
                )}
                onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
              >
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
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base font-display shrink-0">
              Candidates ({filteredCandidates.length}{filteredCandidates.length !== candidates.length ? ` of ${candidates.length}` : ""})
            </CardTitle>
            <div className="flex items-center gap-2 flex-1 justify-end">
              {/* Bulk actions */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-2">
                  <span className="text-xs text-muted-foreground">{selectedIds.size} selected</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                        Change Status <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(Object.entries(STATUS_CONFIG) as [CandidateStatus, typeof STATUS_CONFIG.new][]).map(
                        ([status, config]) => (
                          <DropdownMenuItem
                            key={status}
                            onClick={() => handleBulkStatusChange(status)}
                            className="text-xs"
                          >
                            <div className={`h-2 w-2 rounded-full mr-2 ${config.color}`} />
                            {config.label}
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="h-3 w-3 mr-1.5" />
                    Remove
                  </Button>
                </div>
              )}
              <div className="relative max-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search candidates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              {statusFilter !== "all" && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer text-xs gap-1"
                  onClick={() => setStatusFilter("all")}
                >
                  {STATUS_CONFIG[statusFilter as CandidateStatus]?.label}
                  <span className="text-muted-foreground">×</span>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {candidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                  <Users className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No candidates yet</p>
                <p className="text-xs mt-1 opacity-60">
                  Use the sourcing tool to find and add candidates to this project
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => navigate(`/projects/${id}/search`)}
                >
                  <Search className="h-3.5 w-3.5 mr-1.5" />
                  Source Candidates
                </Button>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm font-medium">No matching candidates</p>
                <p className="text-xs mt-1 opacity-60">Try adjusting your search or filter</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedIds.size === filteredCandidates.length && filteredCandidates.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-medium">
                        <SortableHeader field="full_name">Name</SortableHeader>
                      </TableHead>
                      <TableHead className="font-medium">
                        <SortableHeader field="title">Title</SortableHeader>
                      </TableHead>
                      <TableHead className="font-medium">
                        <SortableHeader field="current_employer">Employer</SortableHeader>
                      </TableHead>
                      <TableHead className="font-medium">
                        <SortableHeader field="location">Location</SortableHeader>
                      </TableHead>
                      <TableHead className="font-medium">
                        <SortableHeader field="avg_tenure_months">Tenure</SortableHeader>
                      </TableHead>
                      <TableHead className="font-medium">
                        <SortableHeader field="status">Status</SortableHeader>
                      </TableHead>
                      <TableHead className="font-medium w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCandidates.map((c) => (
                      <TableRow
                        key={c.id}
                        className={cn(
                          "group hover:bg-secondary/20 cursor-pointer",
                          selectedIds.has(c.id) && "bg-primary/5"
                        )}
                        onClick={() => setDrawerCandidate(c)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(c.id)}
                            onCheckedChange={() => toggleSelect(c.id)}
                          />
                        </TableCell>
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
                              onClick={() => setDeleteTarget({ id: c.id, name: c.full_name })}
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

        {/* Campaign History */}
        {campaigns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Campaign History ({campaigns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Send className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.sent_at
                            ? `Sent ${new Date(campaign.sent_at).toLocaleDateString()}`
                            : `Created ${new Date(campaign.created_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Badge
                        variant={campaign.status === "sent" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {campaign.status}
                      </Badge>
                      <span>{campaign.recipient_count} recipients</span>
                      {(campaign.sent_count ?? 0) > 0 && (
                        <>
                          <span>{campaign.sent_count} sent</span>
                          <span>{campaign.open_count ?? 0} opens</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <CandidateDrawer
        open={!!drawerCandidate}
        onOpenChange={(open) => !open && setDrawerCandidate(null)}
        candidate={drawerCandidate}
        projectId={id}
      />

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Project name</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Description (optional)</label>
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim() || updateProject.isPending}>
              {updateProject.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single candidate delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove candidate?"
        description={`Remove "${deleteTarget?.name}" from this project? This action cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={handleRemoveConfirm}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Remove ${selectedIds.size} candidates?`}
        description={`This will permanently remove ${selectedIds.size} candidate${selectedIds.size > 1 ? "s" : ""} from this project. This action cannot be undone.`}
        confirmLabel="Remove All"
        onConfirm={handleBulkRemoveConfirm}
      />
    </AppLayout>
  );
}
