import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Plus } from "lucide-react";
import { useProjectStore } from "@/stores/projectStore";
import { toast } from "sonner";

interface SearchCandidate {
  id: string;
  full_name: string;
  title: string | null;
  current_employer: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  avg_tenure_months: number | null;
  industry: string | null;
  company_size: string | null;
}

interface SaveToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: SearchCandidate[];
}

export function SaveToProjectDialog({ open, onOpenChange, candidates }: SaveToProjectDialogProps) {
  const { projects, addProject, addCandidateToProject } = useProjectStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const handleSave = () => {
    let projectId = selectedProjectId;

    if (showCreate && newProjectName.trim()) {
      projectId = addProject(newProjectName.trim());
      toast.success(`Project "${newProjectName.trim()}" created`);
    }

    if (!projectId) return;

    let addedCount = 0;
    for (const c of candidates) {
      const before = useProjectStore.getState().getProject(projectId)?.candidates.length ?? 0;
      addCandidateToProject(projectId, {
        id: c.id,
        full_name: c.full_name,
        title: c.title,
        current_employer: c.current_employer,
        location: c.location,
        linkedin_url: c.linkedin_url,
        email: c.email,
        phone: c.phone,
        skills: c.skills,
        avg_tenure_months: c.avg_tenure_months,
        industry: c.industry,
        company_size: c.company_size,
        pdl_id: c.id,
      });
      const after = useProjectStore.getState().getProject(projectId)?.candidates.length ?? 0;
      if (after > before) addedCount++;
    }

    if (addedCount > 0) {
      toast.success(`${addedCount} candidate${addedCount > 1 ? "s" : ""} saved to project`);
    } else {
      toast.info("Candidates already in this project");
    }

    setSelectedProjectId("");
    setShowCreate(false);
    setNewProjectName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Save to Project</DialogTitle>
          <DialogDescription>
            Save {candidates.length} candidate{candidates.length > 1 ? "s" : ""} to a project
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {!showCreate ? (
            <>
              {projects.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Select project</Label>
                  <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{p.name}</span>
                            <span className="text-muted-foreground text-xs">
                              ({p.candidates.length})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No projects yet. Create one below.
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create New Project
              </Button>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">New project name</Label>
              <Input
                placeholder="e.g. ICU Nurses - Q1 Hiring"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                autoFocus
              />
              <button
                onClick={() => setShowCreate(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Choose existing project
              </button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={showCreate ? !newProjectName.trim() : !selectedProjectId}
          >
            Save Candidates
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
