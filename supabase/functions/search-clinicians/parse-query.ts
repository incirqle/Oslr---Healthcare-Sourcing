/**
 * parse-query.ts — turn a recruiter's sentence into structured clinician
 * search criteria.
 *
 * Ported from search-talent/parse-query.ts. The two rules that file exists
 * to enforce carry over verbatim:
 *
 *  1. NEVER INVENT A REQUIREMENT. "Nurses" is a role CLASS, not a title
 *     guess (blueprint §12.2); stated titles ground in the provider's free
 *     autocomplete downstream, never in a model's synonym list.
 *  2. ONE MODEL, ONE PROMPT, ONE PATH. If the model is unavailable we
 *     degrade to a deterministic parse, never to a second model with a
 *     different opinion.
 */

import { callClaude, CLAUDE_HAIKU } from "./ai-router.ts";
import { SENIORITY_LEVELS } from "./clinician-criteria.ts";
import { CARE_SETTINGS, KEYWORD_EXPANSIONS, ROLE_CLASSES } from "./clinical-vocabulary.ts";

/* ------------------------------------------------------------------ */
/*  Post-AI keyword expansion — catches shorthand the AI might miss    */
/* ------------------------------------------------------------------ */

export function expandParsedKeywords(parsed: Record<string, unknown>, originalQuery: string): void {
  const specialties = (parsed.specialties as string[]) || [];
  const requiredKeywords = (parsed.required_keywords as string[]) || [];
  const queryLower = originalQuery.toLowerCase().trim();

  const words = queryLower.split(/\s+/);
  const phrasesToCheck = [queryLower, ...words];
  for (let i = 0; i < words.length - 1; i++) {
    phrasesToCheck.push(`${words[i]} ${words[i + 1]}`);
  }

  for (const phrase of phrasesToCheck) {
    const expansion = KEYWORD_EXPANSIONS[phrase];
    if (expansion) {
      for (const spec of expansion.specialties) {
        if (!specialties.includes(spec)) specialties.push(spec);
      }
      for (const kw of expansion.keywords) {
        if (!requiredKeywords.includes(kw)) requiredKeywords.push(kw);
      }
    }
  }

  if (specialties.length > 0) parsed.specialties = specialties;
  if (requiredKeywords.length > 0) parsed.required_keywords = requiredKeywords;
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                 */
/* ------------------------------------------------------------------ */

function clamp(v: unknown, min: number, max: number, def: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
function toStrArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => typeof x === "string").map(x => x.toLowerCase().trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(x => x.toLowerCase().trim()).filter(Boolean);
  return [];
}
function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.toLowerCase().trim() : null;
}
function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v.trim() : "")).filter(Boolean);
  }
  if (typeof value === "string") {
    return value.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

export interface ParsedClinicianPayload {
  job_titles: string[];
  title_synonyms: string[];
  title_confidence: number;
  role_class: string | null;
  credentials: string[];
  training_stage: { profession: string | null; stage: string | null; year: number | null } | null;
  care_setting: string | null;
  companies: string[];
  current_companies: string[];
  past_companies: string[];
  any_companies: string[];
  exclude_current_companies: string[];
  company_tense: "current" | "any";
  company_is_descriptor: boolean;
  specialty: string | null;
  specialties: string[];
  specialty_tense: "current" | "any" | "past";
  specialty_confidence: number;
  location: {
    state: string | null;
    state_confidence: number;
    city: string | null;
    city_confidence: number;
    metro: string | null;
    region_key: string | null;
  };
  preferred_city: string | null;
  current_role_only: boolean;
  keywords: string[];
  required_keywords: string[];
  min_years_experience: number | null;
  tenure_min_years: number | null;
  recently_changed_jobs: boolean;
  education_terms: string[];
  seniority_levels: string[];
  unmapped_concepts: string[];
  search_notes: string;
}

const VALID_STAGES = new Set(["residency", "fellowship", "internship", "medical_school"]);
const VALID_SPECIALTY_TENSES = new Set(["current", "any", "past"]);

export function validateAIOutput(raw: unknown): ParsedClinicianPayload {
  const r = (raw ?? {}) as Record<string, unknown>;
  const loc = (r.location ?? {}) as Record<string, unknown>;

  const minYearsRaw = r.min_years_experience;
  const minYearsNum = typeof minYearsRaw === "number" ? minYearsRaw : typeof minYearsRaw === "string" ? Number(minYearsRaw) : NaN;
  const minYearsExperience = Number.isFinite(minYearsNum) && minYearsNum > 0 ? Math.floor(minYearsNum) : null;

  const tenureRaw = r.tenure_min_years;
  const tenureNum = typeof tenureRaw === "number" ? tenureRaw : typeof tenureRaw === "string" ? Number(tenureRaw) : NaN;
  const tenureMinYears = Number.isFinite(tenureNum) && tenureNum > 0 ? Math.floor(tenureNum) : null;

  const excludeCurrent = toStrArr(r.exclude_current_companies);
  const current = toStrArr(r.current_companies);
  const currentSet = new Set(current);
  const past = toStrArr(r.past_companies).filter(c => !currentSet.has(c));
  const pastSet = new Set(past);
  const any = toStrArr(r.any_companies).filter(c => !currentSet.has(c) && !pastSet.has(c));

  // role_class: whitelisted against the vocabulary; unknown classes are
  // dropped (they would silently gate on nothing).
  const roleClassRaw = toStr(r.role_class);
  const roleClass = roleClassRaw && ROLE_CLASSES[roleClassRaw] ? roleClassRaw : null;

  // training_stage: {profession, stage, year} — stage whitelisted.
  let trainingStage: ParsedClinicianPayload["training_stage"] = null;
  const ts = r.training_stage;
  if (ts && typeof ts === "object" && !Array.isArray(ts)) {
    const row = ts as Record<string, unknown>;
    const stage = toStr(row.stage);
    if (stage && VALID_STAGES.has(stage)) {
      const yearNum = typeof row.year === "number" ? row.year : typeof row.year === "string" ? Number(row.year) : NaN;
      trainingStage = {
        profession: toStr(row.profession),
        stage,
        year: Number.isFinite(yearNum) && yearNum > 0 && yearNum <= 10 ? Math.floor(yearNum) : null,
      };
    }
  }

  const careSettingRaw = toStr(r.care_setting);
  const careSetting = careSettingRaw && CARE_SETTINGS[careSettingRaw] ? careSettingRaw : null;

  const specialtyTenseRaw = toStr(r.specialty_tense);
  const specialtyTense = (specialtyTenseRaw && VALID_SPECIALTY_TENSES.has(specialtyTenseRaw)
    ? specialtyTenseRaw
    : "current") as "current" | "any" | "past";

  return {
    job_titles: toStrArr(r.job_titles),
    title_synonyms: toStrArr(r.title_synonyms),
    title_confidence: clamp(r.title_confidence, 0, 1, 0.5),
    role_class: roleClass,
    credentials: toStrArr(r.credentials),
    training_stage: trainingStage,
    care_setting: careSetting,
    companies: toStrArr(r.companies),
    current_companies: current,
    past_companies: past,
    any_companies: any,
    exclude_current_companies: excludeCurrent,
    company_tense: r.company_tense === "any" ? "any" : "current",
    company_is_descriptor: r.company_is_descriptor === true,
    specialty: toStr(r.specialty),
    specialties: toStrArr(r.specialties),
    specialty_tense: specialtyTense,
    specialty_confidence: clamp(r.specialty_confidence, 0, 1, 0.5),
    location: {
      state: toStr(loc.state),
      state_confidence: clamp(loc.state_confidence, 0, 1, 0.5),
      city: toStr(loc.city),
      city_confidence: clamp(loc.city_confidence, 0, 1, 0.5),
      metro: toStr(loc.metro),
      region_key: toStr(loc.region_key),
    },
    preferred_city: toStr(r.preferred_city),
    current_role_only: r.current_role_only === false ? false : true,
    keywords: toStrArr(r.keywords),
    required_keywords: toStrArr(r.required_keywords),
    min_years_experience: minYearsExperience,
    tenure_min_years: tenureMinYears,
    recently_changed_jobs: r.recently_changed_jobs === true,
    education_terms: toStrArr(r.education_terms),
    // Case-preserving: the seniority enum is mixed-case; the mapper
    // canonicalizes case-insensitively.
    seniority_levels: toStringArray(r.seniority_levels),
    unmapped_concepts: toStrArr(r.unmapped_concepts),
    search_notes: typeof r.search_notes === "string" ? r.search_notes : "",
  };
}

/* ------------------------------------------------------------------ */
/*  Deterministic fallback                                             */
/* ------------------------------------------------------------------ */

/**
 * Minimal parsed structure from keyword expansion alone, no model call.
 * Deliberately leaves job_titles empty and guesses no role class beyond
 * unambiguous whole words — no stated requirement means no requirement.
 */
function deterministicFallback(query: string): Record<string, unknown> {
  const q = query.toLowerCase();
  const pastPatterns = /\b(former|formerly|ex-|previously|used to|background)\b/i;

  const parsed: Record<string, unknown> = {
    locations: [],
    specialties: [],
    required_keywords: [],
    job_titles: [],
    current_role_only: !pastPatterns.test(query),
    specialty_tense: /\bbackground\b/i.test(query) ? "any" : "current",
  };

  // Unambiguous role-class words only.
  if (/\bnurses?\b/.test(q) && !/\bnurse practitioners?\b/.test(q)) parsed.role_class = "nurse";
  else if (/\bnurse practitioners?\b/.test(q)) parsed.role_class = "nurse_practitioner";
  else if (/\bphysicians?\b|\bdoctors?\b|\bsurgeons?\b/.test(q)) parsed.role_class = "physician";
  else if (/\bresidents?\b/.test(q)) parsed.role_class = "resident";
  else if (/\bpharmacists?\b/.test(q)) parsed.role_class = "pharmacist";
  else if (/\btherapists?\b/.test(q)) parsed.role_class = "therapist";

  expandParsedKeywords(parsed, query);
  return parsed;
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */

function clinicianParserPrompt(): string {
  const enumList = SENIORITY_LEVELS.map((v) => `"${v}"`).join(", ");
  const roleClasses = Object.keys(ROLE_CLASSES).map((k) => `"${k}"`).join(", ");
  const careSettings = Object.keys(CARE_SETTINGS).map((k) => `"${k}"`).join(", ");
  return `
You are the query parser for a clinical healthcare SOURCING search engine.
Recruiters use it to find clinicians: nurses, physicians, residents and
fellows, NPs, PAs, CRNAs, therapists, pharmacists, techs.

DOMAIN IS IMPLICIT: every query is US clinical healthcare. Words like
"nurse", "resident", "attending", "unit", "floor" carry their clinical
meaning.

Parse the query and return ONLY valid JSON. No markdown, no explanation.

THE MOST IMPORTANT RULE — DO NOT INVENT REQUIREMENTS.
Extract only what the user actually asked for. An empty array is a correct
and common answer. In particular:
  - "nurses", "physicians", "residents", "doctors" are ROLE CLASSES, not
    titles. Set role_class; leave job_titles [].
  - Only fill job_titles when the user names an actual title: "charge
    nurses", "nurse managers", "chief residents", "medical directors".
  - NEVER turn a role class into a guessed title list. An invented title is
    enforced downstream and removes the very people the user wanted.

TENSE IS A REQUIREMENT (the most important nuance):
  - Identity phrasing ("cardiovascular nurses", "ICU nurses") means the
    specialty is their CURRENT work → specialty_tense: "current".
  - "background in X" / "experience in X" licenses history → specialty_tense: "any".
  - "used to work in X" / "formerly in X" as the role itself means the X part
    is explicitly PAST → specialty_tense: "past"; put what they do NOW in the
    other fields. Example below.

RETURN THIS EXACT SHAPE:
{
  "job_titles":        string[],   // ONLY titles the user named. [] is normal.
  "title_synonyms":    string[],   // 2-4 variants of a NAMED title. [] when job_titles is [].
  "title_confidence":  number,     // 0.0-1.0
  "role_class":        string|null,  // one of: ${roleClasses}. The license-class population the user asked for. null when they named a specific title instead.
  "credentials":       string[],   // credential/license tokens the user stated: "RN","BSN","NP","MD","DO","DPM","CRNA","PA-C","CCRN","CNOR"… [] when unstated. Credentials are classes, never titles.
  "training_stage":    {"profession": string|null, "stage": "residency"|"fellowship"|"internship"|"medical_school", "year": number|null} | null,
                       // "PGY-3 podiatric residents" -> {"profession":"podiatric","stage":"residency","year":3}
                       // "cardiology fellows" -> {"profession":"cardiology","stage":"fellowship","year":null}
                       // "third-year medical students" -> {"profession":null,"stage":"medical_school","year":3}
                       // null when the ask is not about trainees. When training_stage is set, also set role_class ("resident"/"fellow") only if it adds nothing contradictory; job_titles stays [].
  "care_setting":      string|null,  // one of: ${careSettings}. "hospital nurses" -> "hospital"; "home health PTs" -> "home_health". null when unstated. This is a PREFERENCE surface (ranked, not required).
  "companies":           string[],   // legacy mirror of current_companies
  "current_companies":   string[],   // employers they work at now ("at Baylor", "at the VA")
  "past_companies":      string[],   // employers they worked at before
  "any_companies":       string[],   // either tenure
  "exclude_current_companies": string[],  // "used to work at X" -> X here AND in past_companies
  "company_tense":       "current"|"any",
  "company_is_descriptor": boolean,  // true when the "company" is a facility CLASS ("surgical centers") — prefer care_setting for these.
  "specialty":           string|null,   // primary clinical specialty/service line
  "specialties":         string[],      // all specialty terms (canonical, lowercase)
  "specialty_tense":     "current"|"any"|"past",  // see TENSE rules above
  "specialty_confidence": number,
  "location": {
    "state": string|null, "state_confidence": number,
    "city": string|null,  "city_confidence": number,
    "metro": string|null,
    "region_key": string|null  // ONLY: "bay_area","northern_california","southern_california","dfw_metroplex","houston_metro","new_england","pacific_northwest","midwest","southeast". Anything else: null + keep the state + note it in unmapped_concepts.
  },
  "preferred_city":      string|null,  // "ideally near X" is a preference: city here, only its STATE in location.
  "current_role_only":   boolean,
  "keywords":            string[],
  "required_keywords":   string[],
  "min_years_experience": number|null,  // CAREER years: "5 years of experience" -> 5
  "tenure_min_years":     number|null,  // years at the CURRENT employer/role: "5 years at Baylor" -> 5
  "recently_changed_jobs": boolean,
  "education_terms":     string[],   // degree/program phrases ("bsn", "doctor of nursing practice", "podiatric medicine")
  "seniority_levels":    string[],   // ONLY explicit leadership-class asks, verbatim from: ${enumList}. "nurse leaders / CNOs" -> ["CXO","Vice President","Director"]. NEVER for trainees or bedside roles. [] otherwise.
  "unmapped_concepts":   string[],   // stated requirements no field expresses ("level 1 trauma center", "magnet hospital", "night shift", "open to relocating"). NEVER silently drop a stated requirement.
  "search_notes":        string
}

CONFIDENCE SCALE: 0.9+ explicit | 0.7-0.89 implied | 0.5-0.69 inferred | <0.5 uncertain

WORKED EXAMPLES (the three archetypes + the tense query):

1) "Find me PGY-3 podiatric residents in the state of Texas."
   role_class: "resident", training_stage: {"profession":"podiatric","stage":"residency","year":3},
   job_titles: [], credentials: [], specialty: "podiatry", specialties: ["podiatry"],
   specialty_tense: "current", location: {"state":"texas", ...}

2) "Find me nurses with a cardiovascular background with 5 years of experience."
   role_class: "nurse", job_titles: [], specialty: "cardiovascular",
   specialties: ["cardiovascular"], specialty_tense: "any"  // "background" licenses history
   min_years_experience: 5

3) "Find all the orthopedic physicians at the VA."
   role_class: "physician", job_titles: [], specialty: "orthopedic",
   specialties: ["orthopedic"], specialty_tense: "current",
   current_companies: ["the va"]   // the engine resolves the VA entity group

4) "Nurses who used to work in the operating room and are now on a med-surg floor in Dallas."
   role_class: "nurse", job_titles: [],
   specialties: ["operating room", "perioperative"], specialty_tense: "past",
   required_keywords: ["med surg", "medical surgical"],  // their CURRENT floor
   location: {"city":"dallas","state":"texas", ...}

COMPANY EXTRACTION:
  Each employer appears in EXACTLY ONE company field.
   "at [X]" / "works at [X]"                          -> current_companies
   "former [X]" / "used to work at [X]" / "left [X]"  -> past_companies AND exclude_current_companies
   "ever worked at [X]" / "background at [X]"         -> any_companies
  Default to current when unqualified. Cap 5 per field. Health systems keep
  their stated name ("baylor scott & white", "uchealth", "the va").

OTHER RULES:
  1. All string values lowercase, except seniority_levels (verbatim enum).
  2. "PGY" alone with no profession still sets training_stage with
     profession null — never put "pgy" in keywords or titles (it matches
     pharmacy residents almost exclusively).
  3. Abbreviations expand to canonical terms in specialties: cath lab, CVICU,
     CCU -> cardiovascular family; OR -> operating room/perioperative;
     L&D -> labor and delivery; med-surg -> medical surgical.
`;
}

/* ------------------------------------------------------------------ */
/*  Entry point                                                        */
/* ------------------------------------------------------------------ */

export async function parseQuery(
  query: string,
  clientParsed?: Record<string, unknown> | null,
): Promise<Record<string, unknown>> {
  if (clientParsed && typeof clientParsed === "object" && Object.keys(clientParsed).length > 0) {
    console.log("[Parser] Reusing the parse supplied by the client (no model call).");
    // Re-validate: cached parses came from this validator, but never trust
    // the wire.
    const revalidated = validateAIOutput(clientParsed) as unknown as Record<string, unknown>;
    return revalidated;
  }

  const raw = await callClaude<unknown>(
    clinicianParserPrompt(),
    query,
    null,
    "Clinician-Parser",
    { model: CLAUDE_HAIKU, timeoutMs: 8000, maxTokens: 1500 },
  );

  if (raw === null) {
    console.warn("[Parser] No usable model output — using the deterministic parse.");
    return deterministicFallback(query);
  }

  const parsed = validateAIOutput(raw) as unknown as Record<string, unknown>;
  expandParsedKeywords(parsed, query);
  console.log("[Parser] Parsed:", JSON.stringify(parsed));
  return parsed;
}
