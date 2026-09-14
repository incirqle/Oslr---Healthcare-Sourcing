/**
 * employer-class.ts — THE GREAT INVERSION (blueprint §13).
 *
 * The reference engine's provider-employers.ts EXCLUDES care-delivery
 * organisations from results, because hospitals are not commercial hiring
 * targets for medtech sales. For Oslr they are exactly the population.
 *
 * This module ports the same name-classification knowledge as a CLASSIFIER
 * only: it tags each employer as care-delivery ("provider"), commercial
 * ("commercial" — device/pharma/staffing vendors), or "unknown". The tag
 * feeds card chips and the grader's context. IT IS NEVER A RESULT FILTER —
 * there is deliberately no partition/exclude function in this file, and the
 * engine must never drop a row on this classification.
 */

const PROVIDER_TERMS: string[] = [
  "hospital", "hospitals", "health system", "healthcare system", "health network",
  "medical center", "medical centre", "medical group", "physician group",
  "physicians group", "medical associates", "surgery center", "surgical center",
  "ambulatory surgery", "clinic", "clinics", "healthcare", "health care",
  "kaiser", "permanente", "mayo", "cleveland clinic", "va medical",
  "veterans affairs", "veterans health", "school of medicine", "college of medicine",
  "medical school", "university health", "health sciences", "children's hospital",
  "cancer center", "orthopedic institute", "orthopaedic institute",
  "houston methodist", "methodist", "cedars-sinai", "mount sinai", "northwell",
  "ochsner", "geisinger", "intermountain", "banner health", "providence st",
  "dignity health", "ascension", "trinity health", "commonspirit", "common spirit",
  "advocate aurora", "atrium health", "novant", "sanford health", "scripps",
  "sharp healthcare", "tenet health", "hca ", "sutter", "memorial hermann",
  "presbyterian", "baptist health", "johns hopkins", "massachusetts general",
  "brigham and women", "nyu langone", "mount carmel",
  "home health", "hospice", "skilled nursing", "rehabilitation hospital",
  "urgent care", "dialysis",
];

/** Names that CONTAIN a provider term but are commercial vendors. */
const COMMERCIAL_TERMS: string[] = [
  "zimmer biomet", "nuvasive", "globus medical", "stryker", "medtronic",
  "johnson & johnson", "depuy", "smith & nephew", "arthrex", "boston scientific",
  "abbott", "becton", "baxter", "cardinal health", "mckesson", "olympus",
  "intuitive surgical", "philips", "ge healthcare", "siemens healthineers",
  "pfizer", "merck", "amgen", "eli lilly", "novartis", "astrazeneca",
  // healthcare staffing / travel agencies — commercial, and useful to badge:
  // a travel nurse's W2 employer is the agency, not the facility.
  "aya healthcare", "amn healthcare", "cross country", "travel nurse",
  "medical solutions", "trusted health", "vivian health", "nomad health",
];

const PROVIDER_STRONG_SUFFIX = /\b(health system|healthcare|health care|hospital|clinic)\b/i;
const PROVIDER_SUFFIX = /\b(health|medicine|medical)\b\s*$/i;

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export type EmployerClass = "provider" | "commercial" | "unknown";

/** Classify an employer name. Tag only — never filter on this. */
export function classifyEmployer(name: string | null | undefined): EmployerClass {
  if (!name || typeof name !== "string") return "unknown";
  const n = normalizeName(name);
  if (!n) return "unknown";
  for (const c of COMMERCIAL_TERMS) {
    if (n.includes(c)) return "commercial";
  }
  for (const term of PROVIDER_TERMS) {
    if (n.includes(term)) return "provider";
  }
  if (PROVIDER_STRONG_SUFFIX.test(n) || PROVIDER_SUFFIX.test(n)) return "provider";
  return "unknown";
}
