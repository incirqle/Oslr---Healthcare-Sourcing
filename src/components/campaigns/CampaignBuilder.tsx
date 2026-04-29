import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  GripVertical,
  Mail,
  Clock,
  Plus,
  Trash2,
  Pencil,
  Settings as SettingsIcon,
  Sparkles,
  FileText,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MAILBOXES,
  MERGE_TAGS,
  type CampaignStep,
  type MockCampaign,
  type StepType,
} from "@/data/mock-campaigns";
import { CampaignSettingsModal } from "./CampaignSettingsModal";
import { RichEmailEditor } from "./RichEmailEditor";

const STEP_TYPES: StepType[] = ["Email", "Connection Request", "LinkedIn Message", "Call"];
const TIMEZONES = [
  "America/Denver (MDT -06:00)",
  "America/Los_Angeles (PDT -07:00)",
  "America/New_York (EDT -04:00)",
  "Europe/London (BST +01:00)",
];

function formatScheduled(step: CampaignStep): string {
  if (step.delayValue === 0) return "Immediately";
  const d = new Date();
  d.setDate(d.getDate() + (step.delayUnit === "days" ? step.delayValue : 0));
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) + ` (${step.timezone.split(" ")[1] ?? ""})`;
}

export function CampaignBuilder({
  campaign,
  open,
  onClose,
}: {
  campaign: MockCampaign;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [editingName, setEditingName] = useState(false);
  const [steps, setSteps] = useState<CampaignStep[]>(campaign.steps);
  const [activeIdx, setActiveIdx] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    useMultipleSenders: campaign.useMultipleSenders,
    newThreadPerSender: campaign.newThreadPerSender,
  });
  const [showCcBcc, setShowCcBcc] = useState(false);
  const insertFnRef = useRef<((text: string) => void) | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const active = steps[activeIdx] ?? steps[0];

  const updateStep = (patch: Partial<CampaignStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === activeIdx ? { ...s, ...patch } : s)));
  };

  const addStep = () => {
    const newStep: CampaignStep = {
      id: `step-${Date.now()}`,
      type: "Email",
      subject: "",
      body: "<p></p>",
      fromMailbox: MAILBOXES[0],
      replyInThread: steps.length > 0,
      delayValue: 2,
      delayUnit: "days",
      businessHoursOnly: true,
      timezone: TIMEZONES[0],
    };
    setSteps([...steps, newStep]);
    setActiveIdx(steps.length);
  };

  const deleteStep = (idx: number) => {
    if (steps.length === 1) {
      toast.error("A campaign must have at least one step.");
      return;
    }
    setSteps(steps.filter((_, i) => i !== idx));
    setActiveIdx(Math.max(0, activeIdx - (idx <= activeIdx ? 1 : 0)));
  };

  const handleDrop = (toIdx: number) => {
    if (draggingIdx === null || draggingIdx === toIdx) return;
    const next = [...steps];
    const [moved] = next.splice(draggingIdx, 1);
    next.splice(toIdx, 0, moved);
    setSteps(next);
    setActiveIdx(toIdx);
    setDraggingIdx(null);
  };

  const insertMergeTag = (token: string) => {
    if (insertFnRef.current) insertFnRef.current(token);
    else toast.info("Place cursor in the body first");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] p-0 gap-0 rounded-none border-none flex flex-col">
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b border-border shrink-0">
          <h2 className="text-sm font-semibold">Create campaign</h2>
          <Button
            size="sm"
            onClick={() => {
              toast.success("Campaign saved");
              onClose();
            }}
          >
            Save
          </Button>
        </div>

        {/* Sub-header */}
        <div className="h-14 px-5 flex items-center justify-between border-b border-border shrink-0">
          <div className="flex flex-col">
            {editingName ? (
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                className="h-7 text-base font-semibold w-[300px]"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1.5 text-base font-semibold hover:text-primary transition"
              >
                {name}
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            )}
            <span className="text-[11px] text-muted-foreground">
              Created by {campaign.ownerName} ·{" "}
              {new Date(campaign.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Button>
        </div>

        {/* Body: left rail + right pane */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left rail */}
          <aside className="w-[280px] shrink-0 border-r border-border bg-secondary/20 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {steps.map((s, i) => (
                <button
                  key={s.id}
                  draggable
                  onDragStart={() => setDraggingIdx(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(i)}
                  onClick={() => setActiveIdx(i)}
                  className={cn(
                    "w-full text-left p-2.5 rounded-lg border transition flex gap-2",
                    activeIdx === i
                      ? "bg-card border-primary/40 shadow-sm"
                      : "bg-card/40 border-border hover:bg-card hover:border-border"
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 mt-0.5 shrink-0 cursor-grab" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">
                      Step {i + 1}: {s.type}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Mail className="h-2.5 w-2.5 shrink-0" />
                      {s.fromMailbox}
                    </p>
                    {i > 0 && s.type === "Email" && s.replyInThread && (
                      <Badge variant="secondary" className="text-[9px] mt-1 font-normal py-0 h-4">
                        Reply in same thread
                      </Badge>
                    )}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      {formatScheduled(s)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-3 border-t border-border">
              <Button variant="outline" size="sm" className="w-full" onClick={addStep}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add step
              </Button>
            </div>
          </aside>

          {/* Right pane — step editor */}
          <div className="flex-1 overflow-y-auto p-6 bg-background">
            {/* Top row */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <Badge className="bg-success/15 text-success border-success/30 text-[10px]">
                  Step {activeIdx + 1}
                </Badge>
                <Select
                  value={active.type}
                  onValueChange={(v) => updateStep({ type: v as StepType })}
                >
                  <SelectTrigger className="h-8 w-[180px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STEP_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeIdx > 0 && active.type === "Email" && active.replyInThread && (
                  <span className="text-xs text-muted-foreground">Reply in same thread</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => toast.info("Preview & test — stub")}>
                  Preview and test
                </Button>
                <button
                  onClick={() => deleteStep(activeIdx)}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="Delete step"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Step body */}
            {active.type === "Email" ? (
              <div className="space-y-4 max-w-3xl">
                <FieldRow label="From">
                  <Select
                    value={active.fromMailbox}
                    onValueChange={(v) => updateStep({ fromMailbox: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAILBOXES.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldRow>

                <FieldRow label="Subject">
                  <div className="flex items-center gap-2">
                    <Input
                      value={active.subject ?? ""}
                      onChange={(e) => updateStep({ subject: e.target.value })}
                      placeholder="Subject…"
                      className="h-9 text-sm flex-1"
                    />
                    <button
                      onClick={() => setShowCcBcc((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cc
                    </button>
                    <button
                      onClick={() => setShowCcBcc((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Bcc
                    </button>
                  </div>
                  {showCcBcc && (
                    <div className="space-y-1.5 mt-2">
                      <Input placeholder="Cc…" className="h-8 text-sm" />
                      <Input placeholder="Bcc…" className="h-8 text-sm" />
                    </div>
                  )}
                </FieldRow>

                {/* Action chips */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toast("AI Command — opens picker (stub)")}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] hover:bg-secondary transition"
                  >
                    <Sparkles className="h-3 w-3 text-primary" />
                    AI Command
                  </button>
                  <button
                    onClick={() => toast("Snippets — opens picker (stub)")}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[11px] hover:bg-secondary transition"
                  >
                    <FileText className="h-3 w-3" />
                    Snippets
                  </button>
                </div>

                {/* Merge tags */}
                <div className="flex items-center flex-wrap gap-1.5">
                  {MERGE_TAGS.map((m) => (
                    <button
                      key={m.token}
                      onClick={() => insertMergeTag(m.token)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"
                    >
                      {m.label}
                    </button>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">
                        More…
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {MERGE_TAGS.map((m) => (
                        <DropdownMenuItem
                          key={m.token}
                          onClick={() => insertMergeTag(m.token)}
                          className="text-xs"
                        >
                          {m.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <RichEmailEditor
                  value={active.body}
                  onChange={(html) => updateStep({ body: html })}
                  registerInsert={(fn) => (insertFnRef.current = fn)}
                />

                {/* Timing controls */}
                <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span>Send</span>
                    <Input
                      type="number"
                      min={0}
                      value={active.delayValue}
                      onChange={(e) => updateStep({ delayValue: parseInt(e.target.value || "0", 10) })}
                      className="w-20 h-8"
                    />
                    <Select
                      value={active.delayUnit}
                      onValueChange={(v) => updateStep({ delayUnit: v as "minutes" | "hours" | "days" })}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">minutes</SelectItem>
                        <SelectItem value="hours">hours</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                      </SelectContent>
                    </Select>
                    <span>after previous step</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={active.businessHoursOnly}
                      onCheckedChange={(v) => updateStep({ businessHoursOnly: v })}
                    />
                    <Label className="text-sm">Business hours only</Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm w-24">Timezone</Label>
                    <Select
                      value={active.timezone}
                      onValueChange={(v) => updateStep({ timezone: v })}
                    >
                      <SelectTrigger className="h-8 flex-1 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : active.type === "Call" ? (
              <div className="space-y-4 max-w-3xl">
                <FieldRow label="Call script / talking points">
                  <textarea
                    value={active.body}
                    onChange={(e) => updateStep({ body: e.target.value })}
                    rows={8}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                    placeholder="Outline what to say…"
                  />
                </FieldRow>
                <FieldRow label="Outcome options for the rep">
                  <p className="text-xs text-muted-foreground">
                    Connected · Voicemail · Wrong number · No answer · Not interested
                  </p>
                </FieldRow>
              </div>
            ) : (
              // Connection Request + LinkedIn Message
              <div className="space-y-4 max-w-3xl">
                <FieldRow label="Message">
                  <textarea
                    value={active.body}
                    onChange={(e) => updateStep({ body: e.target.value })}
                    rows={6}
                    maxLength={300}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                    placeholder="Keep it short — LinkedIn limits apply."
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {active.body.length}/300 characters
                  </p>
                </FieldRow>
                <div className="flex items-center flex-wrap gap-1.5">
                  {MERGE_TAGS.slice(0, 4).map((m) => (
                    <button
                      key={m.token}
                      onClick={() => updateStep({ body: active.body + " " + m.token })}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <CampaignSettingsModal
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          useMultipleSenders={settings.useMultipleSenders}
          newThreadPerSender={settings.newThreadPerSender}
          onChange={setSettings}
        />
      </DialogContent>
    </Dialog>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  );
}
