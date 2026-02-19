import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, Sparkles, MapPin, Briefcase, Tag, Clock, Building2, History, X } from "lucide-react";
import { motion } from "framer-motion";
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
      {/* Dynamic animated background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-background to-primary/5" />
        
        {/* Animated orbs */}
        <motion.div
          className="absolute top-[10%] right-[15%] w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px]"
          animate={{
            x: [0, 40, -20, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.9, 1],
            opacity: [0.4, 0.7, 0.5, 0.4],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[5%] left-[10%] w-[400px] h-[400px] rounded-full bg-emerald-500/8 blur-[90px]"
          animate={{
            x: [0, -35, 25, 0],
            y: [0, 25, -20, 0],
            scale: [1, 0.9, 1.1, 1],
            opacity: [0.3, 0.6, 0.4, 0.3],
          }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[40%] left-[40%] w-[250px] h-[250px] rounded-full bg-teal-400/6 blur-[70px]"
          animate={{
            x: [0, 20, -30, 0],
            y: [0, -20, 15, 0],
            scale: [0.95, 1.1, 1, 0.95],
            opacity: [0.2, 0.5, 0.3, 0.2],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* Branding */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display text-foreground mb-3 tracking-tight">
          Oslr{" "}
          <motion.span
            className="inline-block bg-gradient-to-r from-emerald-600 via-primary to-teal-500 bg-clip-text text-transparent"
            animate={{
              backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
            }}
            style={{ backgroundSize: "200% 200%" }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          >
            AI
          </motion.span>
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-muted-foreground text-sm md:text-base mb-10"
        >
          Search for healthcare professionals using natural language
        </motion.p>
      </motion.div>

      {/* Search bar */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="relative flex items-center group">
          {/* Glow ring behind input */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/20 via-emerald-400/15 to-teal-500/20 blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          
          <Search className="absolute left-5 h-5 w-5 text-muted-foreground z-10" />
          <Input
            placeholder='Search by name, criteria... e.g., "General Surgeons in Miami"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="relative pl-14 pr-16 h-16 text-base rounded-full border-border/60 bg-card/80 backdrop-blur-sm shadow-lg shadow-primary/5 focus-visible:ring-primary/30 focus-visible:ring-offset-0 focus-visible:ring-[3px] focus-visible:shadow-xl focus-visible:shadow-primary/10 transition-all duration-300"
            disabled={loading}
          />
          <motion.button
            onClick={handleSubmit}
            disabled={loading || !query.trim()}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="absolute right-3 h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-emerald-500/20 text-primary flex items-center justify-center hover:from-primary/30 hover:to-emerald-500/30 transition-all disabled:opacity-30 z-10"
          >
            <Search className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Category chips */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-2.5 mt-6"
        >
          {categoryChips.map(({ label, icon: Icon }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.06 }}
              whileHover={{ y: -2, scale: 1.03 }}
              onClick={() => setQuery(label)}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 backdrop-blur-sm px-4 py-2 text-sm text-muted-foreground hover:bg-card hover:text-foreground hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 transition-all"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </motion.button>
          ))}
        </motion.div>

        {/* History or suggestions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
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
                {history.slice(0, 5).map((entry, i) => (
                  <motion.button
                    key={entry.timestamp}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.65 + i * 0.05 }}
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
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.05 }}
                  whileHover={{ y: -2, scale: 1.05 }}
                  onClick={() => onSearch(s)}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/50 backdrop-blur-sm px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-md hover:shadow-primary/5 transition-all disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3 text-primary" />
                  {s}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
