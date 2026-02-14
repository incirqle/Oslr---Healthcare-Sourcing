import { useState, useRef } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { useCreateTemplate, useUpdateTemplate } from "@/hooks/useCampaigns";
import { toast } from "sonner";

const MERGE_FIELDS = [
  { key: "{{full_name}}", label: "Full Name" },
  { key: "{{first_name}}", label: "First Name" },
  { key: "{{title}}", label: "Job Title" },
  { key: "{{current_employer}}", label: "Employer" },
  { key: "{{location}}", label: "Location" },
  { key: "{{email}}", label: "Email" },
];

interface TemplateEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: { id: string; name: string; subject: string; body: string } | null;
}

export function TemplateEditor({ open, onOpenChange, template }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || "");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const isEditing = !!template;
  const saving = createTemplate.isPending || updateTemplate.isPending;

  // Reset form when dialog opens with new template
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setName(template?.name || "");
      setSubject(template?.subject || "");
      setBody(template?.body || "");
    }
    onOpenChange(open);
  };

  const insertMergeField = (field: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.substring(0, start) + field + body.substring(end);
    setBody(newBody);
    // Restore focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + field.length, start + field.length);
    }, 0);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) return;
    try {
      if (isEditing) {
        await updateTemplate.mutateAsync({ id: template.id, name: name.trim(), subject: subject.trim(), body });
        toast.success("Template updated");
      } else {
        await createTemplate.mutateAsync({ name: name.trim(), subject: subject.trim(), body });
        toast.success("Template created");
      }
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">{isEditing ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>
            Use merge fields to personalize emails for each candidate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Template name</Label>
            <Input
              placeholder="e.g. Initial Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject line</Label>
            <Input
              ref={subjectRef}
              placeholder="e.g. Exciting opportunity at {{current_employer}}"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Email body</Label>
              <span className="text-[10px] text-muted-foreground">Click merge fields to insert</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {MERGE_FIELDS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => insertMergeField(f.key)}
                  className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Textarea
              ref={bodyRef}
              placeholder={`Hi {{first_name}},\n\nI came across your profile and was impressed by your experience as a {{title}} at {{current_employer}}.\n\nWe have an exciting opportunity that might be a great fit...\n\nBest regards`}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || !subject.trim() || saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</> : isEditing ? "Update Template" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
