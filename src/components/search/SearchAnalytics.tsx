import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SearchAnalytics as Data } from "@/lib/buildSearchAnalytics";
import { VERDICTS } from "@/lib/buildSearchAnalytics";
import type { CriterionVerdict } from "./SearchResults";
import { VERDICT_LABEL } from "./EngineDetails";
import { SET_ASIDE_LABEL } from "./SetAsideTab";
import { toTitleCase } from "./candidate-ui";

export type AnalyticsFilter =
  | { kind: "criterion"; id: string; status: CriterionVerdict; label: string }
  | { kind: "set_aside"; reason: string; label: string };

/** Verdict colors, same tokens as the results table. Used for verdicts only. */
export const VERDICT_FILL: Record<CriterionVerdict, string> = {
  met: "hsl(var(--success))",
  partial: "hsl(var(--warning))",
  unknown: "hsl(var(--muted-foreground))",
  not_met: "hsl(var(--destructive))",
};
const CATEGORY_FILL = "hsl(var(--primary))";
const MILITARY_LABEL: Record<string, string> = { active: "Active duty", reserve: "Guard or Reserve", likely_reserve: "Likely Guard or Reserve", veteran: "Veteran" };

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="min-w-0 rounded-xl border border-border/60 bg-card p-4">
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** Plain list bars for categories (no verdict colors). */
function CountList({ items, empty }: { items: { name: string; count: number }[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
          <span className="truncate text-foreground" title={i.name}>{i.name}</span>
          <span className="tabular-nums text-muted-foreground">{i.count}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full origin-left rounded-full" style={{ background: CATEGORY_FILL, transform: `scaleX(${i.count / max})` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" };

export function SearchAnalytics({ data, onFilter }: { data: Data; onFilter: (f: AnalyticsFilter) => void }) {
  const f = data.funnel;
  const steps = [
    { label: "In the database for these filters", value: f.provider_total },
    { label: "Profiles pulled", value: f.fetched },
    { label: "Kept after Required", value: f.after_required },
    { label: "Met every must-have", value: f.met_must_haves },
    { label: "Match 75 or higher", value: f.match_75 },
  ].filter((s) => s.value !== null) as { label: string; value: number }[];
  const topStep = Math.max(...steps.map((s) => s.value), 1);

  const coverageRows = data.coverage.map((c) => ({ id: c.id, name: c.must_have ? `${c.title} (must-have)` : c.title, ...c.counts }));
  const employerTotal = data.employer.private_practice + data.employer.hospital_employed + data.employer.unknown;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="Funnel" note="How the pool narrowed. Click a reason to see those profiles.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]">
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.label} className="text-sm">
                <div className="flex justify-between gap-2"><span className="text-foreground">{s.label}</span><span className="tabular-nums font-semibold">{s.value.toLocaleString()}</span></div>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <span className="block h-full origin-left rounded-full" style={{ background: CATEGORY_FILL, transform: `scaleX(${s.value / topStep})` }} />
                </span>
              </li>
            ))}
          </ol>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Set aside</p>
            {f.set_aside.length === 0 ? <Empty>Nobody was set aside.</Empty> : (
              <ul className="space-y-1">
                {f.set_aside.map((r) => {
                  const label = SET_ASIDE_LABEL[r.reason] ?? "Other";
                  return (
                    <li key={r.reason}>
                      <button type="button" onClick={() => onFilter({ kind: "set_aside", reason: r.reason, label })}
                        className="flex w-full justify-between gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted">
                        <span className="truncate">{label}</span><span className="tabular-nums text-muted-foreground">{r.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>

      <Card title="Criteria coverage" note="Which Preferred criterion is cutting your pool. Click a segment to see those profiles.">
        {coverageRows.length === 0 ? <Empty>No Preferred criteria yet. Add one in Ranking criteria to see coverage.</Empty> : (
          <div style={{ height: Math.max(140, 44 * coverageRows.length + 60) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageRows} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: number, key: string) => [v, VERDICT_LABEL[key as CriterionVerdict] ?? key]} />
                <Legend formatter={(key: string) => VERDICT_LABEL[key as CriterionVerdict] ?? key} wrapperStyle={{ fontSize: 12 }} />
                {VERDICTS.map((v) => (
                  <Bar key={v} dataKey={v} name={v} stackId="s" fill={VERDICT_FILL[v]} isAnimationActive={false} cursor="pointer"
                    onClick={(d: { payload?: { id: string; name: string } }) => d?.payload && onFilter({ kind: "criterion", id: d.payload.id, status: v, label: `${VERDICT_LABEL[v]} on ${d.payload.name}` })} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Match distribution">
        {!data.match ? <Empty>No Preferred criteria, so there is no match score to show.</Empty> : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.match} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: number) => [v, "Profiles"]} labelFormatter={(l) => `Match ${l}`} />
                <Bar dataKey="count" fill={CATEGORY_FILL} isAnimationActive={false} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Employer type" note="Kept and set aside profiles.">
        {employerTotal === 0 ? <Empty>No profiles to read employer type from.</Empty> : (
          <CountList empty="" items={[
            { name: "Private practice", count: data.employer.private_practice },
            { name: "Hospital or health system employed", count: data.employer.hospital_employed },
            { name: "Not clear from the profile", count: data.employer.unknown },
          ]} />
        )}
      </Card>

      {data.subspecialty && (
        <Card title="Subspecialty evidence" note={`How ${data.subspecialty.label} was shown on kept profiles.`}>
          <CountList empty="" items={[
            { name: "Shown by a rule (title, fellowship, role text)", count: data.subspecialty.rule },
            { name: "Found on reading the profile", count: data.subspecialty.grader },
            { name: "Matched the filter only, no other evidence", count: data.subspecialty.none },
          ]} />
        </Card>
      )}

      <Card title="Years in practice" note={data.years_unknown > 0 ? `${data.years_unknown} kept ${data.years_unknown === 1 ? "profile has" : "profiles have"} no start dates after training.` : "Counted from the first role after training."}>
        {data.years.every((b) => b.count === 0) ? <Empty>No start dates after training on these profiles.</Empty> : (
          <CountList empty="" items={data.years.map((b) => ({ name: `${b.bucket} years`, count: b.count }))} />
        )}
      </Card>

      <Card title="Where they are">
        <CountList items={data.cities.map((c) => ({ name: toTitleCase(c.name), count: c.count }))} empty="No city is listed on these profiles." />
      </Card>

      <Card title="Training programs" note="Residency and fellowship programs on kept profiles.">
        <CountList items={data.training.map((c) => ({ name: toTitleCase(c.name), count: c.count }))} empty="No residency or fellowship program is listed on these profiles." />
      </Card>

      {data.military && (
        <Card title="Military" note="Kept and set aside profiles.">
          <CountList empty="" items={data.military.map((m) => ({ name: MILITARY_LABEL[m.affiliation] ?? toTitleCase(m.affiliation), count: m.count }))} />
        </Card>
      )}
    </div>
  );
}
