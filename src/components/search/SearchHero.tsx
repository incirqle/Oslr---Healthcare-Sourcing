import { useState } from "react";
import { ArrowUp, FolderOpen, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

const exampleQueries = [
  "Cardiology fellows in the Midwest",
  "ICU nurses with BSN near Chicago",
  "Orthopedic surgeons at Panorama Orthopedics, Colorado",
];

const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };

interface SearchHeroProps {
  onSearch: (query: string) => void;
  loading: boolean;
  /** Name of the project this search will be saved into, if any. */
  projectName?: string | null;
}

export function SearchHero({ onSearch, loading, projectName }: SearchHeroProps) {
  const [query, setQuery] = useState("");
  const reduce = useReducedMotion();
  const enter = (delay: number) => ({
    initial: { opacity: 0, transform: reduce ? "none" : "translateY(8px)" },
    animate: { opacity: 1, transform: "translateY(0px)" },
    transition: { ...spring, delay },
  });

  const submit = (q = query) => {
    const v = q.trim();
    if (v && !loading) onSearch(v);
  };

  return (
    <div className="relative flex min-h-[62vh] flex-col items-center justify-center px-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[18%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-mint/10 blur-[120px]" />
      </div>

      <motion.p {...enter(0)} className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-mint-ink">
        {projectName ? "Searching inside your project" : "Every search becomes a project"}
      </motion.p>

      <motion.h1
        {...enter(0.03)}
        className="text-center font-display text-[2.5rem] font-bold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-5xl"
      >
        Talent Search
      </motion.h1>

      <motion.p {...enter(0.06)} className="mt-3 max-w-md text-center text-[15px] leading-relaxed text-muted-foreground">
        Describe the clinician you need. Specialty, training, location, employer.
      </motion.p>

      <motion.div {...enter(0.09)} className="mt-8 w-full max-w-2xl">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(); }}
          className="group relative rounded-[22px] border border-border/70 bg-card/80 p-2 shadow-[0_1px_0_hsl(var(--foreground)/0.04),0_18px_40px_-24px_hsl(var(--mint)/0.45)] backdrop-blur-xl transition-[border-color,box-shadow] duration-200 focus-within:border-mint/60 focus-within:shadow-[0_0_0_4px_hsl(var(--mint)/0.12),0_18px_40px_-20px_hsl(var(--mint)/0.5)]"
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            rows={2}
            autoFocus
            disabled={loading}
            placeholder='Try "doctors at Panorama Orthopedics in Colorado"'
            className="block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-[16px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
          <div className="flex items-center justify-between px-2 pb-1">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-mint-ink" />
              <span className="truncate">
                {projectName ? <>Saves to <span className="font-medium text-foreground">{projectName}</span></> : "A new project is created for this search"}
              </span>
            </span>
            <button
              type="submit"
              aria-label="Search"
              disabled={loading || !query.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint text-mint-foreground shadow-sm transition-[transform,background-color,opacity] duration-100 ease-out hover:bg-mint-ink active:scale-[0.94] disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {exampleQueries.map((q, i) => (
            <motion.button
              key={q}
              type="button"
              {...enter(0.12 + i * 0.04)}
              onClick={() => { setQuery(q); submit(q); }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-[color,border-color,transform] duration-100 ease-out hover:border-mint/40 hover:text-foreground active:scale-[0.97] disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 text-mint-ink" />
              {q}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
