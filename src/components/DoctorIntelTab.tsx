import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw, Loader2, FlaskConical, BookOpen, Building2 } from "lucide-react";
import { ensureDoctorIntel, refreshDoctorIntel, useDoctorIntel, type IntelPerson } from "@/lib/doctorIntel";

const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const KEEP_UPPER = new Set(["LLC", "LP", "INC", "USA", "US", "AG", "LTD", "PLC", "NA", "GE", "BD", "AB", "3M"]);
/** "BIOTISSUE HOLDINGS INC." -> "Biotissue Holdings Inc." */
function niceName(s: string) {
  if (s !== s.toUpperCase()) return s;
  return s.toLowerCase().replace(/[a-z0-9]+/g, (w) => (KEEP_UPPER.has(w.toUpperCase().replace(/\.$/, "")) && w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
}

const KNOWN: Record<string, string> = {
  stryker: "stryker.com", smithnephew: "smith-nephew.com", zimmer: "zimmerbiomet.com", zimmerbiomet: "zimmerbiomet.com",
  depuy: "jnj.com", johnson: "jnj.com", medtronic: "medtronic.com", arthrex: "arthrex.com", pfizer: "pfizer.com",
  biotissue: "biotissue.com", zynex: "zynex.com", neos: "neostx.com", abbvie: "abbvie.com", boston: "bostonscientific.com",
  globus: "globusmedical.com", nuvasive: "nuvasive.com", exactech: "exac.com", conmed: "conmed.com", bioventus: "bioventus.com",
  abbott: "abbott.com", novartis: "novartis.com", merck: "merck.com", lilly: "lilly.com", eli: "lilly.com", amgen: "amgen.com",
  genentech: "gene.com", sanofi: "sanofi.com", astrazeneca: "astrazeneca.com", vericel: "vericel.com", orthofix: "orthofix.com",
};
function companyDomain(name: string) {
  const key = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const joined = key.replace(/ /g, "");
  for (const k of Object.keys(KNOWN)) if (joined.startsWith(k)) return KNOWN[k];
  const first = key.split(" ")[0];
  return first && first.length > 2 ? `${first}.com` : null;
}

function Logo({ name }: { name: string }) {
  const domain = companyDomain(name);
  const sources = domain ? [`https://logo.clearbit.com/${domain}`, `https://www.google.com/s2/favicons?domain=${domain}&sz=64`] : [];
  const [i, setI] = useState(0);
  if (!sources[i]) {
    return <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[12px] font-semibold text-primary">{name.trim().charAt(0).toUpperCase()}</div>;
  }
  return <img src={sources[i]} alt="" onError={() => setI(i + 1)} className="h-8 w-8 shrink-0 rounded-lg border border-ui-border-light/60 bg-background object-contain p-1" />;
}

function Section({ icon, title, sub, children }: { icon: React.ReactNode; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-ui-border-light bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><span className="text-primary">{icon}</span><h3 className="text-[15px] font-semibold text-foreground">{title}</h3></div>
        {sub && <span className="text-[11px] text-ui-text-tertiary">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-[13px] text-ui-text-tertiary">{children}</p>;

const STATUS_TONE: Record<string, string> = {
  RECRUITING: "bg-primary/15 text-primary", ACTIVE_NOT_RECRUITING: "bg-primary/10 text-primary", NOT_YET_RECRUITING: "bg-primary/10 text-primary",
  COMPLETED: "bg-muted text-foreground", WITHDRAWN: "bg-muted text-ui-text-tertiary", TERMINATED: "bg-muted text-ui-text-tertiary",
};
const statusLabel = (s?: string) => (s ? s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : "");
const phaseLabel = (p?: string | null) => (p ? p.replace(/PHASE(\d)/g, "Phase $1").replace(/EARLY_/g, "Early ").replace(/NA/, "Not phased") : null);

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
  const maxYear = Math.max(1, ...(pay?.byYear ?? []).map((y) => y.total));
  const maxCo = Math.max(1, ...(pay?.topCompanies ?? []).map((c) => c.amount));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] text-ui-text-tertiary">
        <span>{d.npi?.npi ? `NPI ${d.npi.npi}${d.npi.specialty ? ` · ${d.npi.specialty}` : ""}` : "NPI not confirmed"}</span>
        <button onClick={() => refreshDoctorIntel(person)} className="inline-flex items-center gap-1 hover:text-foreground"><RefreshCw className="h-3 w-3" /> Refresh</button>
      </div>

      <Section icon={<Building2 className="h-4 w-4" />} title="Industry payments" sub="CMS Open Payments 2022 to 2025">
        {!d.npi?.npi ? (
          <Empty>{(d.npi?.candidates ?? 0) > 1 ? "Several doctors share this name, so payments are not shown to avoid a wrong match." : "No NPI record found for this doctor."}</Empty>
        ) : !pay ? <Empty>Payment records did not load.</Empty> : pay.count === 0 ? <Empty>No industry payments reported.</Empty> : (
          <div className="space-y-5">
            <div className="flex items-baseline gap-2"><span className="text-[26px] font-semibold tracking-tight text-foreground">{usd(pay.total)}</span><span className="text-[12px] text-ui-text-tertiary">{pay.count} payments</span></div>
            <div className="grid grid-cols-4 gap-2">
              {pay.byYear.map((y) => (
                <div key={y.year} className="flex flex-col justify-end rounded-xl bg-muted/40 p-3">
                  <div className="mb-2 h-10 flex items-end"><div className="w-full rounded-sm bg-primary/70" style={{ height: `${Math.max(4, (y.total / maxYear) * 100)}%` }} /></div>
                  <div className="text-[11px] text-ui-text-tertiary">{y.year}</div>
                  <div className="text-[13px] font-medium text-foreground">{usd(y.total)}</div>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ui-text-tertiary">Top companies</div>
              <div className="space-y-2">
                {pay.topCompanies.map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <Logo name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-[13px]"><span className="truncate font-medium text-foreground">{niceName(c.name)}</span><span className="tabular-nums text-foreground">{usd(c.amount)}</span></div>
                      <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-primary/60" style={{ width: `${(c.amount / maxCo) * 100}%` }} /></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ui-text-tertiary">By type</div>
              <div className="flex flex-wrap gap-2">
                {pay.byType.map((c) => <span key={c.name} className="rounded-full bg-muted/60 px-3 py-1 text-[12px] text-ui-text-secondary">{c.name} <span className="font-medium text-foreground">{usd(c.amount)}</span></span>)}
              </div>
            </div>
          </div>
        )}
      </Section>

      <Section icon={<BookOpen className="h-4 w-4" />} title="Research" sub={pubs ? `PubMed${pubs.match === "name" ? " · matched by name" : ""}` : "PubMed"}>
        {!pubs ? <Empty>Research records did not load.</Empty> : pubs.count === 0 ? <Empty>No publications found on PubMed.</Empty> : (
          <div className="space-y-1">
            <div className="mb-2 text-[13px] text-ui-text-secondary">{pubs.count} publications</div>
            {pubs.articles.map((a) => (
              <a key={a.pmid} href={a.url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3 rounded-xl p-3 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-foreground group-hover:text-primary">{a.title}</div>
                  <div className="mt-0.5 text-[11px] text-ui-text-tertiary">{a.journal} · {a.year}</div>
                </div>
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ui-text-tertiary group-hover:text-primary" />
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section icon={<FlaskConical className="h-4 w-4" />} title="Clinical trials" sub="ClinicalTrials.gov">
        {!tri ? <Empty>Trial records did not load.</Empty> : tri.count === 0 ? <Empty>No trials list this doctor as an investigator.</Empty> : (
          <div className="space-y-2">
            {tri.studies.map((t) => (
              <a key={t.nctId} href={t.url} target="_blank" rel="noreferrer" className="group block rounded-xl border border-ui-border-light/60 p-4 hover:border-primary/40 hover:bg-muted/30">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {t.status && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[t.status] ?? "bg-muted text-foreground"}`}>{statusLabel(t.status)}</span>}
                  {phaseLabel(t.phase) && <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-ui-text-secondary">{phaseLabel(t.phase)}</span>}
                  <span className="text-[11px] text-ui-text-tertiary">{t.nctId}</span>
                </div>
                <div className="text-[14px] font-medium text-foreground group-hover:text-primary">{t.title}</div>
                <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-ui-text-tertiary">
                  <span>{[t.sponsor, t.start ? `Started ${t.start}` : null].filter(Boolean).join(" · ")}</span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-medium text-primary">View trial <ExternalLink className="h-3 w-3" /></span>
                </div>
              </a>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
