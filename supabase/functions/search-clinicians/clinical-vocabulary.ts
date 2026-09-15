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

/* ------------------------------------------------------------------ */
/*  Subspecialty depth — the market gap (Steven, 2026-09-15)            */
/* ------------------------------------------------------------------ */

/**
 * Subspecialty families: the layer BELOW "orthopedic surgeon" where generic
 * tools stop. Each entry maps a subspecialty to the terms that actually
 * appear on profiles — probed live 2026-09-15: subspecialty evidence lives
 * in PROCEDURE language (skills: "Total Knee Arthroplasty", "Hip and Knee
 * Arthroplasty"), FELLOWSHIP language (titles: "Arthroplasty Fellow";
 * education field_of_study: "Adult Reconstruction Fellowship"), and role
 * descriptions — almost never in the person's title alone.
 *
 * `terms` are search surfaces (headline/title/summary/descriptions/skills);
 * `education_terms` additionally match fellowship training records.
 * `siblings` name the adjacent subspecialties for the grader (exact = strong,
 * sibling = weak with the sibling named, unrelated = reject).
 */
export interface SubspecialtyDef {
  label: string;
  parent: string;
  /** Query phrases that mean this subspecialty. */
  aliases: string[];
  terms: string[];
  education_terms: string[];
  siblings: string[];
}

export const SUBSPECIALTIES: Record<string, SubspecialtyDef> = {
  joint_reconstruction: {
    label: "Joint Reconstruction",
    parent: "orthopedic",
    aliases: ["joint reconstruction", "joint medicine", "adult reconstruction", "total joints", "joint replacement", "arthroplasty", "hip and knee"],
    terms: [
      "joint replacement", "arthroplasty", "total joint", "adult reconstruction",
      "hip and knee", "total knee", "total hip", "knee replacement", "hip replacement",
      "revision arthroplasty",
    ],
    education_terms: ["adult reconstruction", "arthroplasty", "joint replacement"],
    siblings: ["spine", "sports medicine", "trauma", "foot and ankle", "hand"],
  },
  spine: {
    label: "Spine",
    parent: "orthopedic",
    aliases: ["spine", "spine surgery", "spinal surgery"],
    terms: [
      "spine surgery", "spine surgeon", "spinal", "spine", "scoliosis",
      "spinal deformity", "minimally invasive spine", "cervical spine", "lumbar",
    ],
    education_terms: ["spine surgery", "spine"],
    siblings: ["joint reconstruction", "neurosurgery", "trauma"],
  },
  sports_medicine: {
    label: "Sports Medicine",
    parent: "orthopedic",
    aliases: ["sports medicine", "sports med", "sports"],
    terms: [
      "sports medicine", "arthroscopy", "arthroscopic", "acl", "rotator cuff",
      "cartilage restoration", "team physician",
    ],
    education_terms: ["sports medicine"],
    siblings: ["joint reconstruction", "shoulder and elbow", "hand"],
  },
  foot_ankle: {
    label: "Foot & Ankle",
    parent: "orthopedic",
    aliases: ["foot and ankle", "foot & ankle"],
    terms: ["foot and ankle", "foot & ankle", "ankle reconstruction", "podiatric surgery"],
    education_terms: ["foot and ankle"],
    siblings: ["joint reconstruction", "sports medicine", "trauma"],
  },
  hand: {
    label: "Hand & Upper Extremity",
    parent: "orthopedic",
    aliases: ["hand surgery", "hand and upper extremity", "upper extremity"],
    terms: ["hand surgery", "upper extremity", "hand surgeon", "microsurgery", "wrist"],
    education_terms: ["hand surgery", "hand and upper extremity"],
    siblings: ["sports medicine", "shoulder and elbow"],
  },
  shoulder_elbow: {
    label: "Shoulder & Elbow",
    parent: "orthopedic",
    aliases: ["shoulder and elbow", "shoulder surgery"],
    terms: ["shoulder and elbow", "shoulder arthroplasty", "shoulder replacement", "reverse total shoulder"],
    education_terms: ["shoulder and elbow"],
    siblings: ["sports medicine", "hand", "joint reconstruction"],
  },
  ortho_trauma: {
    label: "Orthopedic Trauma",
    parent: "orthopedic",
    aliases: ["orthopedic trauma", "ortho trauma", "fracture care"],
    terms: ["orthopedic trauma", "orthopaedic trauma", "fracture", "trauma surgery", "polytrauma"],
    education_terms: ["orthopaedic trauma", "orthopedic trauma"],
    siblings: ["joint reconstruction", "spine", "foot and ankle"],
  },
  ortho_oncology: {
    label: "Orthopedic Oncology",
    parent: "orthopedic",
    aliases: ["orthopedic oncology", "musculoskeletal oncology"],
    terms: ["orthopedic oncology", "orthopaedic oncology", "musculoskeletal oncology", "sarcoma", "limb salvage"],
    education_terms: ["musculoskeletal oncology", "orthopaedic oncology"],
    siblings: ["joint reconstruction", "trauma"],
  },
  neurovascular: {
    label: "Neurovascular",
    parent: "neurology",
    aliases: ["neurovascular", "neurointerventional", "endovascular neurosurgery", "vascular neurology"],
    terms: [
      "neurovascular", "neurointerventional", "endovascular", "stroke",
      "aneurysm", "thrombectomy", "cerebrovascular", "vascular neurology",
      "neuro interventional",
    ],
    education_terms: ["vascular neurology", "endovascular", "neurointerventional"],
    siblings: ["neurocritical care", "interventional radiology", "neurosurgery"],
  },
  electrophysiology: {
    label: "Electrophysiology",
    parent: "cardiology",
    aliases: ["electrophysiology", "ep", "cardiac electrophysiology"],
    terms: ["electrophysiology", "electrophysiologist", "ablation", "arrhythmia", "pacemaker", "afib"],
    education_terms: ["electrophysiology", "clinical cardiac electrophysiology"],
    siblings: ["interventional cardiology", "structural heart", "heart failure"],
  },
  interventional_cardiology: {
    label: "Interventional Cardiology",
    parent: "cardiology",
    aliases: ["interventional cardiology", "interventional cardiologist"],
    terms: ["interventional cardiology", "interventional cardiologist", "cath lab", "pci", "angioplasty", "coronary intervention"],
    education_terms: ["interventional cardiology"],
    siblings: ["structural heart", "electrophysiology", "heart failure"],
  },
  structural_heart: {
    label: "Structural Heart",
    parent: "cardiology",
    aliases: ["structural heart", "structural cardiology"],
    terms: ["structural heart", "tavr", "transcatheter", "mitral valve", "watchman", "valve replacement"],
    education_terms: ["structural heart", "structural intervention"],
    siblings: ["interventional cardiology", "cardiac surgery"],
  },
  heart_failure: {
    label: "Advanced Heart Failure",
    parent: "cardiology",
    aliases: ["heart failure", "advanced heart failure", "transplant cardiology"],
    terms: ["heart failure", "advanced heart failure", "lvad", "mechanical circulatory support", "transplant cardiology"],
    education_terms: ["advanced heart failure", "transplant cardiology"],
    siblings: ["interventional cardiology", "electrophysiology"],
  },
  cv_surgery: {
    label: "Cardiovascular / Cardiothoracic Surgery",
    parent: "surgery",
    aliases: [
      "cardiovascular surgery", "cardiovascular surgeon", "cardiothoracic",
      "cardiac surgery", "cardiac surgeon", "heart surgery", "ct surgery",
      "cardiothoracic surgery", "cardiothoracic surgeon",
    ],
    // Probed live 2026-09-15: Cardiothoracic Surgeon / Cardiovascular
    // Surgeon / Cardiothoracic Surgery Fellow all real index titles.
    terms: [
      "cardiothoracic", "cardiovascular surgery", "cardiovascular surgeon",
      "cardiac surgery", "cardiac surgeon", "heart surgery", "cabg",
      "valve surgery", "aortic surgery",
    ],
    education_terms: ["cardiothoracic surgery", "cardiovascular surgery", "cardiac surgery", "thoracic surgery"],
    siblings: ["vascular surgery", "interventional cardiology", "structural heart", "thoracic surgery"],
  },
  mohs: {
    label: "Mohs Surgery",
    parent: "dermatology",
    aliases: ["mohs", "mohs surgery", "micrographic surgery"],
    terms: ["mohs", "micrographic surgery", "dermatologic surgery"],
    education_terms: ["micrographic surgery", "mohs"],
    siblings: ["dermatopathology", "cosmetic dermatology"],
  },
  gi_advanced_endoscopy: {
    label: "Advanced Endoscopy",
    parent: "gastroenterology",
    aliases: ["advanced endoscopy", "therapeutic endoscopy", "interventional endoscopy"],
    terms: ["advanced endoscopy", "therapeutic endoscopy", "ercp", "endoscopic ultrasound", "interventional endoscopy"],
    education_terms: ["advanced endoscopy", "therapeutic endoscopy"],
    siblings: ["hepatology", "ibd"],
  },
  peds_hem_onc: {
    label: "Pediatric Hematology-Oncology",
    parent: "pediatrics",
    aliases: [
      "pediatric oncology", "pediatric oncologist", "peds onc", "peds hem onc",
      "pediatric hematology oncology", "pediatric hematology-oncology",
      "pediatric hematology/oncology", "childhood cancer", "pediatric cancer",
    ],
    // Probed live 2026-09-15: Pediatric Oncologist is a real title; the
    // fellowship lives in FOUR connector spellings (slash/hyphen/space/and).
    terms: [
      "pediatric oncology", "pediatric oncologist", "pediatric hematology",
      "pediatric hematology/oncology", "pediatric hematology and oncology",
      "childhood cancer", "pediatric cancer",
    ],
    education_terms: ["pediatric hematology", "pediatric oncology", "pediatric hematology/oncology"],
    siblings: ["adult oncology", "pediatric critical care", "neonatology", "hematology"],
  },
  mfm: {
    label: "Maternal-Fetal Medicine",
    parent: "obstetrics and gynecology",
    aliases: ["maternal fetal medicine", "maternal-fetal medicine", "mfm", "perinatology"],
    terms: ["maternal fetal medicine", "maternal-fetal", "perinatology", "high risk pregnancy", "high-risk obstetrics"],
    education_terms: ["maternal fetal medicine", "perinatology"],
    siblings: ["reproductive endocrinology", "gynecologic oncology"],
  },
};

/* ------------------------------------------------------------------ */
/*  Population modifiers (the "pediatric X" problem, 2026-09-15)        */
/* ------------------------------------------------------------------ */

/**
 * Patient-population modifiers that change WHO a specialist treats.
 * "Pediatric cardiology" must NOT dilute to bare "cardiology" in one
 * OR-group (every adult cardiologist would satisfy it) — the mapper splits
 * a modifier+specialty compound with no dedicated subspecialty entry into
 * TWO AND-ed criteria: the population group and the specialty group.
 */
export const POPULATION_MODIFIERS: Record<string, { label: string; terms: string[] }> = {
  pediatric: {
    label: "Pediatric",
    terms: ["pediatric", "paediatric", "children's", "childrens", "peds"],
  },
  neonatal: {
    label: "Neonatal",
    terms: ["neonatal", "nicu", "newborn"],
  },
  adolescent: {
    label: "Adolescent",
    terms: ["adolescent", "teen"],
  },
  geriatric: {
    label: "Geriatric",
    terms: ["geriatric", "older adult", "senior care"],
  },
};

/** Leading population modifier of a specialty phrase, if any. */
export function matchPopulationModifier(
  phrase: string,
): { key: string; label: string; terms: string[]; base: string } | null {
  const p = phrase.toLowerCase().trim();
  for (const [key, def] of Object.entries(POPULATION_MODIFIERS)) {
    for (const alias of [key, ...def.terms]) {
      if (p.startsWith(alias + " ")) {
        const base = p.slice(alias.length + 1).trim();
        if (base) return { key, label: def.label, terms: [...def.terms], base };
      }
    }
  }
  return null;
}

/** Resolve a query phrase to a subspecialty definition, if it names one. */
export function matchSubspecialty(phrase: string): { key: string; def: SubspecialtyDef } | null {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;
  for (const [key, def] of Object.entries(SUBSPECIALTIES)) {
    if (def.aliases.some((a) => p === a || p.includes(a))) return { key, def };
  }
  return null;
}

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
    // Probed 2026-09-15: "Nurse Anesthesiologist" is a live title, and so
    // are the MISSPELLINGS people put on their own profiles ("Nurse
    // Anesthesist", "Nurse Anesthestist") — real recall, so they match.
    terms: [
      "crna", "nurse anesthetist", "certified registered nurse anesthetist",
      "nurse anesthesiologist", "nurse anesthesist", "nurse anesthestist",
    ],
  },
  srna: {
    label: "SRNAs (Nurse Anesthesia Students)",
    // Probed 2026-09-15: SRNA, the spelled-out form, Nurse Anesthesia
    // Student/Resident, and RRNA (the newer "resident" term) all live.
    terms: [
      "srna", "student registered nurse anesthetist", "nurse anesthesia student",
      "nurse anesthesia resident", "rrna", "resident registered nurse anesthetist",
    ],
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
  /** Ranking terms (role text, headline). */
  terms: string[];
  /**
   * Employer-NAME terms for the HARD workplace gate ("nurses that work in
   * surgery centers"): US facilities carry their setting in their legal
   * name — probed live 2026-09-15, ASCs are literally "Surgery Center of
   * X". Used only when the query makes the setting the workplace.
   */
  employer_name_terms: string[];
}

export const CARE_SETTINGS: Record<string, CareSettingDef> = {
  hospital: {
    label: "Hospital",
    terms: ["hospital", "medical center", "health system"],
    employer_name_terms: ["hospital", "medical center", "health system", "medical centre"],
  },
  asc: {
    label: "Ambulatory Surgery Center",
    terms: ["ambulatory surgery", "surgery center", "surgical center", "asc"],
    employer_name_terms: ["surgery center", "surgical center", "ambulatory surgery", "surgicenter", "surgery centre"],
  },
  clinic: {
    label: "Clinic / Outpatient",
    terms: ["clinic", "outpatient", "medical group", "practice"],
    employer_name_terms: ["clinic", "medical group", "medical associates", "physicians group", "family practice"],
  },
  home_health: {
    label: "Home Health",
    terms: ["home health", "home care", "visiting nurse"],
    employer_name_terms: ["home health", "home care", "visiting nurse"],
  },
  ltc: {
    label: "Long-Term / Post-Acute Care",
    terms: ["skilled nursing", "long term care", "nursing home", "rehabilitation", "ltach"],
    employer_name_terms: ["skilled nursing", "nursing home", "rehabilitation", "senior living", "care center"],
  },
  hospice: {
    label: "Hospice / Palliative",
    terms: ["hospice", "palliative"],
    employer_name_terms: ["hospice", "palliative"],
  },
  telehealth: {
    label: "Telehealth",
    terms: ["telehealth", "telemedicine", "virtual care", "remote patient"],
    employer_name_terms: ["telehealth", "telemedicine", "virtual care"],
  },
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
