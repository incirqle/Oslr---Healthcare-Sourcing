import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildNarrowedQuery } from "@/lib/broad-search";

interface BroadSearchPanelProps {
  query: string;
  total: number;
  roleLabel: string;
  loading?: boolean;
  onSearch: (query: string) => void;
  onReset: () => void;
}

export function BroadSearchPanel({ query, total, roleLabel, loading = false, onSearch, onReset }: BroadSearchPanelProps) {
  const [refinement, setRefinement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    const extra = refinement.trim();
    if (!extra || loading) return;
    onSearch(buildNarrowedQuery(query, extra));
  };

  return (
    <section className="mx-auto max-w-3xl rounded-[24px] border border-border/70 bg-card/70 px-5 py-8 shadow-sm sm:px-10 sm:py-12" aria-labelledby="broad-search-title">
      <div className="mx-auto max-w-2xl text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-mint-soft text-mint-ink">
          <Search className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="mt-6 text-sm font-medium text-mint-ink">A little more focus will help</p>
        <h1 id="broad-search-title" className="mt-2 font-display text-3xl font-semibold tracking-[-0.02em] text-foreground sm:text-4xl">
          {total.toLocaleString()} {roleLabel.toLowerCase()} across the United States
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          This matches too many profiles to browse usefully. Add a specialty, hospital, city or state to see qualified candidates.
        </p>
      </div>

      <form
        className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border/70 bg-background/80 p-2 transition-colors focus-within:border-mint/60"
        onSubmit={(event) => { event.preventDefault(); submit(); }}
      >
        <label htmlFor="search-within" className="sr-only">Search within {roleLabel.toLowerCase()}</label>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            id="search-within"
            value={refinement}
            onChange={(event) => setRefinement(event.target.value)}
            disabled={loading}
            placeholder="Add a specialty, hospital, city or state…"
            className="h-12 min-w-0 flex-1 bg-transparent px-3 text-[16px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <Button type="submit" disabled={loading || !refinement.trim()} className="h-10 gap-2 px-4">
            {loading ? "Searching…" : "Search"}
            {!loading && <ArrowUp className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </div>
      </form>

      <div className="mt-5 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <p className="min-w-0 truncate text-xs text-muted-foreground" title={query}>Original search: {query}</p>
        <Button type="button" variant="ghost" size="sm" onClick={onReset} className="shrink-0 gap-1.5 text-muted-foreground">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> New search
        </Button>
      </div>
    </section>
  );
}
