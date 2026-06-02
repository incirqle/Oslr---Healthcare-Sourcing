import { useEffect, useMemo, useState } from "react";

/**
 * Faint animated network of dots + thin connecting lines, used as the
 * "scanning the network" loader on the search results page.
 * Pure CSS animation, semantic primary color, respects reduced-motion.
 */

interface Dot {
  cx: number;
  cy: number;
  r: number;
  delay: number;
  duration: number;
}

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  delay: number;
  duration: number;
}

const WIDTH = 1000;
const HEIGHT = 360;

// Deterministic pseudo-random so the layout doesn't reshuffle each render
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildNetwork(): { dots: Dot[]; lines: Line[] } {
  const rand = mulberry32(7);
  const cols = 8;
  const rows = 4;
  const cellW = WIDTH / cols;
  const cellH = HEIGHT / rows;
  const dots: Dot[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = cellW * col + cellW / 2 + (rand() - 0.5) * cellW * 0.55;
      const cy = cellH * row + cellH / 2 + (rand() - 0.5) * cellH * 0.55;
      dots.push({
        cx,
        cy,
        r: 2 + rand() * 2.5,
        delay: rand() * 2.4,
        duration: 2 + rand() * 1.6,
      });
    }
  }

  // Connect each dot to its 2 nearest neighbors → graph-like web
  const lines: Line[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < dots.length; i++) {
    const distances = dots
      .map((d, idx) => ({
        idx,
        d: Math.hypot(d.cx - dots[i].cx, d.cy - dots[i].cy),
      }))
      .filter((x) => x.idx !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { idx } of distances) {
      const key = i < idx ? `${i}-${idx}` : `${idx}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({
        x1: dots[i].cx,
        y1: dots[i].cy,
        x2: dots[idx].cx,
        y2: dots[idx].cy,
        delay: rand() * 3,
        duration: 2.8 + rand() * 1.8,
      });
    }
  }

  return { dots, lines };
}

const CAPTIONS = [
  "Scanning millions of clinical profiles…",
  "Matching credentials and specialties…",
  "Cross-referencing employer signals…",
  "Reranking by clinical fit…",
];

export function SearchNetworkLoader() {
  const { dots, lines } = useMemo(buildNetwork, []);
  const [captionIdx, setCaptionIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setCaptionIdx((i) => (i + 1) % CAPTIONS.length),
      2500
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/40">
      <style>{`
        @keyframes osl-dot-pulse {
          0%, 100% { opacity: 0.18; transform: scale(0.9); }
          50%      { opacity: 0.85; transform: scale(1.15); }
        }
        @keyframes osl-line-pulse {
          0%, 100% { opacity: 0.04; }
          50%      { opacity: 0.22; }
        }
        @keyframes osl-caption-fade {
          0%   { opacity: 0; transform: translateY(4px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .osl-dot {
          transform-origin: center;
          transform-box: fill-box;
          animation: osl-dot-pulse var(--dur, 2.6s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
        .osl-line {
          animation: osl-line-pulse var(--dur, 3.2s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
        }
        .osl-caption {
          animation: osl-caption-fade 0.5s ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .osl-dot, .osl-line { animation: none; opacity: 0.35; }
        }
      `}</style>

      <div className="relative flex h-[360px] w-full items-center justify-center">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {lines.map((l, i) => (
            <line
              key={`l-${i}`}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              stroke="hsl(var(--primary))"
              strokeWidth={0.6}
              className="osl-line"
              style={
                {
                  ["--delay" as string]: `${l.delay}s`,
                  ["--dur" as string]: `${l.duration}s`,
                } as React.CSSProperties
              }
            />
          ))}
          {dots.map((d, i) => (
            <circle
              key={`d-${i}`}
              cx={d.cx}
              cy={d.cy}
              r={d.r}
              fill="hsl(var(--primary))"
              className="osl-dot"
              style={
                {
                  ["--delay" as string]: `${d.delay}s`,
                  ["--dur" as string]: `${d.duration}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </svg>

        <div className="relative z-10 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Searching
            </span>
          </div>
          <p
            key={captionIdx}
            className="osl-caption text-[13px] text-muted-foreground"
          >
            {CAPTIONS[captionIdx]}
          </p>
        </div>
      </div>
    </div>
  );
}
