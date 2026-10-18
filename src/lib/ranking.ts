/**
 * Client recompute for ranked criteria (docs/oslr-criteria-ranking-spec.md
 * sections 6.1, 7, 8). A straight port of scoreRow / weightAt / STATUS_CREDIT
 * in supabase/functions/_shared/clinician-engine/ranking-criteria.ts so that
 * reorder, must-have and remove apply instantly with no request. Keep the
 * two in step: the server is the scoring source, this only re-weights the
 * per-criterion results the server already returned.
 */
import type { Candidate, CandidateCriterionResult, CriterionVerdict } from "@/components/search/SearchResults";

export type RankingOrigin = "parsed" | "user" | "suggested";

export interface RankingCriterion {
  id: string;
  text: string;
  title: string;
  position: number;
  must_have: boolean;
  origin: RankingOrigin;
  kind?: string;
  source_criterion_id?: string;
  /** Client only: added or edited text not checked yet (Phase 4 wires rank_criteria). */
  pending?: boolean;
}

export interface RequiredCriterion {
  id: string;
  kind: string;
  label: string;
}

export const STATUS_CREDIT: Record<CriterionVerdict, number> = {
  met: 1, partial: 0.5, unknown: 0.25, not_met: 0,
};

export function weightAt(i: number, n: number): number {
  return n - i;
}

/** Weight as a whole percentage of the total, for the panel and headers. */
export function weightPercent(i: number, n: number): number {
  if (n <= 0) return 0;
  const total = (n * (n + 1)) / 2;
  return Math.round((weightAt(i, n) / total) * 100);
}

export interface MatchBreakdownEntry { criterion_id: string; points: number; max: number }

export function scoreRow(results: CandidateCriterionResult[], ranking: RankingCriterion[]): {
  match_rate: number | null;
  breakdown: MatchBreakdownEntry[];
  must_have_failed: string[];
} {
  const n = ranking.length;
  if (n === 0) return { match_rate: null, breakdown: [], must_have_failed: [] };
  const byId = new Map(results.map((r) => [r.criterion_id, r]));
  let got = 0, max = 0;
  const breakdown: MatchBreakdownEntry[] = [];
  const must_have_failed: string[] = [];
  ranking.forEach((c, i) => {
    const w = weightAt(i, n);
    const status = byId.get(c.id)?.status ?? "unknown";
    const pts = w * STATUS_CREDIT[status];
    got += pts;
    max += w;
    breakdown.push({ criterion_id: c.id, points: pts, max: w });
    if (c.must_have && status === "not_met") must_have_failed.push(c.id);
  });
  return { match_rate: Math.round((got / max) * 100), breakdown, must_have_failed };
}

/** Criteria that count: not pending (no results yet). Order kept. */
export function scoredCriteria(ranking: RankingCriterion[]): RankingCriterion[] {
  return ranking.filter((c) => !c.pending);
}

/** Fallback short title (spec 6.3): first phrase, title-cased, max 14 characters. */
export function shortTitle(text: string): string {
  const s = String(text ?? "");
  const first = s.split(/[,;:(]| - | and | with | in | at /i)[0].trim() || s.trim();
  const tc = first.toLowerCase().replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  if (tc.length <= 14) return tc;
  let out = "";
  for (const w of tc.split(/\s+/)) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 14) break;
    out = next;
  }
  return out || tc.slice(0, 14);
}

export interface RankedRow extends Candidate {
  match_breakdown?: MatchBreakdownEntry[];
  must_have_failed?: string[];
}

const TIER: Record<string, number> = { strong: 0, weak: 1 };

/**
 * Re-weights rows for the current ordered criteria. Kept rows that fail a
 * must-have move to Set aside (reason must_have) unless the recruiter
 * restored them; rows the server set aside for a must-have come back when
 * the lock is removed. Sort per spec 7, final tiebreak = incoming order.
 */
export function recomputeRanking(
  kept: Candidate[],
  hidden: Candidate[],
  ranking: RankingCriterion[],
): { kept: RankedRow[]; setAside: RankedRow[] } {
  const scored = scoredCriteria(ranking);
  const meta = new Map(ranking.map((c) => [c.id, c]));
  const order = new Map(ranking.map((c, i) => [c.id, i]));

  const rescore = (c: Candidate): RankedRow => {
    const results = c.criteria_results ?? [];
    const required = results.filter((r) => r.group === "required");
    const preferred = results
      .filter((r) => r.group !== "required" && meta.has(r.criterion_id))
      .map((r) => ({ ...r, title: meta.get(r.criterion_id)!.title }))
      .filter((r) => !meta.get(r.criterion_id)!.pending)
      .sort((a, b) => (order.get(a.criterion_id)! - order.get(b.criterion_id)!));
    const s = scoreRow(results, scored);
    return { ...c, criteria_results: [...required, ...preferred], match_rate: s.match_rate, match_breakdown: s.breakdown, must_have_failed: s.must_have_failed };
  };

  const keptOut: { r: RankedRow; i: number }[] = [];
  const asideOut: RankedRow[] = [];
  const mustHaveNote = (r: RankedRow): string => {
    const id = r.must_have_failed![0];
    const res = r.criteria_results?.find((x) => x.criterion_id === id);
    return `No on: ${meta.get(id)?.title ?? id}${res?.evidence ? `. ${res.evidence}` : ""}`;
  };

  kept.forEach((c, i) => {
    const r = rescore(c);
    if (!c.restored && (r.must_have_failed?.length ?? 0) > 0) {
      asideOut.push({ ...r, set_aside_reason: "must_have", set_aside_note: mustHaveNote(r) });
    } else keptOut.push({ r, i });
  });
  hidden.forEach((c, j) => {
    const r = rescore(c);
    if (c.set_aside_reason === "must_have" && (r.must_have_failed?.length ?? 0) === 0) {
      keptOut.push({ r: { ...r, set_aside_reason: null, set_aside_note: null }, i: kept.length + j });
    } else if (c.set_aside_reason === "must_have") {
      asideOut.push({ ...r, set_aside_note: mustHaveNote(r) });
    } else asideOut.push(r);
  });

  const hasMatch = scored.length > 0;
  keptOut.sort((a, b) => {
    if (hasMatch) {
      const d = (b.r.match_rate ?? -1) - (a.r.match_rate ?? -1);
      if (d) return d;
    }
    const t = (TIER[a.r.audit_verdict ?? ""] ?? 2) - (TIER[b.r.audit_verdict ?? ""] ?? 2);
    if (t) return t;
    const s = (b.r.audit_score ?? -1) - (a.r.audit_score ?? -1);
    if (s) return s;
    return a.i - b.i;
  });
  return { kept: keptOut.map((x) => x.r), setAside: asideOut };
}

/**
 * Keep the recruiter's order, locks, edits and removals across a refine:
 * criteria the server still returns stay where the user put them, new ones
 * are appended, removed ones stay removed.
 */
export function mergeRanking(prev: RankingCriterion[], next: RankingCriterion[], removed: Set<string>): RankingCriterion[] {
  const nextById = new Map(next.map((c) => [c.id, c]));
  const kept = prev.filter((c) => c.pending || nextById.has(c.id)).map((c) => (c.pending ? c : { ...nextById.get(c.id)!, title: c.title, text: c.text, must_have: c.must_have }));
  const seen = new Set(kept.map((c) => c.id));
  const added = next.filter((c) => !seen.has(c.id) && !removed.has(c.id));
  return [...kept, ...added].map((c, i) => ({ ...c, position: i }));
}

const STATUS_RANK: Record<CriterionVerdict, number> = { met: 0, partial: 1, unknown: 2, not_met: 3 };

/** Sort by one criterion: met > partial > unknown > not_met, then match. */
export function sortByCriterion<T extends Candidate>(rows: T[], criterionId: string): T[] {
  const st = (r: T) => STATUS_RANK[r.criteria_results?.find((x) => x.criterion_id === criterionId)?.status ?? "unknown"];
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (st(a.r) - st(b.r)) || ((b.r.match_rate ?? -1) - (a.r.match_rate ?? -1)) || (a.i - b.i))
    .map((x) => x.r);
}

/** Plain label for a section id from the grader ("cur0", "exp2", "edu1", "headline"). */
export function sectionLabel(section: string | null | undefined): string | null {
  if (!section) return null;
  const m = section.match(/^(cur|exp|edu|desc)(\d+)$/);
  if (m) {
    const n = Number(m[2]) + 1;
    return m[1] === "cur" ? (n === 1 ? "Current role" : `Current role ${n}`)
      : m[1] === "exp" ? `Past role ${n}`
      : m[1] === "edu" ? `Education ${n}`
      : `Role description ${n}`;
  }
  if (section === "headline") return "Headline";
  if (section === "summary") return "Summary";
  return section;
}
