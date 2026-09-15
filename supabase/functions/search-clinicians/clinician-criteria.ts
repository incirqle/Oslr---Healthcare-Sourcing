/**
 * clinician-criteria.ts — the single typed hard/soft contract per criterion.
 *
 * Ported from search-talent/search-criteria.ts (RepGPT hiring engine,
 * live-verified on Crustdata v2) and adapted to clinical healthcare sourcing
 * per OSLR-SEARCH-ENGINE-BLUEPRINT.md §12–13.
 *
 * One SearchCriteria[] is the handshake between the parser, the v2 query
 * builder, and the UI, so they can never disagree about what is enforced,
 * what is a boost, and what was dropped.
 *
 * Healthcare deltas from the reference contract:
 *  - NEW kinds: role_class, credential, training_stage, employer_group,
 *    care_setting (blueprint §13).
 *  - REMOVED kinds: award (medtech-sales concept — achievement asks parse to
 *    unsupported), role_function (the "Sales & Revenue" normalized-department
 *    gate does not transfer; no clinical department value has been live-probed,
 *    and an unverified enum value silently matches nothing).
 *  - Specialty carries a per-criterion TENSE: "current" (default),
 *    "any" ("background in X" licenses history), used by the builder to
 *    opt past surfaces in for that criterion only (blueprint §12.2).
 */

import {
  CARE_SETTINGS,
  EMPLOYER_GROUPS,
  matchPopulationModifier,
  matchSubspecialty,
  ROLE_CLASSES,
  SPECIALTY_UMBRELLA_NOUNS,
  TRAINING_STAGES,
  type EmployerGroupDef,
} from "./clinical-vocabulary.ts";

export type CriterionKind =
  | "location"
  | "company"
  | "past_company"
  /** A multi-entity employer ("the VA"): id set + domains + name variants. */
  | "employer_group"
  | "experience"
  | "tenure"
  | "job_change"
  | "education"
  | "specialty"
  | "title"
  /** License-class population ("nurses", "physicians") — match terms grounded
   *  in real index titles, never an invented single title. */
  | "role_class"
  /** Credential classes (RN, BSN, NP, MD, DO, DPM, CRNA…): matched on
   *  title/headline/education text; the grader verifies the license class. */
  | "credential"
  /** Residency/fellowship stage+year ("PGY-3 podiatric residents"):
   *  title triangulation is the hard gate; the YEAR is carried for the
   *  deterministic layer and grader (date math), never a hard filter until
   *  start_date range filtering is live-probed (port plan, known gaps). */
  | "training_stage"
  /** Practice setting ("hospital", "ASC", "home health"). SOFT as a
   *  preference; HARD (employer-name gate) when the query makes the setting
   *  the WORKPLACE ("nurses that work in surgery centers") — US facilities
   *  carry their setting in their name, probed 2026-09-15. */
  | "care_setting"
  /** Fellowship-trained qualifier ("fellowship trained cardiovascular
   *  surgeons"): hard gate on fellowship evidence — education records,
   *  fellow-titled past roles, "fellowship trained" self-description. */
  | "fellowship"
  /** Employer size ("small private practices", "large health systems") —
   *  filtered on the current employer's live LinkedIn headcount. */
  | "employer_size"
  | "seniority"
  | "unsupported";

export type CriterionEnforcement = "hard" | "soft" | "dropped";
export type CriterionSource = "user" | "inferred";
export type CriterionEvidenceSource = "search" | "enrich" | "none";

/* ------------------------------------------------------------------ */
/*  Value shapes                                                       */
/* ------------------------------------------------------------------ */

export interface LocationValue {
  level: "state" | "city" | "country" | "region" | "multi_state";
  state?: string;
  city?: string;
  country?: string;
  region_key?: string;
  states?: string[];
  preferred_city?: string;
}

export interface GeoCircle {
  lat: number;
  lng: number;
  radius_mi: number;
}

export interface SubStateRegion {
  label: string;
  state: string;
  circles: GeoCircle[];
}

/** Sub-state regions the parser may emit as location.region_key.
 *  geo_distance on basic_profile.location with lat_lng was live-verified
 *  2026-08-31 (reference) and re-verified 2026-09-14 (probe log, Dallas). */
export const SUB_STATE_REGIONS: Record<string, SubStateRegion> = {
  bay_area: {
    label: "Bay Area",
    state: "california",
    circles: [{ lat: 37.7749, lng: -122.4194, radius_mi: 60 }],
  },
  northern_california: {
    label: "Northern California",
    state: "california",
    circles: [
      { lat: 37.7749, lng: -122.4194, radius_mi: 90 },
      { lat: 38.5816, lng: -121.4944, radius_mi: 90 },
    ],
  },
  southern_california: {
    label: "Southern California",
    state: "california",
    circles: [
      { lat: 34.0522, lng: -118.2437, radius_mi: 90 },
      { lat: 32.7157, lng: -117.1611, radius_mi: 60 },
    ],
  },
  dfw_metroplex: {
    label: "Dallas–Fort Worth",
    state: "texas",
    circles: [{ lat: 32.7767, lng: -96.797, radius_mi: 50 }],
  },
  houston_metro: {
    label: "Greater Houston",
    state: "texas",
    circles: [{ lat: 29.7604, lng: -95.3698, radius_mi: 50 }],
  },
};

export interface MultiStateRegion {
  label: string;
  states: string[];
}

/** Multi-state regions: or() of "=" leaves per state. `in` on
 *  basic_profile.location.state is BANNED (200s with total 0 — reference,
 *  probed live 2026-08-31). */
export const MULTI_STATE_REGIONS: Record<string, MultiStateRegion> = {
  new_england: {
    label: "New England",
    states: ["massachusetts", "new hampshire", "vermont", "maine", "rhode island", "connecticut"],
  },
  pacific_northwest: {
    label: "Pacific Northwest",
    states: ["washington", "oregon"],
  },
  midwest: {
    label: "Midwest",
    states: [
      "ohio", "michigan", "indiana", "illinois", "wisconsin", "minnesota",
      "iowa", "missouri", "north dakota", "south dakota", "nebraska", "kansas",
    ],
  },
  southeast: {
    label: "Southeast",
    states: ["florida", "georgia", "alabama", "mississippi", "tennessee", "south carolina", "north carolina"],
  },
};

export interface CompanyValue {
  name: string;
  excludeCurrent?: boolean;
  /** Resolved by the CALLER via /company/identify before the builder runs. */
  company_id?: number | null;
  /** "current" (default) or "any" — achievement/tenure-ambiguous phrasing. */
  tense?: "current" | "any";
  /** Facility-CLASS descriptor ("surgical center"), not a nameable org.
   *  Never sent to /company/identify. In Oslr this overlaps care_setting —
   *  the parser prefers care_setting; this survives for org-shaped mentions. */
  descriptor?: boolean;
}

export interface EmployerGroupValue {
  /** Group key in EMPLOYER_GROUPS (e.g. "va"). */
  group_key: string;
  name: string;
  company_ids: number[];
  domains: string[];
  name_variants: string[];
}

/** Career years — a range, not just a floor ("5-10 years", "under 3 years"). */
export interface ExperienceValue {
  min?: number;
  max?: number;
}

/** Years in the current role — same range semantics. */
export interface TenureValue {
  min?: number;
  max?: number;
}

/**
 * Employer size by live headcount. max_headcount caps ("small private
 * practices"); min_headcount floors ("large health systems"). Caveat carried
 * on the criterion note: profiles whose employer has no tracked headcount
 * read 0, so a max-cap keeps them (recall-safe) while a min-floor drops them.
 */
export interface EmployerSizeValue {
  max_headcount?: number;
  min_headcount?: number;
}

export interface JobChangeValue {
  recent: true;
}

export type SpecialtyTense = "current" | "any" | "past";

/**
 * Specialty with per-criterion tense (blueprint §12.2):
 *  - "current": identity phrasing ("cardiovascular nurses") — current
 *    surfaces only (§4 tense doctrine).
 *  - "any": background phrasing ("nurses with a cardiovascular background")
 *    — history licensed; past titles/descriptions join the OR.
 *  - "past": explicit former-role phrasing ("nurses who used to work in the
 *    OR") — matched on PAST surfaces; the RE-anchoring to a current role is
 *    whatever other criteria the sentence carries.
 * Legacy bare string[] is accepted everywhere and means "current".
 */
export interface SpecialtyValue {
  terms: string[];
  tense: SpecialtyTense;
  /**
   * Present when this criterion is a SUBSPECIALTY (the layer below
   * "orthopedic surgeon" — joint reconstruction, spine, neurovascular…).
   * Subspecialty evidence lives in procedure language, fellowship training,
   * and role descriptions (probed 2026-09-15), so the builder adds the
   * education surfaces and the grader gets the sibling map.
   */
  subspecialty?: {
    key: string;
    label: string;
    education_terms: string[];
    siblings: string[];
  };
}

export interface RoleClassValue {
  /** Key into ROLE_CLASSES ("nurse", "physician", "resident", …). */
  class: string;
  /** Match terms — the class's curated, index-verified term list. */
  terms: string[];
}

export interface CredentialValue {
  /** Credential tokens as the user asked them ("RN", "BSN", "CRNA", "DPM"). */
  any_of: string[];
}

export interface TrainingStageValue {
  /** "podiatric", "orthopedic surgery", null when unstated. */
  profession: string | null;
  stage: "residency" | "fellowship" | "internship" | "medical_school";
  /** PGY year / program year, null when unstated. */
  year: number | null;
  /** Title match terms for the hard gate (probed variants; see vocabulary). */
  title_terms: string[];
}

export interface CareSettingValue {
  /** Key into CARE_SETTINGS ("hospital", "asc", "clinic", "home_health"…). */
  setting: string;
  terms: string[];
  /** True when the setting is the WORKPLACE ("work in surgery centers"):
   *  the criterion goes hard and gates on the employer NAME. */
  workplace?: boolean;
  /** Employer-name terms for the hard workplace gate. */
  employer_name_terms?: string[];
}

/** Fellowship-trained qualifier. */
export interface FellowshipValue {
  trained: true;
}

export const SENIORITY_LEVELS: readonly string[] = [
  "CXO",
  "Owner / Partner",
  "Vice President",
  "Director",
  "Strategic",
  "Senior",
  "Experienced Manager",
  "Entry Level Manager",
  "Entry Level",
  "In Training",
];

export interface SeniorityValue {
  levels: string[];
}

export interface TitleValue {
  terms: string[];
}

export function canonicalizeSeniorityLevels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const byLower = new Map(SENIORITY_LEVELS.map((l) => [l.toLowerCase(), l]));
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const canonical = byLower.get(v.trim().toLowerCase());
    if (canonical && !out.includes(canonical)) out.push(canonical);
  }
  return out;
}

export type CriterionValue =
  | LocationValue
  | CompanyValue
  | EmployerGroupValue
  | ExperienceValue
  | TenureValue
  | EmployerSizeValue
  | JobChangeValue
  | SpecialtyValue
  | RoleClassValue
  | CredentialValue
  | TrainingStageValue
  | CareSettingValue
  | FellowshipValue
  | SeniorityValue
  | TitleValue
  | string[]
  | null;

export interface SearchCriteria {
  id: string;
  kind: CriterionKind;
  label: string;
  value: CriterionValue;
  enforcement: CriterionEnforcement;
  source: CriterionSource;
  evidenceSource: CriterionEvidenceSource;
  note?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.toLowerCase().trim())
    .filter(Boolean);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.toLowerCase().trim() : null;
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

/**
 * Decompose compound specialty phrases to their umbrella noun so surfaces
 * that write only the umbrella still match ("interventional cardiology" also
 * matches profiles that just say "cardiology"; "cardiac cath lab" gains
 * "cath lab"). Multi-word compounds keep the original phrase AND gain the
 * noun; single words pass through untouched.
 */
export function decomposeSpecialtyTerms(terms: string[]): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    if (!out.includes(t)) out.push(t);
  };
  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const term = raw.trim();
    if (!term) continue;
    add(term);
    if (!/\s/.test(term)) continue;
    for (const noun of SPECIALTY_UMBRELLA_NOUNS) {
      if (term === noun) continue;
      if (
        term.endsWith(` ${noun}`) ||
        term.startsWith(`${noun} `) ||
        term.includes(` ${noun} `)
      ) {
        add(noun);
      }
    }
  }
  return out;
}

const REGION_PHRASES: ReadonlyArray<{ pattern: RegExp; key: string }> = [
  { pattern: /\b(?:sf|san francisco) bay area\b/i, key: "bay_area" },
  { pattern: /\bbay area\b/i, key: "bay_area" },
  { pattern: /\bnorthern california\b/i, key: "northern_california" },
  { pattern: /\bsouthern california\b/i, key: "southern_california" },
  { pattern: /\b(?:dfw|dallas[- \/]fort worth|metroplex)\b/i, key: "dfw_metroplex" },
  { pattern: /\bgreater houston\b/i, key: "houston_metro" },
  { pattern: /\bnew england\b/i, key: "new_england" },
  { pattern: /\bpacific northwest\b/i, key: "pacific_northwest" },
  { pattern: /\bmidwest\b/i, key: "midwest" },
  { pattern: /\bsoutheast\b/i, key: "southeast" },
];

/** Backstop region detection on the raw query when the parser omitted it. */
export function reconcileParsedClinicianIntent(
  parsed: Record<string, unknown>,
  originalQuery: string,
): Record<string, unknown> {
  const reconciled: Record<string, unknown> = { ...parsed };
  const rawLocation = parsed.location;
  const location = rawLocation && typeof rawLocation === "object" && !Array.isArray(rawLocation)
    ? { ...(rawLocation as Record<string, unknown>) }
    : {};

  if (!str(location.region_key)) {
    const match = REGION_PHRASES.find(({ pattern }) => pattern.test(originalQuery));
    if (match && (SUB_STATE_REGIONS[match.key] || MULTI_STATE_REGIONS[match.key])) {
      location.region_key = match.key;
      const subState = SUB_STATE_REGIONS[match.key];
      if (subState) location.state = subState.state;
    }
  }
  if (Object.keys(location).length > 0) reconciled.location = location;
  return reconciled;
}

function seniorityLabel(levels: string[]): string {
  const set = new Set(levels);
  const is = (...want: string[]) => want.length === set.size && want.every((w) => set.has(w));
  if (is("CXO", "Owner / Partner")) return "C-suite";
  if (is("CXO", "Owner / Partner", "Vice President")) return "VP and above";
  if (is("CXO", "Owner / Partner", "Vice President", "Director")) return "Senior leadership";
  return levels.join(" / ");
}

/** Company strings as-received (trim only — case preserved for heuristics). */
function rawStrArr(v: unknown): string[] {
  const out: string[] = [];
  if (Array.isArray(v)) {
    for (const x of v) if (typeof x === "string" && x.trim()) out.push(x.trim());
  } else if (typeof v === "string" && v.trim()) {
    out.push(v.trim());
  }
  return out;
}

/** Resolve an employer mention to a known employer group, if it is one. */
export function matchEmployerGroup(name: string): { key: string; def: EmployerGroupDef } | null {
  const n = name.toLowerCase().trim();
  for (const [key, def] of Object.entries(EMPLOYER_GROUPS)) {
    if (def.aliases.some((a) => n === a || n.includes(a))) return { key, def };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Mapper: parsed payload → criteria                                  */
/* ------------------------------------------------------------------ */

/**
 * Map a parsed clinician query payload to SearchCriteria[].
 *
 * Criterion ids are positional (c0..cN) in a fixed section order — widen
 * targetIds depend on stability, so re-searches must send `cached_parsed`
 * (same contract as the reference engine).
 */
export function mapParsedToCriteria(
  parsed: Record<string, unknown>,
  unmappedConcepts: string[] = [],
): SearchCriteria[] {
  const criteria: SearchCriteria[] = [];
  const push = (c: Omit<SearchCriteria, "id">) =>
    criteria.push({ id: `c${criteria.length}`, ...c });

  /* ---- location (hard) ---- */
  const locations: { state?: string; city?: string; preferredCity?: string; regionKey?: string }[] = [];
  const l2Loc = parsed.location;
  if (l2Loc && typeof l2Loc === "object" && !Array.isArray(l2Loc)) {
    const row = l2Loc as Record<string, unknown>;
    const state = str(row.state) ?? undefined;
    const city = str(row.city) ?? undefined;
    const preferredCity = str(row.preferred_city) ?? str(parsed.preferred_city) ?? undefined;
    const regionKey = str(row.region_key) ?? undefined;
    if (state || city || regionKey) locations.push({ state, city, preferredCity, regionKey });
  }
  if (Array.isArray(parsed.locations)) {
    for (const entry of parsed.locations) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const state = str(row.state) ?? undefined;
      const city = str(row.city) ?? undefined;
      if (state || city) locations.push({ state, city });
    }
  }
  const seenLoc = new Set<string>();
  for (const { state, city, preferredCity, regionKey } of locations) {
    const subState = regionKey ? SUB_STATE_REGIONS[regionKey] : undefined;
    const multiState = regionKey ? MULTI_STATE_REGIONS[regionKey] : undefined;
    if (!state && !subState && !multiState) continue;
    const key = `${regionKey ?? ""}|${state ?? ""}|${city ?? ""}`;
    if (seenLoc.has(key)) continue;
    seenLoc.add(key);
    if (subState) {
      push({
        kind: "location",
        label: subState.label,
        value: { level: "region", region_key: regionKey, state: subState.state },
        enforcement: "hard",
        source: "user",
        evidenceSource: "search",
      });
      continue;
    }
    if (multiState) {
      push({
        kind: "location",
        label: multiState.label,
        value: { level: "multi_state", region_key: regionKey, states: [...multiState.states] },
        enforcement: "hard",
        source: "user",
        evidenceSource: "search",
      });
      continue;
    }
    if (!state) continue;
    push({
      kind: "location",
      label: city
        ? `${titleCase(city)}, ${titleCase(state)}`
        : preferredCity
        ? `${titleCase(state)} (${titleCase(preferredCity)} preferred)`
        : titleCase(state),
      value: city
        ? { level: "city", city, state }
        : preferredCity
        ? { level: "state", state, preferred_city: preferredCity }
        : { level: "state", state },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
    });
  }

  /* ---- employers (hard): groups, companies, past companies ---- */
  const anyNames = new Set(strArr(parsed.any_companies));
  const achievementTense = parsed.company_tense === "any";
  const currentNames = dedupe([
    ...strArr(parsed.current_companies),
    ...(str(parsed.current_company) ? [str(parsed.current_company) as string] : []),
    ...strArr(parsed.companies),
    ...strArr(parsed.any_companies),
  ]);
  const explicitDescriptor = parsed.company_is_descriptor === true;
  const companyHadUpper = new Map<string, boolean>();
  for (
    const raw of [
      ...rawStrArr(parsed.current_companies),
      ...rawStrArr(parsed.current_company),
      ...rawStrArr(parsed.companies),
      ...rawStrArr(parsed.any_companies),
      ...rawStrArr(parsed.past_companies),
      ...rawStrArr(parsed.previous_companies),
    ]
  ) {
    const key = raw.toLowerCase();
    companyHadUpper.set(key, (companyHadUpper.get(key) ?? false) || /[A-Z]/.test(raw));
  }

  const groupedNames = new Set<string>();
  for (const name of currentNames) {
    const group = matchEmployerGroup(name);
    if (!group) continue;
    groupedNames.add(name);
    push({
      kind: "employer_group",
      label: group.def.label,
      value: {
        group_key: group.key,
        name: group.def.label,
        company_ids: [...group.def.company_ids],
        domains: [...group.def.domains],
        name_variants: [...group.def.name_variants],
      },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note: "Matched across the group's known entities, shared domains, and name variants.",
    });
  }

  for (const name of currentNames) {
    if (groupedNames.has(name)) continue;
    const descriptor = explicitDescriptor && !(companyHadUpper.get(name) ?? false);
    const tense = anyNames.has(name) || achievementTense ? "any" as const : "current" as const;
    const value: Record<string, unknown> = descriptor ? { name, descriptor: true } : { name };
    if (tense === "any") value.tense = "any";
    push({
      kind: "company",
      label: titleCase(name),
      value: value as unknown as CompanyValue,
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
    });
  }
  const pastNames = dedupe([
    ...strArr(parsed.past_companies),
    ...strArr(parsed.previous_companies),
  ]).filter((n) => !currentNames.includes(n));
  const excludedNow = strArr(parsed.exclude_current_companies);
  for (const name of pastNames) {
    const excludeCurrent = excludedNow.includes(name);
    push({
      kind: "past_company",
      label: excludeCurrent ? `Formerly ${titleCase(name)} (left)` : `Formerly ${titleCase(name)}`,
      value: { name, ...(excludeCurrent ? { excludeCurrent: true } : {}) },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
    });
  }

  /* ---- role_class (hard) ---- */
  const roleClassKey = str(parsed.role_class);
  if (roleClassKey && ROLE_CLASSES[roleClassKey]) {
    const def = ROLE_CLASSES[roleClassKey];
    push({
      kind: "role_class",
      label: def.label,
      value: { class: roleClassKey, terms: [...def.terms] },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note: def.note,
    });
  }

  /* ---- training_stage (hard) ---- */
  const ts = parsed.training_stage;
  if (ts && typeof ts === "object" && !Array.isArray(ts)) {
    const row = ts as Record<string, unknown>;
    const stage = str(row.stage);
    if (stage && TRAINING_STAGES[stage]) {
      const stageDef = TRAINING_STAGES[stage];
      const profession = str(row.profession);
      const yearNum = typeof row.year === "number"
        ? row.year
        : typeof row.year === "string"
        ? Number(row.year)
        : NaN;
      const year = Number.isFinite(yearNum) && yearNum > 0 ? Math.floor(yearNum) : null;
      // Title terms: profession-qualified variants when the profession is
      // stated (probe log: 4 podiatric resident spellings live), else the
      // stage's generic variants. All whole-phrase; the builder adds
      // connector variants.
      const title_terms = profession
        ? stageDef.professionTerms(profession)
        : [...stageDef.genericTerms];
      push({
        kind: "training_stage",
        label: [
          year ? `PGY-${year}` : null,
          profession ? titleCase(profession) : null,
          stageDef.label,
        ].filter(Boolean).join(" "),
        value: {
          profession,
          stage: stage as TrainingStageValue["stage"],
          year,
          title_terms,
        },
        enforcement: "hard",
        source: "user",
        evidenceSource: "search",
        note: year
          ? "Stage is filtered on real index titles; the year is verified from role start dates by the ranking layer and the AI grader, not by a text filter."
          : undefined,
      });
    }
  }

  /* ---- credential (hard) ---- */
  const credentialTokens = dedupe(strArr(parsed.credentials));
  if (credentialTokens.length > 0) {
    push({
      kind: "credential",
      label: credentialTokens.map((c) => c.toUpperCase()).join(" / "),
      value: { any_of: credentialTokens },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note: "Matched on titles, headline, and education text; the AI grader verifies the license class (credentials are classes, not interchangeable titles).",
    });
  }

  /* ---- title (hard when user-stated) ---- */
  const jobTitles = strArr(parsed.job_titles);
  const titleValues = dedupe([...jobTitles, ...strArr(parsed.title_synonyms)]);
  if (titleValues.length > 0) {
    push({
      kind: "title",
      label: titleCase(jobTitles[0] ?? titleValues[0]),
      value: { terms: titleValues },
      enforcement: jobTitles.length > 0 ? "hard" : "soft",
      source: jobTitles.length > 0 ? "user" : "inferred",
      evidenceSource: "search",
    });
  }

  /* ---- specialty (hard, tensed) ---- */
  // Tense routing: on a "past" ask ("used to work in the OR, now on
  // med-surg"), the stated specialty terms are the PAST requirement, and the
  // keyword fields carry the person's CURRENT work — they must become a
  // SEPARATE current-tense criterion, or the current-floor requirement would
  // be satisfiable from history (the exact bug the tense doctrine exists to
  // prevent, blueprint §4). On current/any asks everything merges into one
  // criterion, matching the reference engine's behavior.
  const specialtyTense: SpecialtyTense =
    parsed.specialty_tense === "any" ? "any" : parsed.specialty_tense === "past" ? "past" : "current";
  const statedSpecialty = dedupe([
    ...(str(parsed.specialty) ? [str(parsed.specialty) as string] : []),
    ...strArr(parsed.specialties),
  ]);
  const keywordTerms = dedupe([
    ...strArr(parsed.required_keywords),
    ...strArr(parsed.keywords),
  ]).filter((t) => !statedSpecialty.includes(t));

  // SUBSPECIALTY SPLIT (the market gap, 2026-09-15): a phrase that names a
  // subspecialty ("joint reconstruction", "spine", "neurovascular") becomes
  // its OWN criterion carrying the procedure/fellowship term set, AND-ed
  // with whatever generic specialty terms remain ("orthopedic"). Merged into
  // one OR-group, the parent term would satisfy the group by itself and the
  // subspecialty would constrain nothing — every orthopedic surgeon would
  // match a joint-reconstruction ask.
  const subspecialtySeen = new Set<string>();
  const genericStated: string[] = [];
  for (const phrase of statedSpecialty) {
    const hit = matchSubspecialty(phrase);
    if (!hit) {
      genericStated.push(phrase);
      continue;
    }
    if (subspecialtySeen.has(hit.key)) continue;
    subspecialtySeen.add(hit.key);
    const subTerms = dedupe([phrase, ...hit.def.terms]);
    push({
      kind: "specialty",
      label: hit.def.label + (specialtyTense === "past" ? " (past role)" : ""),
      value: {
        terms: subTerms,
        tense: specialtyTense,
        subspecialty: {
          key: hit.key,
          label: hit.def.label,
          education_terms: [...hit.def.education_terms],
          siblings: [...hit.def.siblings],
        },
      },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note:
        `Subspecialty: matched on procedure language, fellowship training, and role descriptions — not just titles. Sibling subspecialties (${hit.def.siblings.slice(0, 3).join(", ")}) rank lower.`,
    });
  }

  // POPULATION-MODIFIER SPLIT (the "pediatric X" problem, 2026-09-15):
  // a modifier+specialty compound with no dedicated subspecialty entry
  // ("pediatric cardiology", "neonatal neurology") must not dilute to the
  // bare base specialty in one OR-group — every ADULT specialist would
  // satisfy it. The population becomes its OWN AND-ed criterion; the
  // specialty group keeps the compound phrase plus the base.
  const modifierGroups = new Map<string, { label: string; terms: string[] }>();
  const modifierAdjustedStated: string[] = [];
  for (const phrase of genericStated) {
    const mod = matchPopulationModifier(phrase);
    if (!mod) {
      modifierAdjustedStated.push(phrase);
      continue;
    }
    if (!modifierGroups.has(mod.key)) {
      modifierGroups.set(mod.key, { label: mod.label, terms: mod.terms });
    }
    modifierAdjustedStated.push(phrase);
    if (!modifierAdjustedStated.includes(mod.base)) modifierAdjustedStated.push(mod.base);
  }
  for (const [key, group] of modifierGroups) {
    push({
      kind: "specialty",
      label: `${group.label} population`,
      value: { terms: [...group.terms], tense: specialtyTense },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note:
        `Patient population is its own requirement (AND-ed with the specialty) — without it, "${key} X" would match every adult ${key === "pediatric" ? "specialist" : "clinician"} in X.`,
    });
  }

  // Keywords that themselves name the same subspecialty are already covered.
  const residualKeywords = keywordTerms.filter((t) => {
    const hit = matchSubspecialty(t);
    return !hit || !subspecialtySeen.has(hit.key);
  });
  const mainSpecialtyTerms = decomposeSpecialtyTerms(
    specialtyTense === "past" ? modifierAdjustedStated : dedupe([...modifierAdjustedStated, ...residualKeywords]),
  );
  if (mainSpecialtyTerms.length > 0) {
    push({
      kind: "specialty",
      label: titleCase(mainSpecialtyTerms[0]) + (specialtyTense === "past" ? " (past role)" : ""),
      value: { terms: mainSpecialtyTerms, tense: specialtyTense },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      ...(specialtyTense === "any"
        ? { note: "\"Background\" phrasing licenses history: past roles count for this requirement." }
        : specialtyTense === "past"
        ? { note: "Explicit former-role phrasing: this requirement is matched on PAST roles." }
        : {}),
    });
  }
  if (specialtyTense === "past" && keywordTerms.length > 0) {
    const currentTerms = decomposeSpecialtyTerms(keywordTerms);
    push({
      kind: "specialty",
      label: `Now: ${titleCase(currentTerms[0])}`,
      value: { terms: currentTerms, tense: "current" },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note: "What the person does NOW — matched on current surfaces only.",
    });
  }

  /* ---- care_setting (soft preference, or HARD workplace gate) ---- */
  const settingKey = str(parsed.care_setting);
  if (settingKey && CARE_SETTINGS[settingKey]) {
    const def = CARE_SETTINGS[settingKey];
    const workplace = parsed.care_setting_is_workplace === true;
    push({
      kind: "care_setting",
      label: workplace ? `Works at: ${def.label}` : def.label,
      value: {
        setting: settingKey,
        terms: [...def.terms],
        ...(workplace
          ? { workplace: true, employer_name_terms: [...def.employer_name_terms] }
          : {}),
      },
      enforcement: workplace ? "hard" : "soft",
      source: "user",
      evidenceSource: "search",
      note: workplace
        ? "Workplace requirement: matched on the employer's name (US facilities carry their setting in their name). Facilities named without the setting word can be missed — the semantic pass and grader backstop."
        : "Ranked, not required — practice settings are matched from employer names and role text, which under-reports; requiring it would silently drop real matches.",
    });
  }

  /* ---- fellowship-trained qualifier (hard) ---- */
  if (parsed.fellowship_trained === true) {
    push({
      kind: "fellowship",
      label: "Fellowship trained",
      value: { trained: true },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note: "Matched on fellowship education records, fellow-titled past roles, and \"fellowship trained\" self-description; the grader verifies the fellowship is CLINICAL (an honorific like FACS, or a non-clinical fellowship, does not count).",
    });
  }

  /* ---- experience (hard, RANGE) ---- */
  const num = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  };
  const minYears = num(parsed.min_years_experience);
  const maxYears = num(parsed.max_years_experience);
  if (minYears !== null || maxYears !== null) {
    const label = minYears !== null && maxYears !== null
      ? `${minYears}–${maxYears} years experience`
      : minYears !== null
      ? `${minYears}+ years experience`
      : `up to ${maxYears} years experience`;
    push({
      kind: "experience",
      label,
      value: {
        ...(minYears !== null ? { min: minYears } : {}),
        ...(maxYears !== null ? { max: maxYears } : {}),
      },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
    });
  }

  /* ---- tenure (hard, RANGE) ---- */
  const tenureMin = num(parsed.tenure_min_years);
  const tenureMax = num(parsed.tenure_max_years);
  if (tenureMin !== null || tenureMax !== null) {
    const label = tenureMin !== null && tenureMax !== null
      ? `${tenureMin}–${tenureMax} yrs in current role`
      : tenureMin !== null
      ? `${tenureMin}+ yrs in current role`
      : `under ${tenureMax} yrs in current role`;
    push({
      kind: "tenure",
      label,
      value: {
        ...(tenureMin !== null ? { min: tenureMin } : {}),
        ...(tenureMax !== null ? { max: tenureMax } : {}),
      },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      ...(tenureMin !== null && tenureMin <= 1
        ? {
          note:
            "Tenure counts whole years since the current title started: a 0-1 year minimum over-matches recently promoted long-tenured people.",
        }
        : {}),
    });
  }

  /* ---- employer size (hard) ---- */
  // "small private practices" / "large health systems" — filtered on the
  // current employer's live headcount. Parser emits practice_size
  // ("small" | "midsize" | "large") or explicit head-count bounds.
  const sizeKey = str(parsed.practice_size);
  const explicitMax = num(parsed.max_employer_headcount);
  const explicitMin = num(parsed.min_employer_headcount);
  const SIZE_PRESETS: Record<string, { max_headcount?: number; min_headcount?: number; label: string }> = {
    small: { max_headcount: 50, label: "Small practice (≤50 people)" },
    midsize: { min_headcount: 51, max_headcount: 1000, label: "Midsize employer (51–1,000)" },
    large: { min_headcount: 1001, label: "Large employer (1,000+)" },
  };
  const preset = sizeKey ? SIZE_PRESETS[sizeKey] : undefined;
  if (preset || explicitMax !== null || explicitMin !== null) {
    const value: EmployerSizeValue = {
      ...(preset?.max_headcount !== undefined ? { max_headcount: preset.max_headcount } : {}),
      ...(preset?.min_headcount !== undefined ? { min_headcount: preset.min_headcount } : {}),
      ...(explicitMax !== null ? { max_headcount: explicitMax } : {}),
      ...(explicitMin !== null ? { min_headcount: explicitMin } : {}),
    };
    push({
      kind: "employer_size",
      label: preset?.label ??
        (value.max_headcount !== undefined && value.min_headcount !== undefined
          ? `Employer ${value.min_headcount}–${value.max_headcount} people`
          : value.max_headcount !== undefined
          ? `Employer ≤${value.max_headcount} people`
          : `Employer ${value.min_headcount}+ people`),
      value,
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note: value.min_headcount !== undefined
        ? "Size uses live LinkedIn headcount; employers with no tracked headcount are excluded by a minimum-size floor."
        : "Size uses live LinkedIn headcount; employers with no tracked headcount (most small private practices) are kept by a size cap.",
    });
  }

  /* ---- job change (hard) ---- */
  if (parsed.recently_changed_jobs === true) {
    push({
      kind: "job_change",
      label: "recently left a role (~90 days)",
      value: { recent: true },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
    });
  }

  /* ---- education (hard) ---- */
  const educationTerms = dedupe(strArr(parsed.education_terms));
  if (educationTerms.length > 0) {
    push({
      kind: "education",
      label: titleCase(educationTerms[0]),
      value: educationTerms,
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
    });
  }

  /* ---- seniority (hard, explicit leadership asks only) ---- */
  const seniorityLevels = canonicalizeSeniorityLevels(parsed.seniority_levels);
  if (seniorityLevels.length > 0) {
    push({
      kind: "seniority",
      label: seniorityLabel(seniorityLevels),
      value: { levels: seniorityLevels },
      enforcement: "hard",
      source: "user",
      evidenceSource: "search",
      note:
        "Seniority is classified from the title string — clinical titles without a leadership keyword read as Entry Level, and hospital-affiliated private-practice owners can read as CXO. Use for explicit leadership asks only.",
    });
  }

  /* ---- default geography (inferred) ---- */
  if (!criteria.some((c) => c.kind === "location")) {
    push({
      kind: "location",
      label: "United States (default)",
      value: { level: "country", country: "United States" },
      enforcement: "hard",
      source: "inferred",
      evidenceSource: "search",
    });
  }

  /* ---- unmapped concepts (dropped — surfaced, honest) ---- */
  const seenConcepts = new Set<string>();
  for (const raw of unmappedConcepts) {
    if (typeof raw !== "string") continue;
    const concept = raw.trim();
    if (!concept) continue;
    const key = concept.toLowerCase();
    if (seenConcepts.has(key)) continue;
    seenConcepts.add(key);
    push({
      kind: "unsupported",
      label: titleCase(key),
      value: null,
      enforcement: "dropped",
      source: "user",
      evidenceSource: "none",
    });
  }

  return criteria;
}
