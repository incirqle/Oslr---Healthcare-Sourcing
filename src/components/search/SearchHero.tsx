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
  "General surgeons in Miami",
  "ICU nurses in Dallas with CCRN",
  "Orthopedic surgeons in California",
  "CRNAs in Houston",
  "Cardiologists in Florida",
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
    <div className="relative flex flex-col items-center justify-center min-h-[70vh] px-4 overflow-hidden">
      {/* Dynamic gradient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-primary/5" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary/6 blur-[120px] animate-gradient-float" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-primary/4 blur-[100px] animate-gradient-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-primary/3 blur-[80px] animate-pulse" />
      </div>

      {/* Branding */}
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground mb-3 tracking-tight">
        Search<span className="text-primary">AI</span>
      </h1>
      <p className="text-muted-foreground text-sm md:text-base mb-10 text-center">
        Search for healthcare professionals using natural language
      </p>

      {/* Search bar */}
      <div className="w-full max-w-2xl">
        <div className="relative flex items-center">
          <Search className="absolute left-5 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder='Search by name, criteria... e.g., "General Surgeons in Miami"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="pl-14 pr-16 h-16 text-base rounded-full border-border/60 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:ring-[3px] focus-visible:shadow-xl focus-visible:shadow-primary/10 transition-shadow"
            disabled={loading}
          />
          <button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            className="absolute right-3 h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-all disabled:opacity-30"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap justify-center gap-2.5 mt-6">
          {categoryChips.map(({ label, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setQuery(label)}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 backdrop-blur-sm px-4 py-2 text-sm text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* History or suggestions */}
        {history.length > 0 ? (
          <div className="mt-8 w-full">
            <div className="flex items-center justify-between mb-2.5 px-1">
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
            <div className="flex flex-col gap-1.5">
              {history.slice(0, 5).map((entry) => (
                <button
                  key={entry.timestamp}
                  onClick={() => onSearch(entry.query)}
                  disabled={loading}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-card/70 backdrop-blur-sm px-4 py-3 text-sm text-foreground hover:bg-card hover:shadow-sm transition-all disabled:opacity-50 text-left"
                >
                  <span className="flex items-center gap-2.5 truncate">
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
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSearch(s)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/50 backdrop-blur-sm px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm transition-all disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3 text-primary" />
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
