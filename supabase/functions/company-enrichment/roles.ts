/**
 * roles.ts: a job title → the clinical role group a healthcare recruiter
 * thinks in, plus the physician's specialty when the title says it.
 *
 * Replaces the LinkedIn function buckets the panel used to chart
 * ("Healthcare Services", "Program and Project Management", "Arts and
 * Design"), which say nothing about who works at a practice. Pure: no I/O.
 *
 * Order matters. Checked first to last:
 *   1. recruiting / liaison / program staff  → admin ("Physician Liaison",
 *      "Physician Recruiter", "Fellowship Program Manager" are not doctors)
 *   2. CRNA, then APP (PA, NP)                → before "physician"/"nurse"
 *   3. therapy (PT, OT, AT, hand therapy)     → before "doctor" (DPT)
 *   4. trainee (resident, fellow)             → before "physician"
 *   5. physician
 *   6. nursing
 *   7. clinical support (MA, surgical tech, scribe, esthetician)
 *   8. admin and operations
 * Live titles behind each rule: Bone and Joint Institute of Tennessee,
 * Dallas Plastic Surgery Institute and VUMC rosters, 2026-10-18.
 */

import { matchSubspecialty } from "../_shared/clinician-engine/clinical-vocabulary.ts";

export type RoleGroup =
  | "physician"
  | "app"
  | "crna"
  | "trainee"
  | "nursing"
  | "therapy"
  | "clinical_support"
  | "admin"
  | "other";

export const ROLE_GROUP_ORDER: readonly RoleGroup[] = [
  "physician", "app", "crna", "trainee", "nursing", "therapy", "clinical_support", "admin", "other",
];

export const ROLE_GROUP_LABELS: Record<RoleGroup, string> = {
  physician: "Physicians",
  app: "PAs and NPs",
  crna: "CRNAs",
  trainee: "Residents and fellows",
  nursing: "Nursing",
  therapy: "Therapy and athletic training",
  clinical_support: "Clinical support",
  admin: "Admin and operations",
  other: "Other",
};

const ADMIN_OVERRIDE = /\b(liaison|recruit\w*|sourcing|talent|program (manager|coordinator|director|administrator)|business development|sales|marketing)\b/;
const CRNA = /\b(crna|nurse anesthetist|nurse anesthesiologist|nurse anesthesist|nurse anesthestist)\b/;
const APP = /\b(physician assistant|physician associate|pa-c|nurse practitioner|aprn|fnp|fnp-c|np|np-c|advanced practice (provider|nurse|registered nurse|clinician)|app)\b/;
const THERAPY = /\b(physical therapist|physical therapy|physiotherapist|dpt|occupational therapist|hand therapist|certified hand therapist|cht|athletic trainer|atc|pta|ota|speech (language )?pathologist|respiratory therapist|chiropractor|audiologist|massage therapist|therapist)\b/;
const TRAINEE = /\b(resident|residency|fellow|fellowship|pgy-?\d?|intern physician)\b/;
const PHYSICIAN = /\b(surgeon|physician|doctor|attending|hospitalist|orthopa?edist|internist|intensivist|pediatrician|psychiatrist|podiatrist|dpm|medical director|[a-z]+ologist)\b/;
/** A surgeon/physician noun that is the person, not "Physician Liaison" or "Physician Assistant". */
const STRONG_PHYSICIAN = /\b(surgeon|physician)\b(?!\s+(assistant|associate|liaison|recruit\w*|relations|sourcing))/;
const NOT_PHYSICIAN = /\b(technologist|cytologist|histologist|cosmetologist|phlebotomist|audiologist|scribe|navigator|coordinator|liaison|recruiter|assistant|associate|student)\b/;
const NOT_TRAINEE = /\b(research fellow|summer|fellow of|facs|fellowship program|student)\b/;
const NURSING = /\b(rn|bsn|msn|lpn|lvn|nurse|nursing|rnfa|cnor|circulator|circulating)\b/;
const CLINICAL_SUPPORT = /\b(medical assistant|cma|rma|nrcma|ccma|surgical (tech|technician|technologist|assistant|first assistant)|scrub|surgical first|cst|technician|technologist|tech|sonographer|x-?ray|radiolog\w*|phlebotomist|scribe|patient care tech\w*|pct|esthetician|aesthetician|laser|injector|dme|casting|cast tech|orthotist|prosthetist|ortho tech|clinical (assistant|staff|research)|research (coordinator|nurse))\b/;
const ADMIN = /\b(manager|management|coordinator|director|administrator|administrative|admin|billing|biller|coder|coding|front desk|receptionist|scheduler|scheduling|office|accounting|accountant|bookkeeper|payroll|credentialing|compliance|insurance|prior auth\w*|authorization|patient (services|access|relations|advocate|representative)|representative|specialist|clerk|secretary|human resources|hr|it|ceo|coo|cfo|cmo|president|vice president|vp|owner|partner|consultant|analyst|operations|executive|assistant|concierge|client)\b/;

/** Physician specialties by title wording, broad level. Subspecialty (spine, sports, hand…) comes from SUBSPECIALTIES. */
const SPECIALTY_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(plastic|cosmetic surg|aesthetic surg|reconstructive surg|craniofacial)\w*/, "Plastic surgery"],
  [/\borthop(a)?edi\w*|\borthop(a)?edist\b/, "Orthopaedics"],
  [/\bneurosurg\w*|\bneurological surgeon\b/, "Neurosurgery"],
  [/\banesthesi\w*/, "Anesthesiology"],
  [/\bsports medicine\b/, "Sports medicine"],
  [/\bphysiatr\w*|physical medicine|pm&r|pm and r\b/, "PM&R"],
  [/\bpain\b/, "Pain medicine"],
  [/\bcardiothoracic|cardiac surg|thoracic surg/, "Cardiothoracic surgery"],
  [/\bcardiolog\w*/, "Cardiology"],
  [/\bdermatolog\w*|\bmohs\b/, "Dermatology"],
  [/\bemergency\b/, "Emergency medicine"],
  [/\bfamily (medicine|practice|physician)\b/, "Family medicine"],
  [/\binternal medicine|\binternist\b/, "Internal medicine"],
  [/\bhospitalist\b/, "Hospital medicine"],
  [/\bneurolog\w*/, "Neurology"],
  [/\b(ob\/?gyn|obstetric\w*|gyneco\w*)\b/, "OB/GYN"],
  [/\boncolog\w*|hematolog\w*/, "Oncology"],
  [/\bophthalmolog\w*|\bretina\b|\bcornea\b/, "Ophthalmology"],
  [/\botolaryngolog\w*|\bent\b|head and neck/, "ENT"],
  [/\bpediatric\w*|\bpediatrician\b/, "Pediatrics"],
  [/\bpsychiatr\w*/, "Psychiatry"],
  [/\bradiolog\w*/, "Radiology"],
  [/\burolog\w*/, "Urology"],
  [/\bgastroenterolog\w*/, "Gastroenterology"],
  [/\bpulmonolog\w*|critical care/, "Pulmonary and critical care"],
  [/\bpodiatr\w*|\bdpm\b/, "Podiatry"],
  [/\bvascular surg\w*/, "Vascular surgery"],
  [/\bgeneral surg\w*/, "General surgery"],
  [/\bbariatric\b/, "Bariatric surgery"],
  [/\bendocrinolog\w*/, "Endocrinology"],
  [/\bnephrolog\w*/, "Nephrology"],
  [/\brheumatolog\w*/, "Rheumatology"],
  [/\bpatholog\w*/, "Pathology"],
];

export interface RoleRead {
  group: RoleGroup;
  /** Broad specialty, physicians and trainees only ("Plastic surgery"). */
  specialty: string | null;
  /** Subspecialty label from the clinician engine ("Spine", "Sports Medicine"). */
  subspecialty: string | null;
}

/** Many profiles stack titles ("President, Plastic Surgeon"). Classify the clinical one when any. */
export function classifyRole(title: string | null | undefined): RoleRead {
  const t = String(title ?? "").toLowerCase().replace(/[|•·/]/g, " , ").replace(/\s+/g, " ").trim();
  if (!t) return { group: "other", specialty: null, subspecialty: null };

  let group: RoleGroup;
  const strong = STRONG_PHYSICIAN.test(t);
  if (ADMIN_OVERRIDE.test(t) && !strong) group = "admin";
  else if (CRNA.test(t)) group = "crna";
  else if (APP.test(t)) group = "app";
  else if (THERAPY.test(t) && !strong) group = "therapy";
  else if (TRAINEE.test(t) && !NOT_TRAINEE.test(t)) group = "trainee";
  else if (PHYSICIAN.test(t) && (strong || !NOT_PHYSICIAN.test(t))) group = "physician";
  else if (NURSING.test(t)) group = "nursing";
  else if (CLINICAL_SUPPORT.test(t)) group = "clinical_support";
  else if (ADMIN.test(t)) group = "admin";
  else group = "other";

  if (group !== "physician" && group !== "trainee") return { group, specialty: null, subspecialty: null };
  const spec = SPECIALTY_PATTERNS.find(([re]) => re.test(t))?.[1] ?? null;
  const sub = matchSubspecialty(t);
  return { group, specialty: spec, subspecialty: sub ? sub.def.label : null };
}

export interface RoleCount {
  group: RoleGroup;
  label: string;
  count: number;
}

/** Counts in display order, empty groups dropped. */
export function countRoles(groups: RoleGroup[]): RoleCount[] {
  const m = new Map<RoleGroup, number>();
  for (const g of groups) m.set(g, (m.get(g) ?? 0) + 1);
  return ROLE_GROUP_ORDER.filter((g) => (m.get(g) ?? 0) > 0).map((g) => ({ group: g, label: ROLE_GROUP_LABELS[g], count: m.get(g)! }));
}
