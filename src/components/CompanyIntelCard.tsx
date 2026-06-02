import { ArrowRight, ExternalLink, Star, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useCompanyEnrichment } from "@/hooks/useCompanyEnrichment";

interface CompanyIntelCardProps {
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

function slugDomain(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 40) + ".com"
  );
}

function CompanyLogo({
  name,
  domain,
  size = 56,
}: {
  name: string;
  domain: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (errored) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-[12px] border border-ui-border-light/60 bg-primary/10 text-[20px] font-semibold text-primary shadow-sm"
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
      className="shrink-0 rounded-[12px] border border-ui-border-light/60 bg-white object-contain p-1.5 shadow-sm"
      style={{ width: size, height: size }}
    />
  );
}

export function CompanyIntelCard({ companyName, domain }: CompanyIntelCardProps) {
  const [unlocked, setUnlocked] = useState(false);
  const { data, loading } = useCompanyEnrichment(unlocked ? companyName ?? null : null);

  const resolvedDomain = useMemo(() => {
    if (domain) return domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (data?.company_website_domain) return data.company_website_domain;
    if (companyName) return slugDomain(companyName);
    return "";
  }, [domain, data?.company_website_domain, companyName]);

  if (!companyName) return null;
  const displayName = companyName;

  // Default: premium, brand-led lookup card
  if (!unlocked) {
    return (
      <section className="rounded-[12px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3.5">
        <div className="flex items-center gap-3.5">
          <CompanyLogo name={displayName} domain={resolvedDomain} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ui-text-primary">
              {displayName}
            </p>
            <p className="mt-0.5 text-[12px] text-ui-text-muted">
              Look up company intel
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUnlocked(true)}
            className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-primary hover:underline"
          >
            Look up
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
        <p className="mt-3 text-[11px] text-ui-text-muted">
          Headcount · growth · leadership · Glassdoor
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-[12px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3.5">
        <div className="flex items-center gap-3.5">
          <CompanyLogo name={displayName} domain={resolvedDomain} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ui-text-primary">
              {displayName}
            </p>
            <p className="mt-0.5 text-[12px] text-ui-text-muted">Loading intel…</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-ui-border-light" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-ui-border-light" />
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-[12px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3.5">
        <div className="flex items-center gap-3.5">
          <CompanyLogo name={displayName} domain={resolvedDomain} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ui-text-primary">
              {displayName}
            </p>
            <p className="mt-0.5 text-[12px] text-ui-text-muted">
              No intel found for this company.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const growth = formatGrowth(data.headcount?.growth_12m_percent);
  const leadership = (data.cxos ?? []).slice(0, 4);

  return (
    <section className="rounded-[12px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3.5">
      <div className="flex items-center gap-3.5">
        <CompanyLogo name={displayName} domain={resolvedDomain} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ui-text-primary">
            {displayName}
          </p>
          <p className="mt-0.5 text-[12px] text-ui-text-muted">Employer intel</p>
        </div>
        {data.linkedin_profile_url && (
          <a
            href={data.linkedin_profile_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary hover:underline"
          >
            LinkedIn <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-3">
        {data.headcount?.latest_count !== null &&
          data.headcount?.latest_count !== undefined && (
            <div>
              <div className="flex items-center gap-1 text-[11px] text-ui-text-muted">
                <Users className="h-3 w-3" />
                Employees
              </div>
              <p className="mt-0.5 text-[14px] font-semibold text-ui-text-primary">
                {formatNumber(data.headcount.latest_count)}
                {growth && (
                  <span
                    className={`ml-1 text-[11px] font-medium ${
                      (data.headcount.growth_12m_percent ?? 0) >= 0
                        ? "text-primary"
                        : "text-ui-text-muted"
                    }`}
                  >
                    {growth} YoY
                  </span>
                )}
              </p>
            </div>
          )}

        {data.glassdoor?.overall_rating !== null &&
          data.glassdoor?.overall_rating !== undefined && (
            <div>
              <div className="flex items-center gap-1 text-[11px] text-ui-text-muted">
                <Star className="h-3 w-3" />
                Glassdoor
              </div>
              <p className="mt-0.5 text-[14px] font-semibold text-ui-text-primary">
                {data.glassdoor.overall_rating.toFixed(1)} ★
                {data.glassdoor.review_count !== null &&
                  data.glassdoor.review_count !== undefined && (
                    <span className="ml-1 text-[11px] font-normal text-ui-text-muted">
                      ({formatNumber(data.glassdoor.review_count)})
                    </span>
                  )}
              </p>
            </div>
          )}

        {data.web_traffic?.monthly_visitors !== null &&
          data.web_traffic?.monthly_visitors !== undefined && (
            <div>
              <div className="flex items-center gap-1 text-[11px] text-ui-text-muted">
                <TrendingUp className="h-3 w-3" />
                Visitors/mo
              </div>
              <p className="mt-0.5 text-[14px] font-semibold text-ui-text-primary">
                {formatNumber(data.web_traffic.monthly_visitors)}
              </p>
            </div>
          )}
      </div>

      {leadership.length > 0 && (
        <div className="mt-3 border-t border-ui-border-light pt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
            Leadership
          </p>
          <ul className="space-y-1">
            {leadership.map((p, i) => (
              <li key={`${p.name}-${i}`} className="flex items-center gap-2 text-[13px]">
                <span className="font-medium text-ui-text-primary">{p.name}</span>
                <span className="text-ui-text-muted">· {p.title}</span>
                {p.linkedin_url && (
                  <a
                    href={p.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.headcount?.department_breakdown &&
        Object.keys(data.headcount.department_breakdown).length > 0 && (
          <div className="mt-3 border-t border-ui-border-light pt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
              Departments
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data.headcount.department_breakdown)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 6)
                .map(([dept, count]) => (
                  <span
                    key={dept}
                    className="rounded-full border border-ui-border-light bg-ui-surface px-2 py-0.5 text-[11px] text-ui-text-secondary"
                  >
                    {dept}: {formatNumber(count as number)}
                  </span>
                ))}
            </div>
          </div>
        )}
    </section>
  );
}
