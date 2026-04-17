import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, History, X } from "lucide-react";
import { motion } from "framer-motion";
import type { SearchHistoryEntry } from "@/hooks/useSearchHistory";

const exampleQueries = [
  "Cardiology fellows in the Midwest",
  "ICU nurses with BSN near Chicago",
  "Orthopedic surgeons at Panorama Orthopedics, Colorado",
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
    <div className="relative flex flex-col items-center justify-center min-h-[60vh] px-4 overflow-hidden">
      {/* Subtle ambient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/3" />
        <motion.div
          className="absolute top-[15%] right-[20%] w-[400px] h-[400px] rounded-full bg-primary/8 blur-[100px]"
          animate={{
            x: [0, 30, -15, 0],
            y: [0, -20, 15, 0],
            opacity: [0.3, 0.5, 0.4, 0.3],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[10%] left-[15%] w-[300px] h-[300px] rounded-full bg-emerald-500/6 blur-[90px]"
          animate={{
            x: [0, -25, 15, 0],
            y: [0, 20, -10, 0],
            opacity: [0.2, 0.4, 0.3, 0.2],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Compact branding */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-3xl font-bold font-display text-foreground tracking-tight">
          Oslr{" "}
          <motion.span
            className="inline-block bg-gradient-to-r from-emerald-500 via-primary to-teal-500 bg-clip-text text-transparent"
            animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
            style={{ backgroundSize: "200% 200%" }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            AI
          </motion.span>
        </h1>
      </motion.div>

      {/* Task-oriented prompt */}
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="mt-6 mb-6 text-2xl font-medium text-foreground/80 text-center"
      >
        Who are you looking for?
      </motion.h2>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="relative flex items-center group">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 via-emerald-400/15 to-teal-500/20 blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />

          <Search className="absolute left-5 h-5 w-5 text-muted-foreground z-10" />
          <Input
            placeholder='Try "doctors at Panorama Orthopedics in Colorado"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="relative pl-14 pr-16 h-16 text-base rounded-full border-border/60 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:ring-[3px] focus-visible:shadow-xl focus-visible:shadow-primary/10 transition-all duration-300"
            disabled={loading}
            autoFocus
          />
          <motion.button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="absolute right-3 h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/20 text-primary flex items-center justify-center hover:from-primary/30 hover:to-emerald-500/30 transition-all disabled:opacity-30 z-10"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Try: example query chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2 mt-5"
        >
          <span className="text-xs font-medium text-muted-foreground/70 mr-1">Try:</span>
          {exampleQueries.map((q, i) => (
            <motion.button
              key={q}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              whileHover={{ y: -2 }}
              onClick={() => {
                setQuery(q);
                onSearch(q);
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 backdrop-blur-sm px-3 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary/30 hover:shadow-sm transition-all disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 text-primary/70" />
              {q}
            </motion.button>
          ))}
        </motion.div>

        {/* Recent searches */}
        {history.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="mt-8 w-full"
          >
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
              {history.slice(0, 5).map((entry, i) => (
                <motion.button
                  key={entry.timestamp}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.04 }}
                  whileHover={{ x: 4 }}
                  onClick={() => onSearch(entry.query)}
                  disabled={loading}
                  className="flex items-center justify-between rounded-xl border border-border/50 bg-card/70 backdrop-blur-sm px-4 py-3 text-sm text-foreground hover:bg-card hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 transition-all disabled:opacity-50 text-left"
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{entry.query}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-3">
                    {entry.resultCount.toLocaleString()} results · {formatTime(entry.timestamp)}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
