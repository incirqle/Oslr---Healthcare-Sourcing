import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { PersonAvatar } from "./PersonAvatar";
import type { TalentFlowPerson } from "@/hooks/useCompanyEnrichment";
import { cn } from "@/lib/utils";

interface Props {
  hires: TalentFlowPerson[];
  departures: TalentFlowPerson[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function TalentFlowPeopleList({ hires, departures }: Props) {
  const [tab, setTab] = useState<"hires" | "departures">("hires");
  const [showAll, setShowAll] = useState(false);

  const list = tab === "hires" ? hires : departures;
  const sorted = [...list].sort((a, b) => {
    const da =
      tab === "hires" ? a.current_company_start_date : a.previous_end_date;
    const db =
      tab === "hires" ? b.current_company_start_date : b.previous_end_date;
    return new Date(db ?? 0).getTime() - new Date(da ?? 0).getTime();
  });
  const visible = showAll ? sorted : sorted.slice(0, 10);

  return (
    <div className="flex h-full flex-col rounded-xl border border-ui-border-light bg-white">
      <div className="flex items-center gap-1 border-b border-ui-border-light p-2">
        <PillToggle
          active={tab === "hires"}
          onClick={() => {
            setTab("hires");
            setShowAll(false);
          }}
          tone="hire"
          count={hires.length}
          label="Hires"
        />
        <PillToggle
          active={tab === "departures"}
          onClick={() => {
            setTab("departures");
            setShowAll(false);
          }}
          tone="dep"
          count={departures.length}
          label="Departures"
        />
      </div>

      <ul className="flex-1 divide-y divide-ui-border-light overflow-y-auto">
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-[12px] text-ui-text-muted">
            No {tab} in this range.
          </li>
        )}
        {visible.map((p, i) => {
          const date =
            tab === "hires" ? p.current_company_start_date : p.previous_end_date;
          const company =
            tab === "hires" ? p.current_company : p.current_company;
          const title = tab === "hires" ? p.current_title : p.current_title;
          return (
            <li key={`${p.linkedin_profile_url ?? p.name}-${i}`} className="flex items-start gap-3 px-3.5 py-2.5">
              <PersonAvatar name={p.name} src={p.profile_picture_url} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13px] font-medium text-ui-text-primary">
                    {p.name}
                  </p>
                  {p.linkedin_profile_url && (
                    <a
                      href={p.linkedin_profile_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0A66C2] hover:opacity-70"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <p className="truncate text-[11.5px] text-ui-text-secondary">
                  {title ?? p.headline ?? "—"}
                  {company && (
                    <>
                      {" "}
                      <span className="text-ui-text-muted">at</span> {company}
                    </>
                  )}
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-medium tabular-nums text-ui-text-muted">
                {fmtDate(date)}
              </p>
            </li>
          );
        })}
      </ul>

      {sorted.length > 10 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="border-t border-ui-border-light px-3 py-2 text-center text-[12px] font-medium text-primary hover:bg-ui-surface-subtle"
        >
          {showAll ? "Show less" : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
}

function PillToggle({
  active,
  onClick,
  tone,
  count,
  label,
}: {
  active: boolean;
  onClick: () => void;
  tone: "hire" | "dep";
  count: number;
  label: string;
}) {
  const dot = tone === "hire" ? "bg-[hsl(var(--chart-1))]" : "bg-[hsl(var(--chart-3))]";
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-ui-surface-subtle text-ui-text-primary"
          : "text-ui-text-muted hover:text-ui-text-primary",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {label}
      <span className="text-ui-text-muted">({count})</span>
    </button>
  );
}
