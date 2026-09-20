import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search as SearchIcon,
  Mail,
  Phone,
  Linkedin,
  X,
  Download,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useProjects } from "@/hooks/useProjects";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { STATUS_CONFIG, type CandidateStatus } from "@/types/project";
import { toast } from "sonner";

const PAGE_SIZE = 50;

interface ContactRow {
  id: string;
  full_name: string;
  title: string | null;
  current_employer: string | null;
  location: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  skills: string[] | null;
  status: string;
  tags: string[] | null;
  notes: string | null;
  person_id: string | null;
  project_id: string;
  raw_data: unknown;
  created_at: string;
  projects: { name: string } | null;
}

/** All saved candidates across the company's projects — the real contact book. */
function useAllContacts() {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["all_contacts", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, full_name, title, current_employer, location, linkedin_url, email, phone, skills, status, tags, notes, person_id, project_id, raw_data, created_at, projects(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ContactRow[];
    },
  });
}

function useDeleteContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("candidates").delete().in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all_contacts"] });
      qc.invalidateQueries({ queryKey: ["project_candidate_counts"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });
}

function statusBadge(status: string) {
  const cfg = STATUS_CONFIG[status as CandidateStatus];
  return cfg ?? { label: status, color: "bg-secondary text-secondary-foreground" };
}

function ProfileIcons({ c }: { c: ContactRow }) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const copy = (val: string, label: string) => {
    navigator.clipboard?.writeText(val);
    toast.success(`${label} copied`);
  };
  return (
    <div className="flex items-center gap-1">
      {c.linkedin_url && (
        <a
          href={c.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={stop}
          className="p-1 rounded hover:bg-secondary transition"
          title="LinkedIn"
        >
          <Linkedin className="h-3.5 w-3.5" style={{ color: "#0A66C2" }} />
        </a>
      )}
      {c.email && (
        <button
          onClick={(e) => { stop(e); copy(c.email!, "Email"); }}
          className="p-1 rounded hover:bg-secondary transition"
          title={c.email}
        >
          <Mail className="h-3.5 w-3.5 text-success" />
        </button>
      )}
      {c.phone && (
        <button
          onClick={(e) => { stop(e); copy(c.phone!, "Phone"); }}
          className="p-1 rounded hover:bg-secondary transition"
          title={c.phone}
        >
          <Phone className="h-3.5 w-3.5" style={{ color: "#8B5CF6" }} />
        </button>
      )}
    </div>
  );
}

function toCsv(rows: ContactRow[]): string {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Full Name", "Title", "Organization", "Location", "Email", "Phone", "LinkedIn", "Project", "Status", "Date Added"];
  const lines = rows.map((c) =>
    [c.full_name, c.title, c.current_employer, c.location, c.email, c.phone, c.linkedin_url, c.projects?.name, c.status, c.created_at?.slice(0, 10)]
      .map(esc).join(",")
  );
  return [header.map(esc).join(","), ...lines].join("\n");
}

function downloadCsv(rows: ContactRow[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `oslr-contacts-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Contacts() {
  const navigate = useNavigate();
  const { data: contacts = [], isLoading } = useAllContacts();
  const { data: projects = [] } = useProjects();
  const deleteContacts = useDeleteContacts();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [drawerContact, setDrawerContact] = useState<ContactRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      if (projectFilter.size > 0 && !projectFilter.has(c.project_id)) return false;
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false;
      if (!q) return true;
      return [c.full_name, c.current_employer ?? "", c.title ?? "", c.email ?? "", c.location ?? "", c.projects?.name ?? ""]
        .some((s) => s.toLowerCase().includes(q));
    });
  }, [contacts, debouncedSearch, projectFilter, statusFilter]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, projectFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageContacts = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const allChecked = pageContacts.length > 0 && pageContacts.every((c) => selected.has(c.id));
  const someChecked = pageContacts.some((c) => selected.has(c.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) pageContacts.forEach((c) => next.delete(c.id));
      else pageContacts.forEach((c) => next.add(c.id));
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

  const toggleSetValue = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const handleDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      await deleteContacts.mutateAsync(ids);
      toast.success(`${ids.length} contact${ids.length === 1 ? "" : "s"} removed`);
      setSelected(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const selectedRows = contacts.filter((c) => selected.has(c.id));
  const selectedCount = selected.size;

  const activeIndex = drawerContact ? filtered.findIndex((c) => c.id === drawerContact.id) : -1;

  // The drawer keys notes / fit / enrichment by the provider person id, so
  // saved contacts open with the SAME identity they had in search results.
  const toDrawerCandidate = (c: ContactRow) => ({
    ...c,
    id: c.person_id || c.id,
    skills: c.skills ?? [],
    avg_tenure_months: null,
    industry: null,
    company_size: null,
    raw: (c.raw_data ?? undefined) as Record<string, unknown> | undefined,
  });

  return (
    <AppLayout>
      <div className="space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display text-foreground">
            All Contacts ({contacts.length.toLocaleString()})
          </h1>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => downloadCsv(filtered)}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, role, project..."
              className="pl-8 h-9 text-sm"
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Project{projectFilter.size > 0 ? ` (${projectFilter.size})` : ""}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 max-h-72 overflow-y-auto">
              {projects.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={projectFilter.has(p.id)}
                  onCheckedChange={() => setProjectFilter((prev) => toggleSetValue(prev, p.id))}
                >
                  {p.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Status{statusFilter.size > 0 ? ` (${statusFilter.size})` : ""}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={statusFilter.has(key)}
                  onCheckedChange={() => setStatusFilter((prev) => toggleSetValue(prev, key))}
                >
                  {cfg.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {(projectFilter.size > 0 || statusFilter.size > 0) && (
            <button
              onClick={() => { setProjectFilter(new Set()); setStatusFilter(new Set()); }}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Table / empty state */}
        {!isLoading && contacts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                  <Users className="h-6 w-6 opacity-30" />
                </div>
                <p className="text-sm font-medium">No contacts yet</p>
                <p className="text-xs mt-1 opacity-60 max-w-sm text-center">
                  Save candidates from a project search to build your contact database.
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
                      <TableHead className="font-medium">Project</TableHead>
                      <TableHead className="font-medium">Tags</TableHead>
                      <TableHead className="font-medium">Current Role</TableHead>
                      <TableHead className="font-medium">Organization</TableHead>
                      <TableHead className="font-medium">Location</TableHead>
                      <TableHead className="font-medium whitespace-nowrap">Date Added</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageContacts.map((c) => {
                      const isSelected = selected.has(c.id);
                      const badge = statusBadge(c.status);
                      return (
                        <TableRow
                          key={c.id}
                          className="cursor-pointer hover:bg-secondary/30 transition-colors group"
                          data-state={isSelected ? "selected" : undefined}
                          onClick={() => setDrawerContact(c)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(c.id)}
                              aria-label={`Select ${c.full_name}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-sm">
                            <span className="text-foreground hover:text-primary transition">
                              {c.full_name}
                            </span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[9px] ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <ProfileIcons c={c} />
                          </TableCell>
                          <TableCell>
                            {c.projects?.name ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal max-w-[140px] truncate cursor-pointer hover:bg-secondary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/projects/${c.project_id}`);
                                }}
                              >
                                {c.projects.name}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(c.tags ?? []).length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(c.tags ?? []).slice(0, 2).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px] font-normal">
                                    {t}
                                  </Badge>
                                ))}
                                {(c.tags ?? []).length > 2 && (
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    +{(c.tags ?? []).length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-foreground/80 max-w-[180px] truncate">
                            {c.title ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-foreground/80 max-w-[180px] truncate">
                            {c.current_employer ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {c.location ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(c.created_at)}
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
                  {filtered.length === 0
                    ? "No contacts match"
                    : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
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
            onClick={() => downloadCsv(selectedRows)}
            className="text-xs text-foreground/80 hover:text-foreground px-2 py-1 rounded hover:bg-secondary transition flex items-center gap-1"
          >
            <Download className="h-3 w-3" /> Export
          </button>
          <button
            onClick={handleDelete}
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

      <CandidateDrawer
        open={!!drawerContact}
        onOpenChange={(open) => !open && setDrawerContact(null)}
        candidate={drawerContact ? toDrawerCandidate(drawerContact) : null}
        savedContactId={drawerContact?.id ?? null}
        projectId={drawerContact?.project_id}
        onPrev={() => {
          if (activeIndex > 0) setDrawerContact(filtered[activeIndex - 1]);
        }}
        onNext={() => {
          if (activeIndex >= 0 && activeIndex < filtered.length - 1) {
            setDrawerContact(filtered[activeIndex + 1]);
          }
        }}
        hasPrev={activeIndex > 0}
        hasNext={activeIndex >= 0 && activeIndex < filtered.length - 1}
      />
    </AppLayout>
  );
}
