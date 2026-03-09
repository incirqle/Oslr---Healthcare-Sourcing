import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Mail,
  Eye,
  Users,
  FileText,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertTriangle,
  Plus,
  Sparkles,
  Send,
} from "lucide-react";
import { useTemplates, useCreateCampaign, useDailySendUsage, useCompanyEmailSettings } from "@/hooks/useCampaigns";
import { useProjects, useProjectCandidates } from "@/hooks/useProjects";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CampaignBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenTemplateEditor?: () => void;
}

const STEPS = [
  { id: "name", label: "Name", icon: Sparkles },
  { id: "template", label: "Template", icon: FileText },
  { id: "recipients", label: "Recipients", icon: Users },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "confirm", label: "Send", icon: Send },
] as const;

function resolveMergeFields(text: string, candidate: any): string {
  return text
    .replace(/\{\{full_name\}\}/g, candidate.full_name || "")
    .replace(/\{\{first_name\}\}/g, (candidate.full_name || "").split(" ")[0] || "")
    .replace(/\{\{title\}\}/g, candidate.title || "")
    .replace(/\{\{current_employer\}\}/g, candidate.current_employer || "")
    .replace(/\{\{location\}\}/g, candidate.location || "")
    .replace(/\{\{email\}\}/g, candidate.email || "");
}

export function CampaignBuilder({ open, onOpenChange, onOpenTemplateEditor }: CampaignBuilderProps) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [previewIndex, setPreviewIndex] = useState(0);

  const { data: templates = [] } = useTemplates();
  const { data: projects = [] } = useProjects();
  const { data: candidates = [] } = useProjectCandidates(selectedProjectId);
  const { data: sentToday = 0 } = useDailySendUsage();
  const { data: emailSettings } = useCompanyEmailSettings();
  const createCampaign = useCreateCampaign();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const previewCandidate = candidates[previewIndex] || null;

  const dailyLimit = emailSettings?.daily_email_limit ?? 200;
  const remaining = Math.max(0, dailyLimit - sentToday);
  const willSend = Math.min(candidates.length, remaining);
  const willSkip = candidates.length - willSend;
  const isPartial = willSkip > 0;
  const isBlocked = remaining === 0 && candidates.length > 0;

  const previewSubject = useMemo(() => {
    if (!selectedTemplate || !previewCandidate) return selectedTemplate?.subject || "";
    return resolveMergeFields(selectedTemplate.subject, previewCandidate);
  }, [selectedTemplate, previewCandidate]);

  const previewBody = useMemo(() => {
    if (!selectedTemplate || !previewCandidate) return selectedTemplate?.body || "";
    return resolveMergeFields(selectedTemplate.body, previewCandidate);
  }, [selectedTemplate, previewCandidate]);

  const canProceed = () => {
    switch (step) {
      case 0: return name.trim().length > 0;
      case 1: return !!selectedTemplateId;
      case 2: return !!selectedProjectId && candidates.length > 0;
      case 3: return true;
      case 4: return !isBlocked;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1 && canProceed()) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

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
      resetAndClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    }
  };

  const resetAndClose = () => {
    setName("");
    setSelectedTemplateId("");
    setSelectedProjectId("");
    setStep(0);
    setPreviewIndex(0);
    onOpenChange(false);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); else onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        {/* Stepper header */}
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Create Campaign</DialogTitle>
            <DialogDescription className="text-xs">
              Step {step + 1} of {STEPS.length} — {STEPS[step].label}
            </DialogDescription>
          </DialogHeader>

          {/* Progress bar */}
          <Progress value={progress} className="h-1 mt-4" />

          {/* Step indicators */}
          <div className="flex items-center justify-between mt-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <button
                  key={s.id}
                  onClick={() => { if (isDone) setStep(i); }}
                  disabled={!isDone}
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-medium transition-all rounded-full px-2 py-1",
                    isActive && "text-primary bg-primary/10",
                    isDone && "text-success cursor-pointer hover:bg-success/10",
                    !isActive && !isDone && "text-muted-foreground/40"
                  )}
                >
                  {isDone ? (
                    <div className="h-4 w-4 rounded-full bg-success flex items-center justify-center">
                      <Check className="h-2.5 w-2.5 text-success-foreground" />
                    </div>
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Step content */}
        <div className="px-6 py-5 min-h-[260px] flex flex-col">
          {/* Step 0: Name */}
          {step === 0 && (
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full space-y-4">
              <div className="text-center space-y-1">
                <h3 className="font-display font-semibold text-base">Name your campaign</h3>
                <p className="text-xs text-muted-foreground">Give it a descriptive name so you can find it later</p>
              </div>
              <Input
                placeholder="e.g. ICU Nurse Outreach — March"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-center text-sm"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && canProceed()) handleNext(); }}
              />
            </div>
          )}

          {/* Step 1: Template */}
          {step === 1 && (
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-base">Choose an email template</h3>
                <p className="text-xs text-muted-foreground">Select the template to use for this campaign's emails</p>
              </div>
              {templates.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplateId(t.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        selectedTemplateId === t.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                          selectedTemplateId === t.id ? "bg-primary/15" : "bg-secondary"
                        )}>
                          <Mail className={cn("h-3.5 w-3.5", selectedTemplateId === t.id ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{t.subject || "No subject"}</p>
                        </div>
                        {selectedTemplateId === t.id && (
                          <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                    <FileText className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No templates yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Create an email template first</p>
                  {onOpenTemplateEditor && (
                    <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => { resetAndClose(); onOpenTemplateEditor(); }}>
                      <Plus className="h-3.5 w-3.5" /> Create Template
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Recipients */}
          {step === 2 && (
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-base">Select recipients</h3>
                <p className="text-xs text-muted-foreground">Choose a project — all its candidates become recipients</p>
              </div>
              {projects.length > 0 ? (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProjectId(p.id); setPreviewIndex(0); }}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        selectedProjectId === p.id
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30 hover:bg-secondary/50"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0",
                          selectedProjectId === p.id ? "bg-primary/15" : "bg-secondary"
                        )}>
                          <Users className={cn("h-3.5 w-3.5", selectedProjectId === p.id ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          {p.description && <p className="text-[11px] text-muted-foreground truncate">{p.description}</p>}
                        </div>
                        {selectedProjectId === p.id && (
                          <Check className="h-4 w-4 text-primary ml-auto flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-secondary flex items-center justify-center mb-3">
                    <Users className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No projects yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Create a project and add candidates first</p>
                </div>
              )}
              {selectedProjectId && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
                  candidates.length > 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                )}>
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-medium">
                    {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} will receive this campaign
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && previewCandidate && selectedTemplate && (
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h3 className="font-display font-semibold text-base">Preview emails</h3>
                  <p className="text-xs text-muted-foreground">
                    Showing personalized email for <span className="font-medium text-foreground">{previewCandidate.full_name}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={previewIndex === 0} onClick={() => setPreviewIndex((i) => i - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-center">
                    {previewIndex + 1}/{candidates.length}
                  </span>
                  <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={previewIndex >= candidates.length - 1} onClick={() => setPreviewIndex((i) => i + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-2.5 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">To</p>
                  <p>{previewCandidate.email || "No email available"}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Subject</p>
                  <p className="font-medium">{previewSubject}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Body</p>
                  <div className="whitespace-pre-wrap leading-relaxed bg-background rounded-md p-3 border border-border text-[13px] max-h-[140px] overflow-y-auto">
                    {previewBody || <span className="text-muted-foreground italic">Empty body</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Confirm */}
          {step === 4 && (
            <div className="flex-1 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="font-display font-semibold text-base">Review & create</h3>
                <p className="text-xs text-muted-foreground">Confirm the details before creating your campaign</p>
              </div>

              <div className="space-y-2">
                {[
                  { label: "Campaign", value: name },
                  { label: "Template", value: selectedTemplate?.name || "—" },
                  { label: "Recipients", value: `${candidates.length} candidates` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center px-3 py-2 rounded-lg bg-secondary/50 text-sm">
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {/* Quota bar */}
              <div className="space-y-2 px-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Daily sending quota</span>
                  <span className="font-medium">{sentToday} / {dailyLimit}</span>
                </div>
                <div className="relative">
                  <Progress value={(sentToday / dailyLimit) * 100} className="h-2" />
                  {willSend > 0 && (
                    <div
                      className="absolute top-0 h-2 bg-primary/40 rounded-r-full"
                      style={{
                        left: `${(sentToday / dailyLimit) * 100}%`,
                        width: `${(willSend / dailyLimit) * 100}%`,
                      }}
                    />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">{remaining} emails remaining today</p>
              </div>

              {isBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-destructive">
                    Daily limit reached. Try again tomorrow or increase your limit in settings.
                  </p>
                </div>
              )}

              {isPartial && !isBlocked && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-warning">
                    Only {willSend} of {candidates.length} emails will send. {willSkip} will be skipped due to your daily limit.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={step === 0 ? resetAndClose : handleBack} className="gap-1.5">
            {step === 0 ? "Cancel" : <><ChevronLeft className="h-3.5 w-3.5" /> Back</>}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={handleNext} disabled={!canProceed()} className="gap-1.5">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!canProceed() || createCampaign.isPending}
              className="gap-1.5"
            >
              {createCampaign.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Create Campaign</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
