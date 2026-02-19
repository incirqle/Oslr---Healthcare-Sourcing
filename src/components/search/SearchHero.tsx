import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, MapPin, Briefcase, Tag, Clock, Building2, History, X } from "lucide-react";
import type { SearchHistoryEntry } from "@/hooks/useSearchHistory";

const categoryChips = [
  { label: "Location", icon: MapPin },
  { label: "Job Title", icon: Briefcase },
  { label: "Specialty", icon: Tag },
  { label: "Experience", icon: Clock },
  { label: "Company", icon: Building2 },
];

const suggestions = [
  "Spine reps in Texas",
  "ICU nurses in Dallas with CCRN",
  "Orthopedic sales reps in California",
  "CRNAs in Houston",
  "Cardiac device reps in Florida",
  "Travel nurses with 5+ years experience",
];

interface SearchHeroProps {
  onSearch: (query: string) => void;
  loading: boolean;
  history?: SearchHistoryEntry[];
  onClearHistory?: () => void;
}

export function SearchHero({ onSearch, loading, history = [], onClearHistory }: SearchHeroProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = () => {
    if (query.trim()) onSearch(query.trim());
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <h1 className="text-4xl md:text-5xl font-bold font-display text-foreground mb-2 tracking-tight">
        Search<span className="text-primary">AI</span>
      </h1>
      <p className="text-muted-foreground text-sm mb-8">
        Search for healthcare professionals using natural language
      </p>

      <div className="w-full max-w-2xl">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder='Search by name, criteria... e.g., "General Surgeons in Miami"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="pl-12 pr-14 h-14 text-sm rounded-full border-border shadow-sm focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:ring-[3px]"
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            className="absolute right-2 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-5">
          {categoryChips.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => { setQuery(label); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {history.length > 0 ? (
          <div className="mt-6 w-full">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5" /> Recent Searches
              </span>
              {onClearHistory && (
                <button
                  onClick={onClearHistory}
                  className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {history.slice(0, 5).map((entry) => (
                <button
                  key={entry.timestamp}
                  onClick={() => onSearch(entry.query)}
                  disabled={loading}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors disabled:opacity-50 text-left"
                >
                  <span className="flex items-center gap-2 truncate">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{entry.query}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-3">
                    {entry.resultCount.toLocaleString()} results · {formatTime(entry.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSearch(s)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          💡 Tip: After searching, use <span className="font-semibold text-muted-foreground">Advanced Filters</span> to narrow by city & radius
        </p>
      </div>
    </div>
  );
}
