import { useState, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Eye, Users, FileText } from "lucide-react";
import { useTemplates, useCreateCampaign } from "@/hooks/useCampaigns";
import { useProjects, useProjectCandidates } from "@/hooks/useProjects";
import { toast } from "sonner";

interface CampaignBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function resolveMergeFields(text: string, candidate: any): string {
  return text
    .replace(/\{\{full_name\}\}/g, candidate.full_name || "")
    .replace(/\{\{first_name\}\}/g, (candidate.full_name || "").split(" ")[0] || "")
    .replace(/\{\{title\}\}/g, candidate.title || "")
    .replace(/\{\{current_employer\}\}/g, candidate.current_employer || "")
    .replace(/\{\{location\}\}/g, candidate.location || "")
    .replace(/\{\{email\}\}/g, candidate.email || "");
}

export function CampaignBuilder({ open, onOpenChange }: CampaignBuilderProps) {
  const [name, setName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);
  const [tab, setTab] = useState("setup");

  const { data: templates = [] } = useTemplates();
  const { data: projects = [] } = useProjects();
  const { data: candidates = [] } = useProjectCandidates(selectedProjectId);
  const createCampaign = useCreateCampaign();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const previewCandidate = candidates[previewIndex] || null;

  const previewSubject = useMemo(() => {
    if (!selectedTemplate || !previewCandidate) return selectedTemplate?.subject || "";
    return resolveMergeFields(selectedTemplate.subject, previewCandidate);
  }, [selectedTemplate, previewCandidate]);

  const previewBody = useMemo(() => {
    if (!selectedTemplate || !previewCandidate) return selectedTemplate?.body || "";
    return resolveMergeFields(selectedTemplate.body, previewCandidate);
  }, [selectedTemplate, previewCandidate]);

  const handleCreate = async () => {
    if (!name.trim() || !selectedTemplateId || !selectedProjectId) return;
    try {
      await createCampaign.mutateAsync({
        name: name.trim(),
        templateId: selectedTemplateId,
        projectId: selectedProjectId,
        recipientCount: candidates.length,
      });
      toast.success("Campaign created");
      setName("");
      setSelectedTemplateId("");
      setSelectedProjectId("");
      setTab("setup");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    }
  };

  const canPreview = selectedTemplateId && selectedProjectId && candidates.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Create Campaign</DialogTitle>
          <DialogDescription>
            Choose a template and recipients, then preview personalized emails
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-1">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="setup" className="text-xs">
              <FileText className="h-3.5 w-3.5 mr-1.5" /> Setup
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs" disabled={!canPreview}>
              <Eye className="h-3.5 w-3.5 mr-1.5" /> Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="setup" className="space-y-4 mt-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Campaign name</Label>
              <Input
                placeholder="e.g. ICU Nurse Outreach - January"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email template</Label>
              {templates.length > 0 ? (
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{t.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No templates yet. Create one first.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Recipients from project</Label>
              {projects.length > 0 ? (
                <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setPreviewIndex(0); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No projects yet. Create a project and add candidates first.</p>
              )}
              {selectedProjectId && (
                <p className="text-xs text-muted-foreground mt-1">
                  {candidates.length} recipient{candidates.length !== 1 ? "s" : ""} in this project
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="mt-4">
            {canPreview && previewCandidate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Previewing for <span className="font-medium text-foreground">{previewCandidate.full_name}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={previewIndex === 0}
                      onClick={() => setPreviewIndex((i) => i - 1)}
                    >
                      ← Prev
                    </Button>
                    <span className="text-xs text-muted-foreground">{previewIndex + 1}/{candidates.length}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={previewIndex >= candidates.length - 1}
                      onClick={() => setPreviewIndex((i) => i + 1)}
                    >
                      Next →
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">To</p>
                    <p className="text-sm">{previewCandidate.email || "No email available"}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Subject</p>
                    <p className="text-sm font-medium">{previewSubject}</p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Body</p>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed bg-background rounded-md p-3 border border-border">
                      {previewBody || <span className="text-muted-foreground italic">Empty body</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !selectedTemplateId || !selectedProjectId || candidates.length === 0 || createCampaign.isPending}
          >
            {createCampaign.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Creating...</>
            ) : (
              <>Create Campaign ({candidates.length} recipients)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
