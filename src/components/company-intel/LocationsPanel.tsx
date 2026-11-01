/**
 * Where staff work: states, cities, campuses and countries, all from the
 * base company record (region breakdown + listed office addresses). No
 * per-person pulls, no extra cost.
 */
import { useMemo, useState } from "react";
import { Building2, Globe2, MapPin } from "lucide-react";
import type { CompanyBase } from "@/hooks/useCompanyBrief";
import { campusesFromOffices, splitRegions } from "./regions";
import { fmtCount } from "./brief-utils";
import { cn } from "@/lib/utils";

type View = "states" | "cities" | "countries";

function Bars({ rows, max, highlight }: { rows: { place: string; count: number }[]; max: number; highlight?: (place: string) => boolean }) {
  return (
    <ul className="space-y-2">
      {rows.map((x, i) => (
        <li key={x.place} className="group grid grid-cols-[minmax(0,1fr)_120px_44px] items-center gap-3">
          <span className={cn("truncate text-[13.5px]", highlight?.(x.place) ? "font-semibold text-primary" : "text-foreground")}>{x.place}</span>
          <span className="h-[7px] overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full transition-all duration-500", highlight?.(x.place) ? "bg-primary" : i === 0 ? "bg-primary/80" : "bg-primary/45")}
              style={{ width: `${Math.max(5, (x.count / max) * 100)}%` }}
            />
          </span>
          <span className="text-right text-[12.5px] tabular-nums text-muted-foreground">{fmtCount(x.count)}</span>
        </li>
      ))}
    </ul>
  );
}

export function LocationsCard({ base }: { base: CompanyBase }) {
  const [view, setView] = useState<View>("states");
  const split = useMemo(() => splitRegions(base.headcount.by_region ?? null), [base.headcount.by_region]);
  const campuses = useMemo(() => campusesFromOffices(base.offices ?? []), [base.offices]);

  const rows = view === "states" ? split.states : view === "cities" ? split.cities : split.countries;
  const shown = rows.slice(0, 8);
  const max = Math.max(1, ...shown.map((x) => x.count));
  const hqState = base.hq_state ?? "";
  const highlight = (place: string) => !!hqState && (place === hqState || place.endsWith(`, ${hqState}`) || place.startsWith(`${hqState},`));

  const tabs: { key: View; label: string; n: number }[] = [
    { key: "states", label: "States", n: split.states.length },
    { key: "cities", label: "Cities", n: split.cities.length },
    { key: "countries", label: "Countries", n: split.countries.length },
  ];

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Where staff work</h3>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Every region with listed employees, from the company record.</p>
        </div>
        {split.states.length + split.cities.length + split.countries.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-muted p-0.5">
            {tabs.filter((t) => t.n > 0).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors duration-150 active:scale-[0.97]",
                  view === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown.length > 0 ? (
        <Bars rows={shown} max={max} highlight={highlight} />
      ) : base.sites.length > 0 ? (
        <Bars rows={base.sites.slice(0, 8)} max={Math.max(1, ...base.sites.map((x) => x.count))} highlight={highlight} />
      ) : (
        <p className="py-4 text-center text-[13px] text-muted-foreground">No location breakdown listed for this company.</p>
      )}
      {rows.length > shown.length && <p className="mt-2.5 text-[12px] text-muted-foreground">Plus {rows.length - shown.length} more {view === "countries" ? "countries" : view}.</p>}

      {campuses.length > 0 && (
        <div className="mt-5 border-t border-ui-border-light pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground"><Building2 className="h-3.5 w-3.5" />Listed offices and campuses</p>
          <ul className="flex flex-wrap gap-1.5">
            {campuses.map((c) => (
              <li key={c.place} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-[12.5px] text-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {c.place}
                {c.count > 1 && <span className="tabular-nums text-muted-foreground">×{c.count}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {split.countries.length > 0 && view !== "countries" && (
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Globe2 className="h-3.5 w-3.5" />
          Also listed in {split.countries.slice(0, 3).map((c) => c.place).join(", ")}{split.countries.length > 3 ? ` and ${split.countries.length - 3} more` : ""}.
        </p>
      )}
    </section>
  );
}
