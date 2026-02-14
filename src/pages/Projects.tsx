import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FolderKanban, Plus, Users, Calendar, Trash2 } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { toast } from "sonner";

export default function Projects() {
  const { projects, addProject, deleteProject } = useProjectStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();

  const handleCreate = () => {
    if (!name.trim()) return;
    const id = addProject(name.trim(), description.trim());
    toast.success("Project created");
    setName("");
    setDescription("");
    setOpen(false);
    navigate(`/projects/${id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteProject(id);
    toast.success("Project deleted");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your hiring projects and candidate lists
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display">Create Project</DialogTitle>
                <DialogDescription>
                  Create a new hiring project to organize candidates
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Project name</Label>
                  <Input
                    placeholder="e.g. ICU Nurses - Q1 Hiring"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Description (optional)</Label>
                  <Textarea
                    placeholder="Brief description of this hiring project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!name.trim()}>Create Project</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                  <FolderKanban className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">No projects yet</p>
                <p className="text-xs mt-1.5 opacity-60">
                  Create a project to start organizing candidates
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const statusCounts = {
                new: project.candidates.filter((c) => c.status === "new").length,
                contacted: project.candidates.filter((c) => c.status === "contacted").length,
                interested: project.candidates.filter((c) => c.status === "interested").length,
                hired: project.candidates.filter((c) => c.status === "hired").length,
              };

              return (
                <Card
                  key={project.id}
                  className="group cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <FolderKanban className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold font-display">{project.name}</h3>
                          {project.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{project.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, project.id)}
                        className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {project.candidates.length} candidates
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(project.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      {statusCounts.new > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {statusCounts.new} New
                        </Badge>
                      )}
                      {statusCounts.contacted > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">
                          {statusCounts.contacted} Contacted
                        </Badge>
                      )}
                      {statusCounts.interested > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-0">
                          {statusCounts.interested} Interested
                        </Badge>
                      )}
                      {statusCounts.hired > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-success/10 text-success border-0">
                          {statusCounts.hired} Hired
                        </Badge>
                      )}
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
