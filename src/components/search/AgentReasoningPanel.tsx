import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, ChevronDown, ChevronRight, Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReasoningLine = {
  text: string;
  kind?: "header" | "step" | "result" | "warn";
};

interface AgentReasoningPanelProps {
  query: string;
  lines: ReasoningLine[];
  /** When true, type out lines progressively. When false, render all at once. */
  streaming: boolean;
  /** Called when user clicks the pencil to edit and re-run. */
  onEditQuery?: () => void;
  /** User-typed filter values, derived by comparing parsed output to original query. */
  userFilters: { label: string; group: string }[];
  /** AI-expansion filter values not present in the original query. */
  aiFilters: { label: string; group: string; reason?: string }[];
  /** Original raw query for the "How I interpreted this" panel. */
  rawQuery: string;
  onEditFilters?: () => void;
  /** True if no results — alters tone. */
  zeroResults?: boolean;
  /** True if search errored — alters tone. */
  errored?: boolean;
}

const TYPING_SPEED_MS = 25; // ~40 chars/sec

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Hook that exposes a list of fully-typed lines plus the current in-progress line.
 * Reveals lines sequentially, character by character, at TYPING_SPEED_MS.
 */
function useTypedReveal(lines: ReasoningLine[], enabled: boolean) {
  const [, force] = useReducer((x) => x + 1, 0);
  const stateRef = useRef({ lineIdx: 0, charIdx: 0, complete: false });
  const linesRef = useRef(lines);

  // When the lines array changes (new search), reset.
  useEffect(() => {
    linesRef.current = lines;
    stateRef.current = { lineIdx: 0, charIdx: 0, complete: false };
    force();
  }, [lines]);

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { lineIdx: lines.length, charIdx: 0, complete: true };
      force();
      return;
    }
    if (lines.length === 0) return;

    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const s = stateRef.current;
      const current = linesRef.current[s.lineIdx];
      if (!current) {
        stateRef.current = { ...s, complete: true };
        force();
        return;
      }
      if (s.charIdx < current.text.length) {
        stateRef.current = { ...s, charIdx: s.charIdx + 1 };
        force();
        setTimeout(tick, TYPING_SPEED_MS);
      } else {
        // Brief pause between lines
        stateRef.current = { lineIdx: s.lineIdx + 1, charIdx: 0, complete: false };
        force();
        setTimeout(tick, 120);
      }
    };
    setTimeout(tick, 250);
    return () => {
      cancelled = true;
    };
  }, [lines, enabled]);

  const s = stateRef.current;
  const completedLines = lines.slice(0, s.lineIdx);
  const inProgress =
    s.lineIdx < lines.length ? { ...lines[s.lineIdx], text: lines[s.lineIdx].text.slice(0, s.charIdx) } : null;
  return { completedLines, inProgress, isDone: s.complete || s.lineIdx >= lines.length };
}

export function AgentReasoningPanel({
  query,
  lines,
  streaming,
  onEditQuery,
  userFilters,
  aiFilters,
  rawQuery,
  onEditFilters,
  zeroResults = false,
  errored = false,
}: AgentReasoningPanelProps) {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const useTyping = streaming && !reducedMotion;
  const { completedLines, inProgress, isDone } = useTypedReveal(lines, useTyping);
  const [interpretOpen, setInterpretOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* User query echo bubble (right-aligned) */}
      <div className="flex justify-end">
        <div className="group flex items-start gap-2 max-w-[85%]">
          <button
            type="button"
            onClick={onEditQuery}
            disabled={!onEditQuery}
            className="opacity-0 group-hover:opacity-100 disabled:hidden mt-2 h-8 w-8 rounded-full hover:bg-card/80 text-muted-foreground hover:text-foreground transition-all flex items-center justify-center"
            aria-label="Edit query and re-run"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <div className="rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/20 px-4 py-2.5 text-sm text-foreground">
            {query}
          </div>
        </div>
      </div>

      {/* Agent reasoning stream (left-aligned) */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!isDone && useTyping && (
            <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" aria-hidden />
          )}
        </div>

        {/* Stream */}
        <div
          className="flex-1 min-w-0 rounded-2xl rounded-tl-sm border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3"
          aria-live="polite"
          aria-busy={!isDone}
        >
          <AnimatePresence initial={false}>
            {completedLines.map((line, i) => (
              <ReasoningLineRow key={`done-${i}`} line={line} reducedMotion={reducedMotion} />
            ))}
          </AnimatePresence>

          {inProgress && useTyping && (
            <ReasoningLineRow
              key={`live-${completedLines.length}`}
              line={inProgress}
              cursor
              reducedMotion={reducedMotion}
            />
          )}

          {/* Empty state shimmer while we have nothing yet */}
          {lines.length === 0 && !errored && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span>Thinking…</span>
            </div>
          )}

          {errored && (
            <div className="flex items-center gap-2 text-sm text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>Something went wrong on my end.</span>
            </div>
          )}

          {/* "How I interpreted this" — only after streaming completes */}
          {isDone && !errored && (userFilters.length > 0 || aiFilters.length > 0) && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <button
                type="button"
                onClick={() => setInterpretOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={interpretOpen}
              >
                {interpretOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                How I interpreted this
              </button>

              <AnimatePresence initial={false}>
                {interpretOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pt-3 space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80 mb-1">
                          Your query
                        </div>
                        <div className="text-sm text-foreground/90 italic">"{rawQuery}"</div>
                      </div>

                      <InterpretedFilterGroups userFilters={userFilters} aiFilters={aiFilters} />

                      {onEditFilters && (
                        <button
                          type="button"
                          onClick={onEditFilters}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          Edit filters →
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReasoningLineRow({
  line,
  cursor,
  reducedMotion,
}: {
  line: ReasoningLine;
  cursor?: boolean;
  reducedMotion: boolean;
}) {
  const baseClass = (() => {
    switch (line.kind) {
      case "header":
        return "text-foreground font-medium";
      case "step":
        return "text-muted-foreground pl-3";
      case "result":
        return "text-foreground/90 font-medium";
      case "warn":
        return "text-amber-400";
      default:
        return "text-foreground/90";
    }
  })();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className={cn("text-sm leading-relaxed py-0.5", baseClass)}
    >
      {line.text}
      {cursor && <span className="inline-block w-1.5 h-3.5 bg-primary/70 ml-0.5 animate-pulse align-baseline" />}
    </motion.div>
  );
}

function InterpretedFilterGroups({
  userFilters,
  aiFilters,
}: {
  userFilters: { label: string; group: string }[];
  aiFilters: { label: string; group: string; reason?: string }[];
}) {
  const groups = new Map<string, { user: string[]; ai: { label: string; reason?: string }[] }>();
  for (const f of userFilters) {
    const g = groups.get(f.group) ?? { user: [], ai: [] };
    g.user.push(f.label);
    groups.set(f.group, g);
  }
  for (const f of aiFilters) {
    const g = groups.get(f.group) ?? { user: [], ai: [] };
    g.ai.push({ label: f.label, reason: f.reason });
    groups.set(f.group, g);
  }

  if (groups.size === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        What I searched for
      </div>
      {[...groups.entries()].map(([group, { user, ai }]) => (
        <div key={group} className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground capitalize w-20 shrink-0">{group}:</span>
          {user.map((label) => (
            <span
              key={`u-${label}`}
              className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs text-foreground"
            >
              {label}
            </span>
          ))}
          {ai.map(({ label, reason }) => (
            <span
              key={`a-${label}`}
              title={reason ?? `Added because candidates sometimes use "${label}" instead.`}
              className="rounded-full border border-dashed border-border bg-transparent px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 cursor-help transition-colors"
            >
              {label}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
