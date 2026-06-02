import { useMemo, useState } from "react";
import { ArrowRight, Building2 } from "lucide-react";
import { CompanyIntelModal } from "./CompanyIntelModal";
import { normalizeDomain, resolveCompanyDomain } from "@/lib/company-domains";

interface CompanyIntelCardProps {
  companyName: string | null | undefined;
  domain?: string | null;
}

function CompanyLogo({
  name,
  domain,
  size = 44,
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
        className="flex shrink-0 items-center justify-center rounded-xl border border-ui-border-light/60 bg-primary/10 text-[16px] font-semibold text-primary shadow-sm"
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
      className="shrink-0 rounded-xl border border-ui-border-light/60 bg-white object-contain p-1.5 shadow-sm"
      style={{ width: size, height: size }}
    />
  );
}

export function CompanyIntelCard({ companyName, domain }: CompanyIntelCardProps) {
  const [open, setOpen] = useState(false);

  const seedDomain = useMemo(
    () => normalizeDomain(domain) ?? resolveCompanyDomain(companyName),
    [domain, companyName],
  );

  if (!companyName) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group w-full rounded-2xl border border-ui-border-light bg-ui-surface-elevated px-4 py-3.5 text-left transition-all hover:border-primary/30 hover:shadow-md"
      >
        <div className="flex items-center gap-3.5">
          <CompanyLogo name={companyName} domain={seedDomain} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-ui-text-primary">
              {companyName}
            </p>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ui-text-muted">
              <Building2 className="h-3 w-3" />
              Employer intel
              <span className="text-ui-border-medium">·</span>
              <span className="hidden sm:inline">Headcount · Leadership · Glassdoor</span>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ui-border-light bg-white px-3 py-1.5 text-[12px] font-medium text-primary transition-colors group-hover:border-primary/30 group-hover:bg-primary/5">
            View intel
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </button>

      <CompanyIntelModal
        open={open}
        onOpenChange={setOpen}
        companyName={companyName}
        domain={domain}
      />
    </>
  );
}
