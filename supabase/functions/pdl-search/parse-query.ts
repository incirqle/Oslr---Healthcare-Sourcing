/**
 * parse-query.ts — L2 Claude AI parser with per-field confidence scores.
 * Primary: Claude Haiku via ai-router.ts
 * Fallback: Gemini Flash via Lovable AI Gateway
 * Last resort: Deterministic keyword expansion
 *
 * Tuned for CLINICAL HEALTHCARE professionals (physicians, nurses, NPs, PAs, allied health).
 */

import { callClaude, CLAUDE_HAIKU } from "./ai-router.ts";
import { KEYWORD_EXPANSIONS } from "./config.ts";

/* ------------------------------------------------------------------ */
/* Post-AI keyword expansion                                           */
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
/* Validation helpers                                                   */
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

/* ------------------------------------------------------------------ */
/* Parsed Payload interface                                             */
/* ------------------------------------------------------------------ */

export interface ParsedPayload {
  job_titles: string[];
  title_synonyms: string[];
  title_confidence: number;
  companies: string[];
  company_confidence: number;
  current_companies: string[];
  past_companies: string[];
  any_companies: string[];
  specialty: string | null;
  specialty_confidence: number;
  seniority: string | null;
  location: {
    state: string | null;
    state_confidence: number;
    city: string | null;
    city_confidence: number;
    metro: string | null;
  };
  current_role_only: boolean;
  current_role_confidence: number;
  credentials: string[];
  keywords: string[];
  search_notes: string;
}

/* ------------------------------------------------------------------ */
/* Strict AI output validation                                          */
/* ------------------------------------------------------------------ */

export function validateAIOutput(raw: unknown): ParsedPayload {
  const r = (raw ?? {}) as Record<string, unknown>;
  const loc = (r.location ?? {}) as Record<string, unknown>;

  const current = toStrArr(r.current_companies);
  const currentSet = new Set(current);
  const past = toStrArr(r.past_companies).filter(c => !currentSet.has(c));
  const pastSet = new Set(past);
  const any = toStrArr(r.any_companies).filter(c => !currentSet.has(c) && !pastSet.has(c));

  return {
    job_titles: toStrArr(r.job_titles),
    title_synonyms: toStrArr(r.title_synonyms),
    title_confidence: clamp(r.title_confidence, 0, 1, 0.5),
    companies: toStrArr(r.companies),
    company_confidence: clamp(r.company_confidence, 0, 1, 0.5),
    current_companies: current,
    past_companies: past,
    any_companies: any,
    specialty: toStr(r.specialty),
    specialty_confidence: clamp(r.specialty_confidence, 0, 1, 0.5),
    seniority: toStr(r.seniority),
    location: {
      state: toStr(loc.state),
      state_confidence: clamp(loc.state_confidence, 0, 1, 0.5),
      city: toStr(loc.city),
      city_confidence: clamp(loc.city_confidence, 0, 1, 0.5),
      metro: toStr(loc.metro),
    },
    current_role_only: r.current_role_only !== false,
    current_role_confidence: clamp(r.current_role_confidence, 0, 1, 0.5),
    credentials: toStrArr(r.credentials),
    keywords: toStrArr(r.keywords),
    search_notes: typeof r.search_notes === "string" ? r.search_notes : "",
  };
}

/* ------------------------------------------------------------------ */
/* Role word guardrail — force-populate titles when AI misses           */
/* ------------------------------------------------------------------ */

const GENERIC_CATEGORY_PATTERN = /^(doctors?|nurses?|providers?|clinicians?|professionals?|practitioners?|staff|healthcare workers?|people|candidates|contacts)$/i;

function isGenericCategoryQuery(query: string): boolean {
  const words = query.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
  const roleWords = words.filter(w => GENERIC_CATEGORY_PATTERN.test(w));
  if (roleWords.length === 0) return false;
  const specialtyModifiers = /\b(cardiology|cardiac|orthopedic|ortho|oncology|neurology|neuro|emergency|icu|surgical|pediatric|obgyn|psych|radiology|anesthesia|dermatology|gastro|pulmonary|nephrology|endo|urology|ent|ophthalmology|pain|wound|trauma|spine|critical care|primary care|family medicine|internal medicine|geriatric|hospice|dialysis|home health|nicu|labor and delivery)\b/i;
  return !specialtyModifiers.test(query);
}

const ROLE_WORD_PATTERNS: { pattern: RegExp; titles: string[] }[] = [
  { pattern: /\b(physician|physicians|doctor|doctors|md|do)\b/i, titles: ["physician", "doctor", "attending physician", "hospitalist"] },
  { pattern: /\b(surgeon|surgeons)\b/i, titles: ["surgeon", "general surgeon", "attending surgeon"] },
  { pattern: /\bnurse practitioners?\b|\bnps?\b(?!\s*[.])/i, titles: ["nurse practitioner", "aprn", "family nurse practitioner"] },
  { pattern: /\bphysician assistants?\b|\bpa-?cs?\b/i, titles: ["physician assistant", "pa-c", "certified physician assistant"] },
  { pattern: /\b(registered nurses?|rns?)\b/i, titles: ["registered nurse", "rn", "staff nurse", "charge nurse", "clinical nurse"] },
  { pattern: /\b(lpn|lvn|licensed practical nurse|licensed vocational nurse)\b/i, titles: ["licensed practical nurse", "lpn", "licensed vocational nurse", "lvn"] },
  { pattern: /\b(cna|certified nursing assistant)\b/i, titles: ["certified nursing assistant", "cna", "patient care technician"] },
  { pattern: /\b(physical therapist|pt|dpt)\b/i, titles: ["physical therapist", "pt", "dpt"] },
  { pattern: /\b(occupational therapist|ot|otr)\b/i, titles: ["occupational therapist", "ot", "otr"] },
  { pattern: /\b(speech language pathologist|slp|speech therapist)\b/i, titles: ["speech language pathologist", "slp", "speech therapist"] },
  { pattern: /\b(respiratory therapist|rrt)\b/i, titles: ["respiratory therapist", "rrt"] },
  { pattern: /\b(pharmacist|pharmd)\b/i, titles: ["pharmacist", "clinical pharmacist", "staff pharmacist"] },
  { pattern: /\b(medical assistant|cma)\b/i, titles: ["medical assistant", "certified medical assistant"] },
  { pattern: /\b(crna|nurse anesthetist)\b/i, titles: ["crna", "certified registered nurse anesthetist", "nurse anesthetist"] },
  { pattern: /\b(srna|student (registered )?nurse anesthetist|student crna)\b/i, titles: ["srna", "student registered nurse anesthetist", "student nurse anesthetist"] },
  { pattern: /\b(residents?|resident physicians?)\b/i, titles: ["resident physician", "resident", "medical resident"] },
  { pattern: /\b(fellows?|clinical fellows?)\b/i, titles: ["fellow", "clinical fellow"] },
  { pattern: /\b(medical student|med student|ms[1-4])\b/i, titles: ["medical student"] },
  { pattern: /\b(nursing student|student nurses?|bsn student)\b/i, titles: ["nursing student", "student nurse"] },
  { pattern: /\b(pa student|physician assistant student)\b/i, titles: ["physician assistant student", "pa student"] },
  { pattern: /\b(medical director|cmo)\b/i, titles: ["medical director", "chief medical officer"] },
  { pattern: /\b(nurse manager)\b/i, titles: ["nurse manager", "nursing manager", "clinical nurse manager"] },
  { pattern: /\b(director of nursing|don|cno)\b/i, titles: ["director of nursing", "chief nursing officer", "nursing director"] },
  { pattern: /\b(case manager)\b/i, titles: ["case manager", "rn case manager", "care coordinator"] },
  { pattern: /\b(dentist|dds|dmd)\b/i, titles: ["dentist", "dds", "dmd"] },
  { pattern: /\b(dental hygienist|rdh)\b/i, titles: ["dental hygienist", "rdh"] },
  { pattern: /\b(hospitalist)\b/i, titles: ["hospitalist", "attending hospitalist", "nocturnist"] },
  { pattern: /\b(travel nurse|travel rn|locum tenens|locums)\b/i, titles: ["travel nurse", "travel rn", "locum tenens"] },
];

function enforceRoleWordTitles(parsed: Record<string, unknown>, query: string): void {
  const titles = (parsed.job_titles as string[]) || [];
  if (titles.length > 0) return;

  const queryLower = query.toLowerCase();
  const matchedTitles: string[] = [];

  for (const { pattern, titles } of ROLE_WORD_PATTERNS) {
    if (pattern.test(queryLower)) {
      for (const t of titles) {
        if (!matchedTitles.includes(t)) matchedTitles.push(t);
      }
    }
  }

  if (matchedTitles.length > 0) {
    parsed.job_titles = matchedTitles;
    console.log("[GUARDRAIL] AI returned empty job_titles — forced:", matchedTitles);
  }
}

/* ------------------------------------------------------------------ */
/* Deterministic fallback — no AI                                       */
/* ------------------------------------------------------------------ */

function deterministicFallback(query: string): Record<string, unknown> {
  const pastPatterns = /\b(former|ex-|previously|used to|past|background|before|once worked)\b/i;
  const currentRoleOnly = !pastPatterns.test(query);

  const parsed: Record<string, unknown> = {
    locations: [],
    specialties: [],
    required_keywords: [],
    job_titles: [],
    current_role_only: currentRoleOnly,
  };

  expandParsedKeywords(parsed, query);

  const hasSpecialtyIntent = ((parsed.specialties as string[]) || []).length > 0 ||
    ((parsed.required_keywords as string[]) || []).length > 0;

  if (!hasSpecialtyIntent) {
    parsed.job_titles = [
      "physician", "nurse practitioner", "physician assistant",
      "registered nurse", "hospitalist", "medical director",
    ];
  }

  return parsed;
}

/* ------------------------------------------------------------------ */
/* Normalize parsed payload                                             */
/* ------------------------------------------------------------------ */

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => typeof x === "string").map(x => x.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map(x => x.trim()).filter(Boolean);
  return [];
}

function normalizeParsedPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    locations: [],
    specialties: [],
    required_keywords: [],
    min_years_experience: null,
    seniority: null,
    current_company: null,
    current_companies: [],
    previous_companies: [],
    exclude_current_companies: [],
    job_titles: [],
    past_titles: [],
    skills: [],
    credentials: [],
    free_text: "",
    person_names: [],
    current_role_only: false,
  };

  normalized.locations = toStringArray(raw.locations);
  normalized.specialties = toStringArray(raw.specialties);
  normalized.required_keywords = toStringArray(raw.required_keywords);
  normalized.job_titles = toStringArray(raw.job_titles);
  normalized.past_titles = toStringArray(raw.past_titles);
  normalized.skills = toStringArray(raw.skills);
  normalized.credentials = toStringArray(raw.credentials);
  normalized.person_names = toStringArray(raw.person_names);
  normalized.previous_companies = toStringArray(raw.previous_companies);
  normalized.exclude_current_companies = toStringArray(raw.exclude_current_companies);
  normalized.current_role_only = raw.current_role_only === false ? false : true;

  const currentCompanies = toStringArray(raw.current_companies);
  const currentCompany = typeof raw.current_company === "string" ? raw.current_company.trim() : "";
  if (currentCompanies.length > 0) normalized.current_companies = currentCompanies;
  if (currentCompany) {
    normalized.current_company = currentCompany;
  } else if (currentCompanies.length === 1) {
    normalized.current_company = currentCompanies[0];
  }

  const minYearsRaw = raw.min_years_experience;
  const parsedMinYears = typeof minYearsRaw === "number" ? minYearsRaw : typeof minYearsRaw === "string" ? Number(minYearsRaw) : null;
  if (parsedMinYears !== null && Number.isFinite(parsedMinYears) && parsedMinYears >= 0) {
    normalized.min_years_experience = Math.floor(parsedMinYears);
  }

  if (typeof raw.seniority === "string" && raw.seniority.trim()) {
    normalized.seniority = raw.seniority.trim();
  }

  // Pass through L2 fields for the frontend
  if (raw.location) normalized.location = raw.location;
  if (raw.specialty) normalized.specialty = raw.specialty;
  if (raw.specialty_confidence !== undefined) normalized.specialty_confidence = raw.specialty_confidence;
  if (raw.title_confidence !== undefined) normalized.title_confidence = raw.title_confidence;
  if (raw.company_confidence !== undefined) normalized.company_confidence = raw.company_confidence;
  if (raw.title_synonyms) normalized.title_synonyms = raw.title_synonyms;
  if (raw.search_notes) normalized.search_notes = raw.search_notes;
  if (raw.keywords) normalized.keywords = raw.keywords;

  return normalized;
}

/* ------------------------------------------------------------------ */
/* L2 System Prompt — Claude parser for clinical healthcare             */
/* ------------------------------------------------------------------ */

const L2_SYSTEM_PROMPT = `You are a clinical healthcare workforce intelligence engine. Parse the user query and return ONLY valid JSON. No markdown, no explanation.

SCOPE — CLINICAL ROLES ONLY:
Extract ONLY clinical healthcare professionals: physicians (MDs, DOs, residents, fellows, interns, medical students), nurses (RNs, LPNs, NPs, CRNAs, nursing students, SRNAs), physician assistants (PA-Cs, PA students), therapists (PT, OT, SLP, RT), pharmacists, medical assistants, dentists, dental hygienists, optometrists (ODs), and allied health professionals.

OPTOMETRY IS IN SCOPE. "optometrist" / "OD" / "doctor of optometry" → job_titles: ["optometrist", "doctor of optometry", "od"], specialty: "optometry". Do NOT mark as out of scope. Optometry is distinct from ophthalmology (an MD specialty) — both are in scope.

NON-CLINICAL roles are OUT OF SCOPE. When the query targets a non-clinical role (risk manager, compliance officer, billing, coding, HR, recruiter, IT, administrator without clinical license, executive, marketing, finance, operations, facilities, food service, security, clerical, janitorial), return:
- job_titles: []
- specialty: null
- seniority: null
- credentials: []
- search_notes: "out of scope: non-clinical role"
Still extract companies and location. Do not fabricate clinical titles to rescue the query.

RETURN THIS EXACT SHAPE:
{
  "job_titles": string[],
  "title_synonyms": string[],
  "title_confidence": number,
  "companies": string[],
  "company_confidence": number,
  "current_companies": string[],
  "past_companies": string[],
  "any_companies": string[],
  "specialty": string|null,
  "specialty_confidence": number,
  "seniority": string|null,
  "location": {
    "state": string|null,
    "state_confidence": number,
    "city": string|null,
    "city_confidence": number,
    "metro": string|null
  },
  "current_role_only": boolean,
  "current_role_confidence": number,
  "credentials": string[],
  "keywords": string[],
  "search_notes": string
}

CLINICAL TITLE RULES:
- "doctor" or "physician" → job_titles: ["physician", "attending physician", "hospitalist"]
- "nurse" alone → job_titles: ["registered nurse", "rn", "staff nurse"]
- "NP" or "nurse practitioner" → job_titles: ["nurse practitioner", "aprn", "fnp"]
- "PA" or "physician assistant" → job_titles: ["physician assistant", "pa-c"]
- "surgeon" → job_titles: ["surgeon"], specialty from context
- "CRNA" → job_titles: ["crna", "nurse anesthetist"]
- Specialty-modified generic: "cardiac nurse" → job_titles: ["registered nurse", "rn"], specialty: "cardiology"

TRAINING STAGE — set seniority: "training":
When the query targets anyone currently in a clinical training program (residency, fellowship, nursing school, PA school, SRNA program, medical school), set seniority: "training" AND use training-appropriate job_titles.

- "resident" / "residents" / "resident physician" → job_titles: ["resident physician", "resident"], seniority: "training"
- "fellow" / "fellows" (clinical context) → job_titles: ["fellow", "clinical fellow"], seniority: "training"
- "intern" / "interns" (clinical context, not summer/corporate interns) → job_titles: ["intern", "medical intern"], seniority: "training"
- "medical student" / "med student" / "ms1"–"ms4" → job_titles: ["medical student"], seniority: "training"
- "nursing student" / "student nurse" / "bsn student" → job_titles: ["nursing student", "student nurse"], seniority: "training"
- "SRNA" / "student nurse anesthetist" / "student CRNA" → job_titles: ["srna", "student registered nurse anesthetist"], specialty: "nurse anesthesia", seniority: "training"
- "PA student" / "physician assistant student" → job_titles: ["physician assistant student", "pa student"], seniority: "training"

Specialty-qualified training examples:
- "cardiology fellows at Cleveland Clinic" → job_titles: ["cardiology fellow", "fellow"], specialty: "cardiology", seniority: "training", current_companies: ["cleveland clinic"]
- "IM residents at MGH" → job_titles: ["internal medicine resident", "resident physician"], specialty: "internal medicine", seniority: "training", current_companies: ["massachusetts general hospital"]
- "surgical residents at NYU" → job_titles: ["surgical resident", "general surgery resident"], specialty: "surgery", seniority: "training", current_companies: ["nyu langone"]
- "NICU nursing students at HCA" → job_titles: ["nursing student", "student nurse"], specialty: "neonatal", seniority: "training", current_companies: ["hca healthcare"]

seniority takes ONLY "training" today. For every non-training query, seniority: null. Do not use "entry", "senior", "lead", "mid", "junior" — these are not supported yet.

GENERIC CATEGORY NOUNS — DO NOT extract as job_titles:
providers, clinicians, professionals, practitioners, staff, healthcare workers, people, candidates, contacts.
Set job_titles: [] for these. ONLY extract job_titles when the user specifies a DISTINCT clinical role.

When a specialty is combined with a generic word:
- "cardiac nurses in Atlanta" → job_titles: ["registered nurse", "rn"], specialty: "cardiology"
- "orthopedic surgeons in Dallas" → job_titles: ["surgeon", "orthopedic surgeon"], specialty: "orthopedics"
- "ER providers in Miami" → job_titles: [], specialty: "emergency medicine"

COMPANY EXTRACTION:
  Extract organization references (health systems, hospitals, clinics) into one of three fields.
  CRITICAL: Each company name must appear in EXACTLY ONE field. Never duplicate across fields.
  Default to current_companies if no qualifier is present.
  Field selection rules:
   "work with [Org]" / "at [Org]" / "from [Org]" / "working at [Org]" → current_companies ONLY
   "former [Org]" / "ex-[Org]" / "used to work at" / "left [Org]" / "was at" / "previously at" / "came from" → past_companies ONLY
   "ever worked at" / "have worked at" / "background at" / "current or former" → any_companies ONLY
   When in doubt, use current_companies — never duplicate across fields.
  Cap at 5 organizations per field. If more than 5 are listed, take the first 5 and ignore the rest.

  CRITICAL — NEVER include city/state/location words in the company name:
    Company names must contain ONLY the organization name. Cities, states, regions, and location words
    go into the location field, NOT appended to the company name.
    "doctors at UC Health Denver" → current_companies: ["uchealth"], location.city: "denver"
    "nurses at HCA in Dallas Texas" → current_companies: ["hca healthcare"], location.city: "dallas", location.state: "texas"
    "surgeons at Mayo Clinic Rochester" → current_companies: ["mayo clinic"], location.city: "rochester"
    "providers at UCHealth Aurora Colorado" → current_companies: ["uchealth"], location.city: "aurora", location.state: "colorado"
    "PAs at Cleveland Clinic Florida" → current_companies: ["cleveland clinic"], location.state: "florida"
    WRONG: current_companies: ["uc health denver"] ← city merged into company name
    WRONG: current_companies: ["mayo clinic rochester"] ← city merged into company name
    WRONG: current_companies: ["hca dallas"] ← city merged into company name

  Common health system aliases (use the canonical form):
    "UC Health" / "UCHealth" / "University of Colorado Health" → "uchealth"
    "Mayo" / "Mayo Clinic" → "mayo clinic"
    "HCA" / "HCA Healthcare" → "hca healthcare"
    "Kaiser" / "Kaiser Permanente" → "kaiser permanente"
    "Cleveland Clinic" → "cleveland clinic"
    "Ascension" → "ascension"
    "CommonSpirit" / "Common Spirit" → "commonspirit health"
    "Intermountain" → "intermountain health"
    "Providence" → "providence"
    "Advocate Aurora" → "advocate aurora health"
    "NYU Langone" / "NYU" (healthcare context) → "nyu langone"
    "Mass General" / "MGH" → "massachusetts general hospital"
    "Brigham" / "BWH" → "brigham and women's hospital"

  Examples:
    "Physicians at Mayo Clinic and Cleveland Clinic" → current_companies: ["mayo clinic", "cleveland clinic"]
    "RN from Johns Hopkins" → current_companies: ["johns hopkins"]
    "former Stanford Health nurse" → past_companies: ["stanford health"]
    "staff with UCLA or UCSF background" → any_companies: ["ucla", "ucsf"]
    "orthopedic doctors at uc health in denver" → current_companies: ["uchealth"], location.city: "denver"
    "cardiologists at mayo clinic" → current_companies: ["mayo clinic"]

CREDENTIAL EXTRACTION: RN, BSN, MSN, MD, DO, NP, APRN, PA-C, PT, DPT, OT, SLP, RT, RRT, CRNA, SRNA, DDS, DMD, PharmD.

CONFIDENCE SCALE: 0.9+ explicit | 0.7-0.89 implied | 0.5-0.69 inferred | <0.5 uncertain

RULES:
1. All string values lowercase.
2. title_synonyms: generate variants a healthcare profile might use for the same role.
3. current_role_only=true unless: former, ex-, previously, past, background, before.
4. Small states (DE,RI,VT,WY): set metro to nearest major city.
5. seniority takes ONLY "training" today — null otherwise.
6. Non-clinical queries: empty job_titles + "out of scope: non-clinical role" in search_notes. Do not fabricate clinical titles.`;

const AI_SYSTEM_PROMPT = L2_SYSTEM_PROMPT;

/* ------------------------------------------------------------------ */
/* Primary L2 parse — Claude Haiku                                      */
/* ------------------------------------------------------------------ */

export async function parseQuery(
  query: string,
  lovableKey: string | undefined,
  clientParsed?: Record<string, unknown> | null
): Promise<Record<string, unknown>> {
  if (clientParsed && typeof clientParsed === "object" && Object.keys(clientParsed).length > 0) {
    const parsed = normalizeParsedPayload(clientParsed);
    console.log("Using cached parsed data from client (skipped AI call)");
    return parsed;
  }

  // Try Claude L2 first
  try {
    const raw = await callClaude<Record<string, unknown>>(
      L2_SYSTEM_PROMPT,
      query,
      null,
      "L2-Parser",
      { model: CLAUDE_HAIKU, timeoutMs: 5000 }
    );

    if (raw !== null) {
      const validated = validateAIOutput(raw);

      if (isGenericCategoryQuery(query) && validated.job_titles.length > 0) {
        console.log(`[L2] Generic category query — clearing job_titles: ${JSON.stringify(validated.job_titles)}`);
        validated.job_titles = [];
      }

      expandParsedKeywords(validated as unknown as Record<string, unknown>, query);
      console.log("L2 Claude parsed:", JSON.stringify(validated));
      return validated as unknown as Record<string, unknown>;
    }
  } catch (err) {
    console.error(`[L2-Parser] Claude failed, falling back to Gemini: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log("L2 Claude returned null — falling back to Gemini");
  return parseQueryLegacy(query, lovableKey);
}

/* ------------------------------------------------------------------ */
/* Legacy Gemini fallback                                               */
/* ------------------------------------------------------------------ */

export async function parseQueryLegacy(
  query: string,
  lovableKey: string | undefined
): Promise<Record<string, unknown>> {
  if (!lovableKey) {
    console.log("No LOVABLE_API_KEY — using deterministic fallback");
    return normalizeParsedPayload(deterministicFallback(query));
  }

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: AI_SYSTEM_PROMPT },
          { role: "user", content: query },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`[GEMINI] Non-200: ${res.status}`);
      return normalizeParsedPayload(deterministicFallback(query));
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let aiParsed: Record<string, unknown>;
    try {
      aiParsed = JSON.parse(cleaned);
    } catch {
      console.error("[GEMINI] Unparseable JSON");
      return normalizeParsedPayload(deterministicFallback(query));
    }

    enforceRoleWordTitles(aiParsed, query);
    expandParsedKeywords(aiParsed, query);
    return normalizeParsedPayload(aiParsed);
  } catch (err) {
    console.error(`[GEMINI] Failed: ${err instanceof Error ? err.message : String(err)}`);
    return normalizeParsedPayload(deterministicFallback(query));
  }
}
