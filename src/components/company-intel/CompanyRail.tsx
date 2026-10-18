/**
 * The company panel's left column: everything the initial company
 * enrichment returns, shown on open at no extra cost.
 */

import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { ArrowUpRight, Globe } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyBase } from "@/hooks/useCompanyBrief";
import { LinkedInBadge } from "./LinkedInBadge";
import { fmtCount, fmtMonth, OWNERSHIP_LABEL } from "./brief-utils";
import { cn } from "@/lib/utils";

function Logo({ name, logoUrl, domain }: { name: string; logoUrl: string | null; domain: string | null }) {
  const sources = useMemo(() => [logoUrl, domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null].filter((s): s is string => !!s), [logoUrl, domain]);
  const [i, setI] = useState(0);
  const initials = name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(and|of|the)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  if (!sources[i]) {
    return <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#0A1F44] font-display text-[17px] font-semibold text-[#7AC5B0]">{initials}</div>;
  }
  return <img src={sources[i]} alt="" onError={() => setI((n) => n + 1)} className="h-12 w-12 shrink-0 rounded-lg border border-ui-border-medium bg-white object-contain p-1" />;
}

export function Badge({ children, tone = "neutral", title }: { children: React.ReactNode; tone?: "neutral" | "seafoam" | "navy"; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-medium",
        tone === "seafoam" && "bg-[#7AC5B0]/20 text-[#1F6B57] dark:text-[#7AC5B0]",
        tone === "navy" && "bg-[#0A1F44]/[0.08] text-[#0A1F44] dark:bg-white/10 dark:text-ui-text-primary",
        tone === "neutral" && "border border-ui-border-medium text-ui-text-secondary",
      )}
    >
      {children}
    </span>
  );
}

function Fact({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-ui-text-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold leading-snug tabular-nums text-ui-text-primary [overflow-wrap:anywhere]">{value}</p>
      {sub && <p className="truncate text-[11.5px] text-ui-text-secondary">{sub}</p>}
    </div>
  );
}

export function CompanyRail({ base, state, fallbackName }: { base: CompanyBase | null; state: string; fallbackName: string }) {
  const [more, setMore] = useState(false);
  if (!base) {
    return (
      <aside className="w-full shrink-0 border-b border-ui-border-medium bg-ui-surface-subtle p-6 md:w-[300px] md:border-b-0 md:border-r md:overflow-y-auto">
        <DialogTitle className="font-display text-[19px] font-semibold text-ui-text-primary">{fallbackName}</DialogTitle>
        {state === "loading" && (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {state === "empty" && <p className="mt-3 text-[13px] text-ui-text-secondary">No company page matched this employer.</p>}
        {state === "error" && <p className="mt-3 text-[13px] text-ui-text-secondary">Company details didn't load. Close and reopen to try again.</p>}
      </aside>
    );
  }

  const hc = base.headcount;
  const yoy = hc.yoy_percent;
  const series = hc.timeseries.slice(-36);
  const hq = [base.hq_city, base.hq_state].filter(Boolean).join(", ");
  const ownership = OWNERSHIP_LABEL[base.ownership.model];
  const maxSite = Math.max(1, ...base.sites.map((s) => s.count));

  return (
    <aside className="w-full shrink-0 border-b border-ui-border-medium bg-ui-surface-subtle md:w-[300px] md:border-b-0 md:border-r md:overflow-y-auto">
      <div className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <Logo name={base.display_name} logoUrl={base.logo_url} domain={base.company_website_domain} />
          <div className="min-w-0">
            <DialogTitle className="font-display text-[19px] font-semibold leading-tight tracking-tight text-ui-text-primary [text-wrap:balance]">{base.display_name}</DialogTitle>
            {base.legal_name.toLowerCase() !== base.display_name.toLowerCase() && (
              <p className="mt-0.5 truncate text-[11.5px] text-ui-text-muted" title={base.legal_name}>{base.legal_name}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <LinkedInBadge href={base.linkedin_profile_url} size={22} label={`${base.display_name} company page`} />
          {ownership && <Badge tone={base.ownership.model === "private_practice" ? "seafoam" : "navy"} title={base.ownership.evidence}>{ownership}</Badge>}
          {base.industry && <Badge>{base.industry}</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-ui-border-medium bg-white p-4 dark:bg-background">
          <Fact label="Employees" value={fmtCount(hc.total)} sub={base.employee_count_range ? `Range ${base.employee_count_range}` : undefined} />
          <Fact
            label="1-year change"
            value={yoy === null ? "–" : <span className={yoy >= 0 ? "text-[#1F6B57] dark:text-[#7AC5B0]" : undefined}>{yoy >= 0 ? "+" : ""}{yoy.toFixed(1)}%</span>}
            sub={hc.yoy_absolute !== null ? `${hc.yoy_absolute >= 0 ? "+" : ""}${hc.yoy_absolute} people` : undefined}
          />
          <Fact label="Founded" value={base.year_founded ?? "–"} />
          <Fact label="Headquarters" value={hq || "–"} />
          {series.length > 1 && (
            <div className="col-span-2 border-t border-ui-border-light pt-3">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-ui-text-muted">Headcount</p>
                <p className="text-[11px] text-ui-text-muted">since {fmtMonth(series[0].date)}</p>
              </div>
              <div className="mt-1 h-14">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                    <Area type="monotone" dataKey="employee_count" stroke="#2F8F75" strokeWidth={1.75} fill="#7AC5B0" fillOpacity={0.16} dot={false} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {base.company_website_domain && (
          <a href={`https://${base.company_website_domain}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[12.5px] text-ui-text-secondary transition-colors duration-150 hover:text-ui-text-primary">
            <Globe className="h-3.5 w-3.5 text-ui-text-muted" />
            {base.company_website_domain}
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}

        {base.description && (
          <div>
            <p className={cn("text-[13px] leading-relaxed text-ui-text-secondary", !more && "line-clamp-4")}>{base.description}</p>
            {base.description.length > 220 && (
              <button type="button" onClick={() => setMore((v) => !v)} className="mt-1 text-[12.5px] font-medium text-[#1F6B57] hover:underline dark:text-[#7AC5B0]">
                {more ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {base.sites.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-ui-text-muted">Where staff work</p>
            <ul className="space-y-1.5">
              {base.sites.slice(0, 5).map((s) => (
                <li key={s.place} className="grid grid-cols-[minmax(0,1fr)_64px_28px] items-center gap-2">
                  <span className="truncate text-[12.5px] text-ui-text-primary">{s.place}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-ui-border-light">
                    <span className="block h-full rounded-full bg-[#7AC5B0]" style={{ width: `${Math.max(6, (s.count / maxSite) * 100)}%` }} />
                  </span>
                  <span className="text-right text-[12px] tabular-nums text-ui-text-secondary">{fmtCount(s.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {base.pages.length > 1 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.04em] text-ui-text-muted">Combined pages · {base.pages.length}</p>
            <ul className="space-y-1.5">
              {base.pages.map((p) => (
                <li key={p.company_id} className="flex items-center gap-2">
                  <LinkedInBadge href={p.linkedin_url} size={16} label={`${p.name} company page`} />
                  <span className="truncate text-[12.5px] text-ui-text-secondary" title={p.name}>{p.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
