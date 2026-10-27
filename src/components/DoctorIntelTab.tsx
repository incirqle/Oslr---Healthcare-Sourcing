import { useEffect } from "react";
import { ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { ensureDoctorIntel, refreshDoctorIntel, useDoctorIntel, type IntelPerson } from "@/lib/doctorIntel";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-ui-border-light bg-card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-foreground">{title}</h3>
        {sub && <span className="text-[11px] text-ui-text-tertiary">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-ui-text-tertiary">{children}</p>;

export function DoctorIntelTab({ person }: { person: IntelPerson }) {
  const entry = useDoctorIntel(person.id);
  useEffect(() => { ensureDoctorIntel(person); }, [person.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!entry || entry.status === "loading") {
    return <div className="flex items-center gap-2 py-8 text-[13px] text-ui-text-tertiary"><Loader2 className="h-4 w-4 animate-spin" /> Reading federal records</div>;
  }
  if (entry.status === "error") {
    return <div className="py-8 text-[13px] text-ui-text-tertiary">Federal records did not load. <button className="underline" onClick={() => refreshDoctorIntel(person)}>Try again</button></div>;
  }
  const d = entry.data;
  if (!d) return <Empty>No federal records could be matched to this doctor.</Empty>;
  const pay = d.payments, pubs = d.publications, tri = d.trials;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] text-ui-text-tertiary">
        <span>{d.npi?.npi ? `NPI ${d.npi.npi}${d.npi.specialty ? ` · ${d.npi.specialty}` : ""}` : "NPI not confirmed"}</span>
        <button onClick={() => refreshDoctorIntel(person)} className="inline-flex items-center gap-1 hover:text-foreground"><RefreshCw className="h-3 w-3" /> Refresh</button>
      </div>

      <Section title="Industry payments" sub="CMS Open Payments 2022 to 2025">
        {!d.npi?.npi ? (
          <Empty>{(d.npi?.candidates ?? 0) > 1 ? "Several doctors share this name, so payments are not shown to avoid a wrong match." : "No NPI record found for this doctor."}</Empty>
        ) : !pay ? <Empty>Payment records did not load.</Empty> : pay.count === 0 ? <Empty>No industry payments reported.</Empty> : (
          <div className="space-y-3">
            <div className="flex items-baseline gap-2"><span className="text-[22px] font-semibold text-foreground">{usd(pay.total)}</span><span className="text-[12px] text-ui-text-tertiary">{pay.count} payments</span></div>
            <div className="grid grid-cols-4 gap-2">
              {pay.byYear.map((y) => (
                <div key={y.year} className="rounded-lg bg-muted/40 p-2 text-center"><div className="text-[11px] text-ui-text-tertiary">{y.year}</div><div className="text-[12px] font-medium text-foreground">{usd(y.total)}</div></div>
              ))}
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-ui-text-tertiary">Top companies</div>
              {pay.topCompanies.map((c) => <div key={c.name} className="flex justify-between py-0.5 text-[13px]"><span className="truncate text-ui-text-secondary">{c.name}</span><span className="text-foreground">{usd(c.amount)}</span></div>)}
            </div>
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-wide text-ui-text-tertiary">By type</div>
              {pay.byType.map((c) => <div key={c.name} className="flex justify-between py-0.5 text-[13px]"><span className="truncate text-ui-text-secondary">{c.name}</span><span className="text-foreground">{usd(c.amount)}</span></div>)}
            </div>
          </div>
        )}
      </Section>

      <Section title="Research" sub={pubs ? `PubMed${pubs.match === "name" ? " · matched by name" : ""}` : "PubMed"}>
        {!pubs ? <Empty>Research records did not load.</Empty> : pubs.count === 0 ? <Empty>No publications found.</Empty> : (
          <div className="space-y-2">
            <div className="text-[13px] text-ui-text-secondary">{pubs.count} publications</div>
            {pubs.articles.map((a) => (
              <a key={a.pmid} href={a.url} target="_blank" rel="noreferrer" className="block rounded-lg p-2 hover:bg-muted/40">
                <div className="text-[13px] font-medium text-foreground">{a.title}</div>
                <div className="flex items-center gap-1 text-[11px] text-ui-text-tertiary">{a.journal} · {a.year} <ExternalLink className="h-3 w-3" /></div>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section title="Clinical trials" sub="ClinicalTrials.gov">
        {!tri ? <Empty>Trial records did not load.</Empty> : tri.count === 0 ? <Empty>No trials list this doctor as an investigator.</Empty> : (
          <div className="space-y-2">
            {tri.studies.map((t) => (
              <a key={t.nctId} href={t.url} target="_blank" rel="noreferrer" className="block rounded-lg p-2 hover:bg-muted/40">
                <div className="text-[13px] font-medium text-foreground">{t.title}</div>
                <div className="text-[11px] text-ui-text-tertiary">{[t.status?.replace(/_/g, " ").toLowerCase(), t.phase, t.sponsor].filter(Boolean).join(" · ")}</div>
              </a>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
