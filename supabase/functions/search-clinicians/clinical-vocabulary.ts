/**
 * clinical-vocabulary.ts — the healthcare domain model for search-clinicians.
 *
 * Sources:
 *  - pdl-search/config.ts KEYWORD_EXPANSIONS (390 clinical entries, ported
 *    subset) — abbreviation → canonical specialty term mappings ONLY. No
 *    entry here ever becomes an invented title requirement (blueprint §3.1).
 *  - docs/search-clinicians-probe-log.md — live Crustdata v2 autocomplete
 *    probes 2026-09-14. Role-class and training-stage term lists contain only
 *    phrases verified to exist in the live index (or their connector
 *    variants, which the builder generates).
 *
 * TERMS ARE MATCH SURFACES, NOT INVENTED TITLES: a role_class gates on an OR
 * of these terms across real titles; the user's own stated titles still
 * ground through free autocomplete (title-vocabulary.ts) at parse time.
 */

/* ------------------------------------------------------------------ */
/*  Keyword expansions (shorthand → canonical specialty terms)          */
/* ------------------------------------------------------------------ */

export const KEYWORD_EXPANSIONS: Record<string, { specialties: string[]; keywords: string[] }> = {
  // Cardiology
  "cardio": { specialties: ["cardiovascular"], keywords: ["cardiovascular", "cardiac", "cardiology"] },
  "cardiac": { specialties: ["cardiovascular"], keywords: ["cardiovascular", "cardiac"] },
  "cardiology": { specialties: ["cardiology"], keywords: ["cardiology", "cardiac", "cardiovascular"] },
  "cardiovascular": { specialties: ["cardiovascular"], keywords: ["cardiovascular", "cardiac"] },
  "cath lab": { specialties: ["cardiovascular"], keywords: ["cath lab", "cardiac cath", "interventional"] },
  "cvicu": { specialties: ["cardiovascular"], keywords: ["cvicu", "cardiovascular icu", "cardiac icu"] },
  "ccu": { specialties: ["cardiovascular"], keywords: ["ccu", "coronary care"] },
  "telemetry": { specialties: ["cardiovascular"], keywords: ["telemetry"] },
  "ep": { specialties: ["electrophysiology"], keywords: ["electrophysiology"] },
  // Ortho
  "ortho": { specialties: ["orthopedic"], keywords: ["orthopedic", "orthopaedic"] },
  "orthopedic": { specialties: ["orthopedic"], keywords: ["orthopedic", "orthopaedic"] },
  "orthopedics": { specialties: ["orthopedic"], keywords: ["orthopedic", "orthopaedic"] },
  "orthopaedic": { specialties: ["orthopedic"], keywords: ["orthopaedic", "orthopedic"] },
  "spine": { specialties: ["spine"], keywords: ["spine"] },
  "sports med": { specialties: ["sports medicine"], keywords: ["sports medicine"] },
  // Emergency / critical care
  "er": { specialties: ["emergency medicine"], keywords: ["emergency", "emergency department"] },
  "ed": { specialties: ["emergency medicine"], keywords: ["emergency department", "emergency"] },
  "emergency": { specialties: ["emergency medicine"], keywords: ["emergency"] },
  "icu": { specialties: ["critical care"], keywords: ["icu", "intensive care", "critical care"] },
  "critical care": { specialties: ["critical care"], keywords: ["critical care", "icu"] },
  "nicu": { specialties: ["neonatal"], keywords: ["nicu", "neonatal"] },
  "picu": { specialties: ["pediatric critical care"], keywords: ["picu", "pediatric icu"] },
  // Perioperative
  "or": { specialties: ["perioperative"], keywords: ["operating room", "perioperative"] },
  "operating room": { specialties: ["perioperative"], keywords: ["operating room", "perioperative"] },
  "perioperative": { specialties: ["perioperative"], keywords: ["perioperative", "operating room"] },
  "pacu": { specialties: ["perioperative"], keywords: ["pacu", "post anesthesia"] },
  "med surg": { specialties: ["medical surgical"], keywords: ["med surg", "medical surgical"] },
  "med-surg": { specialties: ["medical surgical"], keywords: ["med surg", "medical surgical"] },
  "med/surg": { specialties: ["medical surgical"], keywords: ["med surg", "medical surgical"] },
  // Women's health
  "obgyn": { specialties: ["obstetrics and gynecology"], keywords: ["ob/gyn", "obstetrics", "gynecology"] },
  "ob/gyn": { specialties: ["obstetrics and gynecology"], keywords: ["ob/gyn", "obstetrics", "gynecology"] },
  "l&d": { specialties: ["labor and delivery"], keywords: ["labor and delivery", "l&d"] },
  "labor and delivery": { specialties: ["labor and delivery"], keywords: ["labor and delivery", "l&d"] },
  // Peds
  "peds": { specialties: ["pediatrics"], keywords: ["pediatric", "pediatrics"] },
  "pediatric": { specialties: ["pediatrics"], keywords: ["pediatric"] },
  // Onc / heme
  "onc": { specialties: ["oncology"], keywords: ["oncology"] },
  "oncology": { specialties: ["oncology"], keywords: ["oncology", "cancer"] },
  "hem onc": { specialties: ["hematology oncology"], keywords: ["hematology", "oncology"] },
  // Neuro
  "neuro": { specialties: ["neurology"], keywords: ["neurology", "neuro"] },
  "neurology": { specialties: ["neurology"], keywords: ["neurology"] },
  "neurosurgery": { specialties: ["neurosurgery"], keywords: ["neurosurgery", "neurosurgical"] },
  // GI / renal / endocrine / pulm
  "gi": { specialties: ["gastroenterology"], keywords: ["gastroenterology", "gi", "endoscopy"] },
  "gastro": { specialties: ["gastroenterology"], keywords: ["gastroenterology"] },
  "renal": { specialties: ["nephrology"], keywords: ["nephrology", "renal", "dialysis"] },
  "dialysis": { specialties: ["nephrology"], keywords: ["dialysis"] },
  "endocrine": { specialties: ["endocrinology"], keywords: ["endocrinology", "diabetes"] },
  "pulm": { specialties: ["pulmonology"], keywords: ["pulmonology", "respiratory"] },
  // Psych / derm / other
  "psych": { specialties: ["psychiatry"], keywords: ["psychiatry", "behavioral health"] },
  "behavioral health": { specialties: ["psychiatry"], keywords: ["behavioral health", "psychiatric"] },
  "derm": { specialties: ["dermatology"], keywords: ["dermatology"] },
  "ent": { specialties: ["otolaryngology"], keywords: ["ent", "otolaryngology"] },
  "anesthesia": { specialties: ["anesthesiology"], keywords: ["anesthesia", "anesthesiology"] },
  "radiology": { specialties: ["radiology"], keywords: ["radiology", "imaging"] },
  "urology": { specialties: ["urology"], keywords: ["urology"] },
  "podiatry": { specialties: ["podiatry"], keywords: ["podiatry", "podiatric"] },
  "wound care": { specialties: ["wound care"], keywords: ["wound care"] },
  "home health": { specialties: ["home health"], keywords: ["home health"] },
  "hospice": { specialties: ["hospice"], keywords: ["hospice", "palliative"] },
  "palliative": { specialties: ["palliative care"], keywords: ["palliative"] },
  "primary care": { specialties: ["primary care"], keywords: ["primary care", "family medicine"] },
  "family medicine": { specialties: ["family medicine"], keywords: ["family medicine"] },
  "internal medicine": { specialties: ["internal medicine"], keywords: ["internal medicine"] },
  "hospitalist": { specialties: ["hospital medicine"], keywords: ["hospitalist"] },
};

/**
 * Umbrella nouns compound specialty phrases decompose to, so a surface that
 * writes only the umbrella still matches ("interventional cardiology" also
 * matches "cardiology"). Clinical analog of the reference's operative nouns.
 */
export const SPECIALTY_UMBRELLA_NOUNS: readonly string[] = [
  "cardiology",
  "cardiovascular",
  "oncology",
  "neurology",
  "trauma",
  "spine",
  "sports medicine",
  "critical care",
  "emergency",
  "surgery",
  "cath lab",
  "wound care",
  "labor and delivery",
  "pediatrics",
];

/* ------------------------------------------------------------------ */
/*  Role classes                                                       */
/* ------------------------------------------------------------------ */

export interface RoleClassDef {
  label: string;
  /**
   * Current-title match terms. Whole words/phrases only — v2 `[.]` is a
   * case-insensitive WHOLE-WORD / adjacent-phrase match (blueprint §5.7
   * measured table), so short tokens match their own token, not substrings.
   * Deliberately EXCLUDED short tokens whose whole-word sense collides:
   * "MD" (Managing Director), "DO" (English verb), "PA" (executive/personal
   * assistant, Pennsylvania). Those license classes ride the credential
   * criterion + grader instead.
   */
  terms: string[];
  note?: string;
}

export const ROLE_CLASSES: Record<string, RoleClassDef> = {
  nurse: {
    label: "Nurses",
    terms: ["nurse", "rn", "registered nurse", "staff nurse", "charge nurse", "lpn", "lvn"],
    note: "\"Nurse practitioner\" is a different license class — NP inclusion is the grader's judgment call, surfaced in its reason, never a silent filter decision.",
  },
  nurse_practitioner: {
    label: "Nurse Practitioners",
    terms: ["nurse practitioner", "np", "aprn", "fnp", "acnp", "agnp", "pmhnp"],
  },
  physician: {
    label: "Physicians",
    terms: [
      "physician", "doctor", "surgeon", "hospitalist", "attending",
      "cardiologist", "radiologist", "anesthesiologist", "pathologist",
      "dermatologist", "neurologist", "urologist", "oncologist",
      "gastroenterologist", "pulmonologist", "nephrologist",
      "endocrinologist", "rheumatologist", "ophthalmologist", "psychiatrist",
      "pediatrician", "internist", "intensivist", "neonatologist",
      "obstetrician", "gynecologist",
    ],
    note: "MD/DO alone are not title filters (whole-word \"MD\" is also Managing Director) — the credential criterion and grader verify the license.",
  },
  physician_assistant: {
    label: "Physician Assistants",
    terms: ["physician assistant", "physician associate", "pa-c"],
  },
  resident: {
    label: "Residents",
    terms: ["resident physician", "medical resident", "resident", "house officer", "chief resident"],
  },
  fellow: {
    label: "Fellows",
    terms: ["clinical fellow", "fellow", "fellowship"],
  },
  therapist: {
    label: "Therapists",
    terms: [
      "physical therapist", "occupational therapist", "respiratory therapist",
      "speech language pathologist", "therapist", "dpt",
    ],
  },
  pharmacist: {
    label: "Pharmacists",
    terms: ["pharmacist", "pharmd", "pharmacy manager", "clinical pharmacist"],
  },
  crna: {
    label: "CRNAs",
    terms: ["crna", "nurse anesthetist", "certified registered nurse anesthetist"],
  },
  dentist: {
    label: "Dentists",
    terms: ["dentist", "dds", "dmd", "orthodontist", "oral surgeon", "endodontist", "periodontist"],
  },
  podiatrist: {
    label: "Podiatrists",
    terms: ["podiatrist", "podiatric physician", "podiatric surgeon", "dpm"],
  },
  tech: {
    label: "Techs & Technologists",
    terms: [
      "technologist", "technician", "surgical tech", "radiologic technologist",
      "sonographer", "phlebotomist", "paramedic", "emt",
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Training stages                                                    */
/* ------------------------------------------------------------------ */

export interface TrainingStageDef {
  label: string;
  /** Generic current-title terms when no profession is stated. */
  genericTerms: readonly string[];
  /** Profession-qualified terms ("podiatric" → the 4 live spellings). */
  professionTerms: (profession: string) => string[];
  /** Typical program length in years (date-math hint for the grader). */
  typicalYears: Record<string, number> & { default: number };
}

export const TRAINING_STAGES: Record<string, TrainingStageDef> = {
  residency: {
    label: "Residents",
    genericTerms: ["resident physician", "medical resident", "resident"],
    // Probe log 2026-09-14: podiatr* residents live under FOUR spellings.
    // The pattern generalizes: "<profession> resident", "<profession>
    // residency", "<noun-form> resident", "resident physician".
    professionTerms: (profession: string) => {
      const p = profession.toLowerCase().trim();
      const out = new Set<string>([
        `${p} resident`,
        `${p} surgery resident`,
        `${p} surgical resident`,
        "resident physician",
      ]);
      // adjective/noun pairs the index actually carries (probe log)
      if (p === "podiatric" || p === "podiatry") {
        out.add("podiatry resident");
        out.add("podiatric resident");
        out.add("podiatric surgery resident");
        out.add("podiatric surgical resident");
      }
      return [...out];
    },
    typicalYears: { podiatric: 3, podiatry: 3, "family medicine": 3, "internal medicine": 3, pediatrics: 3, "emergency medicine": 3, "general surgery": 5, "orthopedic surgery": 5, neurosurgery: 7, default: 3 },
  },
  fellowship: {
    label: "Fellows",
    genericTerms: ["clinical fellow", "fellow"],
    professionTerms: (profession: string) => [
      `${profession.toLowerCase().trim()} fellow`,
      `${profession.toLowerCase().trim()} fellowship`,
      "clinical fellow",
    ],
    typicalYears: { default: 1 },
  },
  internship: {
    label: "Interns",
    genericTerms: ["intern", "medical intern"],
    professionTerms: (profession: string) => [
      `${profession.toLowerCase().trim()} intern`,
      "intern",
    ],
    typicalYears: { default: 1 },
  },
  medical_school: {
    label: "Medical Students",
    genericTerms: ["medical student", "medical students"],
    professionTerms: (profession: string) => [
      `${profession.toLowerCase().trim()} student`,
      "medical student",
    ],
    typicalYears: { default: 4 },
  },
};

/**
 * The PGY-pharmacy trap (probe log 2026-09-14): the top 25 live titles for
 * "pgy" are ALL pharmacy residents. Bare "PGY" must never be emitted as a
 * filter without profession context; when the ask is a physician-track
 * PGY-N, the year is verified by date math, not the token.
 */
export const PGY_TRAP_NOTE =
  "Bare 'PGY' matches pharmacy residents almost exclusively — never filter on it alone.";

/* ------------------------------------------------------------------ */
/*  Care settings (soft criteria)                                      */
/* ------------------------------------------------------------------ */

export interface CareSettingDef {
  label: string;
  terms: string[];
}

export const CARE_SETTINGS: Record<string, CareSettingDef> = {
  hospital: { label: "Hospital", terms: ["hospital", "medical center", "health system"] },
  asc: { label: "Ambulatory Surgery Center", terms: ["ambulatory surgery", "surgery center", "surgical center", "asc"] },
  clinic: { label: "Clinic / Outpatient", terms: ["clinic", "outpatient", "medical group", "practice"] },
  home_health: { label: "Home Health", terms: ["home health", "home care", "visiting nurse"] },
  ltc: { label: "Long-Term / Post-Acute Care", terms: ["skilled nursing", "long term care", "nursing home", "rehabilitation", "ltach"] },
  hospice: { label: "Hospice / Palliative", terms: ["hospice", "palliative"] },
  telehealth: { label: "Telehealth", terms: ["telehealth", "telemedicine", "virtual care", "remote patient"] },
};

/* ------------------------------------------------------------------ */
/*  Employer groups                                                    */
/* ------------------------------------------------------------------ */

export interface EmployerGroupDef {
  label: string;
  /** Lowercase phrases in a query that mean this group. */
  aliases: string[];
  /**
   * Anchor crustdata company ids, resolved via free /company/identify
   * 2026-09-14 (probe log). NEVER a bare short-token name filter ("VA").
   */
  company_ids: number[];
  domains: string[];
  /** Employer-name substring variants ORed in for entities the id set missed. */
  name_variants: string[];
}

export const EMPLOYER_GROUPS: Record<string, EmployerGroupDef> = {
  va: {
    label: "VA (Veterans Affairs)",
    aliases: ["the va", "va ", "veterans affairs", "veterans health", "veterans administration", "veterans health administration"],
    company_ids: [
      1129891, // U.S. Department of Veterans Affairs (va.gov, 10001+)
      6891547, // South Texas Veterans Health Care System
      7575637, // Gulf Coast Veterans Health Care System
      6820262, // Southeast Louisiana Veterans Health Care System
      12974094, // VA Pacific Island Health Care System
      8082851, // Salem VA (Veterans Health Administration)
    ],
    domains: ["va.gov"],
    name_variants: [
      "veterans affairs",
      "veterans health administration",
      "veterans health care system",
      "va medical center",
      "va healthcare system",
    ],
  },
  hca: {
    label: "HCA Healthcare",
    aliases: ["hca", "hca healthcare"],
    company_ids: [1125547],
    domains: ["hcahealthcare.com"],
    name_variants: ["hca healthcare", "medical city healthcare", "hca florida", "hca houston"],
  },
  kaiser: {
    label: "Kaiser Permanente",
    aliases: ["kaiser", "kaiser permanente"],
    company_ids: [],
    domains: ["kaiserpermanente.org", "kp.org"],
    name_variants: ["kaiser permanente", "kaiser foundation"],
  },
};

/* ------------------------------------------------------------------ */
/*  Credentials                                                        */
/* ------------------------------------------------------------------ */

/**
 * Credential tokens safe to emit as whole-word text filters on titles /
 * headline / education degree text. Short tokens with a colliding whole-word
 * sense are grader-only (GRADER_ONLY_CREDENTIALS).
 */
export const FILTERABLE_CREDENTIALS: ReadonlySet<string> = new Set([
  "rn", "bsn", "msn", "dnp", "np", "aprn", "fnp", "crna", "cnm",
  "lpn", "lvn", "cna", "pa-c", "dpm", "dds", "dmd", "pharmd", "dpt",
  "otr/l", "ccc-slp", "rrt", "rt(r)", "ccrn", "cnor", "cen",
]);

/** Credential asks the text filter must NOT enforce (whole-word collisions);
 *  the grader verifies them from the profile instead. */
export const GRADER_ONLY_CREDENTIALS: ReadonlySet<string> = new Set([
  "md", "do", "pa", "ma", "dc",
]);
