import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Search, Sparkles, Loader2, MapPin, Building2, ExternalLink, Clock, FolderPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SaveToProjectDialog } from "@/components/SaveToProjectDialog";
import { CandidateDrawer } from "@/components/CandidateDrawer";

interface Candidate {
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

const suggestions = [
  "Registered nurses in Dallas",
  "Cardiologists with ICU experience",
  "Travel nurses in California",
  "Nurse practitioners at HCA Healthcare",
  "Emergency room physicians in Houston",
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sqlUsed, setSqlUsed] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogCandidates, setSaveDialogCandidates] = useState<Candidate[]>([]);
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);

  const handleSearch = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setSearched(true);
    setSelected(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("pdl-search", {
        body: { query: q, size: 25 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setCandidates(data.candidates || []);
      setTotal(data.total || 0);
      setSqlUsed(data.sql_used || "");

      if (data.candidates?.length > 0) {
        toast.success(`Found ${data.total.toLocaleString()} matching professionals`);
      } else {
        toast.info("No results found. Try a different query.");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Search failed");
      setCandidates([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const formatTenure = (months: number | null) => {
    if (!months) return "—";
    if (months < 12) return `${months}mo`;
    const years = Math.floor(months / 12);
    const remaining = months % 12;
    return remaining > 0 ? `${years}y ${remaining}mo` : `${years}y`;
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  };

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  const openBulkSave = () => {
    setSaveDialogCandidates(selectedCandidates);
    setSaveDialogOpen(true);
  };

  const openSingleSave = (candidate: Candidate) => {
    setSaveDialogCandidates([candidate]);
    setSaveDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Search Candidates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Use natural language to find healthcare professionals
          </p>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="pt-6 pb-5">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                <Input
                  placeholder='Try: "Registered nurses in Dallas with 5+ years experience at HCA Healthcare"'
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-10 h-12 text-sm border-border focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:ring-[3px]"
                  disabled={loading}
                />
              </div>
              <Button className="h-12 px-6 font-medium" onClick={() => handleSearch()} disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleChipClick(s)}
                  disabled={loading}
                  className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base font-display">
                Results {searched && !loading && `(${total.toLocaleString()} found)`}
              </CardTitle>
              {selected.size > 0 && (
                <Button size="sm" variant="outline" onClick={openBulkSave}>
                  <FolderPlus className="h-3.5 w-3.5 mr-1.5" />
                  Save {selected.size} to Project
                </Button>
              )}
            </div>
            {sqlUsed && (
              <span className="text-[10px] font-mono text-muted-foreground/50 max-w-md truncate">
                {sqlUsed}
              </span>
            )}
          </CardHeader>
          <CardContent>
            {!searched && !loading && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                  <Search className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">Enter a search query to find healthcare professionals</p>
                <p className="text-xs mt-1.5 opacity-60">Powered by People Data Labs</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-sm font-medium">Searching healthcare professionals…</p>
                <p className="text-xs mt-1.5 opacity-60">Translating your query and searching the database</p>
              </div>
            )}

            {searched && !loading && candidates.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary mb-4">
                  <Search className="h-7 w-7 opacity-30" />
                </div>
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs mt-1.5 opacity-60">Try adjusting your search query</p>
              </div>
            )}

            {candidates.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selected.size === candidates.length && candidates.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="font-medium">Name</TableHead>
                      <TableHead className="font-medium">Title</TableHead>
                      <TableHead className="font-medium">Employer</TableHead>
                      <TableHead className="font-medium">Location</TableHead>
                      <TableHead className="font-medium">Avg Tenure</TableHead>
                      <TableHead className="font-medium">Skills</TableHead>
                      <TableHead className="font-medium w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {candidates.map((c) => (
                      <TableRow key={c.id} className="group hover:bg-secondary/20 cursor-pointer" onClick={() => setDrawerCandidate(c)}>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(c.id)}
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
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {c.skills.slice(0, 3).map((skill) => (
                              <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0">
                                {skill}
                              </Badge>
                            ))}
                            {c.skills.length > 3 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                +{c.skills.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openSingleSave(c)}
                              className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
                              title="Save to project"
                            >
                              <FolderPlus className="h-3.5 w-3.5" />
                            </button>
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
      </div>

      <SaveToProjectDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        candidates={saveDialogCandidates}
      />

      <CandidateDrawer
        open={!!drawerCandidate}
        onOpenChange={(open) => !open && setDrawerCandidate(null)}
        candidate={drawerCandidate}
      />
    </AppLayout>
  );
}
