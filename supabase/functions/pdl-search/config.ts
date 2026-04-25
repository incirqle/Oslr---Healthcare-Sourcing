/**
 * config.ts — Clinical healthcare constants, keyword expansions, metro maps.
 * Adapted from RepGPT's medical device config for clinical healthcare professionals.
 */

/* ------------------------------------------------------------------ */
/* Clinical Specialty Keyword Expansions                                */
/* ------------------------------------------------------------------ */
export const KEYWORD_EXPANSIONS: Record<string, { specialties: string[]; keywords: string[] }> = {
  // Cardiology
  "cardio": { specialties: ["cardiology"], keywords: ["cardiology", "cardiac", "cardiovascular"] },
  "cardiac": { specialties: ["cardiology"], keywords: ["cardiology", "cardiac"] },
  "cardiology": { specialties: ["cardiology"], keywords: ["cardiology", "cardiac", "cardiovascular"] },
  "cardiovascular": { specialties: ["cardiology"], keywords: ["cardiovascular", "cardiac"] },
  "heart": { specialties: ["cardiology"], keywords: ["cardiac", "cardiology"] },
  "interventional cardiology": { specialties: ["interventional cardiology"], keywords: ["interventional", "cardiac catheterization"] },

  // Orthopedics
  "ortho": { specialties: ["orthopedics"], keywords: ["orthopedic", "orthopedics"] },
  "orthopedic": { specialties: ["orthopedics"], keywords: ["orthopedic", "orthopedics"] },
  "orthopedics": { specialties: ["orthopedics"], keywords: ["orthopedic", "musculoskeletal"] },
  "orthopaedic": { specialties: ["orthopedics"], keywords: ["orthopedic", "orthopaedic"] },

  // Oncology
  "oncology": { specialties: ["oncology"], keywords: ["oncology", "cancer"] },
  "cancer": { specialties: ["oncology"], keywords: ["oncology", "cancer", "tumor"] },
  "hematology": { specialties: ["hematology/oncology"], keywords: ["hematology", "oncology"] },
  "hem onc": { specialties: ["hematology/oncology"], keywords: ["hematology", "oncology"] },

  // Neurology / Neurosurgery
  "neuro": { specialties: ["neurology"], keywords: ["neurology", "neurological"] },
  "neurology": { specialties: ["neurology"], keywords: ["neurology", "neurological"] },
  "neurosurgery": { specialties: ["neurosurgery"], keywords: ["neurosurgery", "neurological"] },

  // Emergency / Critical Care
  "er": { specialties: ["emergency medicine"], keywords: ["emergency", "emergency medicine"] },
  "emergency": { specialties: ["emergency medicine"], keywords: ["emergency medicine", "emergency department"] },
  "emergency medicine": { specialties: ["emergency medicine"], keywords: ["emergency medicine", "emergency department", "ED"] },
  "icu": { specialties: ["critical care"], keywords: ["intensive care", "critical care", "ICU"] },
  "critical care": { specialties: ["critical care"], keywords: ["critical care", "intensive care"] },

  // Surgery
  "surgery": { specialties: ["surgery"], keywords: ["surgery", "surgical"] },
  "surgical": { specialties: ["surgery"], keywords: ["surgery", "surgical"] },
  "general surgery": { specialties: ["general surgery"], keywords: ["general surgery", "surgeon"] },

  // Primary Care / Internal Medicine
  "primary care": { specialties: ["primary care"], keywords: ["primary care", "family medicine", "internal medicine"] },
  "family medicine": { specialties: ["family medicine"], keywords: ["family medicine", "family practice", "primary care"] },
  "family practice": { specialties: ["family medicine"], keywords: ["family medicine", "family practice"] },
  "internal medicine": { specialties: ["internal medicine"], keywords: ["internal medicine", "internist"] },
  "im": { specialties: ["internal medicine"], keywords: ["internal medicine"] },

  // Pediatrics
  "peds": { specialties: ["pediatrics"], keywords: ["pediatrics", "pediatric"] },
  "pediatrics": { specialties: ["pediatrics"], keywords: ["pediatrics", "pediatric", "children"] },
  "pediatric": { specialties: ["pediatrics"], keywords: ["pediatrics", "pediatric"] },
  "nicu": { specialties: ["neonatology"], keywords: ["neonatal", "NICU", "neonatology"] },

  // OB/GYN
  "obgyn": { specialties: ["obstetrics/gynecology"], keywords: ["obstetrics", "gynecology", "OB/GYN"] },
  "ob/gyn": { specialties: ["obstetrics/gynecology"], keywords: ["obstetrics", "gynecology"] },
  "obstetrics": { specialties: ["obstetrics/gynecology"], keywords: ["obstetrics", "OB/GYN"] },
  "gynecology": { specialties: ["obstetrics/gynecology"], keywords: ["gynecology", "OB/GYN"] },
  "labor and delivery": { specialties: ["obstetrics/gynecology"], keywords: ["labor and delivery", "L&D", "obstetrics"] },

  // Psychiatry / Behavioral Health
  "psychiatry": { specialties: ["psychiatry"], keywords: ["psychiatry", "psychiatric", "behavioral health"] },
  "behavioral health": { specialties: ["behavioral health"], keywords: ["behavioral health", "mental health", "psychiatry"] },

  // Radiology
  "radiology": { specialties: ["radiology"], keywords: ["radiology", "radiologist", "imaging"] },

  // Anesthesiology
  "anesthesia": { specialties: ["anesthesiology"], keywords: ["anesthesiology", "anesthesia"] },
  "anesthesiology": { specialties: ["anesthesiology"], keywords: ["anesthesiology", "anesthesia"] },
  "crna": { specialties: ["nurse anesthesia"], keywords: ["nurse anesthetist", "CRNA", "anesthesia"] },

  // Dermatology
  "dermatology": { specialties: ["dermatology"], keywords: ["dermatology", "dermatologist"] },

  // Gastroenterology
  "gi": { specialties: ["gastroenterology"], keywords: ["gastroenterology", "GI"] },
  "gastro": { specialties: ["gastroenterology"], keywords: ["gastroenterology", "GI"] },
  "gastroenterology": { specialties: ["gastroenterology"], keywords: ["gastroenterology", "GI"] },

  // Pulmonology
  "pulmonology": { specialties: ["pulmonology"], keywords: ["pulmonology", "pulmonary", "respiratory"] },

  // Nephrology
  "nephrology": { specialties: ["nephrology"], keywords: ["nephrology", "renal", "kidney"] },
  "renal": { specialties: ["nephrology"], keywords: ["nephrology", "renal"] },
  "dialysis": { specialties: ["nephrology"], keywords: ["dialysis", "nephrology", "renal"] },

  // Endocrinology
  "endocrinology": { specialties: ["endocrinology"], keywords: ["endocrinology", "endocrine"] },
  "endocrine": { specialties: ["endocrinology"], keywords: ["endocrinology", "diabetes", "endocrine"] },
  "diabetes": { specialties: ["endocrinology"], keywords: ["diabetes", "endocrinology"] },

  // Urology
  "urology": { specialties: ["urology"], keywords: ["urology", "urologist"] },

  // ENT
  "ent": { specialties: ["otolaryngology"], keywords: ["ENT", "otolaryngology", "ear nose throat"] },
  "otolaryngology": { specialties: ["otolaryngology"], keywords: ["otolaryngology", "ENT"] },

  // Ophthalmology
  "ophthalmology": { specialties: ["ophthalmology"], keywords: ["ophthalmology", "eye"] },
  "optometry": { specialties: ["ophthalmology"], keywords: ["ophthalmology", "optometry"] },

  // Pain Management
  "pain management": { specialties: ["pain management"], keywords: ["pain management", "pain medicine"] },

  // Physical Therapy / Rehab
  "physical therapy": { specialties: ["physical therapy"], keywords: ["physical therapy", "physical therapist", "rehabilitation"] },
  "physiotherapy": { specialties: ["physical therapy"], keywords: ["physical therapy", "physiotherapy", "rehabilitation"] },
  "rehabilitation": { specialties: ["rehabilitation"], keywords: ["rehabilitation", "physical therapy", "occupational therapy"] },
  "occupational therapy": { specialties: ["occupational therapy"], keywords: ["occupational therapy", "OT"] },
  "ot": { specialties: ["occupational therapy"], keywords: ["occupational therapy"] },
  "speech therapy": { specialties: ["speech therapy"], keywords: ["speech therapy", "speech-language pathology", "SLP"] },

  // Pharmacy
  "pharmacy": { specialties: ["pharmacy"], keywords: ["pharmacy", "pharmacist"] },
  "pharmacist": { specialties: ["pharmacy"], keywords: ["pharmacist", "pharmacy"] },

  // Infectious Disease
  "infectious disease": { specialties: ["infectious disease"], keywords: ["infectious disease", "infection control"] },

  // Geriatrics
  "geriatrics": { specialties: ["geriatrics"], keywords: ["geriatrics", "geriatric", "elderly care"] },

  // Hospice / Palliative
  "hospice": { specialties: ["hospice/palliative"], keywords: ["hospice", "palliative care", "end of life"] },
  "palliative": { specialties: ["hospice/palliative"], keywords: ["palliative care", "hospice"] },

  // Home Health
  "home health": { specialties: ["home health"], keywords: ["home health", "home care", "visiting nurse"] },

  // Wound Care
  "wound care": { specialties: ["wound care"], keywords: ["wound care", "wound management"] },

  // Spine
  "spine": { specialties: ["spine"], keywords: ["spine", "spinal"] },

  // Trauma
  "trauma": { specialties: ["trauma"], keywords: ["trauma", "trauma surgery"] },

  // ── Compound specialty + nursing role terms ──────────────────────────
  // These fire when a user searches "cardiology nurses", "OR nurses", etc.
  // The specialty filter narrows the pool; the keywords reinforce title matching.

  // Cardiology nurses
  "cardiac nurse": { specialties: ["cardiology"], keywords: ["cardiac nurse", "cardiovascular nurse", "CCU nurse", "telemetry nurse", "cardiac step-down"] },
  "cardiac nurses": { specialties: ["cardiology"], keywords: ["cardiac nurse", "cardiovascular nurse", "CCU nurse", "telemetry nurse"] },
  "cardiology nurse": { specialties: ["cardiology"], keywords: ["cardiac nurse", "cardiology nurse", "cardiovascular nurse", "CCU nurse"] },
  "cardiology nurses": { specialties: ["cardiology"], keywords: ["cardiac nurse", "cardiology nurse", "cardiovascular nurse", "CCU nurse"] },
  "cardiovascular nurse": { specialties: ["cardiology"], keywords: ["cardiovascular nurse", "cardiac nurse", "CCU nurse"] },
  "ccu nurse": { specialties: ["cardiology"], keywords: ["CCU nurse", "cardiac care unit", "cardiac nurse"] },
  "telemetry nurse": { specialties: ["cardiology"], keywords: ["telemetry nurse", "cardiac monitor", "step-down nurse"] },
  "cath lab nurse": { specialties: ["interventional cardiology"], keywords: ["cath lab nurse", "cardiac catheterization nurse", "interventional nurse"] },

  // OR / Surgical nurses
  "or nurse": { specialties: ["surgery"], keywords: ["OR nurse", "operating room nurse", "scrub nurse", "perioperative nurse", "circulating nurse"] },
  "or nurses": { specialties: ["surgery"], keywords: ["OR nurse", "operating room nurse", "scrub nurse", "perioperative nurse"] },
  "operating room nurse": { specialties: ["surgery"], keywords: ["operating room nurse", "OR nurse", "scrub nurse", "perioperative nurse"] },
  "scrub nurse": { specialties: ["surgery"], keywords: ["scrub nurse", "OR nurse", "operating room nurse", "surgical technologist"] },
  "perioperative nurse": { specialties: ["surgery"], keywords: ["perioperative nurse", "OR nurse", "pre-op nurse", "post-op nurse", "PACU nurse"] },
  "surgical nurse": { specialties: ["surgery"], keywords: ["surgical nurse", "OR nurse", "scrub nurse", "perioperative nurse"] },
  "pacu nurse": { specialties: ["surgery"], keywords: ["PACU nurse", "recovery room nurse", "post-anesthesia nurse", "post-op nurse"] },
  "pre-op nurse": { specialties: ["surgery"], keywords: ["pre-op nurse", "pre-operative nurse", "surgical prep nurse"] },

  // ICU / Critical care nurses
  "icu nurse": { specialties: ["critical care"], keywords: ["ICU nurse", "critical care nurse", "intensive care nurse"] },
  "icu nurses": { specialties: ["critical care"], keywords: ["ICU nurse", "critical care nurse", "intensive care nurse"] },
  "critical care nurse": { specialties: ["critical care"], keywords: ["critical care nurse", "ICU nurse", "intensive care nurse"] },
  "critical care nurses": { specialties: ["critical care"], keywords: ["critical care nurse", "ICU nurse", "intensive care nurse"] },
  "micu nurse": { specialties: ["critical care"], keywords: ["MICU nurse", "medical ICU nurse", "critical care nurse"] },
  "sicu nurse": { specialties: ["critical care"], keywords: ["SICU nurse", "surgical ICU nurse", "critical care nurse"] },
  "cvicu nurse": { specialties: ["critical care"], keywords: ["CVICU nurse", "cardiovascular ICU nurse", "cardiac ICU nurse"] },

  // ER / Emergency nurses
  "er nurse": { specialties: ["emergency medicine"], keywords: ["ER nurse", "emergency room nurse", "emergency nurse", "trauma nurse"] },
  "er nurses": { specialties: ["emergency medicine"], keywords: ["ER nurse", "emergency room nurse", "emergency nurse"] },
  "emergency room nurse": { specialties: ["emergency medicine"], keywords: ["emergency room nurse", "ER nurse", "emergency nurse"] },
  "emergency nurse": { specialties: ["emergency medicine"], keywords: ["emergency nurse", "ER nurse", "emergency room nurse"] },
  "trauma nurse": { specialties: ["trauma"], keywords: ["trauma nurse", "ER nurse", "emergency nurse", "trauma bay"] },

  // Oncology nurses
  "oncology nurse": { specialties: ["oncology"], keywords: ["oncology nurse", "chemo nurse", "infusion nurse", "cancer nurse"] },
  "oncology nurses": { specialties: ["oncology"], keywords: ["oncology nurse", "chemo nurse", "infusion nurse", "cancer nurse"] },
  "chemo nurse": { specialties: ["oncology"], keywords: ["chemo nurse", "chemotherapy nurse", "oncology nurse", "infusion nurse"] },
  "infusion nurse": { specialties: ["oncology"], keywords: ["infusion nurse", "chemo nurse", "oncology nurse", "IV infusion"] },
  "bmt nurse": { specialties: ["oncology"], keywords: ["BMT nurse", "bone marrow transplant nurse", "oncology nurse"] },

  // OB / Labor & Delivery nurses
  "labor and delivery nurse": { specialties: ["obstetrics/gynecology"], keywords: ["labor and delivery nurse", "L&D nurse", "OB nurse", "obstetrics nurse"] },
  "l&d nurse": { specialties: ["obstetrics/gynecology"], keywords: ["L&D nurse", "labor and delivery nurse", "OB nurse"] },
  "ob nurse": { specialties: ["obstetrics/gynecology"], keywords: ["OB nurse", "obstetrics nurse", "labor and delivery nurse", "L&D nurse"] },
  "postpartum nurse": { specialties: ["obstetrics/gynecology"], keywords: ["postpartum nurse", "mother baby nurse", "OB nurse", "maternity nurse"] },
  "mother baby nurse": { specialties: ["obstetrics/gynecology"], keywords: ["mother baby nurse", "postpartum nurse", "OB nurse"] },

  // Pediatric nurses
  "pediatric nurse": { specialties: ["pediatrics"], keywords: ["pediatric nurse", "peds nurse", "children's nurse"] },
  "pediatric nurses": { specialties: ["pediatrics"], keywords: ["pediatric nurse", "peds nurse", "children's nurse"] },
  "peds nurse": { specialties: ["pediatrics"], keywords: ["peds nurse", "pediatric nurse", "children's nurse"] },
  "picu nurse": { specialties: ["pediatrics"], keywords: ["PICU nurse", "pediatric ICU nurse", "pediatric critical care"] },

  // Orthopedic nurses
  "ortho nurse": { specialties: ["orthopedics"], keywords: ["ortho nurse", "orthopedic nurse", "joint replacement nurse"] },
  "orthopedic nurse": { specialties: ["orthopedics"], keywords: ["orthopedic nurse", "ortho nurse", "joint replacement nurse", "spine nurse"] },
  "joint replacement nurse": { specialties: ["orthopedics"], keywords: ["joint replacement nurse", "arthroplasty nurse", "orthopedic nurse"] },

  // Neuro nurses
  "neuro nurse": { specialties: ["neurology"], keywords: ["neuro nurse", "neurology nurse", "neuroscience nurse", "stroke nurse"] },
  "neurology nurse": { specialties: ["neurology"], keywords: ["neurology nurse", "neuro nurse", "neuroscience nurse"] },
  "stroke nurse": { specialties: ["neurology"], keywords: ["stroke nurse", "neuro nurse", "stroke certified nurse"] },

  // Psychiatric nurses
  "psych nurse": { specialties: ["psychiatry"], keywords: ["psych nurse", "psychiatric nurse", "behavioral health nurse", "mental health nurse"] },
  "psychiatric nurse": { specialties: ["psychiatry"], keywords: ["psychiatric nurse", "psych nurse", "behavioral health nurse"] },
  "behavioral health nurse": { specialties: ["behavioral health"], keywords: ["behavioral health nurse", "psych nurse", "mental health nurse"] },

  // Dialysis / Nephrology nurses
  "nephrology nurse": { specialties: ["nephrology"], keywords: ["nephrology nurse", "dialysis nurse", "renal nurse"] },

  // GI nurses
  "gi nurse": { specialties: ["gastroenterology"], keywords: ["GI nurse", "gastroenterology nurse", "endoscopy nurse"] },
  "endoscopy nurse": { specialties: ["gastroenterology"], keywords: ["endoscopy nurse", "GI nurse", "colonoscopy nurse"] },

  // Radiology / Imaging nurses
  "radiology nurse": { specialties: ["radiology"], keywords: ["radiology nurse", "imaging nurse", "IR nurse", "interventional radiology nurse"] },
  "ir nurse": { specialties: ["radiology"], keywords: ["IR nurse", "interventional radiology nurse", "radiology nurse"] },

  // General nursing role terms (no specialty filter)
  "nurses": { specialties: [], keywords: ["registered nurse", "RN", "nursing"] },
  "nurse": { specialties: [], keywords: ["registered nurse", "RN", "nursing"] },
  "rn": { specialties: [], keywords: ["registered nurse", "RN"] },
  "np": { specialties: [], keywords: ["nurse practitioner", "NP", "APRN"] },
  "aprn": { specialties: [], keywords: ["advanced practice registered nurse", "APRN", "nurse practitioner"] },
  "pa": { specialties: [], keywords: ["physician assistant", "PA-C", "physician associate"] },
  "pa-c": { specialties: [], keywords: ["physician assistant", "PA-C"] },

  // ── Compound specialty + physician/doctor terms ───────────────────────
  // "cardiology doctor", "orthopedic surgeon", "neuro physician", etc.

  // General doctor shorthand
  "doctor": { specialties: [], keywords: ["physician", "doctor", "attending", "MD", "DO"] },
  "doctors": { specialties: [], keywords: ["physician", "doctor", "attending", "MD", "DO"] },
  "physician": { specialties: [], keywords: ["physician", "attending physician", "MD", "DO"] },
  "physicians": { specialties: [], keywords: ["physician", "attending physician", "MD", "DO"] },
  "md": { specialties: [], keywords: ["MD", "physician", "medical doctor", "attending"] },
  "do": { specialties: [], keywords: ["DO", "doctor of osteopathic medicine", "physician"] },
  "attending": { specialties: [], keywords: ["attending physician", "attending", "staff physician"] },
  "hospitalist": { specialties: ["hospital medicine"], keywords: ["hospitalist", "hospital medicine", "nocturnist"] },

  // Cardiology physicians
  "cardiology doctor": { specialties: ["cardiology"], keywords: ["cardiologist", "cardiac physician", "cardiovascular physician"] },
  "cardiology doctors": { specialties: ["cardiology"], keywords: ["cardiologist", "cardiac physician", "cardiovascular physician"] },
  "cardiology physician": { specialties: ["cardiology"], keywords: ["cardiologist", "cardiovascular physician"] },
  "heart doctor": { specialties: ["cardiology"], keywords: ["cardiologist", "cardiac physician"] },
  "cardiologist": { specialties: ["cardiology"], keywords: ["cardiologist", "cardiac physician", "interventional cardiologist"] },
  "cardiologists": { specialties: ["cardiology"], keywords: ["cardiologist", "interventional cardiologist"] },

  // Orthopedic physicians
  "orthopedic doctor": { specialties: ["orthopedics"], keywords: ["orthopedic surgeon", "orthopedist", "orthopedic physician"] },
  "orthopedic doctors": { specialties: ["orthopedics"], keywords: ["orthopedic surgeon", "orthopedist"] },
  "orthopedic surgeon": { specialties: ["orthopedics"], keywords: ["orthopedic surgeon", "orthopedist", "sports medicine surgeon"] },
  "orthopedic surgeons": { specialties: ["orthopedics"], keywords: ["orthopedic surgeon", "orthopedist"] },
  "orthopedist": { specialties: ["orthopedics"], keywords: ["orthopedist", "orthopedic surgeon"] },

  // Oncology physicians
  "oncology doctor": { specialties: ["oncology"], keywords: ["oncologist", "cancer physician", "medical oncologist"] },
  "oncologist": { specialties: ["oncology"], keywords: ["oncologist", "medical oncologist", "radiation oncologist"] },
  "oncologists": { specialties: ["oncology"], keywords: ["oncologist", "medical oncologist"] },

  // Neurology physicians
  "neurology doctor": { specialties: ["neurology"], keywords: ["neurologist", "neurology physician"] },
  "neurologist": { specialties: ["neurology"], keywords: ["neurologist", "neurology physician"] },
  "neurosurgeon": { specialties: ["neurosurgery"], keywords: ["neurosurgeon", "brain surgeon", "spine surgeon"] },

  // Emergency physicians
  "er doctor": { specialties: ["emergency medicine"], keywords: ["emergency physician", "ER doctor", "emergency medicine physician"] },
  "emergency doctor": { specialties: ["emergency medicine"], keywords: ["emergency physician", "emergency medicine physician"] },
  "emergency physician": { specialties: ["emergency medicine"], keywords: ["emergency physician", "emergency medicine physician"] },

  // Surgery physicians
  "general surgeon": { specialties: ["general surgery"], keywords: ["general surgeon", "surgeon", "surgical physician"] },
  "surgeon": { specialties: ["surgery"], keywords: ["surgeon", "surgical physician", "attending surgeon"] },
  "surgeons": { specialties: ["surgery"], keywords: ["surgeon", "surgical physician"] },

  // Primary care / Internal medicine physicians
  "primary care doctor": { specialties: ["primary care"], keywords: ["primary care physician", "PCP", "family physician", "internist"] },
  "pcp": { specialties: ["primary care"], keywords: ["primary care physician", "PCP", "family medicine"] },
  "internist": { specialties: ["internal medicine"], keywords: ["internist", "internal medicine physician"] },
  "family physician": { specialties: ["family medicine"], keywords: ["family physician", "family medicine physician", "family doctor"] },
  "family doctor": { specialties: ["family medicine"], keywords: ["family doctor", "family physician", "family medicine"] },

  // Radiology physicians
  "radiologist": { specialties: ["radiology"], keywords: ["radiologist", "diagnostic radiologist", "interventional radiologist"] },
  "radiologists": { specialties: ["radiology"], keywords: ["radiologist", "diagnostic radiologist"] },
  "interventional radiologist": { specialties: ["radiology"], keywords: ["interventional radiologist", "IR physician"] },

  // Anesthesiology physicians
  "anesthesiologist": { specialties: ["anesthesiology"], keywords: ["anesthesiologist", "anesthesia physician", "attending anesthesiologist"] },
  "anesthesiologists": { specialties: ["anesthesiology"], keywords: ["anesthesiologist", "anesthesia physician"] },

  // Psychiatry physicians
  "psychiatrist": { specialties: ["psychiatry"], keywords: ["psychiatrist", "psychiatric physician"] },
  "psychiatrists": { specialties: ["psychiatry"], keywords: ["psychiatrist", "psychiatric physician"] },

  // Pediatrics physicians
  "pediatrician": { specialties: ["pediatrics"], keywords: ["pediatrician", "pediatric physician", "children's physician"] },
  "pediatricians": { specialties: ["pediatrics"], keywords: ["pediatrician", "pediatric physician"] },

  // GI physicians
  "gastroenterologist": { specialties: ["gastroenterology"], keywords: ["gastroenterologist", "GI physician", "gastroenterology physician"] },
  "gi doctor": { specialties: ["gastroenterology"], keywords: ["gastroenterologist", "GI physician"] },

  // Urology physicians
  "urologist": { specialties: ["urology"], keywords: ["urologist", "urology physician"] },

  // Dermatology physicians
  "dermatologist": { specialties: ["dermatology"], keywords: ["dermatologist", "dermatology physician"] },

  // ── Students, Trainees, and Residents ────────────────────────────────
  // Medical students, interns, residents, and fellows at all training stages.
  // PDL's job_title_levels "training" canonical value covers these roles.

  // Medical students
  "medical student": { specialties: [], keywords: ["medical student", "MS1", "MS2", "MS3", "MS4", "clerkship", "clinical rotation"] },
  "medical students": { specialties: [], keywords: ["medical student", "MS3", "MS4", "clerkship", "clinical rotation"] },
  "ms3": { specialties: [], keywords: ["MS3", "medical student", "third year medical student", "clinical rotation"] },
  "ms4": { specialties: [], keywords: ["MS4", "medical student", "fourth year medical student", "sub-intern"] },

  // Interns (PGY-1)
  "intern": { specialties: [], keywords: ["intern", "PGY-1", "first year resident", "internship"] },
  "interns": { specialties: [], keywords: ["intern", "PGY-1", "first year resident", "internship"] },
  "pgy-1": { specialties: [], keywords: ["PGY-1", "intern", "first year resident"] },
  "pgy1": { specialties: [], keywords: ["PGY-1", "intern", "first year resident"] },

  // Residents (general)
  "resident": { specialties: [], keywords: ["resident", "medical resident", "resident physician", "PGY", "house officer"] },
  "residents": { specialties: [], keywords: ["resident", "medical resident", "resident physician", "PGY"] },
  "medical resident": { specialties: [], keywords: ["medical resident", "resident physician", "resident"] },
  "resident physician": { specialties: [], keywords: ["resident physician", "medical resident", "resident"] },
  "pgy-2": { specialties: [], keywords: ["PGY-2", "second year resident"] },
  "pgy-3": { specialties: [], keywords: ["PGY-3", "third year resident"] },
  "pgy-4": { specialties: [], keywords: ["PGY-4", "fourth year resident", "chief resident"] },
  "chief resident": { specialties: [], keywords: ["chief resident", "senior resident"] },

  // Fellows (general)
  "fellow": { specialties: [], keywords: ["fellow", "clinical fellow", "fellowship", "post-residency"] },
  "fellows": { specialties: [], keywords: ["fellow", "clinical fellow", "fellowship"] },
  "clinical fellow": { specialties: [], keywords: ["clinical fellow", "fellow", "fellowship"] },

  // Specialty-specific residents
  "cardiology resident": { specialties: ["cardiology"], keywords: ["cardiology resident", "internal medicine resident", "cardiac resident"] },
  "orthopedic resident": { specialties: ["orthopedics"], keywords: ["orthopedic resident", "ortho resident", "orthopedic surgery resident"] },
  "surgery resident": { specialties: ["surgery"], keywords: ["surgery resident", "surgical resident", "general surgery resident"] },
  "er resident": { specialties: ["emergency medicine"], keywords: ["emergency medicine resident", "ER resident"] },
  "emergency medicine resident": { specialties: ["emergency medicine"], keywords: ["emergency medicine resident", "ER resident"] },
  "psychiatry resident": { specialties: ["psychiatry"], keywords: ["psychiatry resident", "psychiatric resident"] },
  "pediatric resident": { specialties: ["pediatrics"], keywords: ["pediatric resident", "pediatrics resident", "peds resident"] },
  "neurology resident": { specialties: ["neurology"], keywords: ["neurology resident", "neurology resident physician"] },
  "radiology resident": { specialties: ["radiology"], keywords: ["radiology resident", "diagnostic radiology resident"] },
  "anesthesia resident": { specialties: ["anesthesiology"], keywords: ["anesthesia resident", "anesthesiology resident", "CA-1", "CA-2", "CA-3"] },

  // Specialty-specific fellows
  "cardiology fellow": { specialties: ["cardiology"], keywords: ["cardiology fellow", "cardiac fellow", "interventional cardiology fellow", "electrophysiology fellow"] },
  "interventional cardiology fellow": { specialties: ["interventional cardiology"], keywords: ["interventional cardiology fellow", "cath lab fellow"] },
  "orthopedic fellow": { specialties: ["orthopedics"], keywords: ["orthopedic fellow", "ortho fellow", "sports medicine fellow"] },
  "oncology fellow": { specialties: ["oncology"], keywords: ["oncology fellow", "hematology oncology fellow", "hem onc fellow"] },
  "neurology fellow": { specialties: ["neurology"], keywords: ["neurology fellow", "stroke fellow", "neuro fellow"] },
  "gastroenterology fellow": { specialties: ["gastroenterology"], keywords: ["gastroenterology fellow", "GI fellow", "hepatology fellow"] },
  "gi fellow": { specialties: ["gastroenterology"], keywords: ["GI fellow", "gastroenterology fellow"] },
  "pulmonology fellow": { specialties: ["pulmonology"], keywords: ["pulmonology fellow", "pulmonary fellow", "critical care fellow"] },
  "nephrology fellow": { specialties: ["nephrology"], keywords: ["nephrology fellow", "renal fellow"] },
  "rheumatology fellow": { specialties: ["rheumatology"], keywords: ["rheumatology fellow", "rheum fellow"] },
  "endocrinology fellow": { specialties: ["endocrinology"], keywords: ["endocrinology fellow", "endo fellow", "diabetes fellow"] },
  "infectious disease fellow": { specialties: ["infectious disease"], keywords: ["infectious disease fellow", "ID fellow"] },
  "geriatrics fellow": { specialties: ["geriatrics"], keywords: ["geriatrics fellow", "geriatric medicine fellow"] },
  "palliative care fellow": { specialties: ["hospice/palliative"], keywords: ["palliative care fellow", "hospice fellow"] },
  "sports medicine fellow": { specialties: ["orthopedics"], keywords: ["sports medicine fellow", "primary care sports medicine fellow"] },
  "pain medicine fellow": { specialties: ["pain management"], keywords: ["pain medicine fellow", "pain management fellow"] },
};

/* ------------------------------------------------------------------ */
/* Health System Divisions / Subsidiaries                               */
/* ------------------------------------------------------------------ */
export const HEALTH_SYSTEM_DIVISIONS: Record<string, string[]> = {
  "hca healthcare": ["hca", "hospital corporation of america", "hca hospitals", "hca healthcare inc", "hca inc", "healthtrust", "parallon"],
  "commonspirit health": ["commonspirit", "dignity health", "catholic health initiatives", "chi", "chi health", "virginia mason franciscan health"],
  "ascension": ["ascension health", "ascension st. vincent", "ascension seton", "ascension providence", "ascension via christi"],
  "kaiser permanente": ["kaiser", "kaiser foundation", "the permanente medical group", "southern california permanente"],
  "providence": ["providence health", "providence st. joseph", "providence health & services", "swedish health services"],
  "tenet healthcare": ["tenet", "tenet health", "uspi", "united surgical partners"],
  "universal health services": ["uhs", "universal health"],
  "trinity health": ["trinity health corporation", "mercy health", "saint alphonsus"],
  "advocate health": ["advocate aurora", "advocate health care", "aurora health care", "atrium health", "advocate aurora health"],
  "banner health": ["banner"],
  "uc health": ["uchealth", "uc health", "university of colorado health", "university of colorado hospital", "uch"],
  "uchealth": ["uchealth", "uc health", "university of colorado health", "university of colorado hospital", "uch"],
};

/* ------------------------------------------------------------------ */
/* Company Aliases — shorthand → canonical name                        */
/* ------------------------------------------------------------------ */
export const COMPANY_ALIASES: Record<string, string> = {
  "hca": "hca healthcare",
  "kaiser": "kaiser permanente",
  "mayo": "mayo clinic",
  "cleveland clinic": "cleveland clinic",
  "johns hopkins": "johns hopkins",
  "mass general": "mass general brigham",
  "partners": "mass general brigham",
  "mount sinai": "mount sinai",
  "nyp": "newyork-presbyterian",
  "uc health": "uchealth",
  "uchealth": "uchealth",
  "university of colorado health": "uchealth",
  "uch": "uchealth",
  "university of colorado hospital": "uchealth",
};

/* ------------------------------------------------------------------ */
/* Known Specialty Employers (boost, not filter)                        */
/* ------------------------------------------------------------------ */
export const SPECIALTY_EMPLOYERS: Record<string, string[]> = {
  "cardiology": ["cleveland clinic", "mayo clinic", "cedars-sinai", "mount sinai", "mass general brigham", "johns hopkins"],
  "oncology": ["md anderson", "memorial sloan kettering", "mayo clinic", "johns hopkins", "dana-farber", "moffitt cancer center"],
  "orthopedics": ["hss", "hospital for special surgery", "mayo clinic", "cleveland clinic", "rush university medical center"],
  "neurology": ["mayo clinic", "johns hopkins", "cleveland clinic", "mass general brigham", "ucsf"],
  "pediatrics": ["children's hospital of philadelphia", "boston children's hospital", "texas children's hospital", "cincinnati children's", "nationwide children's"],
  "emergency medicine": ["hca healthcare", "tenet healthcare", "universal health services", "envision healthcare", "teamhealth"],
};

/* ------------------------------------------------------------------ */
/* Healthcare Industries for PDL filtering                              */
/* ------------------------------------------------------------------ */
export const HEALTHCARE_INDUSTRIES: string[] = [
  "hospital & health care",
  "medical practice",
  "health, wellness & fitness",
  "mental health care",
  "pharmaceuticals",
  "biotechnology",
  "medical devices",
  "alternative medicine",
  "individual & family services",
];

/* ------------------------------------------------------------------ */
/* Excluded Industries (not healthcare)                                 */
/* ------------------------------------------------------------------ */
export const EXCLUDED_INDUSTRIES: string[] = [
  "staffing and recruiting", "food & beverages", "wine and spirits", "food production",
  "restaurants", "hospitality", "retail", "apparel & fashion", "consumer goods",
  "leisure, travel & tourism", "automotive", "oil & energy", "mining & metals",
  "construction", "real estate", "insurance", "banking", "financial services",
  "information technology and services", "computer software", "cosmetics",
  "consumer services", "renewables & environment", "utilities", "telecommunications",
  "media production", "entertainment", "gambling & casinos", "sporting goods",
  "farming", "primary/secondary education", "higher education", "government administration",
  "military", "law enforcement", "legal services", "accounting",
  "logistics and supply chain", "warehousing", "airlines/aviation",
];

/* ------------------------------------------------------------------ */
/* Clinical Title Expansions                                            */
/* ------------------------------------------------------------------ */
export const TITLE_EXPANSIONS: Record<string, string[]> = {
  "physician": ["physician", "doctor", "attending physician", "staff physician", "hospitalist", "medical doctor", "md"],
  "surgeon": ["surgeon", "general surgeon", "attending surgeon", "surgical"],
  "nurse practitioner": ["nurse practitioner", "np", "aprn", "advanced practice registered nurse", "family nurse practitioner", "fnp", "adult-gerontology nurse practitioner", "acute care nurse practitioner", "psychiatric nurse practitioner"],
  "physician assistant": ["physician assistant", "pa-c", "pa", "certified physician assistant", "surgical physician assistant", "physician associate"],
  "registered nurse": ["registered nurse", "rn", "staff nurse", "charge nurse", "clinical nurse", "bedside nurse", "floor nurse"],
  "nurse manager": ["nurse manager", "nursing manager", "unit manager", "clinical nurse manager", "assistant nurse manager"],
  "director of nursing": ["director of nursing", "don", "nursing director", "chief nursing officer", "cno", "vp of nursing"],
  "clinical nurse specialist": ["clinical nurse specialist", "cns", "nurse specialist"],
  "crna": ["crna", "certified registered nurse anesthetist", "nurse anesthetist", "nurse anesthesiologist"],
  "licensed practical nurse": ["licensed practical nurse", "lpn", "licensed vocational nurse", "lvn"],
  "certified nursing assistant": ["certified nursing assistant", "cna", "nursing assistant", "patient care technician", "pct", "nurse aide"],
  "physical therapist": ["physical therapist", "pt", "dpt", "physiotherapist", "staff physical therapist", "senior physical therapist"],
  "occupational therapist": ["occupational therapist", "ot", "otr", "otr/l", "certified occupational therapy assistant", "cota"],
  "speech language pathologist": ["speech language pathologist", "slp", "speech therapist", "ccc-slp"],
  "respiratory therapist": ["respiratory therapist", "rt", "rrt", "certified respiratory therapist"],
  "pharmacist": ["pharmacist", "clinical pharmacist", "staff pharmacist", "pharmacy manager", "pharmd"],
  "medical assistant": ["medical assistant", "ma", "certified medical assistant", "cma", "clinical medical assistant"],
  "medical director": ["medical director", "chief medical officer", "cmo", "associate medical director", "regional medical director"],
  "chief nursing officer": ["chief nursing officer", "cno", "vp nursing", "senior vp nursing", "svp nursing"],
  "hospitalist": ["hospitalist", "hospital medicine", "attending hospitalist", "nocturnist"],
  "nurse educator": ["nurse educator", "clinical educator", "nursing instructor", "staff development", "clinical nurse educator"],
  "case manager": ["case manager", "rn case manager", "nurse case manager", "care coordinator", "care manager", "utilization review nurse"],
  "infection control": ["infection control", "infection preventionist", "cic", "infection control nurse", "epidemiologist"],
  "wound care nurse": ["wound care nurse", "wound specialist", "cwocn", "wound ostomy continence nurse", "woc nurse"],
  "dialysis nurse": ["dialysis nurse", "dialysis rn", "hemodialysis nurse", "peritoneal dialysis nurse", "nephrology nurse"],
  "home health nurse": ["home health nurse", "home health rn", "visiting nurse", "home care nurse", "field nurse"],
  "travel nurse": ["travel nurse", "travel rn", "agency nurse", "locum tenens", "locums"],
  "dentist": ["dentist", "dds", "dmd", "dental surgeon", "general dentist"],
  "dental hygienist": ["dental hygienist", "rdh", "registered dental hygienist"],
};

/* ------------------------------------------------------------------ */
/* US States                                                            */
/* ------------------------------------------------------------------ */
export const US_STATES: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

/* ------------------------------------------------------------------ */
/* City → Metro mapping                                                 */
/* ------------------------------------------------------------------ */
export const CITY_TO_METRO: Record<string, string[]> = {
  "denver": ["denver, colorado"],
  "dallas": ["dallas, texas", "dallas-fort worth, texas"],
  "houston": ["houston, texas"],
  "austin": ["austin, texas"],
  "san antonio": ["san antonio, texas"],
  "los angeles": ["los angeles, california"],
  "san francisco": ["san francisco, california", "san francisco bay area"],
  "san jose": ["san jose, california", "san francisco bay area"],
  "san diego": ["san diego, california"],
  "miami": ["miami, florida"],
  "tampa": ["tampa, florida", "tampa bay area"],
  "orlando": ["orlando, florida"],
  "jacksonville": ["jacksonville, florida"],
  "atlanta": ["atlanta, georgia"],
  "nashville": ["nashville, tennessee"],
  "chicago": ["chicago, illinois"],
  "boston": ["boston, massachusetts"],
  "phoenix": ["phoenix, arizona"],
  "seattle": ["seattle, washington"],
  "portland": ["portland, oregon"],
  "philadelphia": ["philadelphia, pennsylvania"],
  "pittsburgh": ["pittsburgh, pennsylvania"],
  "new york": ["new york, new york", "new york city metropolitan area"],
  "charlotte": ["charlotte, north carolina"],
  "raleigh": ["raleigh, north carolina", "raleigh-durham, north carolina"],
  "detroit": ["detroit, michigan"],
  "minneapolis": ["minneapolis, minnesota", "minneapolis-saint paul, minnesota"],
  "salt lake city": ["salt lake city, utah"],
  "baltimore": ["baltimore, maryland"],
  "las vegas": ["las vegas, nevada"],
  "indianapolis": ["indianapolis, indiana"],
  "columbus": ["columbus, ohio"],
  "cleveland": ["cleveland, ohio"],
  "kansas city": ["kansas city, missouri"],
  "richmond": ["richmond, virginia"],
  "washington": ["washington, district of columbia"],
  "st. louis": ["st. louis, missouri"],
  "saint louis": ["st. louis, missouri"],
  "milwaukee": ["milwaukee, wisconsin"],
  "memphis": ["memphis, tennessee"],
  "sacramento": ["sacramento, california"],
  "louisville": ["louisville, kentucky"],
  "oklahoma city": ["oklahoma city, oklahoma"],
  "new orleans": ["new orleans, louisiana"],
  "birmingham": ["birmingham, alabama"],
  "tucson": ["tucson, arizona"],
  "omaha": ["omaha, nebraska"],
  "albuquerque": ["albuquerque, new mexico"],
  "honolulu": ["honolulu, hawaii"],
  "anchorage": ["anchorage, alaska"],
  // NOTE: Small/resort towns intentionally OMITTED from metro mapping.
  // They should search locally first; cascade handles widening if needed.
  "rochester": ["rochester, minnesota"],   // Mayo Clinic
  "jackson": ["jackson, wyoming"],          // Jackson Hole
  "park city": ["salt lake city, utah"],
  "scottsdale": ["phoenix, arizona"],
  "naples": ["naples, florida"],
  "sarasota": ["sarasota, florida"],
};

/* ------------------------------------------------------------------ */
/* Nearby Cities Map                                                    */
/* ------------------------------------------------------------------ */
export const NEARBY_CITIES: Record<string, { radius: number; cities: string[] }[]> = {
  "denver": [
    { radius: 10, cities: ["aurora", "lakewood", "arvada", "westminster", "englewood", "littleton"] },
    { radius: 25, cities: ["thornton", "centennial", "broomfield", "commerce city", "brighton", "golden", "parker"] },
    { radius: 50, cities: ["boulder", "longmont", "loveland", "castle rock"] },
    { radius: 100, cities: ["fort collins", "greeley", "colorado springs", "pueblo"] },
  ],
  "dallas": [
    { radius: 10, cities: ["irving", "garland", "mesquite", "richardson", "grand prairie"] },
    { radius: 25, cities: ["plano", "arlington", "fort worth", "frisco", "mckinney", "carrollton", "denton"] },
    { radius: 50, cities: ["waco", "tyler", "wichita falls"] },
  ],
  "houston": [
    { radius: 10, cities: ["pasadena", "sugar land", "baytown", "pearland"] },
    { radius: 25, cities: ["the woodlands", "league city", "missouri city", "conroe", "katy"] },
    { radius: 50, cities: ["galveston", "beaumont", "college station"] },
  ],
  "atlanta": [
    { radius: 10, cities: ["decatur", "sandy springs", "roswell", "east point"] },
    { radius: 25, cities: ["marietta", "alpharetta", "lawrenceville", "smyrna", "kennesaw", "duluth"] },
    { radius: 50, cities: ["athens", "macon", "gainesville"] },
  ],
  "chicago": [
    { radius: 10, cities: ["evanston", "cicero", "oak park", "berwyn", "skokie"] },
    { radius: 25, cities: ["naperville", "aurora", "joliet", "elgin", "schaumburg", "arlington heights"] },
    { radius: 50, cities: ["rockford", "waukegan", "dekalb"] },
  ],
  "los angeles": [
    { radius: 10, cities: ["glendale", "burbank", "pasadena", "inglewood", "santa monica"] },
    { radius: 25, cities: ["long beach", "anaheim", "irvine", "torrance", "pomona", "el monte"] },
    { radius: 50, cities: ["riverside", "san bernardino", "ontario", "oxnard", "ventura"] },
  ],
  "miami": [
    { radius: 10, cities: ["miami beach", "hialeah", "coral gables", "north miami"] },
    { radius: 25, cities: ["fort lauderdale", "hollywood", "pembroke pines", "davie", "boca raton"] },
    { radius: 50, cities: ["west palm beach", "palm beach gardens", "delray beach"] },
  ],
  "new york": [
    { radius: 10, cities: ["jersey city", "newark", "yonkers", "hoboken"] },
    { radius: 25, cities: ["white plains", "stamford", "new rochelle", "paterson", "elizabeth"] },
    { radius: 50, cities: ["bridgeport", "new haven", "trenton"] },
  ],
  "phoenix": [
    { radius: 10, cities: ["scottsdale", "tempe", "mesa", "glendale", "chandler"] },
    { radius: 25, cities: ["gilbert", "peoria", "surprise", "avondale", "goodyear"] },
    { radius: 50, cities: ["prescott", "flagstaff", "tucson"] },
  ],
  "seattle": [
    { radius: 10, cities: ["bellevue", "renton", "kent", "redmond", "kirkland"] },
    { radius: 25, cities: ["tacoma", "everett", "federal way", "lakewood", "auburn"] },
    { radius: 50, cities: ["olympia", "bellingham"] },
  ],
  "boston": [
    { radius: 10, cities: ["cambridge", "somerville", "brookline", "quincy"] },
    { radius: 25, cities: ["worcester", "lowell", "brockton", "newton", "framingham"] },
    { radius: 50, cities: ["providence", "springfield", "manchester"] },
  ],
  "nashville": [
    { radius: 10, cities: ["brentwood", "franklin", "hendersonville", "murfreesboro"] },
    { radius: 25, cities: ["clarksville", "gallatin", "lebanon", "smyrna"] },
    { radius: 50, cities: ["bowling green", "chattanooga", "huntsville"] },
  ],
  "memphis": [
    { radius: 10, cities: ["germantown", "cordova", "bartlett", "collierville", "arlington", "lakeland"] },
    { radius: 25, cities: ["southaven", "olive branch", "horn lake", "millington", "munford", "atoka"] },
    { radius: 50, cities: ["west memphis", "marion", "covington", "oxford", "tupelo"] },
  ],
  "philadelphia": [
    { radius: 10, cities: ["camden", "chester", "norristown", "wilmington"] },
    { radius: 25, cities: ["trenton", "cherry hill", "king of prussia", "media"] },
    { radius: 50, cities: ["reading", "allentown", "atlantic city"] },
  ],
  "san francisco": [
    { radius: 10, cities: ["oakland", "berkeley", "daly city", "south san francisco"] },
    { radius: 25, cities: ["san jose", "fremont", "hayward", "palo alto", "sunnyvale", "mountain view"] },
    { radius: 50, cities: ["santa cruz", "santa rosa", "napa", "vallejo"] },
  ],
  "washington": [
    { radius: 10, cities: ["arlington", "alexandria", "bethesda", "silver spring"] },
    { radius: 25, cities: ["fairfax", "reston", "rockville", "columbia", "frederick"] },
    { radius: 50, cities: ["baltimore", "annapolis", "richmond"] },
  ],
  // Small/resort healthcare towns — local corridor only (no Denver drift)
  "vail": [
    { radius: 15, cities: ["edwards", "avon", "eagle", "minturn"] },
    { radius: 30, cities: ["frisco", "breckenridge", "silverthorne", "glenwood springs", "leadville"] },
  ],
  "aspen": [
    { radius: 10, cities: ["basalt", "carbondale", "snowmass village"] },
    { radius: 25, cities: ["glenwood springs", "vail", "edwards"] },
    { radius: 50, cities: ["grand junction", "denver"] },
  ],
  "rochester": [
    { radius: 10, cities: ["byron", "stewartville"] },
    { radius: 25, cities: ["austin", "winona", "owatonna"] },
    { radius: 50, cities: ["minneapolis", "saint paul", "la crosse"] },
  ],
  "jackson": [
    { radius: 10, cities: ["wilson", "teton village"] },
    { radius: 25, cities: ["driggs", "victor", "alpine"] },
    { radius: 50, cities: ["idaho falls", "rexburg"] },
  ],
  "park city": [
    { radius: 10, cities: ["heber city", "midway", "kamas"] },
    { radius: 25, cities: ["salt lake city", "sandy", "provo", "orem"] },
  ],
};
