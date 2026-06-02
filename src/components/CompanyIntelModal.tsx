import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUpRight,
  ExternalLink,
  Globe,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { useCompanyEnrichment } from "@/hooks/useCompanyEnrichment";
import { normalizeDomain, resolveCompanyDomain } from "@/lib/company-domains";

interface CompanyIntelModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyName: string | null | undefined;
  domain?: string | null;
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function formatGrowth(pct: number | null | undefined): string | null {
  if (pct === null || pct === undefined) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function CompanyLogo({
  name,
  domain,
  size = 72,
}: {
  name: string;
  domain: string | null;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (!domain || errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-2xl border border-ui-border-light/60 bg-primary/10 text-[28px] font-semibold text-primary shadow-sm"
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={`${name} logo`}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className="shrink-0 rounded-2xl border border-ui-border-light/60 bg-white object-contain p-2 shadow-sm"
      style={{ width: size, height: size }}
    />
  );
}

export function CompanyIntelModal({
  open,
  onOpenChange,
  companyName,
  domain,
}: CompanyIntelModalProps) {
  const seedDomain = useMemo(
    () => normalizeDomain(domain) ?? resolveCompanyDomain(companyName),
    [domain, companyName],
  );

  const { data, loading } = useCompanyEnrichment(
    open ? companyName ?? null : null,
    open ? seedDomain : null,
  );

  const resolvedDomain = useMemo(
    () => normalizeDomain(data?.company_website_domain) ?? seedDomain ?? null,
    [data?.company_website_domain, seedDomain],
  );

  if (!companyName) return null;
  const displayName = data?.company_name ?? companyName;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[42rem] gap-0 overflow-hidden border border-ui-border-light bg-white p-0 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-ui-surface-subtle via-white to-ui-surface-subtle px-6 pb-6 pt-6">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-1.5 text-ui-text-muted transition-colors hover:bg-ui-surface-hover hover:text-ui-text-primary"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <CompanyLogo name={displayName} domain={resolvedDomain} size={72} />
            <div className="mt-1 min-w-0 flex-1">
              <DialogTitle className="text-[22px] font-semibold tracking-tight text-ui-text-primary">
                {displayName}
              </DialogTitle>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {resolvedDomain && (
                  <a
                    href={`https://${resolvedDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-ui-border-light bg-white px-2.5 py-1 text-[12px] font-medium text-ui-text-secondary transition-colors hover:border-primary/30 hover:text-primary"
                  >
                    <Globe className="h-3 w-3" />
                    {resolvedDomain}
                    <ArrowUpRight className="h-2.5 w-2.5" />
                  </a>
                )}
                {data?.linkedin_profile_url && (
                  <a
                    href={data.linkedin_profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-ui-border-light bg-white px-2.5 py-1 text-[12px] font-medium text-[#0A66C2] transition-colors hover:border-[#0A66C2]/30"
                  >
                    LinkedIn
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {data?.founded_year && (
                  <span className="text-[12px] text-ui-text-muted">
                    Founded {data.founded_year}
                  </span>
                )}
              </div>
              {data?.description && (
                <p className="mt-2.5 max-w-xl text-[13px] leading-relaxed text-ui-text-secondary line-clamp-2">
                  {data.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pb-6">
          {loading ? (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-[72px] rounded-xl" />
                <Skeleton className="h-[72px] rounded-xl" />
                <Skeleton className="h-[72px] rounded-xl" />
              </div>
              <Skeleton className="h-[120px] rounded-xl" />
              <Skeleton className="h-[80px] rounded-xl" />
            </div>
          ) : !data ? (
            <div className="mt-10 flex flex-col items-center justify-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ui-surface-subtle">
                <Globe className="h-6 w-6 text-ui-text-muted" />
              </div>
              <p className="mt-4 text-[15px] font-medium text-ui-text-primary">
                No public intel found for {displayName}
              </p>
              <p className="mt-1 max-w-xs text-[13px] text-ui-text-muted">
                We couldn't locate employer data. This company may be too small or not publicly listed.
              </p>
            </div>
          ) : (
            <>
              {/* Snapshot stats */}
              <div className="mt-5 grid grid-cols-3 gap-3">
                {data.headcount?.latest_count !== null &&
                  data.headcount?.latest_count !== undefined && (
                    <div className="rounded-xl border border-ui-border-light bg-ui-surface-subtle p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ui-text-muted">
                        <Users className="h-3.5 w-3.5" />
                        Employees
                      </div>
                      <p className="mt-2 text-[22px] font-semibold tracking-tight text-ui-text-primary">
                        {formatNumber(data.headcount.latest_count)}
                      </p>
                      {formatGrowth(data.headcount.growth_12m_percent) && (
                        <p
                          className={`mt-0.5 text-[12px] font-medium ${
                            (data.headcount.growth_12m_percent ?? 0) >= 0
                              ? "text-primary"
                              : "text-ui-text-muted"
                          }`}
                        >
                          {formatGrowth(data.headcount.growth_12m_percent)}{" "}
                          <span className="font-normal text-ui-text-muted">
                            YoY
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                {data.glassdoor?.overall_rating !== null &&
                  data.glassdoor?.overall_rating !== undefined && (
                    <div className="rounded-xl border border-ui-border-light bg-ui-surface-subtle p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ui-text-muted">
                        <Star className="h-3.5 w-3.5" />
                        Glassdoor
                      </div>
                      <p className="mt-2 text-[22px] font-semibold tracking-tight text-ui-text-primary">
                        {data.glassdoor.overall_rating.toFixed(1)}
                        <span className="ml-1 text-[14px] text-ui-text-muted">
                          ★
                        </span>
                      </p>
                      {data.glassdoor.review_count !== null &&
                        data.glassdoor.review_count !== undefined && (
                          <p className="mt-0.5 text-[12px] text-ui-text-muted">
                            {formatNumber(data.glassdoor.review_count)} reviews
                          </p>
                        )}
                    </div>
                  )}

                {data.web_traffic?.monthly_visitors !== null &&
                  data.web_traffic?.monthly_visitors !== undefined && (
                    <div className="rounded-xl border border-ui-border-light bg-ui-surface-subtle p-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-ui-text-muted">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Visitors / mo
                      </div>
                      <p className="mt-2 text-[22px] font-semibold tracking-tight text-ui-text-primary">
                        {formatNumber(data.web_traffic.monthly_visitors)}
                      </p>
                      {formatGrowth(data.web_traffic.growth_mom_percent) && (
                        <p className="mt-0.5 text-[12px] text-ui-text-muted">
                          {formatGrowth(data.web_traffic.growth_mom_percent)}{" "}
                          <span className="font-normal">MoM</span>
                        </p>
                      )}
                    </div>
                  )}
              </div>

              {/* Leadership */}
              {(data.cxos ?? []).length > 0 && (
                <div className="mt-5 rounded-xl border border-ui-border-light bg-white p-5">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
                    Leadership
                  </p>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(data.cxos ?? []).slice(0, 8).map((p, i) => (
                      <li
                        key={`${p.name}-${i}`}
                        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-ui-surface-subtle"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[12px] font-semibold text-primary">
                          {p.name
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-ui-text-primary">
                            {p.name}
                          </p>
                          <p className="truncate text-[12px] text-ui-text-muted">
                            {p.title}
                          </p>
                        </div>
                        {p.linkedin_url && (
                          <a
                            href={p.linkedin_url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-ui-text-muted transition-colors hover:text-[#0A66C2]"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Departments */}
              {data.headcount?.department_breakdown &&
                Object.keys(data.headcount.department_breakdown).length > 0 && (
                  <div className="mt-5 rounded-xl border border-ui-border-light bg-white p-5">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
                      Departments
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(data.headcount.department_breakdown)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 10)
                        .map(([dept, count]) => (
                          <span
                            key={dept}
                            className="inline-flex items-center gap-1.5 rounded-full border border-ui-border-light bg-ui-surface-subtle px-3 py-1.5 text-[12px] text-ui-text-secondary"
                          >
                            <span className="font-medium text-ui-text-primary">
                              {dept}
                            </span>
                            <span className="text-ui-text-muted">
                              {formatNumber(count as number)}
                            </span>
                          </span>
                        ))}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
