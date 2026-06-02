import { Building2, ExternalLink, Lock, Star, TrendingUp, Users } from "lucide-react";
import { useState } from "react";
import { useCompanyEnrichment } from "@/hooks/useCompanyEnrichment";

interface CompanyIntelCardProps {
  companyName: string | null | undefined;
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

export function CompanyIntelCard({ companyName }: CompanyIntelCardProps) {
  const [unlocked, setUnlocked] = useState(false);
  const { data, loading } = useCompanyEnrichment(unlocked ? companyName ?? null : null);

  if (!companyName) return null;

  if (!unlocked) {
    return (
      <section className="rounded-[10px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
          <Building2 className="h-3.5 w-3.5" />
          Employer Intel
          <button
            type="button"
            onClick={() => setUnlocked(true)}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-primary hover:bg-primary/15"
          >
            <Lock className="h-3 w-3" /> Unlock (1 credit)
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-ui-text-muted">
          Headcount, growth, leadership & Glassdoor for {companyName}.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rounded-[10px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3">
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
          <Building2 className="h-3.5 w-3.5" />
          Employer Intel
        </div>
        <p className="text-[13px] text-ui-text-muted">Loading…</p>
      </section>
    );
  }

  if (!data) return null;

  const growth = formatGrowth(data.headcount?.growth_12m_percent);
  const leadership = (data.cxos ?? []).slice(0, 4);

  return (
    <section className="rounded-[10px] border border-ui-border-light bg-ui-surface-elevated px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-ui-text-muted">
        <Building2 className="h-3.5 w-3.5" />
        Employer Intel
        {data.linkedin_profile_url && (
          <a
            href={data.linkedin_profile_url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium normal-case tracking-normal text-primary hover:underline"
          >
            LinkedIn <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
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
