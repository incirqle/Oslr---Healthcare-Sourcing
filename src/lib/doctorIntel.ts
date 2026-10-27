import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DoctorIntel {
  npi: { npi: string | null; candidates: number; credential?: string | null; specialty?: string | null; city?: string | null } | null;
  payments: {
    total: number; count: number;
    byYear: { year: string; total: number; count: number }[];
    topCompanies: { name: string; amount: number }[];
    byType: { name: string; amount: number }[];
  } | null;
  publications: { count: number; match: "affiliation" | "name"; articles: { pmid: string; title: string; journal: string; year: string; url: string }[] } | null;
  trials: { count: number; studies: { nctId: string; title: string; status: string; phase: string | null; sponsor: string | null; start: string | null; url: string }[] } | null;
  fetched_at: string;
}

export interface IntelPerson {
  id: string;
  full_name: string;
  title?: string | null;
  location?: string | null;
  current_employer?: string | null;
}

type Entry = { status: "loading" } | { status: "ready"; data: DoctorIntel | null } | { status: "error" };
const store = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const set = (id: string, e: Entry) => { store.set(id, e); emit(); };

const DOCTOR_RE = /\b(physician|surgeon|md|m\.d\.|do|d\.o\.|mbbs|doctor|resident|fellow|attending|hospitalist|intensivist|anesthesiologist|radiologist|cardiologist|neurologist|oncologist|psychiatrist|pediatrician|dermatologist|urologist|gastroenterologist|nephrologist|pulmonologist|orthopaedic|orthopedic|ophthalmologist|pathologist|internist|obstetrician|gynecologist|endocrinologist|rheumatologist|chief medical officer)\b/i;
const NOT_DOCTOR_RE = /\b(nurse|rn|np|pa-c|physician assistant|nurse practitioner|technician|therapist|coordinator|recruiter|sales|representative|assistant|scribe|medical assistant)\b/i;

export function isDoctor(p: { title?: string | null; full_name?: string | null }): boolean {
  const t = `${p.title ?? ""} ${p.full_name ?? ""}`;
  if (/\b(physician assistant|nurse practitioner)\b/i.test(t)) return false;
  if (NOT_DOCTOR_RE.test(p.title ?? "") && !/\b(physician|surgeon|md)\b/i.test(p.title ?? "")) return false;
  return DOCTOR_RE.test(t);
}

function toPayload(p: IntelPerson) {
  const name = p.full_name.replace(/,.*$/, "").replace(/\b(dr|md|do|phd|mbbs|facs|faaos)\.?\b/gi, "").trim().split(/\s+/);
  if (name.length < 2) return null;
  const parts = (p.location ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const state = parts.length >= 2 ? parts[parts.length - 1] === "United States" ? parts[parts.length - 2] : parts[parts.length - 1] : parts[0] ?? null;
  return { first: name[0], last: name[name.length - 1], state, city: parts.length >= 2 ? parts[0] : null, employer: p.current_employer ?? null, title: p.title ?? null };
}

async function fetchBatch(people: IntelPerson[], refresh = false) {
  const payloads = people.map((p) => ({ p, body: toPayload(p) })).filter((x) => x.body);
  people.forEach((p) => { if (!payloads.find((x) => x.p.id === p.id)) set(p.id, { status: "ready", data: null }); });
  if (!payloads.length) return;
  payloads.forEach(({ p }) => set(p.id, { status: "loading" }));
  try {
    const { data, error } = await supabase.functions.invoke("doctor-intel", { body: { people: payloads.map((x) => x.body), refresh } });
    if (error) throw error;
    payloads.forEach(({ p }, i) => set(p.id, { status: "ready", data: data?.results?.[i] ?? null }));
  } catch {
    payloads.forEach(({ p }) => set(p.id, { status: "error" }));
  }
}

/** Background pre-fetch for a page of search results. Never blocks the search. */
export function prefetchDoctorIntel(people: IntelPerson[]) {
  const todo = people.filter((p) => isDoctor(p) && !store.has(p.id));
  if (!todo.length) return;
  todo.forEach((p) => store.set(p.id, { status: "loading" }));
  emit();
  (async () => {
    for (let i = 0; i < todo.length; i += 5) await fetchBatch(todo.slice(i, i + 5));
  })();
}

export function ensureDoctorIntel(p: IntelPerson) {
  const e = store.get(p.id);
  if (!e || e.status === "error") void fetchBatch([p]);
}

export function refreshDoctorIntel(p: IntelPerson) { void fetchBatch([p], true); }

export function useDoctorIntel(id: string | null | undefined): Entry | undefined {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => (id ? store.get(id) : undefined),
  );
}
