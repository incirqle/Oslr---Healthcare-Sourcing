import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SaveToProjectDialog } from "@/components/SaveToProjectDialog";
import { CandidateDrawer } from "@/components/CandidateDrawer";
import { SearchHero } from "@/components/search/SearchHero";
import { FilterReview, type ParsedFilters } from "@/components/search/FilterReview";
import { FilterEditor } from "@/components/search/FilterEditor";
import { SearchResults, type Candidate } from "@/components/search/SearchResults";

type SearchStep = "hero" | "parsing" | "review" | "searching" | "results";

export default function SearchPage() {
  const [step, setStep] = useState<SearchStep>("hero");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ParsedFilters>({
    job_titles: [], locations: [], companies: [], keywords: [], experience_years: null, specialties: [],
  });
  const [filterTotal, setFilterTotal] = useState(0);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveDialogCandidates, setSaveDialogCandidates] = useState<Candidate[]>([]);
  const [drawerCandidate, setDrawerCandidate] = useState<Candidate | null>(null);
  const [filterEditorOpen, setFilterEditorOpen] = useState(false);

  const handleInitialSearch = async (q: string) => {
    setQuery(q);
    setStep("parsing");

    try {
      const { data, error } = await supabase.functions.invoke("pdl-search", {
        body: { action: "parse_filters", query: q },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setFilters(data.filters);
      setFilterTotal(data.total || 0);
      setStep("review");
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error(err.message || "Failed to parse search");
      setStep("hero");
    }
  };

  const handleRunSearch = async () => {
    setStep("searching");
    setSelected(new Set());

    try {
      const { data, error } = await supabase.functions.invoke("pdl-search", {
        body: { action: "search_with_filters", filters, size: 25 },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setCandidates(data.candidates || []);
      setTotal(data.total || 0);
      setStep("results");

      if (data.candidates?.length > 0) {
        toast.success(`Found ${data.total.toLocaleString()} matching professionals`);
      } else {
        toast.info("No results found. Try adjusting your filters.");
      }
    } catch (err: any) {
      console.error("Search error:", err);
      toast.error(err.message || "Search failed");
      setStep("review");
    }
  };

  const handleReset = () => {
    setStep("hero");
    setQuery("");
    setFilters({ job_titles: [], locations: [], companies: [], keywords: [], experience_years: null, specialties: [] });
    setCandidates([]);
    setTotal(0);
    setSelected(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === candidates.length) setSelected(new Set());
    else setSelected(new Set(candidates.map((c) => c.id)));
  };

  const selectedCandidates = candidates.filter((c) => selected.has(c.id));

  return (
    <AppLayout>
      <div className="space-y-6">
        {step === "hero" && (
          <SearchHero onSearch={handleInitialSearch} loading={false} />
        )}

        {step === "parsing" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Analyzing your search…</p>
            <p className="text-xs mt-1.5 opacity-60">Translating your query into search filters</p>
          </div>
        )}

        {step === "review" && (
          <FilterReview
            query={query}
            filters={filters}
            total={filterTotal}
            onEdit={() => setFilterEditorOpen(true)}
            onReset={handleReset}
            onRunSearch={handleRunSearch}
            loading={false}
          />
        )}

        {step === "searching" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm font-medium">Searching healthcare professionals…</p>
            <p className="text-xs mt-1.5 opacity-60">Running search with your filters</p>
          </div>
        )}

        {step === "results" && (
          <>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setStep("review")}
                className="text-sm text-primary hover:underline"
              >
                ← Back to filters
              </button>
              <button
                onClick={handleReset}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                New search
              </button>
            </div>
            <SearchResults
              candidates={candidates}
              total={total}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onOpenCandidate={setDrawerCandidate}
              onSaveSingle={(c) => { setSaveDialogCandidates([c]); setSaveDialogOpen(true); }}
              onSaveBulk={() => { setSaveDialogCandidates(selectedCandidates); setSaveDialogOpen(true); }}
            />
          </>
        )}
      </div>

      <FilterEditor
        open={filterEditorOpen}
        onOpenChange={setFilterEditorOpen}
        filters={filters}
        onFiltersChange={setFilters}
        total={filterTotal}
      />

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
