/**
 * People tab: pick which groups to pull, see the count and cost first,
 * then the people. Groups someone already pulled show up loaded and free.
 */

import { useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyBriefState, PullGroup, RosterPerson } from "@/hooks/useCompanyBrief";
import { PersonAvatar } from "./PersonAvatar";
import { LinkedInBadge } from "./LinkedInBadge";
import { fmtCount, fmtCredits, fmtMonth, GROUP_LABEL, GROUP_ORDER, tenure } from "./brief-utils";
import { cn } from "@/lib/utils";

/** Profiles per pull page (matches PULL_PAGE_SIZE in the edge function). */
export const PAGE_SIZE = 50;
const SPECIALTY_GROUPS: PullGroup[] = ["doctors", "trainees"];

export function PeoplePanel({ s }: { s: CompanyBriefState }) {
  const [picked, setPicked] = useState<PullGroup[]>([]);
  const [spec, setSpec] = useState<Partial<Record<PullGroup, string>>>({});
  const per = s.preview?.credits_per_profile ?? 0.03;

  const rows = GROUP_ORDER.map((g) => {
    const pv = s.preview?.groups.find((x) => x.group === g);
    const narrowed = s.counts[g];
    const count = narrowed ? narrowed.count : pv?.count ?? null;
    const firstPage = count === null ? null : Math.min(count, PAGE_SIZE);
    return { g, hint: pv?.hint ?? "", count, firstPage, narrowedBy: narrowed?.specialty ?? null, pulled: !!s.pulled[g], busy: !!s.busy[g], error: s.errors[g] };
  });
  const chosen = rows.filter((r) => picked.includes(r.g) && !r.pulled);
  const profiles = chosen.reduce((n, r) => n + (r.firstPage ?? 0), 0);
  const anyPulled = rows.some((r) => r.pulled);

  const toggle = (g: PullGroup) => setPicked((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  const go = async () => {
    const groups = chosen.map((r) => r.g);
    await s.pull(groups, spec);
    setPicked((cur) => cur.filter((g) => !groups.includes(g)));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-ui-border-medium bg-white dark:bg-background">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ui-border-light px-5 py-3.5">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ui-text-primary">Who do you want to see?</h3>
            <p className="text-[12.5px] text-ui-text-secondary">Counts are free to view. You only pay for the groups you pull.</p>
          </div>
          {s.preview && <p className="text-[11.5px] text-ui-text-muted">{fmtCredits(per)} credits per profile</p>}
        </header>

        <ul className="divide-y divide-ui-border-light">
          {rows.map((r) => (
            <li key={r.g} className={cn("grid grid-cols-[24px_minmax(0,1fr)_64px_84px] items-center gap-x-3 px-5 py-3", r.pulled && "bg-ui-surface-subtle")}>
              <span className="flex h-6 items-center">
                {r.pulled ? (
                  <Check className="h-4 w-4 text-[#2F8F75]" aria-label="Pulled" />
                ) : (
                  <input
                    id={`pick-${r.g}`}
                    type="checkbox"
                    checked={picked.includes(r.g)}
                    onChange={() => toggle(r.g)}
                    disabled={!r.count || r.busy}
                    className="h-4 w-4 accent-[#0A1F44]"
                  />
                )}
              </span>
              <label htmlFor={`pick-${r.g}`} className="min-w-0 cursor-pointer">
                <span className="block text-[13.5px] font-medium text-ui-text-primary">{GROUP_LABEL[r.g]}</span>
                <span className="block truncate text-[12px] text-ui-text-muted">
                  {r.narrowedBy ? `Narrowed to "${r.narrowedBy}"` : r.hint}
                </span>
              </label>
              <span className="text-right text-[14px] font-semibold tabular-nums text-ui-text-primary">
                {s.previewState === "loading" || (r.narrowedBy && r.count === null) ? <Skeleton className="ml-auto h-4 w-8" /> : fmtCount(r.count)}
              </span>
              <span className="text-right text-[12px] tabular-nums text-ui-text-secondary">
                {r.pulled ? (
                  <span className="font-medium text-[#1F6B57] dark:text-[#7AC5B0]">Pulled</span>
                ) : r.busy ? (
                  <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin" />
                ) : r.firstPage ? (
                  `${fmtCredits(r.firstPage * per)} cr`
                ) : (
                  ""
                )}
              </span>
              {SPECIALTY_GROUPS.includes(r.g) && !r.pulled && (r.count ?? 0) > 10 && (
                <div className="col-start-2 col-end-5 mt-2 flex items-center gap-2">
                  <input
                    id={`spec-${r.g}`}
                    value={spec[r.g] ?? ""}
                    onChange={(e) => setSpec((cur) => ({ ...cur, [r.g]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && s.recount(r.g, spec[r.g] ?? "")}
                    placeholder="Narrow by specialty, e.g. orthopaedic, spine"
                    className="h-8 min-w-0 flex-1 rounded-md border border-ui-border-medium bg-white px-2.5 text-[12.5px] text-ui-text-primary placeholder:text-ui-text-muted focus:outline-none focus:ring-2 focus:ring-[#7AC5B0]/50 dark:bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => s.recount(r.g, spec[r.g] ?? "")}
                    className="h-8 shrink-0 rounded-md border border-ui-border-medium px-2.5 text-[12px] font-medium text-ui-text-primary transition-colors duration-150 hover:bg-ui-surface-subtle"
                  >
                    {spec[r.g]?.trim() ? "Count" : "Clear"}
                  </button>
                </div>
              )}
              {(r.count ?? 0) > PAGE_SIZE && !r.pulled && (
                <p className="col-start-2 col-end-5 mt-1 text-[11.5px] text-ui-text-muted">
                  Pulls the first {PAGE_SIZE}. Load the next {PAGE_SIZE} for {fmtCredits(PAGE_SIZE * per)} credits at a time.
                </p>
              )}
              {r.error && <p className="col-start-2 col-end-5 mt-1 text-[12px] text-destructive">Couldn't load this group. {r.error}</p>}
            </li>
          ))}
        </ul>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ui-border-light px-5 py-3.5">
          <p className="text-[12.5px] text-ui-text-secondary">
            {chosen.length === 0
              ? s.previewState === "error" ? "Counts didn't load. Close and reopen the company to try again." : "Check the groups you want."
              : <>
                <span className="font-semibold tabular-nums text-ui-text-primary">{profiles}</span> profiles ·{" "}
                <span className="font-semibold tabular-nums text-ui-text-primary">{fmtCredits(profiles * per)}</span> credits
              </>}
          </p>
          <button
            type="button"
            onClick={go}
            disabled={chosen.length === 0 || profiles === 0}
            className="h-9 rounded-md bg-[#0A1F44] px-4 text-[13px] font-medium text-white transition-[opacity,transform] duration-150 active:scale-[0.98] disabled:opacity-40"
          >
            {chosen.length === 0 ? "Pull" : `Pull ${profiles} profiles`}
          </button>
        </footer>
      </section>

      {anyPulled && <Results s={s} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Results                                                              */
/* ------------------------------------------------------------------ */

function Results({ s }: { s: CompanyBriefState }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<PullGroup | "all">("all");
  const per = s.preview?.credits_per_profile ?? 0.03;
  const groups = GROUP_ORDER.filter((g) => s.pulled[g]);

  // A person can match two groups ("President, Plastic Surgeon"): show them once, in the first group.
  const byGroup = useMemo(() => {
    const seen = new Set<string>();
    const out: Partial<Record<PullGroup, RosterPerson[]>> = {};
    for (const g of groups) {
      out[g] = (s.pulled[g]?.pages ?? []).flatMap((p) => p.people).filter((p) => {
        const k = p.linkedin_profile_url ?? `${p.name}|${p.title}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    return out;
  }, [s.pulled, groups]);

  const needle = q.trim().toLowerCase();
  const match = (p: RosterPerson) => !needle || [p.name, p.title, p.specialty, p.subspecialty, p.trained_at, p.city].some((v) => v && v.toLowerCase().includes(needle));
  const shownGroups = groups.filter((g) => only === "all" || only === g);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip active={only === "all"} onClick={() => setOnly("all")} label="All pulled" count={groups.reduce((n, g) => n + (byGroup[g]?.length ?? 0), 0)} />
          {groups.map((g) => <Chip key={g} active={only === g} onClick={() => setOnly(g)} label={GROUP_LABEL[g]} count={byGroup[g]?.length ?? 0} />)}
        </div>
        <label className="relative block w-full sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ui-text-muted" />
          <input
            id="people-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, specialty, training"
            className="h-8 w-full rounded-md border border-ui-border-medium bg-white pl-8 pr-2 text-[12.5px] text-ui-text-primary placeholder:text-ui-text-muted focus:outline-none focus:ring-2 focus:ring-[#7AC5B0]/50 dark:bg-background"
          />
        </label>
      </div>

      <div className="space-y-5">
        {shownGroups.map((g) => {
          const pg = s.pulled[g]!;
          const last = pg.pages[pg.pages.length - 1];
          const people = (byGroup[g] ?? []).filter(match);
          const ex = pg.pages.reduce((acc, p) => {
            for (const [k, v] of Object.entries(p.excluded)) acc[k] = (acc[k] ?? 0) + v;
            return acc;
          }, {} as Record<string, number>);
          const left = [
            ex.out_of_area && `${ex.out_of_area} in another state`,
            ex.stale_training && `${ex.stale_training} old training entries`,
            ex.side_role && `${ex.side_role} side jobs`,
            ex.non_employee && `${ex.non_employee} students or observers`,
            ex.other_role && `${ex.other_role} in a different role`,
          ].filter(Boolean);
          const remaining = last.total !== null ? Math.max(0, last.total - pg.pages.reduce((n, p) => n + p.returned, 0)) : null;
          return (
            <div key={g}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h4 className="text-[13.5px] font-semibold text-ui-text-primary">
                  {GROUP_LABEL[g]} <span className="font-normal text-ui-text-muted tabular-nums">{people.length}</span>
                  {pg.specialty && <span className="ml-1.5 text-[12px] font-normal text-ui-text-secondary">· {pg.specialty}</span>}
                </h4>
                {pg.pages.some((p) => p.cached) && <span className="text-[11.5px] text-ui-text-muted">Loaded from the shared cache</span>}
              </div>
              <div className="overflow-hidden rounded-lg border border-ui-border-medium bg-white dark:bg-background">
                <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_104px_minmax(0,0.9fr)] gap-4 border-b border-ui-border-medium bg-ui-surface-subtle px-4 py-2 text-[11px] font-medium uppercase tracking-[0.04em] text-ui-text-muted md:grid">
                  <span>Person</span><span>Specialty and training</span><span>Here since</span><span>Works in</span>
                </div>
                {people.length === 0 ? (
                  <p className="px-4 py-6 text-center text-[13px] text-ui-text-muted">{needle ? "Nobody here matches that search." : "Nobody in this group after cleanup."}</p>
                ) : (
                  <ul className="divide-y divide-ui-border-light">{people.map((p, i) => <PersonRow key={`${p.name}-${i}`} p={p} />)}</ul>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11.5px] text-ui-text-muted">{left.length > 0 && `Left out: ${left.join(", ")}.`}</p>
                {last.next_cursor && (
                  <button
                    type="button"
                    onClick={() => s.loadMore(g)}
                    disabled={!!s.busy[g]}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border-medium px-3 text-[12.5px] font-medium text-ui-text-primary transition-colors duration-150 hover:bg-ui-surface-subtle disabled:opacity-50"
                  >
                    {s.busy[g] && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Load next {Math.min(PAGE_SIZE, remaining ?? PAGE_SIZE)} · {fmtCredits(Math.min(PAGE_SIZE, remaining ?? PAGE_SIZE) * per)} cr
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Chip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-colors duration-150 active:scale-[0.98]",
        active ? "border-[#0A1F44] bg-[#0A1F44] text-white dark:border-ui-text-primary dark:bg-ui-text-primary dark:text-background" : "border-ui-border-medium text-ui-text-secondary hover:text-ui-text-primary",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-white/70 dark:text-background/70" : "text-ui-text-muted")}>{count}</span>
    </button>
  );
}

function PersonRow({ p }: { p: RosterPerson }) {
  const spec = p.subspecialty ?? p.specialty;
  return (
    <li className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-2.5 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_104px_minmax(0,0.9fr)] md:items-center">
      <div className="flex min-w-0 items-center gap-2.5">
        <PersonAvatar name={p.name} src={p.profile_picture_url} size={30} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-ui-text-primary">{p.name}</span>
            <LinkedInBadge href={p.linkedin_profile_url} size={15} label={`${p.name} profile`} />
          </div>
          <p className="truncate text-[12px] text-ui-text-secondary">{p.title ?? "–"}</p>
          {p.also_at.length > 0 && <p className="truncate text-[11.5px] text-ui-text-muted">Also at {p.also_at.join(", ")}</p>}
        </div>
      </div>
      <div className="min-w-0 pl-10 md:pl-0">
        {spec && <p className="truncate text-[12.5px] text-ui-text-primary">{spec}</p>}
        {p.trained_at && <p className="truncate text-[12px] text-ui-text-secondary">{p.training_kind === "fellowship" ? "Fellowship" : "Residency"}: {p.trained_at}</p>}
        {!spec && !p.trained_at && <p className="hidden text-[12px] text-ui-text-muted md:block">–</p>}
      </div>
      <p className="pl-10 text-[12.5px] tabular-nums text-ui-text-secondary md:pl-0">
        {p.start_date ? <>{fmtMonth(p.start_date)} <span className="text-ui-text-muted">· {tenure(p.start_date)}</span></> : <span className="text-ui-text-muted">–</span>}
      </p>
      <p className="truncate pl-10 text-[12.5px] text-ui-text-secondary md:pl-0">{p.city ?? "–"}</p>
    </li>
  );
}
