/**
 * build-crustdata-query.ts — CrustData PersonDB query builder for Oslr.
 *
 * THREE-AND PATTERN (live-tested June 2026, 129/140 recall):
 *   AND #1: Company (all health system entities + academic affiliates + domain fallbacks)
 *   AND #2: Specialty keywords (ortho, spine, cardio, etc. across title, headline, summary, skills, education)
 *   AND #3: Clinical role signal (surgeon, physician, nurse, resident, fellow, PA, etc.)
 *
 * CRITICAL: PersonDB Search uses these field names:
 *   current_employers.title, current_employers.name, current_employers.company_id,
 *   current_employers.company_website_domain, headline, summary, skills, region,
 *   location_state, location_country, education_background.field_of_study,
 *   education_background.degree_name
 *
 * DO NOT USE Realtime field names (experience.employment_details.*, basic_profile.*, etc.)
 */

import {
  HEALTH_SYSTEM_DIVISIONS,
  COMPANY_ALIASES,
  US_STATES,
} from "./config.ts";

/* ------------------------------------------------------------------ */
/* Types                                                                */
/* ------------------------------------------------------------------ */

interface BasicFilter {
  column: string;
  type: string;
  value: unknown;
}

interface CompoundFilter {
  op: "and" | "or";
  conditions: Array<BasicFilter | CompoundFilter>;
}

type CrustFilter = BasicFilter | CompoundFilter;

interface CrustDataQuery {
  dataset: "people";
  filters: CompoundFilter;
  sorts?: { column: string; order: "asc" | "desc" }[];
  limit: number;
  post_processing?: { exclude_profiles?: string[] };
}

interface BuildCrustDataOptions {
  size?: number;
  excludeLinkedInUrls?: string[];
}

function f(column: string, type: string, value: unknown): BasicFilter {
  return { column, type, value };
}

/* ------------------------------------------------------------------ */
/* Health system entity map                                              */
/* ------------------------------------------------------------------ */

const HEALTH_SYSTEM_ENTITIES: Record<string, {
  entity_ids: number[];
  academic_ids: number[];
  domains: string[];
}> = {
  "uchealth": {
    entity_ids: [1304813, 6259524, 6524064, 9255529, 12929305, 10791937, 9819138, 6644127],
    academic_ids: [670107, 6041104, 2056710],
    domains: ["uchealth.org", "cuanschutz.edu", "CUmedicine.us"],
  },
};

/* ------------------------------------------------------------------ */
/* Clinical role signal libraries                                        */
/* ------------------------------------------------------------------ */

const ROLE_SIGNALS: Record<string, { title: string[]; headline: string[]; education_degree: string[] }> = {
  physician: {
    title: ["surgeon", "physician", "professor", "fellow", "resident", "attending", "medical director", "chief", "hospitalist", "internist", "cardiologist", "neurologist", "oncologist", "radiologist", "anesthesiologist", "psychiatrist", "pediatrician", "dermatologist", "ophthalmologist", "urologist", "gastroenterologist", "pulmonologist", "nephrologist", "endocrinologist", "rheumatologist"],
    headline: ["surgeon", "physician", "MD", "DO", "fellow", "resident", "FACS", "FACP", "FAAOS"],
    education_degree: ["doctor of medicine", "MD", "M.D.", "doctor of osteopathic medicine", "DO", "D.O."],
  },
  nurse: {
    title: ["registered nurse", "nurse practitioner", "nurse manager", "nurse director", "clinical nurse", "charge nurse", "nurse educator", "nurse anesthetist", "CRNA", "nurse midwife", "nursing supervisor", "nurse navigator", "operating room nurse"],
    headline: ["RN", "BSN", "MSN", "DNP", "APRN", "NP", "CRNA", "nurse practitioner", "registered nurse"],
    education_degree: ["nursing", "bachelor of science in nursing", "BSN", "MSN", "DNP", "doctor of nursing practice"],
  },
  resident: {
    title: ["resident", "resident physician", "chief resident", "surgery resident", "medical resident", "intern"],
    headline: ["resident", "PGY", "resident physician"],
    education_degree: ["residency", "internship"],
  },
  fellow: {
    title: ["fellow", "clinical fellow", "research fellow", "spine fellow", "sports medicine fellow", "hand surgery fellow"],
    headline: ["fellow", "fellowship"],
    education_degree: ["fellowship"],
  },
  student: {
    title: ["medical student", "nursing student", "student nurse", "PA student", "SRNA"],
    headline: ["medical student", "nursing student", "student", "MS1", "MS2", "MS3", "MS4"],
    education_degree: [],
  },
  pa: {
    title: ["physician assistant", "PA-C", "surgical PA", "orthopedic PA", "physician associate"],
    headline: ["PA-C", "physician assistant", "MPAS"],
    education_degree: ["physician assistant", "MPAS", "MMS"],
  },
  therapist: {
    title: ["physical therapist", "occupational therapist", "speech therapist", "respiratory therapist", "rehabilitation"],
    headline: ["PT", "DPT", "OT", "OTR", "SLP", "physical therapist", "occupational therapist"],
    education_degree: ["physical therapy", "DPT", "occupational therapy", "OTD"],
  },
  all_clinical: {
    title: ["surgeon", "physician", "professor", "fellow", "resident", "attending", "medical director", "chief", "nurse", "registered nurse", "nurse practitioner", "CRNA", "physician assistant", "PA-C", "physical therapist", "occupational therapist", "pharmacist", "hospitalist", "medical student", "nursing student"],
    headline: ["surgeon", "physician", "MD", "DO", "RN", "NP", "PA-C", "PT", "DPT", "fellow", "resident"],
    education_degree: ["doctor of medicine", "MD", "M.D.", "DO", "nursing", "BSN", "MSN", "DNP", "physician assistant", "physical therapy", "DPT"],
  },
};

/* ------------------------------------------------------------------ */
/* Specialty keyword library                                             */
/* ------------------------------------------------------------------ */

const SPECIALTY_KEYWORDS: Record<string, { title: string[]; headline: string[]; summary: string[]; education: string[] }> = {
  orthopedics: {
    title: ["orthopedic", "orthopaedic", "spine", "sports medicine", "musculoskeletal", "hand surgery", "foot ankle", "joint replacement", "trauma surgery", "physical medicine rehabilitation"],
    headline: ["orthopedic", "orthopaedic", "spine", "sports medicine", "musculoskeletal", "physical medicine", "PM&R"],
    summary: ["orthopedic surgery", "orthopaedic surgery", "spine surgery", "sports medicine", "musculoskeletal", "joint replacement", "physical medicine rehabilitation"],
    education: ["orthopaedic surgery", "orthopedic surgery", "sports medicine", "spine surgery", "musculoskeletal", "physical medicine"],
  },
  cardiology: {
    title: ["cardiology", "cardiologist", "cardiac", "cardiovascular", "electrophysiology", "interventional", "heart failure", "structural heart"],
    headline: ["cardiology", "cardiologist", "cardiac", "cardiovascular", "electrophysiology"],
    summary: ["cardiology", "cardiac surgery", "cardiovascular", "electrophysiology", "interventional cardiology", "heart failure"],
    education: ["cardiology", "cardiovascular", "cardiac"],
  },
  neurology: {
    title: ["neurology", "neurologist", "neurosurgery", "neurosurgeon", "neuro", "stroke", "epilepsy"],
    headline: ["neurology", "neurologist", "neurosurgeon", "neurosurgery"],
    summary: ["neurology", "neurosurgery", "neurological", "stroke", "epilepsy", "movement disorder"],
    education: ["neurology", "neurosurgery", "neurological"],
  },
  oncology: {
    title: ["oncology", "oncologist", "cancer", "hematology", "radiation oncology"],
    headline: ["oncology", "oncologist", "hematology"],
    summary: ["oncology", "cancer", "hematology", "radiation oncology", "surgical oncology"],
    education: ["oncology", "hematology"],
  },
  "emergency medicine": {
    title: ["emergency medicine", "emergency physician", "ER", "ED physician"],
    headline: ["emergency medicine", "emergency physician", "ER physician"],
    summary: ["emergency medicine", "emergency department", "trauma", "critical care"],
    education: ["emergency medicine"],
  },
  pediatrics: {
    title: ["pediatrics", "pediatrician", "neonatology", "neonatal", "NICU", "pediatric"],
    headline: ["pediatrics", "pediatrician", "neonatology"],
    summary: ["pediatrics", "pediatric", "neonatal", "NICU", "children"],
    education: ["pediatrics", "neonatology"],
  },
  "internal medicine": {
    title: ["internal medicine", "internist", "hospitalist"],
    headline: ["internal medicine", "internist", "hospitalist"],
    summary: ["internal medicine", "hospital medicine"],
    education: ["internal medicine"],
  },
  "family medicine": {
    title: ["family medicine", "family physician", "family practice", "primary care"],
    headline: ["family medicine", "family physician", "primary care"],
    summary: ["family medicine", "primary care", "family practice"],
    education: ["family medicine", "family practice"],
  },
  surgery: {
    title: ["surgeon", "surgery", "surgical", "general surgery", "trauma surgery", "vascular surgery", "plastic surgery", "cardiothoracic"],
    headline: ["surgeon", "surgery", "surgical"],
    summary: ["surgery", "surgical", "operative"],
    education: ["surgery", "surgical"],
  },
  anesthesiology: {
    title: ["anesthesiology", "anesthesiologist", "anesthesia"],
    headline: ["anesthesiology", "anesthesiologist"],
    summary: ["anesthesiology", "anesthesia", "pain medicine"],
    education: ["anesthesiology", "anesthesia"],
  },
  radiology: {
    title: ["radiology", "radiologist", "interventional radiology", "imaging"],
    headline: ["radiology", "radiologist"],
    summary: ["radiology", "diagnostic imaging", "interventional radiology"],
    education: ["radiology", "diagnostic radiology"],
  },
  psychiatry: {
    title: ["psychiatry", "psychiatrist", "behavioral health", "mental health"],
    headline: ["psychiatry", "psychiatrist"],
    summary: ["psychiatry", "mental health", "behavioral health"],
    education: ["psychiatry"],
  },
  dermatology: {
    title: ["dermatology", "dermatologist"],
    headline: ["dermatology", "dermatologist"],
    summary: ["dermatology"],
    education: ["dermatology"],
  },
  gastroenterology: {
    title: ["gastroenterology", "gastroenterologist", "GI", "hepatology"],
    headline: ["gastroenterology", "gastroenterologist", "GI"],
    summary: ["gastroenterology", "hepatology", "endoscopy"],
    education: ["gastroenterology"],
  },
  urology: {
    title: ["urology", "urologist"],
    headline: ["urology", "urologist"],
    summary: ["urology", "urological"],
    education: ["urology"],
  },
  ophthalmology: {
    title: ["ophthalmology", "ophthalmologist", "retina", "glaucoma", "cataract"],
    headline: ["ophthalmology", "ophthalmologist"],
    summary: ["ophthalmology", "retina", "glaucoma"],
    education: ["ophthalmology"],
  },
  pulmonology: {
    title: ["pulmonology", "pulmonologist", "pulmonary", "respiratory", "critical care"],
    headline: ["pulmonology", "pulmonologist", "critical care"],
    summary: ["pulmonology", "pulmonary", "respiratory", "critical care"],
    education: ["pulmonology", "pulmonary"],
  },
  nephrology: {
    title: ["nephrology", "nephrologist", "renal", "dialysis"],
    headline: ["nephrology", "nephrologist"],
    summary: ["nephrology", "renal", "dialysis", "kidney"],
    education: ["nephrology"],
  },
  endocrinology: {
    title: ["endocrinology", "endocrinologist", "diabetes"],
    headline: ["endocrinology", "endocrinologist"],
    summary: ["endocrinology", "diabetes", "endocrine"],
    education: ["endocrinology"],
  },
  "obstetrics/gynecology": {
    title: ["obstetrics", "gynecology", "OB/GYN", "obstetrician", "gynecologist"],
    headline: ["OB/GYN", "obstetrics", "gynecology"],
    summary: ["obstetrics", "gynecology", "maternal", "reproductive"],
    education: ["obstetrics", "gynecology"],
  },
  rheumatology: {
    title: ["rheumatology", "rheumatologist"],
    headline: ["rheumatology", "rheumatologist"],
    summary: ["rheumatology", "autoimmune"],
    education: ["rheumatology"],
  },
  "infectious disease": {
    title: ["infectious disease", "infection control"],
    headline: ["infectious disease"],
    summary: ["infectious disease", "infection"],
    education: ["infectious disease"],
  },
  "pain management": {
    title: ["pain management", "pain medicine", "pain specialist"],
    headline: ["pain management", "pain medicine"],
    summary: ["pain management", "chronic pain"],
    education: ["pain medicine", "pain management"],
  },
  pathology: {
    title: ["pathology", "pathologist"],
    headline: ["pathology", "pathologist"],
    summary: ["pathology"],
    education: ["pathology"],
  },
};

/* ------------------------------------------------------------------ */
/* State normalization                                                   */
/* ------------------------------------------------------------------ */

const ABBREV_TO_STATE: Record<string, string> = {};
for (const [full, abbr] of Object.entries(US_STATES)) {
  ABBREV_TO_STATE[abbr.toLowerCase()] = full;
}

function normalizeStateName(s: string): string {
  const lower = s.toLowerCase().trim();
  if (ABBREV_TO_STATE[lower]) return ABBREV_TO_STATE[lower];
  return lower.replace(/\b\w/g, c => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* Company resolution                                                    */
/* ------------------------------------------------------------------ */

function resolveCompanyFilters(parsed: Record<string, unknown>): BasicFilter[] {
  // Prefer pre-resolved data injected by index.ts (resolveHealthSystem).
  // CrustData uses dedicated `_crustdata_*` fields so PDL's string IDs on
  // `_resolved_company_*` never leak into the PersonDB query (PersonDB
  // requires integer company_ids and 500s on strings).
  const resolvedIds = Array.isArray(parsed._crustdata_entity_ids)
    ? parsed._crustdata_entity_ids as number[]
    : [];
  const resolvedDomains = Array.isArray(parsed._crustdata_domains)
    ? parsed._crustdata_domains as string[]
    : [];
  const resolvedNames = Array.isArray(parsed._crustdata_company_names)
    ? parsed._crustdata_company_names as string[]
    : [];


  const filters: BasicFilter[] = [];

  if (resolvedIds.length > 0 || resolvedDomains.length > 0) {
    if (resolvedIds.length > 0) {
      filters.push(f("current_employers.company_id", "in", resolvedIds));
    }
    for (const domain of resolvedDomains) {
      filters.push(f("current_employers.company_website_domain", "(.)", domain));
    }
    // Add a few fuzzy name fallbacks too (capped)
    for (const name of resolvedNames.slice(0, 10)) {
      filters.push(f("current_employers.name", "(.)", name));
    }
    console.log(`[CRUSTDATA] Using resolved company: ${resolvedIds.length} IDs, ${resolvedDomains.length} domains, ${resolvedNames.length} names`);
    return filters;
  }

  // Fallback: build from raw parsed companies
  const currentCompanies = (parsed.current_companies as string[]) || [];
  const companies = (parsed.companies as string[]) || [];
  const effectiveCompanies = currentCompanies.length > 0 ? currentCompanies : companies;
  if (effectiveCompanies.length === 0) return [];

  for (const company of effectiveCompanies) {
    const lower = company.toLowerCase().trim();
    const canonical = COMPANY_ALIASES[lower] ?? lower;
    const systemEntry = HEALTH_SYSTEM_ENTITIES[canonical] || HEALTH_SYSTEM_ENTITIES[lower];

    if (systemEntry) {
      const allIds = [...systemEntry.entity_ids, ...systemEntry.academic_ids];
      filters.push(f("current_employers.company_id", "in", allIds));
      for (const domain of systemEntry.domains) {
        filters.push(f("current_employers.company_website_domain", "(.)", domain));
      }
      console.log(`[CRUSTDATA] Resolved health system "${company}" → ${allIds.length} entity IDs + ${systemEntry.domains.length} domain fallbacks`);
    } else {
      const divisions = HEALTH_SYSTEM_DIVISIONS[canonical] ?? [];
      const allNames = new Set([canonical, lower, ...divisions]);
      for (const name of allNames) {
        filters.push(f("current_employers.name", "(.)", name));
      }
      console.log(`[CRUSTDATA] Unknown system "${company}" — using fuzzy name match (${allNames.size} variants)`);
    }
  }

  return filters;
}

/* ------------------------------------------------------------------ */
/* Main query builder                                                    */
/* ------------------------------------------------------------------ */

export function buildCrustDataQuery(
  parsed: Record<string, unknown>,
  options: BuildCrustDataOptions = {}
): CrustDataQuery {
  const { size = 100, excludeLinkedInUrls } = options;
  const andConditions: CrustFilter[] = [];

  // ── AND #1: COMPANY ───────────────────────────────────────────────
  const companyFilters = resolveCompanyFilters(parsed);
  if (companyFilters.length > 0) {
    if (companyFilters.length === 1) andConditions.push(companyFilters[0]);
    else andConditions.push({ op: "or", conditions: companyFilters });
  }

  // ── AND #2: SPECIALTY KEYWORDS ────────────────────────────────────
  const specialty = (parsed.specialty as string) || null;
  const specialties = (parsed.specialties as string[]) || [];
  const effectiveSpecialty = specialty || specialties[0] || null;

  if (effectiveSpecialty) {
    const specLower = effectiveSpecialty.toLowerCase();
    const specConfig = SPECIALTY_KEYWORDS[specLower] || null;
    const specSignals: BasicFilter[] = [];

    if (specConfig) {
      for (const t of specConfig.title) specSignals.push(f("current_employers.title", "(.)", t));
      for (const h of specConfig.headline) specSignals.push(f("headline", "(.)", h));
      for (const s of specConfig.summary) specSignals.push(f("summary", "(.)", s));
      for (const e of specConfig.education) specSignals.push(f("education_background.field_of_study", "(.)", e));
      specSignals.push(f("skills", "(.)", effectiveSpecialty));
    } else {
      specSignals.push(f("current_employers.title", "(.)", effectiveSpecialty));
      specSignals.push(f("headline", "(.)", effectiveSpecialty));
      specSignals.push(f("summary", "(.)", effectiveSpecialty));
      specSignals.push(f("skills", "(.)", effectiveSpecialty));
      specSignals.push(f("education_background.field_of_study", "(.)", effectiveSpecialty));
    }

    if (specSignals.length > 0) {
      andConditions.push({ op: "or", conditions: specSignals });
    }
    console.log(`[CRUSTDATA] Specialty "${effectiveSpecialty}": ${specSignals.length} signals (config=${!!specConfig})`);
  }

  // ── AND #3: CLINICAL ROLE SIGNAL ──────────────────────────────────
  const jobTitles = (parsed.job_titles as string[]) || [];
  const seniority = (parsed.seniority as string) || null;
  const titleJoined = jobTitles.join(" ").toLowerCase();

  let roleKey = "all_clinical";
  if (seniority === "training") {
    if (/fellow/.test(titleJoined)) roleKey = "fellow";
    else if (/resident/.test(titleJoined)) roleKey = "resident";
    else if (/student|srna/.test(titleJoined)) roleKey = "student";
    else roleKey = "resident";
  } else if (/surgeon|physician|doctor|md|do|hospitalist|attending/.test(titleJoined)) {
    roleKey = "physician";
  } else if (/nurse|rn|np|crna|bsn|msn|dnp/.test(titleJoined)) {
    roleKey = "nurse";
  } else if (/physician assistant|pa-c|pa student/.test(titleJoined)) {
    roleKey = "pa";
  } else if (/therapist|pt |dpt|ot |slp|respiratory/.test(titleJoined)) {
    roleKey = "therapist";
  } else if (/fellow/.test(titleJoined)) {
    roleKey = "fellow";
  } else if (/resident/.test(titleJoined)) {
    roleKey = "resident";
  }

  const roleConfig = ROLE_SIGNALS[roleKey];
  if (roleConfig) {
    const roleSignals: BasicFilter[] = [];
    for (const t of roleConfig.title) roleSignals.push(f("current_employers.title", "(.)", t));
    for (const h of roleConfig.headline) {
      if (h.length <= 3 && /^[A-Z.]+$/.test(h)) roleSignals.push(f("headline", "[.]", h));
      else roleSignals.push(f("headline", "(.)", h));
    }
    for (const d of roleConfig.education_degree) {
      if (d.length <= 4 && /^[A-Z.]+$/.test(d)) roleSignals.push(f("education_background.degree_name", "[.]", d));
      else roleSignals.push(f("education_background.degree_name", "(.)", d));
    }
    if (roleSignals.length > 0) {
      andConditions.push({ op: "or", conditions: roleSignals });
    }
    console.log(`[CRUSTDATA] Role "${roleKey}": ${roleSignals.length} signals`);
  }

  // ── LOCATION ──────────────────────────────────────────────────────
  // PersonDB uses `region` as a partial-match free-text field
  // (e.g. "Denver, Colorado, United States"). The `location_state` /
  // `location_country` columns with `=` operator cause 500 errors.
  const locationObj = (parsed.location as { city?: string | null; state?: string | null }) || {};

  if (locationObj.city) {
    andConditions.push(f("region", "(.)", locationObj.city));
  } else if (locationObj.state) {
    andConditions.push(f("region", "(.)", normalizeStateName(locationObj.state)));
  }

  // ── BUILD ─────────────────────────────────────────────────────────
  const query: CrustDataQuery = {
    dataset: "people",
    filters: { op: "and", conditions: andConditions },
    limit: Math.min(size, 1000),
    sorts: [{ column: "years_of_experience_raw", order: "desc" }],
  };

  if (excludeLinkedInUrls && excludeLinkedInUrls.length > 0) {
    query.post_processing = { exclude_profiles: excludeLinkedInUrls.slice(0, 50000) };
  }

  console.log(`[CRUSTDATA] Query: ${andConditions.length} AND conditions, specialty=${effectiveSpecialty || "none"}, role=${roleKey}, location=${locationObj.state || locationObj.city || "none"}`);

  return query;
}

/* ------------------------------------------------------------------ */
/* Cascade (geographic expansion)                                       */
/* ------------------------------------------------------------------ */

export type CrustCascadeStep = "expand_geo" | "drop_role" | "drop_specialty";

export function applyCascadeStep(
  query: CrustDataQuery,
  step: CrustCascadeStep
): CrustDataQuery {
  const cloned: CrustDataQuery = JSON.parse(JSON.stringify(query));
  const andBlock = cloned.filters;

  switch (step) {
    case "expand_geo": {
      andBlock.conditions = andBlock.conditions.map((c: CrustFilter): CrustFilter => {
        if ("op" in c && c.op === "and") {
          const inner = c.conditions.filter(
            (ic) => !("column" in ic && ic.column === "region")
          );
          return inner.length === 1 ? inner[0] : { ...c, conditions: inner };
        }
        return c;
      });
      break;
    }
    case "drop_role": {
      andBlock.conditions = andBlock.conditions.filter((c: CrustFilter) => {
        if ("op" in c && c.op === "or") {
          const first = c.conditions[0];
          if (first && "column" in first) {
            const col = first.column;
            if (col === "current_employers.title" || col === "headline" || col === "education_background.degree_name") {
              const val = String(first.value).toLowerCase();
              if (["surgeon", "physician", "nurse", "registered nurse", "fellow", "resident", "pa-c"].includes(val)) {
                return false;
              }
            }
          }
        }
        return true;
      });
      break;
    }
    case "drop_specialty": {
      andBlock.conditions = andBlock.conditions.filter((c: CrustFilter) => {
        if ("op" in c && c.op === "or") {
          const first = c.conditions[0];
          if (first && "column" in first) {
            if (first.column === "skills") return false;
            if (first.column === "education_background.field_of_study") return false;
          }
        }
        return true;
      });
      break;
    }
  }

  return cloned;
}

export type { CrustDataQuery, CrustFilter, BasicFilter, CompoundFilter, BuildCrustDataOptions };
