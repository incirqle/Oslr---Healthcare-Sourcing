/**
 * Glowing-node constellation loader for the search results canvas.
 *
 * Each skeleton row is anchored by a pulsing primary-tinted node; a faint
 * SVG overlay draws flowing connections between consecutive nodes so the
 * surface reads as a live network discovering candidates.
 */

const ROWS = 6;
const ROW_HEIGHT = 76; // px — matches py-5 + content
const NODE_X = 28; // px — node center from container left

export function SearchNetworkLoader() {
  const totalHeight = ROWS * ROW_HEIGHT;

  return (
    <div className="relative w-full overflow-hidden" style={{ minHeight: totalHeight }}>
      <style>{`
        @keyframes osl-node-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 0 0 hsl(var(--primary) / 0.45),
              0 0 12px 2px hsl(var(--primary) / 0.35);
          }
          50% {
            transform: scale(1.15);
            box-shadow:
              0 0 0 6px hsl(var(--primary) / 0),
              0 0 22px 6px hsl(var(--primary) / 0.55);
          }
        }
        @keyframes osl-bar-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes osl-line-flow {
          to { stroke-dashoffset: -40; }
        }
        @keyframes osl-satellite {
          0%, 100% { opacity: 0.35; transform: scale(0.9); }
          50%      { opacity: 1;    transform: scale(1.1); }
        }
        .osl-node {
          background: radial-gradient(
            circle at 35% 30%,
            hsl(var(--primary) / 1) 0%,
            hsl(var(--primary) / 0.8) 45%,
            hsl(var(--primary) / 0.5) 100%
          );
          animation: osl-node-pulse 2.4s ease-in-out infinite;
        }
        .osl-bar {
          background: linear-gradient(
            90deg,
            hsl(var(--foreground) / 0.05) 0%,
            hsl(var(--foreground) / 0.05) 30%,
            hsl(var(--primary) / 0.22) 50%,
            hsl(var(--foreground) / 0.05) 70%,
            hsl(var(--foreground) / 0.05) 100%
          );
          background-size: 200% 100%;
          animation: osl-bar-shimmer 2.8s linear infinite;
        }
        .osl-line {
          stroke: hsl(var(--primary) / 0.35);
          stroke-width: 1;
          fill: none;
          stroke-dasharray: 4 6;
          animation: osl-line-flow 2.2s linear infinite;
        }
        .osl-satellite {
          background: hsl(var(--primary) / 0.7);
          box-shadow: 0 0 10px 2px hsl(var(--primary) / 0.4);
          animation: osl-satellite 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .osl-node, .osl-bar, .osl-line, .osl-satellite { animation: none; }
        }
      `}</style>

      {/* Connecting lines behind the rows */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
      >
        {Array.from({ length: ROWS - 1 }).map((_, i) => {
          const y1 = i * ROW_HEIGHT + ROW_HEIGHT / 2;
          const y2 = (i + 1) * ROW_HEIGHT + ROW_HEIGHT / 2;
          const curve = i % 2 === 0 ? 16 : -16;
          const path = `M ${NODE_X} ${y1} C ${NODE_X + curve} ${y1 + 24}, ${NODE_X - curve} ${y2 - 24}, ${NODE_X} ${y2}`;
          return (
            <path
              key={i}
              d={path}
              className="osl-line"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          );
        })}
      </svg>

      <ul className="relative">
        {Array.from({ length: ROWS }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-4 px-2"
            style={{ height: ROW_HEIGHT }}
          >
            {/* Glowing node */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <div
                className="osl-node h-3 w-3 rounded-full"
                style={{ animationDelay: `${i * 0.32}s` }}
              />
            </div>

            {/* Shimmering text bars */}
            <div className="flex-1 space-y-2">
              <div
                className="osl-bar h-3 rounded-full"
                style={{
                  width: `${42 + ((i * 7) % 28)}%`,
                  animationDelay: `${i * 0.18}s`,
                }}
              />
              <div
                className="osl-bar h-2.5 rounded-full"
                style={{
                  width: `${22 + ((i * 11) % 24)}%`,
                  animationDelay: `${i * 0.18 + 0.4}s`,
                }}
              />
            </div>

            {/* Satellite nodes on the right */}
            <div className="hidden items-center gap-2 sm:flex">
              <div
                className="osl-satellite h-1.5 w-1.5 rounded-full"
                style={{ animationDelay: `${i * 0.4}s` }}
              />
              <div
                className="osl-satellite h-2 w-2 rounded-full"
                style={{ animationDelay: `${i * 0.4 + 0.6}s` }}
              />
              <div
                className="h-6 w-16 shrink-0 rounded-full"
                style={{ background: "hsl(var(--foreground) / 0.04)" }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
