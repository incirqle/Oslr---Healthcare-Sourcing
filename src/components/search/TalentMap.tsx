import { useMemo, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import statesTopo from "us-atlas/states-10m.json";
import { toTitleCase } from "./candidate-ui";

type StateFeature = GeoJSON.Feature<GeoJSON.Geometry, { name: string }>;

const W = 960;
const H = 600;

/** US state map shaded by how many candidates live in each state. */
export function TalentMap({ states, onSelect, selected }: {
  states: { name: string; count: number }[];
  selected?: string | null;
  onSelect?: (state: string | null) => void;
}) {
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const counts = useMemo(() => new Map(states.map((s) => [s.name, s.count])), [states]);
  const max = Math.max(1, ...states.map((s) => s.count));

  const shapes = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topo = statesTopo as any;
    const fc = feature(topo, topo.objects.states) as unknown as GeoJSON.FeatureCollection<GeoJSON.Geometry, { name: string }>;
    const projection = geoAlbersUsa().fitSize([W, H], fc);
    const path = geoPath(projection);
    return fc.features.map((f: StateFeature) => {
      const c = path.centroid(f);
      return { name: f.properties.name.toLowerCase(), d: path(f) ?? "", cx: c[0], cy: c[1] };
    });
  }, []);

  const hovered = hover ? counts.get(hover.name) ?? 0 : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Map of where candidates are located">
        {shapes.map((s) => {
          const n = counts.get(s.name) ?? 0;
          const t = n / max;
          const isSel = selected === s.name;
          return (
            <path
              key={s.name}
              d={s.d}
              onMouseMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setHover({ name: s.name, x: e.clientX - r.left, y: e.clientY - r.top });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={() => n > 0 && onSelect?.(isSel ? null : s.name)}
              className={n > 0 ? "cursor-pointer transition-[fill-opacity] duration-200" : ""}
              style={{
                fill: n > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))",
                fillOpacity: n > 0 ? 0.22 + 0.78 * Math.sqrt(t) : 0.55,
                stroke: isSel ? "hsl(var(--foreground))" : "hsl(var(--background))",
                strokeWidth: isSel ? 2.5 : 1,
              }}
            />
          );
        })}
        {shapes.map((s) => {
          const n = counts.get(s.name) ?? 0;
          if (n === 0 || !Number.isFinite(s.cx)) return null;
          return (
            <text key={`l-${s.name}`} x={s.cx} y={s.cy + 5} textAnchor="middle" pointerEvents="none"
              className="font-semibold tabular-nums" style={{ fontSize: 15, fill: "hsl(var(--primary-foreground))" }}>
              {n}
            </text>
          );
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-popover px-3 py-1.5 text-[13px] text-popover-foreground shadow-lg"
          style={{ left: hover.x, top: hover.y - 10 }}>
          <span className="font-medium">{toTitleCase(hover.name)}</span>
          <span className="ml-2 tabular-nums text-muted-foreground">{hovered} {hovered === 1 ? "candidate" : "candidates"}</span>
        </div>
      )}
    </div>
  );
}
