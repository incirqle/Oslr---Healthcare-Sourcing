/**
 * build-clinician-query.ts — SearchCriteria[] → Crustdata v2 /person/search
 * filter tree. Ported from search-talent/build-crustdata-w2-query.ts
 * (live-verified operator/field notes preserved) and adapted to the clinician
 * criteria contract.
 *
 * Contract: every hard criterion is AND-ed; soft criteria are never filters
 * (scoring happens downstream). Leaves are {field, type, value}; branches are
 * {op: "and"|"or", conditions: [...]}.
 *
 * Every emitted field path is drawn from the frozen F table below — all
 * live-verified either in the reference engine (dates in comments) or in
 * docs/search-clinicians-probe-log.md (2026-09-14). An unlisted path must be
 * probed before it is added: an invalid path is a BILLED 400 (probe log).
 */

import type {
  CareSettingValue,
  CompanyValue,
  CredentialValue,
  EmployerGroupValue,
  EmployerSizeValue,
  ExperienceValue,
  JobChangeValue,
  LocationValue,
  RoleClassValue,
  SearchCriteria,
  SeniorityValue,
  SpecialtyValue,
  TenureValue,
  TitleValue,
  TrainingStageValue,
} from "./clinician-criteria.ts";
import { canonicalizeSeniorityLevels, SUB_STATE_REGIONS } from "./clinician-criteria.ts";
import { FILTERABLE_CREDENTIALS, GRADER_ONLY_CREDENTIALS } from "./clinical-vocabulary.ts";

/* ------------------------------------------------------------------ */
/*  v2 filter tree types                                               */
/* ------------------------------------------------------------------ */

export interface V2FilterLeaf {
  field: string;
  type: string;
  value: unknown;
}

export interface V2FilterBranch {
  op: "and" | "or";
  conditions: V2FilterNode[];
}

export type V2FilterNode = V2FilterLeaf | V2FilterBranch;

/* ------------------------------------------------------------------ */
/*  Filter paths (filter path ≠ response path)                         */
/* ------------------------------------------------------------------ */

const F = {
  headline: "basic_profile.headline",
  summary: "basic_profile.summary",
  city: "basic_profile.location.city",
  state: "basic_profile.location.state",
  // geo_distance target: the LOCATION OBJECT itself (reference 2026-08-31;
  // re-verified in probe D 2026-09-14 — .region does NOT exist on v2).
  location: "basic_profile.location",
  locationFull: "basic_profile.location.full_location",
  country: "basic_profile.location.country",
  skills: "skills.professional_network_skills",
  yoe: "years_of_experience_raw",
  curCompanyId: "experience.employment_details.current.company_id",
  curCompanyName: "experience.employment_details.current.company_name",
  curCompanyDomain: "experience.employment_details.current.company_website_domain",
  curTitle: "experience.employment_details.current.title",
  curDescription: "experience.employment_details.current.description",
  pastCompanyId: "experience.employment_details.past.company_id",
  pastCompanyName: "experience.employment_details.past.company_name",
  pastTitle: "experience.employment_details.past.title",
  pastDescription: "experience.employment_details.past.description",
  curYearsAtCompany: "experience.employment_details.current.years_at_company_raw",
  curCompanyHeadcount: "experience.employment_details.current.company_headcount_latest",
  recentlyChangedJobs: "recently_changed_jobs",
  eduDegree: "education.schools.degree",
  eduFieldOfStudy: "education.schools.field_of_study",
  curSeniority: "experience.employment_details.current.seniority_level",
} as const;

const leaf = (field: string, type: string, value: unknown): V2FilterLeaf => ({ field, type, value });
const or = (...conditions: V2FilterNode[]): V2FilterBranch => ({ op: "or", conditions });
const and = (...conditions: V2FilterNode[]): V2FilterBranch => ({ op: "and", conditions });

/* ------------------------------------------------------------------ */
/*  Connector variants                                                 */
/* ------------------------------------------------------------------ */

/**
 * Every spelling of a connector phrase.
 *
 * The reference engine measured and/& blindness ("foot and ankle" ≠
 * "foot & ankle" under [.] tokenization). The clinical index adds two more
 * families, both live-probed 2026-09-14:
 *  - slash/hyphen/space: Med/Surg RN, Med-Surg RN and Med Surg RN all exist;
 *  - ae/e: Orthopaedic and Orthopedic are separately populated.
 */
export function connectorVariants(term: string): string[] {
  const out = new Set<string>([term]);
  const add = (t: string) => out.add(t);
  if (/\s+and\s+/i.test(term)) add(term.replace(/\s+and\s+/gi, " & "));
  if (/\s*&\s*/.test(term)) add(term.replace(/\s*&\s*/g, " and "));
  // slash / hyphen / space triplet. Any phrase already carrying a slash or
  // hyphen gains the spaced form; known slashable compounds (probe log:
  // Med/Surg, Med-Surg and Med Surg all live) gain all three spellings even
  // from the space-only form.
  const SLASH_COMPOUNDS = new Set(["med surg", "ob gyn", "peds er", "post op", "pre op"]);
  for (const t of [...out]) {
    const spaced = t.replace(/\s*[\/-]\s*/g, " ").toLowerCase();
    if (spaced !== t) add(spaced);
    const words = spaced.split(/\s+/);
    if (words.length === 2 && (/[\/-]/.test(t) || SLASH_COMPOUNDS.has(spaced))) {
      add(`${words[0]}/${words[1]}`);
      add(`${words[0]}-${words[1]}`);
    }
  }
  // ae/e spelling family (orthopaedic/orthopedic, paediatric/pediatric,
  // anaesthesia/anesthesia, haematology/hematology, gynaecology/gynecology,
  // orthopaedics/orthopedics)
  for (const t of [...out]) {
    if (/aa?e/i.test(t)) {
      add(t.replace(/paedi/gi, "pedi").replace(/naesth/gi, "nesth").replace(/haem/gi, "hem").replace(/gynaec/gi, "gynec").replace(/orthopaed/gi, "orthoped"));
    }
    if (/orthoped/i.test(t)) add(t.replace(/orthoped/gi, "orthopaed"));
    if (/pediatric/i.test(t)) add(t.replace(/pediatric/gi, "paediatric"));
    if (/anesthes/i.test(t)) add(t.replace(/anesthes/gi, "anaesthes"));
    if (/hematolog/i.test(t)) add(t.replace(/hematolog/gi, "haematolog"));
    if (/gynecolog/i.test(t)) add(t.replace(/gynecolog/gi, "gynaecolog"));
  }
  return [...out];
}

/**
 * Connector variants PLUS singular/plural forms of the final word.
 *
 * `[.]` is whole-word and unstemmed (blueprint §5.7 measured table), so
 * "orthopedic" does NOT match "orthopedics" and "surgery center" does not
 * match "surgery centers". Every text criterion emits through this wrapper
 * so the s-form gap stops silently costing recall. Kept conservative:
 * only the last word inflects, only for words ≥4 chars.
 */
export function lexicalVariants(term: string): string[] {
  const out = new Set<string>();
  for (const v of connectorVariants(term)) {
    out.add(v);
    const words = v.split(/\s+/);
    const last = words[words.length - 1];
    if (last.length >= 4) {
      let inflected: string | null = null;
      if (/ies$/.test(last)) inflected = last.replace(/ies$/, "y");
      else if (/[a-z]s$/.test(last) && !/ss$/.test(last)) inflected = last.replace(/s$/, "");
      else if (/y$/.test(last)) inflected = last.replace(/y$/, "ies");
      else inflected = last + "s";
      if (inflected && inflected !== last) {
        out.add([...words.slice(0, -1), inflected].join(" "));
      }
    }
  }
  return [...out];
}

/* ------------------------------------------------------------------ */
/*  Title-term safety guard                                            */
/* ------------------------------------------------------------------ */

/**
 * Minimum length for a FREE-TEXT title term (user-stated titles). Curated
 * role-class / credential tokens bypass this — they are hand-vetted against
 * whole-word collisions in clinical-vocabulary.ts. "md" as a stated title is
 * still dropped (whole-word "MD" is a Managing Director too).
 */
export const MIN_TITLE_TERM_LENGTH = 4;

export function safeTitleTerms(terms: string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const t = raw.toLowerCase().trim();
    if (!t) continue;
    (t.length >= MIN_TITLE_TERM_LENGTH ? kept : dropped).push(t);
  }
  return { kept, dropped };
}

/* ------------------------------------------------------------------ */
/*  Builder                                                            */
/* ------------------------------------------------------------------ */

export interface BuildClinicianQueryOptions {
  /**
   * Also match CURRENT-tense specialty terms in PAST job titles and
   * descriptions. OFF by default (tense doctrine, blueprint §4). ON only for
   * the labelled past-role-holders fallback. Criteria whose OWN tense is
   * "any"/"past" always reach the surfaces their tense licenses, regardless
   * of this flag.
   */
  pastSpecialty?: boolean;
}

export function buildClinicianQuery(
  criteria: SearchCriteria[],
  opts: BuildClinicianQueryOptions = {},
): V2FilterNode | null {
  const hard: V2FilterNode[] = [];
  // Multiple named CURRENT employers (and employer groups) are alternatives —
  // a person works at one place. Past employers keep AND (career chains).
  const employerAlternatives: V2FilterNode[] = [];
  // Multiple locations are alternatives too: "ICU nurses in Dallas or
  // Houston" means either place. ANDed (each location its own hard clause,
  // the pre-2026-09-15 behavior) two locations demanded a person be in both
  // — a guaranteed zero.
  const locationAlternatives: V2FilterNode[] = [];

  for (const c of criteria) {
    if (c.enforcement !== "hard") continue;

    switch (c.kind) {
      case "company": {
        const v = c.value as CompanyValue;
        const anyTense = v.tense === "any";
        if (v.company_id != null) {
          const cur = leaf(F.curCompanyId, "=", v.company_id);
          employerAlternatives.push(anyTense ? or(cur, leaf(F.pastCompanyId, "=", v.company_id)) : cur);
        } else {
          const cur = leaf(F.curCompanyName, "[.]", v.name);
          employerAlternatives.push(anyTense ? or(cur, leaf(F.pastCompanyName, "[.]", v.name)) : cur);
        }
        break;
      }
      case "employer_group": {
        // The VA problem (blueprint §12.3): one "employer" = many entities.
        // id set + shared domains + name-variant substrings, all ORed —
        // present-tense by construction. NEVER a bare short-token name.
        const v = c.value as EmployerGroupValue;
        const clauses: V2FilterNode[] = [];
        if (v.company_ids.length > 0) clauses.push(leaf(F.curCompanyId, "in", v.company_ids));
        for (const d of v.domains) clauses.push(leaf(F.curCompanyDomain, "[.]", d));
        for (const n of v.name_variants) clauses.push(leaf(F.curCompanyName, "[.]", n));
        if (clauses.length > 0) {
          employerAlternatives.push(clauses.length === 1 ? clauses[0] : or(...clauses));
        }
        break;
      }
      case "past_company": {
        const v = c.value as CompanyValue;
        if (v.company_id != null) {
          hard.push(leaf(F.pastCompanyId, "=", v.company_id));
        } else {
          hard.push(leaf(F.pastCompanyName, "[.]", v.name));
        }
        if (v.excludeCurrent) {
          if (v.company_id != null) {
            hard.push(leaf(F.curCompanyId, "!=", v.company_id));
          } else {
            hard.push(leaf(F.curCompanyName, "(!)", v.name));
          }
        }
        break;
      }
      case "location": {
        const v = c.value as LocationValue;
        if (v.level === "country" && v.country) {
          locationAlternatives.push(leaf(F.country, "=", v.country));
        } else if (v.level === "region" && v.region_key && SUB_STATE_REGIONS[v.region_key]) {
          const region = SUB_STATE_REGIONS[v.region_key];
          const circles = region.circles.map((g) =>
            leaf(F.location, "geo_distance", { lat_lng: [g.lat, g.lng], distance: g.radius_mi, unit: "mi" })
          );
          // Clip to every state the metro straddles (Tri-State, DMV,
          // Chicagoland) — or() of "=" leaves, never `in`.
          const clipStates = region.states ?? [region.state];
          const clip = clipStates.length === 1
            ? leaf(F.state, "=", clipStates[0])
            : or(...clipStates.map((s) => leaf(F.state, "=", s)));
          locationAlternatives.push(and(
            clip,
            circles.length === 1 ? circles[0] : or(...circles),
          ));
        } else if (v.level === "multi_state" && Array.isArray(v.states) && v.states.length > 0) {
          // or() of "=" leaves. NEVER `in` (silently matches nothing —
          // reference probe 2026-08-31).
          const states = v.states.filter((s) => typeof s === "string" && s.trim());
          if (states.length === 1) locationAlternatives.push(leaf(F.state, "=", states[0]));
          else if (states.length > 1) locationAlternatives.push(or(...states.map((s) => leaf(F.state, "=", s))));
        } else if (v.level === "city" && v.city && v.state) {
          // City equality is unreliable (probe D: city="Dallas" removed every
          // result), and hyper-local asks (Golden, Boulder) also need the
          // people whose profile says the nearby metro. state= AND (city= OR
          // full_location substring OR a 15mi geo circle around the named
          // town — geocoded by the provider, verified live 2026-09-15 on
          // Golden/Boulder).
          locationAlternatives.push(and(
            leaf(F.state, "=", v.state),
            or(
              leaf(F.city, "=", v.city),
              leaf(F.locationFull, "[.]", v.city),
              leaf(F.location, "geo_distance", {
                location: `${v.city}, ${v.state}`,
                distance: 15,
                unit: "mi",
              }),
            ),
          ));
        } else if (v.state) {
          locationAlternatives.push(leaf(F.state, "=", v.state));
        }
        break;
      }
      case "experience": {
        const v = c.value as ExperienceValue;
        if (typeof v.min === "number") hard.push(leaf(F.yoe, "=>", v.min));
        if (typeof v.max === "number") hard.push(leaf(F.yoe, "=<", v.max));
        break;
      }
      case "employer_size": {
        // Live headcount on the current employer. A max-cap keeps untracked
        // (headcount 0) employers — most small private practices have no
        // tracked headcount, and dropping them would delete the very
        // population the filter targets. A min-floor necessarily excludes
        // untracked employers (the criterion note says so).
        const v = c.value as EmployerSizeValue;
        if (typeof v.max_headcount === "number") {
          hard.push(leaf(F.curCompanyHeadcount, "=<", v.max_headcount));
        }
        if (typeof v.min_headcount === "number") {
          hard.push(leaf(F.curCompanyHeadcount, "=>", v.min_headcount));
        }
        break;
      }
      case "role_class": {
        // OR over the class's curated whole-word/phrase terms on the current
        // title. Never an invented single title (blueprint §3.1); the terms
        // are index-verified vocabulary, and connector variants cover the
        // spelling families.
        const v = c.value as RoleClassValue;
        const clauses: V2FilterNode[] = [];
        for (const t of v.terms) {
          for (const variant of lexicalVariants(t)) {
            clauses.push(leaf(F.curTitle, "[.]", variant));
          }
        }
        if (clauses.length === 0) break;
        hard.push(clauses.length === 1 ? clauses[0] : or(...clauses));
        break;
      }
      case "credential": {
        // Filterable tokens gate on title/headline/education degree text;
        // grader-only tokens (MD/DO/PA — whole-word collisions) emit nothing
        // here and are verified by the audit pass.
        const v = c.value as CredentialValue;
        const filterable = v.any_of
          .map((t) => t.toLowerCase().trim())
          .filter((t) => FILTERABLE_CREDENTIALS.has(t) && !GRADER_ONLY_CREDENTIALS.has(t));
        if (filterable.length === 0) break;
        const clauses: V2FilterNode[] = [];
        for (const t of filterable) {
          clauses.push(leaf(F.curTitle, "[.]", t));
          clauses.push(leaf(F.headline, "[.]", t));
          clauses.push(leaf(F.eduDegree, "[.]", t));
        }
        hard.push(or(...clauses));
        break;
      }
      case "training_stage": {
        // Hard gate = title triangulation over the stage's live spellings.
        // The YEAR is deliberately NOT a text filter (PGY-pharmacy trap) and
        // start_date range filtering ships only after a live probe (port
        // plan, known gaps) — the deterministic layer + grader do year math
        // from the dates already on the rows.
        const v = c.value as TrainingStageValue;
        const clauses: V2FilterNode[] = [];
        for (const t of v.title_terms) {
          for (const variant of lexicalVariants(t)) {
            clauses.push(leaf(F.curTitle, "[.]", variant));
          }
        }
        if (clauses.length === 0) break;
        hard.push(clauses.length === 1 ? clauses[0] : or(...clauses));
        break;
      }
      case "specialty": {
        // Per-criterion tense (blueprint §12.2):
        //   current → current surfaces only (tense doctrine §4)
        //   any     → current + past surfaces (background phrasing)
        //   past    → past surfaces only (explicit former-role phrasing)
        // opts.pastSpecialty (the labelled fallback) widens "current" to
        // history exactly like "any".
        const raw = c.value as SpecialtyValue | string[];
        const terms = (Array.isArray(raw) ? raw : raw?.terms ?? [])
          .filter((t) => typeof t === "string" && t.trim());
        if (terms.length === 0) break;
        const tense = Array.isArray(raw) ? "current" : (raw.tense ?? "current");
        const subspecialty = Array.isArray(raw) ? undefined : raw.subspecialty;
        const CURRENT_SURFACES = [
          F.headline, F.curTitle, F.curCompanyName,
          F.summary, F.curDescription, F.skills,
        ];
        const PAST_SURFACES = [F.pastTitle, F.pastDescription];
        const surfaces = tense === "past"
          ? PAST_SURFACES
          : (tense === "any" || opts.pastSpecialty)
          ? [...CURRENT_SURFACES, ...PAST_SURFACES]
          : CURRENT_SURFACES;
        const clauses: V2FilterNode[] = [];
        for (const t of terms) {
          for (const v of lexicalVariants(t)) {
            for (const field of surfaces) clauses.push(leaf(field, "[.]", v));
          }
        }
        // Subspecialty asks add the FELLOWSHIP surfaces: an "Adult
        // Reconstruction Fellowship" education record is subspecialty
        // identity even when every current surface just says "Orthopaedic
        // Surgeon" (probed live 2026-09-15). The grader still verifies the
        // person practices it NOW.
        if (subspecialty) {
          for (const t of subspecialty.education_terms) {
            for (const v of lexicalVariants(t)) {
              clauses.push(leaf(F.eduFieldOfStudy, "[.]", v));
              clauses.push(leaf(F.eduDegree, "[.]", v));
            }
          }
        }
        hard.push(or(...clauses));
        break;
      }
      case "title": {
        const raw = c.value as TitleValue | string[];
        const terms = Array.isArray(raw) ? raw : (raw?.terms ?? []);
        const { kept } = safeTitleTerms(terms);
        const clauses: V2FilterNode[] = kept.flatMap((t) =>
          lexicalVariants(t).map((v) => leaf(F.curTitle, "[.]", v))
        );
        if (clauses.length === 0) break;
        hard.push(clauses.length === 1 ? clauses[0] : or(...clauses));
        break;
      }
      case "tenure": {
        const v = c.value as TenureValue;
        if (typeof v.min === "number") hard.push(leaf(F.curYearsAtCompany, "=>", v.min));
        if (typeof v.max === "number") hard.push(leaf(F.curYearsAtCompany, "=<", v.max));
        break;
      }
      case "job_change": {
        const v = c.value as JobChangeValue;
        hard.push(leaf(F.recentlyChangedJobs, "=", v.recent));
        break;
      }
      case "education": {
        const terms = Array.isArray(c.value)
          ? (c.value as string[]).filter((t) => typeof t === "string" && t.trim())
          : [];
        if (terms.length === 0) break;
        const clauses: V2FilterNode[] = [];
        for (const t of terms) {
          clauses.push(leaf(F.eduDegree, "[.]", t));
          clauses.push(leaf(F.eduFieldOfStudy, "[.]", t));
        }
        hard.push(or(...clauses));
        break;
      }
      case "seniority": {
        const v = c.value as SeniorityValue;
        const levels = canonicalizeSeniorityLevels(v?.levels);
        if (levels.length === 1) hard.push(leaf(F.curSeniority, "=", levels[0]));
        else if (levels.length > 1) hard.push(leaf(F.curSeniority, "in", levels));
        break;
      }
      case "care_setting": {
        // Soft preference → never a filter. HARD workplace mode ("nurses
        // that work in surgery centers") gates on the employer NAME — US
        // facilities carry their setting in their legal name (probed live
        // 2026-09-15: ASCs are "Surgery Center of X").
        const v = c.value as CareSettingValue;
        if (!v.workplace) break;
        const nameTerms = v.employer_name_terms ?? [];
        if (nameTerms.length === 0) break;
        const clauses: V2FilterNode[] = [];
        for (const t of nameTerms) {
          for (const variant of lexicalVariants(t)) {
            clauses.push(leaf(F.curCompanyName, "[.]", variant));
          }
        }
        hard.push(clauses.length === 1 ? clauses[0] : or(...clauses));
        break;
      }
      case "fellowship": {
        // Fellowship evidence lives in three places (probed 2026-09-15):
        // education records ("Cardiology Fellowship" as a DEGREE value),
        // fellow-titled roles (current or past — "Cardiothoracic Surgery
        // Fellow"), and self-description ("fellowship trained" / the
        // hyphenated spelling). Non-clinical fellowships ("Product
        // Management Fellowship") pass the text gate; the grader cuts them.
        const clauses: V2FilterNode[] = [
          leaf(F.eduDegree, "[.]", "fellowship"),
          leaf(F.eduFieldOfStudy, "[.]", "fellowship"),
          leaf(F.pastTitle, "[.]", "fellow"),
          leaf(F.curTitle, "[.]", "fellowship"),
          leaf(F.headline, "[.]", "fellowship trained"),
          leaf(F.headline, "[.]", "fellowship-trained"),
          leaf(F.summary, "[.]", "fellowship trained"),
          leaf(F.summary, "[.]", "fellowship-trained"),
          leaf(F.summary, "[.]", "fellowship"),
        ];
        hard.push(or(...clauses));
        break;
      }
      case "unsupported":
        break;
    }
  }

  if (employerAlternatives.length === 1) hard.push(employerAlternatives[0]);
  else if (employerAlternatives.length > 1) hard.push(or(...employerAlternatives));

  if (locationAlternatives.length === 1) hard.push(locationAlternatives[0]);
  else if (locationAlternatives.length > 1) hard.push(or(...locationAlternatives));

  if (hard.length === 0) return null;
  return hard.length === 1 ? hard[0] : and(...hard);
}

/* ------------------------------------------------------------------ */
/*  Card-renderable projection                                         */
/* ------------------------------------------------------------------ */

// Returnable fields ONLY — honors.*, years_of_experience_raw and
// skills.professional_network_skills are filter-only and 400 in `fields`.
// Everything the card ever shows rides the search response (blueprint §5.8):
// zero extra calls on card expand.
export const CARD_FIELDS: string[] = [
  "basic_profile.name",
  "basic_profile.first_name",
  "basic_profile.last_name",
  "basic_profile.headline",
  "basic_profile.location",
  "basic_profile.summary",
  "basic_profile.current_title",
  "basic_profile.profile_picture_permalink",
  "basic_profile.normalized_title",
  // Parent employment objects, not subfields: live-probed 2026-09-14 (probe
  // log A and D) — the parent returns title, name, dates, description,
  // company ids/logos AND is_default, which the match-scope layer and the
  // training-stage year math need. (Reference engine projected subfields and
  // silently lost is_default/dates.)
  "experience.employment_details.current",
  "experience.employment_details.past",
  "education",
  "social_handles.professional_network_identifier.profile_url",
  "crustdata_person_id",
];
