import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";

export interface SankeyInput {
  centerLabel: string;
  hireSources: { company: string; count: number }[];
  destinations: { company: string; count: number }[];
}

interface NodeDatum {
  id: string;
  name: string;
  side: "left" | "center" | "right";
  count: number;
}

interface LinkDatum {
  source: string;
  target: string;
  value: number;
  kind: "hire" | "departure";
}

const SIDE_PAD = 140; // label gutter on each side

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/** Single-side bar list used as a fallback when sankey can't render. */
function BarList({
  items,
  kind,
}: {
  items: { company: string; count: number }[];
  kind: "hire" | "departure";
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[12px] text-ui-text-muted">
        No movement in this range.
      </div>
    );
  }
  const max = Math.max(...items.map((i) => i.count), 1);
  const color =
    kind === "hire" ? "hsl(var(--chart-1))" : "hsl(var(--chart-3))";
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.company} className="flex items-center gap-2 text-[12px]">
          <span className="w-40 shrink-0 truncate text-ui-text-primary">
            {truncate(it.company, 28)}
          </span>
          <span
            className="h-2 rounded-full"
            style={{
              width: `${Math.max(6, (it.count / max) * 100)}%`,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
          <span className="ml-1 text-ui-text-muted">{it.count}</span>
        </li>
      ))}
    </ul>
  );
}

export function TalentFlowSankey({ data }: { data: SankeyInput }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.floor(w));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const hasHires = data.hireSources.length > 0;
  const hasDeps = data.destinations.length > 0;

  // Compute sankey only when width is known, both sides have data, and
  // there's enough horizontal room for the d3 extent to be valid.
  const layout = useMemo(() => {
    if (width === 0) return null;
    if (!hasHires || !hasDeps) return null;
    const innerLeft = SIDE_PAD;
    const innerRight = width - SIDE_PAD;
    if (innerRight - innerLeft < 80) return null;

    try {
      const nodeList: NodeDatum[] = [];
      const linkList: LinkDatum[] = [];

      data.hireSources.forEach((s) => {
        nodeList.push({
          id: `h:${s.company}`,
          name: s.company,
          side: "left",
          count: s.count,
        });
        linkList.push({
          source: `h:${s.company}`,
          target: "center",
          value: s.count,
          kind: "hire",
        });
      });

      const totalHires = data.hireSources.reduce((s, x) => s + x.count, 0);
      const totalDeps = data.destinations.reduce((s, x) => s + x.count, 0);

      nodeList.push({
        id: "center",
        name: data.centerLabel,
        side: "center",
        count: totalHires + totalDeps,
      });

      data.destinations.forEach((d) => {
        nodeList.push({
          id: `d:${d.company}`,
          name: d.company,
          side: "right",
          count: d.count,
        });
        linkList.push({
          source: "center",
          target: `d:${d.company}`,
          value: d.count,
          kind: "departure",
        });
      });

      const maxRows = Math.max(
        data.hireSources.length,
        data.destinations.length,
        1,
      );
      const h = Math.max(360, maxRows * 42 + 40);

      const idx = new Map(nodeList.map((n, i) => [n.id, i]));
      const sankeyNodes = nodeList.map((n) => ({ ...n }));
      const sankeyLinks = linkList.map((l) => ({
        ...l,
        source: idx.get(l.source)!,
        target: idx.get(l.target)!,
      }));

      const generator = sankey<NodeDatum, LinkDatum>()
        .nodeId((d: any) => d.id)
        .nodeAlign(sankeyJustify)
        .nodeWidth(14)
        .nodePadding(16)
        .extent([
          [innerLeft, 16],
          [innerRight, h - 16],
        ]);

      const graph = generator({
        nodes: sankeyNodes as any,
        links: sankeyLinks as any,
      });

      return {
        nodes: graph.nodes as any[],
        links: graph.links as any[],
        height: h,
      };
    } catch (err) {
      console.warn("[TalentFlowSankey] layout failed, using fallback", err);
      return null;
    }
  }, [data, width, hasHires, hasDeps]);

  const colorFor = (side: string) => {
    if (side === "left") return "hsl(var(--chart-1))";
    if (side === "right") return "hsl(var(--chart-3))";
    return "hsl(var(--ui-text-primary))";
  };

  // Fallback when we can't render the sankey: show whichever side(s) have data.
  if (!layout) {
    return (
      <div ref={ref} className="w-full">
        {!hasHires && !hasDeps ? (
          <div className="flex h-48 items-center justify-center text-[12px] text-ui-text-muted">
            No movement in this range.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-ui-text-muted">
                Hires from
              </p>
              <BarList items={data.hireSources} kind="hire" />
            </div>
            <div>
              <p className="mb-2 text-[11.5px] font-medium uppercase tracking-wide text-ui-text-muted">
                Departures to
              </p>
              <BarList items={data.destinations} kind="departure" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const { nodes, links, height } = layout;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="grad-hire" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="grad-dep" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.2} />
            <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0.45} />
          </linearGradient>
        </defs>

        <g>
          {links.map((l, i) => (
            <path
              key={i}
              d={sankeyLinkHorizontal()(l) ?? ""}
              fill="none"
              stroke={l.kind === "hire" ? "url(#grad-hire)" : "url(#grad-dep)"}
              strokeWidth={Math.max(1, l.width ?? 1)}
              className="transition-opacity hover:opacity-100"
              opacity={hover ? 0.35 : 0.85}
              onMouseEnter={(e) => {
                const rect = ref.current?.getBoundingClientRect();
                setHover({
                  x: e.clientX - (rect?.left ?? 0) + 8,
                  y: e.clientY - (rect?.top ?? 0) + 8,
                  text:
                    l.kind === "hire"
                      ? `${l.value} from ${l.source.name} → ${data.centerLabel}`
                      : `${l.value} from ${data.centerLabel} → ${l.target.name}`,
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </g>

        <g>
          {nodes.map((n) => {
            const isCenter = n.side === "center";
            const fill = colorFor(n.side);
            return (
              <g key={n.id}>
                <rect
                  x={n.x0}
                  y={n.y0}
                  width={(n.x1 ?? 0) - (n.x0 ?? 0)}
                  height={Math.max(2, (n.y1 ?? 0) - (n.y0 ?? 0))}
                  fill={fill}
                  rx={2}
                />
                <text
                  x={n.side === "left" ? (n.x0 ?? 0) - 8 : (n.x1 ?? 0) + 8}
                  y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2}
                  dy="0.35em"
                  textAnchor={n.side === "left" ? "end" : "start"}
                  className="fill-ui-text-primary"
                  fontSize={isCenter ? 13 : 12}
                  fontWeight={isCenter ? 600 : 500}
                >
                  {truncate(n.name, 22)}
                  <tspan
                    dx={6}
                    className="fill-ui-text-muted"
                    fontSize={11}
                    fontWeight={500}
                  >
                    {n.count}
                  </tspan>
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-ui-border-light bg-white px-2.5 py-1.5 text-[11px] font-medium text-ui-text-primary shadow-lg"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.text}
        </div>
      )}
    </div>
  );
}
