/**
 * Minimal, fluid loading state for the search results canvas.
 *
 * No graph metaphor, no constellation, no duplicate "searching" caption —
 * just quiet skeleton rows with a slow horizontal light sweep. Status copy
 * is owned by the AgentReasoningPanel above; this surface is purely visual.
 */

const ROWS = 6;

export function SearchNetworkLoader() {
  return (
    <div className="relative w-full overflow-hidden">
      <style>{`
        @keyframes osl-sweep {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes osl-breathe {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1; }
        }
        .osl-sweep {
          animation: osl-sweep 2.6s ease-in-out infinite;
        }
        .osl-breathe {
          animation: osl-breathe 2.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .osl-sweep, .osl-breathe { animation: none; }
        }
      `}</style>

      <ul className="divide-y divide-foreground/[0.04]">
        {Array.from({ length: ROWS }).map((_, i) => (
          <li
            key={i}
            className="osl-breathe flex items-center gap-4 px-2 py-5"
            style={{ animationDelay: `${i * 0.18}s` }}
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-foreground/[0.05]" />
            <div className="flex-1 space-y-2">
              <div
                className="h-3 rounded-full bg-foreground/[0.06]"
                style={{ width: `${42 + ((i * 7) % 28)}%` }}
              />
              <div
                className="h-2.5 rounded-full bg-foreground/[0.04]"
                style={{ width: `${22 + ((i * 11) % 24)}%` }}
              />
            </div>
            <div className="hidden h-6 w-16 shrink-0 rounded-full bg-foreground/[0.04] sm:block" />
          </li>
        ))}
      </ul>

      <div
        aria-hidden="true"
        className="osl-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.08) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
