/**
 * Talent flow: where people came from (left), this company (center), where
 * they went (right). Institutions are logo cards; ribbons are sized by people.
 * Hover or tap a card to light its ribbons, tap again to filter the list.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { OrgLogo } from "@/components/search/Avatars";
import type { CompanyBase, MovementPerson } from "@/hooks/useCompanyBrief";
import { CompanyLogo } from "./OverviewPanel";
import { cn } from "@/lib/utils";

export interface FlowNode {
  key: string;
  name: string;
  count: number;
  logo: string | null;
  domain: string | null;
  kind: string;
  training: number;
}

const ACADEMIC = /\b(university|universit|school of medicine|college of medicine|medical school|academic|college|institute of technology)\b/i;
const SYSTEM = /\b(hospital|health system|healthcare system|health care|health|medical center|regional|clinic\b|kaiser|hca|va\b|veterans)\b/i;
const TRAINING = /\b(resident|residency|fellow|fellowship|intern)\b/i;

export function institutionKind(name: string): string {
  if (ACADEMIC.test(name)) return "Academic center";
  if (SYSTEM.test(name)) return "Health system";
  return "Practice or group";
}

export function buildNodes(list: MovementPerson[], side: "from" | "to", limit: number): FlowNode[] {
  const m = new Map<string, FlowNode>();
  for (const p of list) {
    const name = (side === "from" ? p.previous_company : p.current_company)?.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const n = m.get(k) ?? { key: `${side}:${k}`, name, count: 0, logo: null, domain: null, kind: institutionKind(name), training: 0 };
    n.count++;
    n.logo ??= (side === "from" ? p.previous_company_logo : p.current_company_logo) ?? null;
    n.domain ??= (side === "from" ? p.previous_company_domain : p.current_company_domain) ?? null;
    const title = side === "from" ? p.previous_title : p.previous_title;
    if (title && TRAINING.test(title)) n.training++;
    m.set(k, n);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

const ROW = 60;
const GAP = 10;

interface Props {
  base: CompanyBase | null;
  name: string;
  hires: MovementPerson[];
  departures: MovementPerson[];
  focus: string | null;
  onFocus: (key: string | null) => void;
}

export function FlowSankey({ base, name, hires, departures, focus, onFocus }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((e) => setW(Math.floor(e[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const left = useMemo(() => buildNodes(hires, "from", 7), [hires]);
  const right = useMemo(() => buildNodes(departures, "to", 7), [departures]);
  const rows = Math.max(left.length, right.length, 3);
  const h = rows * ROW + (rows - 1) * GAP;
  const narrow = w > 0 && w < 640;
  const cardW = narrow ? Math.max(110, Math.floor(w * 0.34)) : Math.min(240, Math.floor(w * 0.27));
  const centerW = narrow ? 0 : Math.min(200, Math.floor(w * 0.2));
  const cx0 = narrow ? w : (w - centerW) / 2;
  const cx1 = narrow ? w : cx0 + centerW;
  const leftTotal = left.reduce((n, x) => n + x.count, 0);
  const rightTotal = right.reduce((n, x) => n + x.count, 0);
  const maxBand = h * 0.8;
  const unit = Math.min(ROW - 18, maxBand / Math.max(1, leftTotal, rightTotal));
  const active = hover ?? focus;

  const yOf = (i: number, n: number) => {
    const total = n * ROW + (n - 1) * GAP;
    const top = (h - total) / 2;
    return top + i * (ROW + GAP) + ROW / 2;
  };

  const band = (x0: number, y0: number, x1: number, y1: number, t: number) => {
    const mx = (x0 + x1) / 2;
    return `M${x0},${y0 - t / 2} C${mx},${y0 - t / 2} ${mx},${y1 - t / 2} ${x1},${y1 - t / 2} L${x1},${y1 + t / 2} C${mx},${y1 + t / 2} ${mx},${y0 + t / 2} ${x0},${y0 + t / 2} Z`;
  };

  // Ribbons stack into the center card.
  let accL = h / 2 - (leftTotal * unit) / 2;
  const leftBands = left.map((n, i) => {
    const t = Math.max(3, n.count * unit);
    const y1 = accL + t / 2;
    accL += t;
    return { n, d: band(cardW, yOf(i, left.length), cx0, y1, t) };
  });
  let accR = h / 2 - (rightTotal * unit) / 2;
  const rightBands = right.map((n, i) => {
    const t = Math.max(3, n.count * unit);
    const y0 = accR + t / 2;
    accR += t;
    return { n, d: band(cx1, y0, w - cardW, yOf(i, right.length), t) };
  });

  if (left.length === 0 && right.length === 0) {
    return <p className="py-10 text-center text-[13px] text-muted-foreground">No moves to or from other employers for this filter.</p>;
  }

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height: h }}>
      {w > 0 && (
        <>
          <svg width={w} height={h} className="absolute inset-0" aria-hidden="true">
            <defs>
              <linearGradient id="flow-in" x1="0" x2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.18} />
              </linearGradient>
              <linearGradient id="flow-out" x1="0" x2="1">
                <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.45} />
              </linearGradient>
            </defs>
            {[...leftBands.map((b) => ({ ...b, fill: "url(#flow-in)" })), ...rightBands.map((b) => ({ ...b, fill: "url(#flow-out)" }))].map((b) => (
              <path
                key={b.n.key}
                d={b.d}
                fill={b.fill}
                className="transition-opacity duration-200 ease-out"
                style={{ opacity: active ? (active === b.n.key ? 1 : 0.18) : 0.85 }}
              />
            ))}
          </svg>

          {left.map((n, i) => (
            <NodeCard key={n.key} n={n} side="from" style={{ left: 0, top: yOf(i, left.length) - ROW / 2, width: cardW }}
              active={active === n.key} dim={!!active && active !== n.key} focused={focus === n.key}
              onHover={setHover} onTap={() => onFocus(focus === n.key ? null : n.key)} />
          ))}
          {right.map((n, i) => (
            <NodeCard key={n.key} n={n} side="to" style={{ left: w - cardW, top: yOf(i, right.length) - ROW / 2, width: cardW }}
              active={active === n.key} dim={!!active && active !== n.key} focused={focus === n.key}
              onHover={setHover} onTap={() => onFocus(focus === n.key ? null : n.key)} />
          ))}

          {!narrow && (
            <div className="absolute flex flex-col items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-card/90 px-3 text-center shadow-[0_12px_40px_-16px_hsl(var(--primary)/0.45)] backdrop-blur-xl"
              style={{ left: cx0, width: centerW, top: Math.max(0, h / 2 - 90), height: Math.min(h, 180) }}>
              <CompanyLogo base={base} name={name} size={48} />
              <p className="line-clamp-2 text-[13.5px] font-semibold leading-tight text-foreground">{name}</p>
              <div className="flex items-center gap-3 text-[12px] tabular-nums">
                <span className="text-primary">+{hires.length} in</span>
                <span className="text-muted-foreground">−{departures.length} out</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NodeCard({ n, side, style, active, dim, focused, onHover, onTap }: {
  n: FlowNode; side: "from" | "to"; style: React.CSSProperties; active: boolean; dim: boolean; focused: boolean;
  onHover: (k: string | null) => void; onTap: () => void;
}) {
  const fav = n.domain ? `https://www.google.com/s2/favicons?domain=${n.domain}&sz=128` : null;
  return (
    <button
      type="button"
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(n.key)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onHover(null)}
      onClick={onTap}
      aria-pressed={focused}
      aria-label={`${n.name}, ${n.count} ${side === "from" ? "came from here" : "went here"}`}
      style={{ ...style, height: ROW }}
      className={cn(
        "absolute flex items-center gap-2.5 rounded-xl border bg-card/95 px-2.5 text-left shadow-sm backdrop-blur",
        "transition-[transform,opacity,border-color,box-shadow] duration-150 ease-out active:scale-[0.97]",
        side === "to" && "flex-row-reverse text-right",
        focused ? "border-primary ring-2 ring-primary/30" : active ? "border-primary/50 shadow-md" : "border-border/70",
        dim && "opacity-45",
      )}
    >
      <OrgLogo name={n.name} src={n.logo} fallbackSrc={fav} className="h-9 w-9 rounded-lg" textClassName="text-[11px]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground" title={n.name}>{n.name}</span>
        <span className={cn("mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground", side === "to" && "justify-end")}>
          <span className="truncate">{n.training > 0 ? (side === "from" ? "Training pipeline" : "Trainees went here") : n.kind}</span>
        </span>
      </span>
      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums", side === "from" ? "bg-primary/12 text-primary" : "bg-muted text-foreground/80")}>{n.count}</span>
    </button>
  );
}
