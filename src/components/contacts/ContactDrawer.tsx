import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  X,
  Plus,
  ChevronDown,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Tag as TagIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import type { MockContact, MockExperience } from "@/data/mock-contacts";
import { ALL_STATUSES } from "@/data/mock-contacts";
import { useState } from "react";

function CompanyAvatar({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="rounded-md object-cover bg-muted shrink-0"
      style={{ width: size, height: size }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div
      className="rounded-md bg-secondary text-secondary-foreground flex items-center justify-center text-xs font-semibold shrink-0"
      style={{ width: size, height: size }}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function statusColor(status: MockContact["status"]) {
  switch (status) {
    case "Replied":
      return "bg-success/10 text-success border-success/20";
    case "Email Sent":
      return "bg-primary/10 text-primary border-primary/20";
    case "Shortlisted":
      return "bg-warning/10 text-warning border-warning/20";
    case "Hired":
      return "bg-success/15 text-success border-success/30";
    case "Rejected":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-secondary text-secondary-foreground border-border";
  }
}

function ExperienceCard({ exp }: { exp: MockExperience }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (exp.description?.length ?? 0) > 140;
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card">
      <CompanyAvatar src={exp.companyLogo} name={exp.company} size={36} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold truncate">{exp.company}</p>
        </div>
        <p className="text-sm text-foreground/80">{exp.role}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {exp.startDate} – {exp.endDate} · {exp.duration}
        </p>
        {exp.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {exp.location}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {exp.salary && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {exp.salary}
            </Badge>
          )}
          {exp.fundingStage && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {exp.fundingStage}
            </Badge>
          )}
        </div>
        {exp.description && (
          <p className="text-xs text-foreground/70 mt-2 leading-relaxed">
            {expanded || !isLong ? exp.description : `${exp.description.slice(0, 140)}…`}
            {isLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="ml-1 text-primary hover:underline"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function ContactDrawer({
  contact,
  open,
  onOpenChange,
  onPrev,
  onNext,
}: {
  contact: MockContact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [status, setStatus] = useState<MockContact["status"] | null>(null);
  const [note, setNote] = useState("");
  if (!contact) return null;

  const currentStatus = status ?? contact.status;
  const primaryProject = contact.projects[0] ?? "Project";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col gap-0"
      >
        {/* Top icon row */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              title="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={onNext}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              title="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info("Open in new tab — stub")}>
                  Open in new tab
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Copy link — stub")}>
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => toast.info("Delete contact — stub")}
                >
                  Delete contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-border">
          <h2 className="text-xl font-bold font-display">{contact.fullName}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3" />
            {contact.location}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px]">
              <CompanyAvatar src={contact.organizationLogo} name={contact.organization} size={14} />
              {contact.organization}
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px]">
              <CompanyAvatar src={contact.educationLogo} name={contact.education} size={14} />
              {contact.education}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor(currentStatus)}`}
                  >
                    {currentStatus}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ALL_STATUSES.map((s) => (
                    <DropdownMenuItem key={s} onClick={() => setStatus(s)}>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {contact.subStatus && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {contact.subStatus}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Awaiting Reply</DropdownMenuItem>
                    <DropdownMenuItem>Replied</DropdownMenuItem>
                    <DropdownMenuItem>No Response</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div className="flex items-stretch rounded-md overflow-hidden">
              <Button
                size="sm"
                className="rounded-r-none gap-1.5 h-7 text-xs px-2.5"
                onClick={() => toast.success(`Added to ${primaryProject}`)}
              >
                <Plus className="h-3 w-3" />
                Add to {primaryProject.length > 12 ? `${primaryProject.slice(0, 12)}…` : primaryProject}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-1.5 h-7">
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => toast.info("Add to campaign — stub")}>
                    Add to campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Add tag — stub")}>
                    Add tag
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => toast.info("Remove from project — stub")}
                  >
                    Remove from project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 mt-3 self-start">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="experience" className="text-xs">Experience</TabsTrigger>
            <TabsTrigger value="education" className="text-xs">Education</TabsTrigger>
            <TabsTrigger value="skills" className="text-xs">Skills</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <TabsContent value="overview" className="mt-0 space-y-5">
              <Field label="Status">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusColor(currentStatus)}`}>
                  {currentStatus}
                </span>
              </Field>

              <Field label="Contact">
                <div className="space-y-1">
                  {contact.profiles.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{contact.profiles.email}</span>
                      {contact.profiles.emailVerified && (
                        <Badge variant="outline" className="text-[9px] py-0 h-4 border-success/30 text-success">verified</Badge>
                      )}
                    </div>
                  )}
                  {contact.profiles.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{contact.profiles.phone}</span>
                    </div>
                  )}
                </div>
              </Field>

              <Field label="Activity">
                <p className="text-sm text-foreground/80 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  {contact.lastContactedAt
                    ? `Last contacted on ${new Date(contact.lastContactedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : "Never contacted"}
                </p>
              </Field>

              <Field label="Tags">
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                  <button
                    onClick={() => toast.info("Add tag — stub")}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    Add
                  </button>
                </div>
              </Field>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-semibold">Experience</h3>
                  <p className="text-[11px] text-muted-foreground">
                    {contact.totalYears} yrs total · {contact.avgTenureYears} yrs avg tenure
                  </p>
                </div>
                <div className="space-y-2">
                  {contact.experience.slice(0, 3).map((e, idx) => (
                    <ExperienceCard key={idx} exp={e} />
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="experience" className="mt-0 space-y-2">
              {contact.experience.map((e, idx) => (
                <ExperienceCard key={idx} exp={e} />
              ))}
            </TabsContent>

            <TabsContent value="education" className="mt-0 space-y-2">
              {contact.educationList.map((ed, idx) => (
                <div key={idx} className="flex gap-3 p-3 rounded-lg border border-border bg-card">
                  <CompanyAvatar src={ed.schoolLogo} name={ed.school} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{ed.school}</p>
                    <p className="text-sm text-foreground/80">
                      {ed.degree}{ed.major ? ` · ${ed.major}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ed.startYear} – {ed.endYear}
                    </p>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="skills" className="mt-0">
              <div className="flex flex-wrap gap-1.5">
                {contact.skills.map((s) => (
                  <Badge key={s} variant="outline" className="text-[11px] font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-3">
              <div className="space-y-2">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add an internal note…"
                  rows={3}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!note.trim()}
                    onClick={() => {
                      toast.success("Note added");
                      setNote("");
                    }}
                  >
                    Add note
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Activity
                </p>
                {contact.lastContactedAt ? (
                  <div className="text-xs p-3 rounded-lg border border-border bg-card">
                    <p className="font-medium">Email sent</p>
                    <p className="text-muted-foreground mt-0.5">
                      {new Date(contact.lastContactedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No activity yet.</p>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5 flex items-center gap-1">
        {label === "Tags" && <TagIcon className="h-3 w-3" />}
        {label}
      </p>
      {children}
    </div>
  );
}
