import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/* ------------------------------------------------------------------ */
/* Types: the company-enrichment edge function, schema 15               */
/* ------------------------------------------------------------------ */

export type PullGroup = "doctors" | "trainees" | "apps" | "nurses" | "clinical" | "executive" | "admin";

export type RoleGroup = "physician" | "app" | "crna" | "trainee" | "nursing" | "therapy" | "clinical_support" | "admin" | "other";

export interface EntityPage {
  company_id: number;
  name: string;
  linkedin_url: string | null;
}

export interface CompanyBase {
  schema_version: number;
  company_id: number;
  crustdata_entity_ids: number[];
  legal_name: string;
  display_name: string;
  pages: EntityPage[];
  matched_name: string | null;
  company_website_domain: string | null;
  linkedin_profile_url: string | null;
  logo_url: string | null;
  hq_city: string | null;
  hq_state: string | null;
  hq_country: string | null;
  industry: string | null;
  description: string | null;
  year_founded: number | null;
  employee_count_range: string | null;
  ownership: { model: "private_practice" | "hospital_employed" | "unknown"; evidence: string };
  headcount: {
    total: number | null;
    yoy_percent: number | null;
    yoy_absolute: number | null;
    timeseries: { date: string; employee_count: number }[];
  };
  sites: { place: string; count: number }[];
  enriched_at: string;
  cached?: boolean;
}

export interface GroupPreview {
  group: PullGroup;
  label: string;
  hint: string;
  count: number | null;
}

export interface CompanyPreview {
  groups: GroupPreview[];
  movement: { hires: number | null; departures: number | null; window_months: number };
  credits_per_profile: number;
  counted_at: string;
  /** Groups (and "movement") someone already pulled: loading them is free. */
  available: Partial<Record<PullGroup | "movement", boolean>>;
  cached?: boolean;
}

export interface RosterPerson {
  name: string;
  linkedin_profile_url: string | null;
  profile_picture_url: string | null;
  title: string | null;
  role_group: RoleGroup;
  specialty: string | null;
  subspecialty: string | null;
  start_date: string | null;
  city: string | null;
  state: string | null;
  listed_as: string | null;
  trained_at: string | null;
  training_kind: "fellowship" | "residency" | null;
  also_at: string[];
  matched_by: "id" | "name";
}

export type RosterExclusion = "non_employee" | "side_role" | "stale_training" | "out_of_area" | "duplicate" | "no_target_entry" | "other_role";

export interface PullPage {
  group: PullGroup;
  specialty: string | null;
  page: number;
  people: RosterPerson[];
  excluded: Record<RosterExclusion, number>;
  matched_by_name: number;
  /** Profiles the provider returned (what was paid for). */
  returned: number;
  total: number | null;
  next_cursor: string | null;
  pulled_at: string;
  cached?: boolean;
}

export interface MovementPerson {
  name: string;
  linkedin_profile_url: string | null;
  profile_picture_url: string | null;
  current_title: string | null;
  current_company: string | null;
  current_company_linkedin_url: string | null;
  current_company_start_date: string | null;
  previous_company: string | null;
  previous_company_linkedin_url: string | null;
  previous_title: string | null;
  previous_end_date: string | null;
  role_group: RoleGroup;
  specialty: string | null;
}

export interface MovementExclusions {
  internal_move: number;
  side_role: number;
  non_employee: number;
  duplicate: number;
  no_target_entry: number;
}

export interface CompanyMovement {
  window_months: number;
  hires: MovementPerson[];
  departures: MovementPerson[];
  hires_returned: number;
  departures_returned: number;
  hire_total_matched: number | null;
  departure_total_matched: number | null;
  excluded: { hires: MovementExclusions; departures: MovementExclusions };
  pulled_at: string;
  cached?: boolean;
}

/** One pulled group: its pages in order, plus the specialty it was narrowed by. */
export interface PulledGroup {
  specialty: string | null;
  pages: PullPage[];
}

/* ------------------------------------------------------------------ */
/* Hook                                                                 */
/* ------------------------------------------------------------------ */

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("company-enrichment", { body });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

/**
 * The company panel's data, in the order a user spends on it:
 *   1. base (on open): company facts from the initial enrichment
 *   2. preview (on open, after base): a count per people group and for movement
 *   3. pull(groups) / loadMore(group): people, on request
 *   4. pullMovement(): who joined and left, on request
 * Groups someone already pulled are loaded on open; they come from the shared cache at no cost.
 */
export function useCompanyBrief(input: { open: boolean; companyName: string | null | undefined; domain?: string | null; companyId?: number | null }) {
  const { open, companyName, domain, companyId } = input;
  const [base, setBase] = useState<CompanyBase | null>(null);
  const [baseState, setBaseState] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle");
  const [preview, setPreview] = useState<CompanyPreview | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [pulled, setPulled] = useState<Partial<Record<PullGroup, PulledGroup>>>({});
  const [busy, setBusy] = useState<Partial<Record<PullGroup | "movement", boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<PullGroup | "movement" | "base" | "preview", string>>>({});
  const [movement, setMovement] = useState<CompanyMovement | null>(null);
  const [counts, setCounts] = useState<Partial<Record<PullGroup, { specialty: string; count: number | null }>>>({});
  const run = useRef(0);

  const ids = base?.crustdata_entity_ids ?? null;
  const scope = useCallback(() => ({ entity_ids: ids ?? [], company_id: base?.company_id ?? companyId ?? null, company_name: companyName ?? null }), [ids, base?.company_id, companyId, companyName]);

  // 1 + 2: base, then preview, then free loads of anything already pulled.
  useEffect(() => {
    if (!open || !companyName) return;
    const mine = ++run.current;
    setBase(null); setPreview(null); setPulled({}); setMovement(null); setErrors({}); setCounts({});
    setBaseState("loading"); setPreviewState("idle");
    let stage: "base" | "preview" = "base";
    (async () => {
      try {
        const res = await call<{ company: CompanyBase | null }>({ action: "base", company_name: companyName, company_domain: domain ?? null, company_id: companyId ?? null });
        if (mine !== run.current) return;
        if (!res.company) { setBaseState("empty"); return; }
        setBase(res.company);
        setBaseState("ready");
        stage = "preview";
        setPreviewState("loading");
        const scoped = { entity_ids: res.company.crustdata_entity_ids, company_id: res.company.company_id, company_name: companyName };
        const p = await call<{ preview: CompanyPreview }>({ action: "preview", ...scoped });
        if (mine !== run.current) return;
        setPreview(p.preview);
        setPreviewState("ready");
        const free = (Object.keys(p.preview.available ?? {}) as Array<PullGroup | "movement">).filter((k) => p.preview.available[k]);
        await Promise.all(free.map(async (k) => {
          if (k === "movement") {
            const m = await call<{ movement: CompanyMovement }>({ action: "movement", ...scoped });
            if (mine === run.current) setMovement(m.movement);
          } else {
            const r = await call<{ pull: PullPage }>({ action: "pull", group: k, ...scoped });
            if (mine === run.current) setPulled((cur) => ({ ...cur, [k]: { specialty: null, pages: [r.pull] } }));
          }
        }));
      } catch (e) {
        if (mine !== run.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setErrors((cur) => ({ ...cur, [stage]: msg }));
        setBaseState((s) => (s === "loading" ? "error" : s));
        setPreviewState((s) => (s === "loading" ? "error" : s));
      }
    })();
  }, [open, companyName, domain, companyId]);

  const pull = useCallback(async (groups: PullGroup[], specialty?: Partial<Record<PullGroup, string>>) => {
    await Promise.all(groups.map(async (g) => {
      const spec = specialty?.[g]?.trim() || null;
      setBusy((b) => ({ ...b, [g]: true }));
      setErrors((x) => ({ ...x, [g]: undefined }));
      try {
        const r = await call<{ pull: PullPage }>({ action: "pull", group: g, specialty: spec, page: 1, ...scope() });
        setPulled((cur) => ({ ...cur, [g]: { specialty: spec, pages: [r.pull] } }));
      } catch (e) {
        setErrors((x) => ({ ...x, [g]: e instanceof Error ? e.message : String(e) }));
      } finally {
        setBusy((b) => ({ ...b, [g]: false }));
      }
    }));
  }, [scope]);

  const loadMore = useCallback(async (g: PullGroup) => {
    const current = pulled[g];
    const last = current?.pages[current.pages.length - 1];
    if (!current || !last?.next_cursor) return;
    setBusy((b) => ({ ...b, [g]: true }));
    try {
      const r = await call<{ pull: PullPage }>({ action: "pull", group: g, specialty: current.specialty, cursor: last.next_cursor, page: last.page + 1, ...scope() });
      setPulled((cur) => ({ ...cur, [g]: { specialty: current.specialty, pages: [...(cur[g]?.pages ?? []), r.pull] } }));
    } catch (e) {
      setErrors((x) => ({ ...x, [g]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy((b) => ({ ...b, [g]: false }));
    }
  }, [pulled, scope]);

  const recount = useCallback(async (g: PullGroup, specialty: string) => {
    const spec = specialty.trim();
    if (!spec) { setCounts((c) => ({ ...c, [g]: undefined })); return; }
    setCounts((c) => ({ ...c, [g]: { specialty: spec, count: null } }));
    try {
      const r = await call<{ count: { count: number | null } }>({ action: "preview", group: g, specialty: spec, ...scope() });
      setCounts((c) => ({ ...c, [g]: { specialty: spec, count: r.count.count } }));
    } catch (e) {
      setErrors((x) => ({ ...x, [g]: e instanceof Error ? e.message : String(e) }));
    }
  }, [scope]);

  const pullMovement = useCallback(async () => {
    setBusy((b) => ({ ...b, movement: true }));
    setErrors((x) => ({ ...x, movement: undefined }));
    try {
      const r = await call<{ movement: CompanyMovement }>({ action: "movement", ...scope() });
      setMovement(r.movement);
    } catch (e) {
      setErrors((x) => ({ ...x, movement: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy((b) => ({ ...b, movement: false }));
    }
  }, [scope]);

  return { base, baseState, preview, previewState, pulled, movement, busy, errors, counts, pull, loadMore, recount, pullMovement };
}

export type CompanyBriefState = ReturnType<typeof useCompanyBrief>;
