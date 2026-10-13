/**
 * clinical-vocabulary.ts — the healthcare domain model for search-clinicians.
 *
 * Sources:
 *  - the legacy config KEYWORD_EXPANSIONS (390 clinical entries, ported
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
  // Pain medicine (Neuvora beta 2026-09-20: "pain management" matched only as
  // a literal phrase — interventional pain, pain medicine, algology and
  // PM&R physicians were invisible; Memphis returned 2, Mississippi 12).
  "pain": { specialties: ["pain medicine"], keywords: ["pain management", "pain medicine"] },
  "pain management": { specialties: ["pain medicine"], keywords: ["pain management", "pain medicine", "interventional pain"] },
  "pain medicine": { specialties: ["pain medicine"], keywords: ["pain medicine", "pain management", "interventional pain"] },
  "interventional pain": { specialties: ["pain medicine"], keywords: ["interventional pain", "pain management"] },
  "chronic pain": { specialties: ["pain medicine"], keywords: ["chronic pain", "pain management"] },
  "algology": { specialties: ["pain medicine"], keywords: ["algology", "pain medicine"] },
  "physiatry": { specialties: ["physical medicine and rehabilitation"], keywords: ["physiatry", "physiatrist", "physical medicine and rehabilitation"] },
  "physiatrist": { specialties: ["physical medicine and rehabilitation"], keywords: ["physiatrist", "physical medicine and rehabilitation"] },
  "physiatrists": { specialties: ["physical medicine and rehabilitation"], keywords: ["physiatrist", "physical medicine and rehabilitation"] },
  "algologist": { specialties: ["pain medicine"], keywords: ["algology", "pain medicine"] },
  "algologists": { specialties: ["pain medicine"], keywords: ["algology", "pain medicine"] },
  "pm&r": { specialties: ["physical medicine and rehabilitation"], keywords: ["pm&r", "physical medicine and rehabilitation", "physiatry"] },
  "pmr": { specialties: ["physical medicine and rehabilitation"], keywords: ["pm&r", "physical medicine and rehabilitation", "physiatry"] },
  "physical medicine": { specialties: ["physical medicine and rehabilitation"], keywords: ["physical medicine and rehabilitation", "physiatry"] },
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
  pain_medicine: {
    label: "Pain Medicine",
    parent: "anesthesiology",
    aliases: [
      "pain medicine", "pain management", "interventional pain", "chronic pain",
      "pain physician", "pain specialist", "pain doctor", "algology", "pain",
    ],
    // Practitioners write their identity in procedure and setting language
    // far more than the phrase "pain management": the procedure terms carry
    // recall, the grader verifies they practice it now. PM&R / physiatry
    // rides along — the interventional-pain population is heavily physiatry.
    terms: [
      "pain medicine", "pain management", "interventional pain", "chronic pain",
      "pain physician", "pain specialist", "pain clinic", "pain center", "spine and pain",
      "algology", "algologist",
      "physiatry", "physiatrist", "physical medicine and rehabilitation", "pm&r",
      "anesthesiology pain", "anesthesia pain",
      "epidural", "nerve block", "radiofrequency ablation", "spinal cord stimulator",
      "spinal cord stimulation", "kyphoplasty", "vertebroplasty", "facet injection",
      "medial branch block", "intrathecal pump",
    ],
    education_terms: ["pain medicine", "pain management", "interventional pain", "physical medicine and rehabilitation"],
    siblings: ["anesthesiology", "physical medicine and rehabilitation", "neurology", "spine", "sports medicine"],
  },
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
/**
 * Whole-word containment. `includes` let the two-letter alias "ep"
 * (electrophysiology) fire on n-EP-hrology, h-EP-atology and r-EP-roductive,
 * routing renal and REI searches to cardiac EP. An alias must sit on word
 * boundaries; a trailing space in the alias ("va ") stays literal.
 */
export function containsWholePhrase(haystack: string, phrase: string): boolean {
  const h = haystack.toLowerCase();
  // Aliases were written with a trailing space as a crude boundary ("va ");
  // the boundary classes below make that explicit, so trim first.
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (h === p) return true;
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(h);
}

export function matchSubspecialty(phrase: string): { key: string; def: SubspecialtyDef } | null {
  const p = phrase.toLowerCase().trim();
  if (!p) return null;
  for (const [key, def] of Object.entries(SUBSPECIALTIES)) {
    if (def.aliases.some((a) => containsWholePhrase(p, a))) return { key, def };
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
      "orthopedist", "orthopaedist",
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
  surgeon: {
    label: "Surgeons",
    // "X surgeons" is a SURGICAL population, not the whole physician class.
    // When a specialty is stated the mapper REPLACES this bare term with the
    // composed forms from surgeonTitleTerms() ("orthopedic surgeon",
    // "orthopedist", "spine surgeon"…) plus an employer-qualified arm; the
    // bare word stands only for an unqualified "surgeons" ask. Live failure
    // 2026-10-12 (orthopedic surgeons, Miami): the physician class matched
    // "Doctor of Physical Therapy", "Physician Assistant", "Physician
    // Recruiter" and "partnering with surgeons" headlines — 37 of 50 rows.
    terms: ["surgeon"],
    note: "Matched on surgeon-shaped titles composed with the stated specialty; non-surgeon clinicians, recruiters and vendors are filtered before grading.",
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

/* ------------------------------------------------------------------ */
/*  Surgeon composition + role-class noise (2026-10-12)                 */
/* ------------------------------------------------------------------ */

/**
 * Extra title forms per specialty ROOT (the specialty phrase with a trailing
 * "surgery"/"surgeon(s)" stripped). The generic rule already yields
 * "<root> surgeon" and "<root> surgery"; this table adds the -ist forms and
 * the subspecialty surgeon titles people actually carry. The builder's
 * lexicalVariants() adds ae/e spellings and plurals, so "orthopedist" also
 * covers "orthopaedist(s)" and "orthopedics" is reached from "orthopedic".
 */
export const SURGEON_TITLE_FORMS: Record<string, string[]> = {
  orthopedic: [
    "orthopedist", "orthopedics",
    "spine surgeon", "hand surgeon", "foot and ankle surgeon", "sports medicine surgeon",
    "joint replacement surgeon", "arthroplasty surgeon", "shoulder surgeon",
    "orthopedic traumatologist", "pediatric orthopedic surgeon", "orthopedic oncologist",
  ],
  orthopaedic: ["orthopaedist", "orthopaedics"],
  ortho: ["orthopedic surgeon", "orthopedist"],
  spine: ["spine surgeon", "spinal surgeon"],
  neuro: ["neurosurgeon", "neurosurgery", "neurological surgeon"],
  neurological: ["neurosurgeon", "neurosurgery"],
  neurosurgery: ["neurosurgeon"],
  plastic: ["plastic surgeon", "cosmetic surgeon", "aesthetic surgeon", "reconstructive surgeon"],
  cardiothoracic: ["cardiac surgeon", "heart surgeon", "thoracic surgeon", "cardiovascular surgeon"],
  cardiac: ["cardiothoracic surgeon", "heart surgeon", "cardiovascular surgeon"],
  cardiovascular: ["cardiothoracic surgeon", "cardiac surgeon", "heart surgeon"],
  vascular: ["vascular surgeon", "endovascular surgeon"],
  general: ["general surgeon"],
  colorectal: ["colorectal surgeon", "colon and rectal surgeon"],
  bariatric: ["bariatric surgeon", "metabolic surgeon"],
  thoracic: ["thoracic surgeon"],
  transplant: ["transplant surgeon"],
  trauma: ["trauma surgeon", "acute care surgeon"],
  oral: ["oral surgeon", "oral and maxillofacial surgeon", "maxillofacial surgeon"],
  maxillofacial: ["oral and maxillofacial surgeon"],
  ent: ["otolaryngologist", "head and neck surgeon", "ent surgeon"],
  otolaryngology: ["otolaryngologist", "head and neck surgeon"],
  urologic: ["urologist", "urological surgeon"],
  urology: ["urologist", "urological surgeon"],
  ophthalmic: ["ophthalmologist", "eye surgeon"],
  ophthalmology: ["ophthalmologist", "eye surgeon"],
  gynecologic: ["gynecologic surgeon", "gynecologic oncologist"],
  pediatric: ["pediatric surgeon"],
  hand: ["hand surgeon", "upper extremity surgeon"],
  "foot and ankle": ["foot and ankle surgeon"],
  breast: ["breast surgeon", "breast surgical oncologist"],
  surgical: ["surgical oncologist"],
};

/** Abbreviated employer-name tokens per specialty root ("Ortho Miami"). */
const SPECIALTY_EMPLOYER_ABBREVIATIONS: Record<string, string[]> = {
  orthopedic: ["ortho", "orthopedics", "orthopaedics", "bone and joint", "bone & joint", "sports medicine"],
  orthopaedic: ["ortho", "orthopaedics"],
  neuro: ["neurosurgery", "neurosurgical", "brain and spine"],
  plastic: ["plastic surgery", "aesthetic", "cosmetic surgery"],
  spine: ["spine", "brain and spine"],
};

/**
 * Reduce a stated specialty phrase to its surgical ROOT:
 *   "orthopedic surgery" → "orthopedic"; "spine surgeons" → "spine";
 *   "neurosurgery" → "neurosurgery" (compound word, kept whole).
 */
export function specialtyRoot(phrase: string): string {
  return phrase.toLowerCase().trim()
    .replace(/\s+surgeons?$/, "")
    .replace(/\s+surgery$/, "")
    .replace(/\s+surgical$/, "")
    .trim();
}

/**
 * Title/headline match terms for "<specialty> surgeons". Composed, never a
 * bare "surgeon"/"doctor"/"physician": every term names the surgical
 * population itself. The builder adds spelling and plural variants.
 */
export function surgeonTitleTerms(specialties: readonly string[]): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    const v = t.toLowerCase().trim();
    if (v && !out.includes(v)) out.push(v);
  };
  for (const phrase of specialties) {
    const root = specialtyRoot(phrase);
    if (!root) continue;
    if (/surgery$/.test(root) && !/\s/.test(root)) {
      // "neurosurgery": the compound noun is itself a title token and the
      // table carries the -surgeon form.
      add(root);
    } else {
      add(`${root} surgeon`);
      add(`${root} surgery`);
    }
    for (const extra of SURGEON_TITLE_FORMS[root] ?? []) add(extra);
  }
  return out;
}

/**
 * Generic physician words for the EMPLOYER-QUALIFIED arm of a surgeon ask:
 * "Medical Doctor at Orthopedic Care Partners", "Physician & Founder" at a
 * Foot & Ankle institute. Only ever ANDed with a specialty-named employer,
 * never a free-standing gate. "md" is allowed here because the employer
 * clause pins it to a clinical practice (and the noise filter drops
 * managing directors).
 */
export const PHYSICIAN_GENERIC_TERMS: readonly string[] = [
  "physician", "surgeon", "attending", "medical doctor", "md", "chief of surgery",
];

/** Employer-name terms that identify a specialty practice for that arm. */
export function specialtyEmployerTerms(specialties: readonly string[]): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    const v = t.toLowerCase().trim();
    if (v && !out.includes(v)) out.push(v);
  };
  for (const phrase of specialties) {
    const root = specialtyRoot(phrase);
    if (!root) continue;
    add(root);
    add(`${root} surgery`);
    for (const extra of SPECIALTY_EMPLOYER_ABBREVIATIONS[root] ?? []) add(extra);
  }
  return out;
}

/**
 * Role-class NOISE: title/headline patterns that prove a row is NOT in the
 * asked license class even though a loose word matched. Applied in-process
 * (noise-filter.ts) before the grader, so the engine never pays a model
 * call to reject a physical therapist for a surgeon ask. Every pattern was
 * seen live on 2026-10-12 (Miami orthopedic surgeons) or in the probe log.
 * Keyed by role class; classes absent here are never filtered.
 */
const PHYSICIAN_NOISE: readonly RegExp[] = [
  /\bphysician (assistant|associate)s?\b/i,
  /\bpa-c\b/i,
  /\bphysical therap/i,
  /\bdoctor of physical therapy\b/i,
  /\bdpt\b/i,
  /\boccupational therap/i,
  /\brespiratory therap/i,
  /\bathletic trainer/i,
  /\bchiropract/i,
  /\bpodiatr/i,
  /\bdpm\b/i,
  /\bacupunctur/i,
  /\bnurse\b/i,
  /\bnursing\b/i,
  /\b(rn|np|aprn|fnp|crna|lpn)\b/i,
  /\brecruit/i,
  /\bstaffing\b/i,
  /\btalent acquisition\b/i,
  /\bplacement\b/i,
  /\bsales\b/i,
  /\baccount (executive|manager)\b/i,
  /\bterritory\b/i,
  /\bbusiness development\b/i,
  /\bmarketing\b/i,
  /\bmanaging director\b/i,
  /\bmedical device/i,
  /\bdistributor/i,
  /\bscribe/i,
  /\bmedical student/i,
  /\bpharmac/i,
  /\bdentist|\bdds\b|\bdmd\b/i,
  /\bdoctor of business|\bdba\b/i,
  /\bveterinar/i,
];

export const ROLE_CLASS_NOISE: Record<string, readonly RegExp[]> = {
  physician: PHYSICIAN_NOISE,
  surgeon: PHYSICIAN_NOISE,
  resident: [
    /\bpharmacy resident/i,
    /\brecruit/i,
    /\bstaffing\b/i,
    /\bsales\b/i,
  ],
};

/* ------------------------------------------------------------------ */
/*  Employment model: hospital-employed vs private practice (2026-10-13) */
/* ------------------------------------------------------------------ */

/**
 * The dimension recruiters mean by "private practice" vs "hospital-
 * employed": WHO SIGNS THE PAYCHECK. Binary by decision (Steven,
 * 2026-10-13): hospitals, health systems, academic medical centers,
 * government (VA, county, IHS) and the physician groups those systems own
 * are "hospital_employed"; every other care-delivery employer — solo and
 * group practices, ASCs, dental practices, DSOs, PE-backed groups — is
 * "private_practice".
 */
export type EmploymentModel = "hospital_employed" | "private_practice";

export interface EmploymentModelDef {
  label: string;
  /** Query phrasing that asks for this model (backstop when the parser misses). */
  phrases: readonly RegExp[];
}

export const EMPLOYMENT_MODELS: Record<EmploymentModel, EmploymentModelDef> = {
  private_practice: {
    label: "Private practice",
    phrases: [
      /\bprivate[- ]practice\b/i,
      /\bindependent (practice|practitioner|physician|doctor|dentist|group)s?\b/i,
      /\bphysician[- ]owned\b/i,
      /\bdoctor[- ]owned\b/i,
      /\bself[- ]employed\b/i,
      /\bsolo (practice|practitioner)s?\b/i,
      /\bpractice owners?\b/i,
      /\bown(s|ing)? (their|his|her|a) (own )?practice\b/i,
      /\b(not|non)[- ]?hospital[- ]?(employed|affiliated|based|owned)\b/i,
      /\bnot employed by (a |the )?(hospital|health system)s?\b/i,
      /\boutside (of )?(a |the )?(hospital|health) system\b/i,
      /\bnon[- ]?(academic|system)\b/i,
    ],
  },
  hospital_employed: {
    label: "Hospital-employed",
    phrases: [
      /\bhospital[- ](employed|based|owned)\b/i,
      /\bemployed (by|at|with) (a |the )?(hospital|health system|medical center|academic)/i,
      /\bhealth[- ]system[- ]employed\b/i,
      /\bsystem[- ]employed\b/i,
      /\bacademic (physician|surgeon|doctor|faculty|dentist)s?\b/i,
      /\b(work|working|practicing) (at|in|for) (a |the )?hospital\b/i,
    ],
  },
};

/**
 * Employer-name tokens that mean a hospital, health system, academic
 * medical center or government care delivery — i.e. hospital-employed.
 * Whole words/phrases; matched case-insensitively on the employer name.
 */
export const HOSPITAL_SYSTEM_TOKENS: readonly string[] = [
  "hospital", "hospitals", "health system", "healthcare system", "health care system",
  "health network", "medical center", "medical centre", "health sciences center",
  "university", "school of medicine", "college of medicine", "medical school",
  "faculty practice", "faculty physicians", "academic medical",
  "veterans affairs", "veterans health", "va medical", "department of veterans",
  "indian health service", "county health", "public health", "department of health",
  "military", "army", "navy", "air force", "naval hospital", "medical command",
  "children's hospital", "childrens hospital", "cancer center", "cancer institute",
  "regional medical", "community health center", "fqhc", "health district",
];

/**
 * Health-system BRANDS whose employed-physician groups look like practices
 * by name ("Baptist Health Medical Group", "HCA Florida Physicians",
 * "Memorial Physician Group", "UHealth"). A name that starts with or
 * contains one of these is hospital-employed whatever follows.
 */
export const HEALTH_SYSTEM_BRANDS: readonly string[] = [
  // national / multi-state
  "hca", "hca healthcare", "hca florida", "commonspirit", "common spirit", "ascension",
  "adventhealth", "advent health", "trinity health", "tenet", "community health systems",
  "lifepoint", "universal health services", "uhs", "prime healthcare", "steward",
  "providence", "sutter", "intermountain", "banner health", "geisinger", "northwell",
  "kaiser", "permanente", "mayo clinic", "cleveland clinic", "johns hopkins",
  "mass general", "massachusetts general", "brigham", "nyu langone", "mount sinai",
  "cedars-sinai", "cedars sinai", "houston methodist", "memorial hermann", "ochsner",
  "atrium health", "novant", "advocate", "aurora health", "sanford health", "scripps",
  "sharp healthcare", "dignity health", "baylor scott", "ut southwestern", "ut health",
  "uchealth", "uc health", "ucla health", "ucsf", "stanford health", "duke health",
  "emory healthcare", "piedmont", "wellstar", "orlando health", "tampa general",
  "baycare", "lee health", "nch healthcare", "sarasota memorial",
  // south florida
  "baptist health", "jackson health", "jackson memorial", "memorial healthcare",
  "memorial physician", "uhealth", "university of miami health", "miller school",
  "mount sinai medical center", "holy cross", "broward health", "cleveland clinic florida",
  "nicklaus children", "joe dimaggio", "larkin community", "hialeah hospital",
  "palm beach health", "jupiter medical", "boca raton regional", "bethesda hospital",
];

/**
 * Employer-name tokens that mean an independent care-delivery practice.
 * Positive recall terms for the provider-side clause; the in-process
 * classifier still lets a system brand override them.
 */
export const PRIVATE_PRACTICE_TOKENS: readonly string[] = [
  "associates", "and associates", "& associates", "partners", "group", "medical group",
  "physicians group", "physician group", "medical associates", "specialists", "specialty",
  "clinic", "clinics", "practice", "family practice", "institute", "center", "centre",
  "surgery center", "surgical center", "surgicenter", "surgeons", "physicians",
  "orthopedics", "orthopaedics", "orthopedic", "orthopaedic", "sports medicine",
  "spine", "pain", "dermatology", "dental", "dentistry", "orthodontics", "oral surgery",
  "eye", "vision", "ophthalmology", "ent", "allergy", "cardiology", "gastroenterology",
  "urology", "neurology", "pediatrics", "women's", "ob/gyn", "obgyn", "obstetrics",
  "podiatry", "foot and ankle", "foot & ankle", "plastic surgery", "aesthetics",
  "md pa", "m.d. p.a.", "md, pa", "pa", "p.a.", "pllc", "llc", "llp", "inc",
  "dds", "dmd", "do pa", "m.d.", "md",
];

/** Headcount at or above which an unbranded employer is treated as a system. */
export const SYSTEM_HEADCOUNT_FLOOR = 1001;
/** Headcount at or below which an employer is practice-sized (0 = untracked). */
export const PRACTICE_HEADCOUNT_CAP = 250;
