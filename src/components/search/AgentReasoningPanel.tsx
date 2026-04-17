import { useEffect, useMemo, useReducer, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Sparkles, AlertCircle, SlidersHorizontal } from "lucide-react";
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
  /** True if search errored — alters tone. */
  errored?: boolean;
  /** True once the request has resolved — switches to condensed one-line summary. */
  done?: boolean;
  /** Total result count, for the condensed summary line. */
  totalCount?: number;
  /** Short filter summary (e.g. "Panorama Orthopedics, Colorado, Orthopedics +1"). */
  filterSummary?: string;
  /** Open the refine sheet from the condensed line. */
  onRefine?: () => void;
}

const TYPING_SPEED_MS = 22; // ~45 chars/sec

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Stable typewriter:
 * - Keys off a content signature (joined text), NOT the array reference.
 *   This prevents resets when parent re-renders with structurally-identical lines.
 * - When new lines are APPENDED, we keep the typed prefix and continue from where
 *   we left off instead of restarting from line 0.
 */
function useTypedReveal(lines: ReasoningLine[], enabled: boolean) {
  const [, force] = useReducer((x) => x + 1, 0);
  const stateRef = useRef({ lineIdx: 0, charIdx: 0, complete: false });
  const linesRef = useRef(lines);
  const tickingRef = useRef(false);

  // Build a content signature so we only react to real content changes.
  const signature = useMemo(() => lines.map((l) => `${l.kind ?? ""}|${l.text}`).join("\n"), [lines]);
  const prevSignatureRef = useRef(signature);
  const prevLinesLenRef = useRef(lines.length);

  // Reset / append handling.
  useEffect(() => {
    const prev = prevSignatureRef.current;
    const isAppendOnly = signature.startsWith(prev) && lines.length >= prevLinesLenRef.current;

    linesRef.current = lines;

    if (!isAppendOnly) {
      // Genuine reset (new search, different content).
      stateRef.current = { lineIdx: 0, charIdx: 0, complete: false };
    } else {
      // Same prefix, just more lines — keep current position, mark not complete.
      stateRef.current = { ...stateRef.current, complete: false };
    }

    prevSignatureRef.current = signature;
    prevLinesLenRef.current = lines.length;
    force();
  }, [signature, lines]);

  useEffect(() => {
    if (!enabled) {
      stateRef.current = { lineIdx: lines.length, charIdx: 0, complete: true };
      force();
      return;
    }
    if (lines.length === 0) return;
    if (tickingRef.current) return; // already running

    let cancelled = false;
    tickingRef.current = true;

    const tick = () => {
      if (cancelled) {
        tickingRef.current = false;
        return;
      }
      const s = stateRef.current;
      const current = linesRef.current[s.lineIdx];
      if (!current) {
        stateRef.current = { ...s, complete: true };
        tickingRef.current = false;
        force();
        return;
      }
      if (s.charIdx < current.text.length) {
        stateRef.current = { ...s, charIdx: s.charIdx + 1 };
        force();
        setTimeout(tick, TYPING_SPEED_MS);
      } else {
        stateRef.current = { lineIdx: s.lineIdx + 1, charIdx: 0, complete: false };
        force();
        setTimeout(tick, 140);
      }
    };
    setTimeout(tick, 200);
    return () => {
      cancelled = true;
      tickingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signature]);

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
  errored = false,
  done = false,
  totalCount,
  filterSummary,
  onRefine,
}: AgentReasoningPanelProps) {
  const reducedMotion = useMemo(prefersReducedMotion, []);
  const useTyping = streaming && !done && !reducedMotion;
  const { completedLines, inProgress, isDone } = useTypedReveal(lines, useTyping);

  // Condensed one-line summary mode — shown after the search resolves.
  if (done && !errored) {
    const count = totalCount ?? 0;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border/50 bg-card/40 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-foreground">
            Found <span className="font-semibold">{count.toLocaleString()}</span>{" "}
            {count === 1 ? "candidate" : "candidates"} for{" "}
            <span className="text-muted-foreground">"{query}"</span>
          </span>
        </div>
        {filterSummary && (
          <>
            <span className="hidden sm:inline text-border" aria-hidden>
              ·
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-full sm:max-w-[40ch]">
              Filtered by {filterSummary}
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          {onRefine && (
            <button
              type="button"
              onClick={onRefine}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <SlidersHorizontal className="h-3 w-3" />
              Refine
            </button>
          )}
          {onEditQuery && (
            <button
              type="button"
              onClick={onEditQuery}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  // Streaming bubble mode — shown while the search is in flight.
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
        <div className="relative shrink-0">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-primary flex items-center justify-center shadow-sm shadow-primary/20">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          {!isDone && useTyping && (
            <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" aria-hidden />
          )}
        </div>

        <div
          className="flex-1 min-w-0 rounded-2xl rounded-tl-sm border border-border/60 bg-card/60 backdrop-blur-sm px-4 py-3"
          aria-live="polite"
          aria-busy={!isDone}
        >
          <AnimatePresence initial={false}>
            {completedLines.map((line, i) => (
              <ReasoningLineRow key={`done-${i}-${line.text}`} line={line} reducedMotion={reducedMotion} />
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
        return "text-muted-foreground";
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
