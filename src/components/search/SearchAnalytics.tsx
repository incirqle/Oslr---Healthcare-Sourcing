import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SearchAnalytics as Data } from "@/lib/buildSearchAnalytics";
import { VERDICTS } from "@/lib/buildSearchAnalytics";
import type { CriterionVerdict } from "./SearchResults";
import { VERDICT_LABEL } from "./EngineDetails";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toTitleCase } from "./candidate-ui";

export type AnalyticsFilter = { kind: "criterion"; id: string; status: CriterionVerdict; label: string };

/** Verdict colors, same tokens as the results table. Used for verdicts only. */
export const VERDICT_FILL: Record<CriterionVerdict, string> = {
  met: "#0A1F44",
  partial: "#5A7090",
  unknown: "#BCC6D3",
  not_met: "#E4E8EE",
};
const CATEGORY_FILL = "#7AC5B0";
const MILITARY_LABEL: Record<string, string> = { active: "Active duty", reserve: "Guard or Reserve", likely_reserve: "Likely Guard or Reserve", veteran: "Veteran" };

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-5">
      <h3 className="font-display text-[16px] font-semibold text-foreground">{title}</h3>
      {note && <p className="mt-1 text-[13.5px] text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] text-muted-foreground">{children}</p>;
}

/** Plain list bars for categories (no verdict colors). */
function CountList({ items, empty }: { items: { name: string; count: number }[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-[14px]">
          <span className="truncate text-foreground" title={i.name}>{i.name}</span>
          <span className="tabular-nums font-medium text-foreground">{i.count}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <span className="block h-full origin-left rounded-full" style={{ background: CATEGORY_FILL, transform: `scaleX(${i.count / max})` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const tooltipStyle = { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, color: "hsl(var(--popover-foreground))" };

export function SearchAnalytics({ data, onFilter, onAddCriteria }: { data: Data; onFilter: (f: AnalyticsFilter) => void; onAddCriteria?: () => void }) {
  const coverageRows = data.coverage.map((c) => ({ id: c.id, name: c.must_have ? `${c.title} (must-have)` : c.title, ...c.counts }));
  const employerTotal = data.employer.private_practice + data.employer.hospital_employed + data.employer.unknown;
  const addButton = onAddCriteria && (
    <Button size="sm" onClick={onAddCriteria} className="mt-3 h-9 gap-1.5"><Plus className="h-4 w-4" /> Add ranking criteria</Button>
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="How candidates meet your ranking" note={coverageRows.length > 0 ? "Click a bar to see those candidates." : undefined}>
        {coverageRows.length === 0 ? (
          <div>
            <Empty>Add what matters most to you, like fellowship training or years in practice, and this shows how many candidates have each one.</Empty>
            {addButton}
          </div>
        ) : (
          <div style={{ height: Math.max(160, 48 * coverageRows.length + 64) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={coverageRows} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} domain={[0, "dataMax"]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: number, key: string) => [v, VERDICT_LABEL[key as CriterionVerdict] ?? key]} />
                <Legend formatter={(key: string) => <span style={{ color: "hsl(var(--foreground))" }}>{VERDICT_LABEL[key as CriterionVerdict] ?? key}</span>} wrapperStyle={{ fontSize: 13 }} />
                {VERDICTS.map((v) => (
                  <Bar key={v} dataKey={v} name={v} stackId="s" fill={VERDICT_FILL[v]} stroke={v === "not_met" ? "#BCC6D3" : undefined} isAnimationActive={false} cursor="pointer"
                    onClick={(d: { payload?: { id: string; name: string } }) => d?.payload && onFilter({ kind: "criterion", id: d.payload.id, status: v, label: `${VERDICT_LABEL[v]} on ${d.payload.name}` })} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card
        title={data.match_basis === "criteria" ? "Match to your ranking" : "How well they fit your search"}
        note={data.match_basis === "fit" ? "Each candidate's fit score from reading their profile. Add ranking criteria to score them on your own priorities." : undefined}
      >
        {!data.match ? <Empty>No scores yet for these candidates.</Empty> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.match} margin={{ left: -16, right: 8 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v: number) => [v, "Candidates"]} />
                <Bar dataKey="count" fill={CATEGORY_FILL} isAnimationActive={false} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title="Practice type">
        {employerTotal === 0 ? <Empty>No candidates to show.</Empty> : (
          <CountList empty="" items={[
            { name: "Private practice", count: data.employer.private_practice },
            { name: "Hospital or health system", count: data.employer.hospital_employed },
            { name: "Not listed", count: data.employer.unknown },
          ]} />
        )}
      </Card>

      {data.subspecialty && (
        <Card title={`${data.subspecialty.label} experience`} note="Where each candidate's profile shows it.">
          <CountList empty="" items={[
            { name: "In their title, fellowship or role", count: data.subspecialty.rule },
            { name: "Elsewhere in their profile", count: data.subspecialty.grader },
            { name: "Matched the search, few details listed", count: data.subspecialty.none },
          ]} />
        </Card>
      )}

      <Card title="Years in practice" note={data.years_unknown > 0 && data.years.some((b) => b.count > 0) ? `Not listed for ${data.years_unknown} ${data.years_unknown === 1 ? "candidate" : "candidates"}.` : undefined}>
        {data.years.every((b) => b.count === 0) ? <Empty>Not listed on these profiles.</Empty> : (
          <CountList empty="" items={data.years.map((b) => ({ name: `${b.bucket} years`, count: b.count }))} />
        )}
      </Card>

      <Card title="Cities">
        <CountList items={data.cities.map((c) => ({ name: toTitleCase(c.name), count: c.count }))} empty="No city is listed on these profiles." />
      </Card>

      <Card title="Where they trained" note="Residency and fellowship programs.">
        <CountList items={data.training.map((c) => ({ name: toTitleCase(c.name), count: c.count }))} empty="No residency or fellowship is listed on these profiles." />
      </Card>

      {data.military && (
        <Card title="Military service">
          <CountList empty="" items={data.military.map((m) => ({ name: MILITARY_LABEL[m.affiliation] ?? toTitleCase(m.affiliation), count: m.count }))} />
        </Card>
      )}
    </div>
  );
}
