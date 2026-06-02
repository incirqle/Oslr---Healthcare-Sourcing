import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CompanyIntel, TalentFlowPerson } from "@/hooks/useCompanyEnrichment";
import { TalentFlowSankey } from "./TalentFlowSankey";
import { TalentFlowPeopleList } from "./TalentFlowPeopleList";
import { cn } from "@/lib/utils";

const RANGES = { "3M": 3, "6M": 6, "1Y": 12, "2Y": 24 } as const;
type RangeKey = keyof typeof RANGES;

function inRange(iso: string | null, months: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= months * 30 * 86_400_000;
}

function applyFilters(
  list: TalentFlowPerson[],
  dateKey: "current_company_start_date" | "previous_end_date",
  range: RangeKey,
  role: string,
): TalentFlowPerson[] {
  const months = RANGES[range];
  return list.filter((p) => {
    if (role !== "all" && p.function_category !== role) return false;
    return inRange(p[dateKey], months);
  });
}

function topN(
  list: TalentFlowPerson[],
  key: "previous_company" | "current_company",
  n = 10,
): { company: string; count: number }[] {
  const m = new Map<string, number>();
  for (const p of list) {
    const v = p[key];
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

export function TalentFlowTab({ data }: { data: CompanyIntel }) {
  const tf = data.talent_flow;
  const [range, setRange] = useState<RangeKey>("1Y");
  const [role, setRole] = useState<string>("all");

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    [...(tf?.hires ?? []), ...(tf?.departures ?? [])].forEach((p) => {
      if (p.function_category) set.add(p.function_category);
    });
    return Array.from(set).sort();
  }, [tf]);

  const filteredHires = useMemo(
    () =>
      applyFilters(tf?.hires ?? [], "current_company_start_date", range, role),
    [tf, range, role],
  );
  const filteredDeps = useMemo(
    () => applyFilters(tf?.departures ?? [], "previous_end_date", range, role),
    [tf, range, role],
  );

  const sankeyData = useMemo(
    () => ({
      centerLabel: data.company_name,
      hireSources: topN(filteredHires, "previous_company"),
      destinations: topN(filteredDeps, "current_company"),
    }),
    [data.company_name, filteredHires, filteredDeps],
  );

  if (!tf || (tf.hires.length === 0 && tf.departures.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-ui-border-light bg-ui-surface-subtle py-14 text-center">
        <p className="text-[14px] font-medium text-ui-text-primary">
          No recent talent flow detected
        </p>
        <p className="mt-1 max-w-sm text-[12.5px] text-ui-text-muted">
          We couldn't find recent hires or departures for this company in our
          dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ui-text-primary">
          Talent flow
        </h3>
        <div className="flex items-center gap-2">
          <Select
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: "all", label: "All roles" },
              ...roleOptions.map((r) => ({ value: r, label: r })),
            ]}
          />
          <div className="flex items-center gap-0.5 rounded-full border border-ui-border-light bg-ui-surface-subtle p-0.5">
            {(Object.keys(RANGES) as RangeKey[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  range === r
                    ? "bg-white text-ui-text-primary shadow-sm"
                    : "text-ui-text-muted hover:text-ui-text-primary",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="rounded-xl border border-ui-border-light bg-white p-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-[12px]">
            <p className="font-medium text-ui-text-primary">
              Hires vs departures · top 10 companies
            </p>
            <div className="flex items-center gap-3 text-ui-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]" />
                Hires {filteredHires.length}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-3))]" />
                Departures {filteredDeps.length}
              </span>
            </div>
          </div>
          {sankeyData.hireSources.length === 0 &&
          sankeyData.destinations.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-[12px] text-ui-text-muted">
              No movement in this range.
            </div>
          ) : (
            <TalentFlowSankey data={sankeyData} />
          )}
        </div>
        <TalentFlowPeopleList hires={filteredHires} departures={filteredDeps} />
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-ui-border-light bg-white px-3 py-1 text-[11.5px] font-medium text-ui-text-secondary">
      <span className="text-ui-text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent pr-4 text-ui-text-primary focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3 text-ui-text-muted" />
    </label>
  );
}
