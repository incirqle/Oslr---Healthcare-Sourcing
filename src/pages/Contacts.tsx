import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search as SearchIcon,
  RefreshCw,
  ChevronDown,
  Mail,
  Phone,
  Linkedin,
  Twitter,
  Globe,
  Plus,
  X,
  Tag as TagIcon,
  Download,
  Upload,
  FolderPlus,
  Send,
  Activity,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Mail as MailIcon,
} from "lucide-react";
import { AddFilterButton, type ContactFilter } from "@/components/contacts/AddFilterButton";
import { ContactDrawer } from "@/components/contacts/ContactDrawer";
import {
  MOCK_CONTACTS,
  ALL_PROJECTS,
  ALL_TAGS,
  type MockContact,
} from "@/data/mock-contacts";
import { toast } from "sonner";
import { useNavigate as useNav } from "react-router-dom";

const PAGE_SIZE = 50;

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

function ProfileIcons({ contact }: { contact: MockContact }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const handleCopy = (val: string, label: string) => {
    navigator.clipboard?.writeText(val);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex items-center gap-1">
      {contact.profiles.linkedin && (
        <a
          href={contact.profiles.linkedin}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="p-1 rounded hover:bg-secondary transition"
          title="LinkedIn"
        >
          <Linkedin className="h-3.5 w-3.5" style={{ color: "#0A66C2" }} />
        </a>
      )}
      {contact.profiles.email && (
        <button
          onClick={(e) => { stop(e); handleCopy(contact.profiles.email!, "Email"); }}
          className="p-1 rounded hover:bg-secondary transition"
          title={contact.profiles.email}
        >
          <Mail
            className="h-3.5 w-3.5"
            style={{ color: contact.profiles.emailVerified ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}
          />
        </button>
      )}
      {contact.profiles.phone && (
        <button
          onClick={(e) => { stop(e); handleCopy(contact.profiles.phone!, "Phone"); }}
          className="p-1 rounded hover:bg-secondary transition"
          title={contact.profiles.phone}
        >
          <Phone className="h-3.5 w-3.5" style={{ color: "#8B5CF6" }} />
        </button>
      )}
      {contact.profiles.crunchbase && (
        <a
          href={contact.profiles.crunchbase}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="p-1 rounded hover:bg-secondary transition"
          title="Crunchbase"
        >
          <Globe className="h-3.5 w-3.5" style={{ color: "#F97316" }} />
        </a>
      )}
      {contact.profiles.twitter && (
        <a
          href={contact.profiles.twitter}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="p-1 rounded hover:bg-secondary transition"
          title="Twitter / X"
        >
          <Twitter className="h-3.5 w-3.5 text-foreground" />
        </a>
      )}
    </div>
  );
}

function ProjectPills({ projects }: { projects: string[] }) {
  if (projects.length === 0)
    return <span className="text-xs text-muted-foreground">—</span>;
  const visible = projects.slice(0, 2);
  const remaining = projects.length - visible.length;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((p) => (
        <Badge key={p} variant="outline" className="text-[10px] font-normal max-w-[120px] truncate">
          {p}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="secondary" className="text-[10px] font-normal">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
}

function CompanyAvatar({ src, name }: { src?: string; name: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="h-5 w-5 rounded object-cover bg-muted shrink-0"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  ) : (
    <div className="h-5 w-5 rounded bg-secondary flex items-center justify-center text-[8px] font-semibold shrink-0">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Contacts() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<ContactFilter[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Open drawer from URL param
  useEffect(() => {
    const id = searchParams.get("contact");
    if (id) {
      setActiveContactId(id);
      setDrawerOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return MOCK_CONTACTS;
    return MOCK_CONTACTS.filter((c) =>
      [c.fullName, c.organization, c.currentRole, c.profiles.email ?? ""]
        .some((s) => s.toLowerCase().includes(q))
    );
  }, [debouncedSearch]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filters.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageContacts = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allChecked =
    pageContacts.length > 0 && pageContacts.every((c) => selected.has(c.id));
  const someChecked = pageContacts.some((c) => selected.has(c.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        pageContacts.forEach((c) => next.delete(c.id));
      } else {
        pageContacts.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openContact = (c: MockContact) => {
    setActiveContactId(c.id);
    setDrawerOpen(true);
    setSearchParams({ contact: c.id }, { replace: true });
  };

  const closeDrawer = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) {
      setActiveContactId(null);
      const next = new URLSearchParams(searchParams);
      next.delete("contact");
      setSearchParams(next, { replace: true });
    }
  };

  const activeIndex = filtered.findIndex((c) => c.id === activeContactId);
  const activeContact = activeIndex >= 0 ? filtered[activeIndex] : null;

  const goPrev = () => {
    if (activeIndex > 0) {
      const c = filtered[activeIndex - 1];
      setActiveContactId(c.id);
      setSearchParams({ contact: c.id }, { replace: true });
    }
  };
  const goNext = () => {
    if (activeIndex >= 0 && activeIndex < filtered.length - 1) {
      const c = filtered[activeIndex + 1];
      setActiveContactId(c.id);
      setSearchParams({ contact: c.id }, { replace: true });
    }
  };

  const addFilter = (f: ContactFilter) => {
    if (filters.includes(f)) return;
    setFilters([...filters, f]);
  };
  const removeFilter = (f: ContactFilter) =>
    setFilters(filters.filter((x) => x !== f));

  const selectedCount = selected.size;

  return (
    <AppLayout>
      <div className="space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-display text-foreground">
              All Contacts ({MOCK_CONTACTS.length.toLocaleString()})
            </h1>
            <button
              onClick={() => toast.success("Refreshed")}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Actions
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => toast.info("Import CSV — opens upload modal (stub)")}>
                <Upload className="h-3.5 w-3.5 mr-2" />
                Import Contacts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.success("Exporting current view…")}>
                <Download className="h-3.5 w-3.5 mr-2" />
                Export
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <TagIcon className="h-3.5 w-3.5 mr-2" />
                  Add Tag
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {ALL_TAGS.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => toast.success(`Tag "${t}" added`)}>
                      {t}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toast.info("Create new tag — stub")}>
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Create new tag
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderPlus className="h-3.5 w-3.5 mr-2" />
                  Shortlist in Project
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {ALL_PROJECTS.map((p) => (
                    <DropdownMenuItem key={p} onClick={() => toast.success(`Shortlisted in "${p}"`)}>
                      {p}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem onClick={() => toast.info("Add to campaign — stub")}>
                <Send className="h-3.5 w-3.5 mr-2" />
                Add to Campaign
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Activity className="h-3.5 w-3.5 mr-2" />
                  Log Activity
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {["Email Sent", "Call", "Meeting", "Note"].map((a) => (
                    <DropdownMenuItem key={a} onClick={() => toast.success(`${a} logged`)}>
                      {a}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, etc."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <AddFilterButton onAdd={addFilter} />
        </div>

        {/* Active filter chips */}
        {filters.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5">
            {filters.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[11px]"
              >
                {f}
                <button
                  onClick={() => removeFilter(f)}
                  className="hover:text-destructive transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={() => setFilters([])}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Table */}
        {MOCK_CONTACTS.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                  <MailIcon className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No contacts yet</p>
                <p className="text-xs mt-1 opacity-60 max-w-sm text-center">
                  Source candidates with Search to build your contact database.
                </p>
                <Button size="sm" className="mt-4" onClick={() => navigate("/search")}>
                  Go to Search
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={toggleAll}
                          aria-label="Select all"
                          className={someChecked && !allChecked ? "data-[state=unchecked]:bg-primary/30" : ""}
                        />
                      </TableHead>
                      <TableHead className="font-medium">Full Name</TableHead>
                      <TableHead className="font-medium">Profiles</TableHead>
                      <TableHead className="font-medium">Projects</TableHead>
                      <TableHead className="font-medium">Tags</TableHead>
                      <TableHead className="font-medium">Current Role</TableHead>
                      <TableHead className="font-medium">Organization</TableHead>
                      <TableHead className="font-medium">Education</TableHead>
                      <TableHead className="font-medium">Location</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Date Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageContacts.map((c) => {
                      const isSelected = selected.has(c.id);
                      return (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer hover:bg-secondary/30 transition-colors group"
                          data-state={isSelected ? "selected" : undefined}
                          onClick={() => openContact(c)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(c.id)}
                              aria-label={`Select ${c.fullName}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <span className="text-foreground hover:text-primary transition">
                              {c.fullName}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] ${statusColor(c.status)}`}
                              >
                                {c.status}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <ProfileIcons contact={c} />
                          </TableCell>
                          <TableCell>
                            <ProjectPills projects={c.projects} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {c.tags.length === 0 ? (
                              <button
                                onClick={() => toast.info("Tag picker — stub")}
                                className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                Add Tags
                              </button>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {c.tags.slice(0, 2).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                                    {t}
                                  </Badge>
                                ))}
                                {c.tags.length > 2 && (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    +{c.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-foreground/80 max-w-[180px] truncate">
                            {c.currentRole}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <CompanyAvatar src={c.organizationLogo} name={c.organization} />
                              <span className="text-foreground/80 truncate max-w-[160px]">{c.organization}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <CompanyAvatar src={c.educationLogo} name={c.education} />
                              <span className="text-foreground/80 truncate max-w-[160px]">{c.education}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {c.location}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(c.dateCreated)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border text-xs text-muted-foreground">
                <span>
                  Showing {page * PAGE_SIZE + 1}–
                  {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="px-2">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky bulk-action footer */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-card border border-border rounded-full shadow-lg px-4 py-2">
          <span className="text-sm font-medium pr-2 border-r border-border">
            {selectedCount} selected
          </span>
          <button
            onClick={() => toast.info("Add tag — stub")}
            className="text-xs text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition flex items-center gap-1"
          >
            <TagIcon className="h-3 w-3" /> Add Tag
          </button>
          <button
            onClick={() => toast.info("Shortlist in project — stub")}
            className="text-xs text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition flex items-center gap-1"
          >
            <FolderPlus className="h-3 w-3" /> Shortlist
          </button>
          <button
            onClick={() => toast.info("Add to campaign — stub")}
            className="text-xs text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition flex items-center gap-1"
          >
            <Send className="h-3 w-3" /> Campaign
          </button>
          <button
            onClick={() => toast.info("Log activity — stub")}
            className="text-xs text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition flex items-center gap-1"
          >
            <Activity className="h-3 w-3" /> Log
          </button>
          <button
            onClick={() => toast.success(`Exporting ${selectedCount} contacts…`)}
            className="text-xs text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition flex items-center gap-1"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <button
            onClick={() => toast.info("Delete — stub")}
            className="text-xs text-destructive hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition flex items-center gap-1"
          >
            <Trash2 className="h-3 w-3" /> Delete
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary transition ml-1"
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <ContactDrawer
        contact={activeContact}
        open={drawerOpen}
        onOpenChange={closeDrawer}
        onPrev={activeIndex > 0 ? goPrev : undefined}
        onNext={activeIndex >= 0 && activeIndex < filtered.length - 1 ? goNext : undefined}
      />
    </AppLayout>
  );
}
