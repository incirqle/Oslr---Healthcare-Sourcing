// ─── AI-Powered Query Parser ──────────────────────────────────────────────────

import { CLINICAL_KEYWORD_EXPANSIONS, MAX_QUERY_LENGTH } from "./config.ts";

export interface ParsedFilters {
  job_titles: string[];
  locations: string[];
  companies: string[];
  keywords: string[];
  experience_years?: number | null;
  specialties: string[];
}

const SYSTEM_PROMPT = `You are a search query parser for a clinical healthcare recruiting platform that finds doctors, nurses, and allied health professionals.

Return ONLY valid JSON with this exact structure — no explanation, no markdown:
{
  "job_titles": ["registered nurse", "RN"],
  "locations": ["Texas"],
  "companies": [],
  "keywords": [],
  "experience_years": null,
  "specialties": []
}

CRITICAL PARSING RULES:
1. This platform is ONLY for clinical healthcare roles: physicians, surgeons, nurses, NPs, PAs, CRNAs, therapists, technicians, pharmacists, etc.
2. IGNORE any sales, device rep, pharma rep, or commercial roles — those are not supported.
3. Do NOT auto-infer job titles the user didn't mention. Only populate titles the user explicitly stated.
4. Single keyword queries (e.g., "oncology") are treated as specialty/focus-area only — no title injection.
5. job_titles: Extract clinical role/title keywords. Expand abbreviations: "ER doctor" → ["emergency medicine physician", "emergency physician"]; "ICU nurse" → ["ICU nurse", "intensive care unit nurse", "critical care nurse", "registered nurse"]; "CRNA" → ["CRNA", "certified registered nurse anesthetist"].
6. locations: ALWAYS separate city and state into a SINGLE string like "Miami Florida" (city first, then state). If only a state is given, use just the state name (e.g., "Texas"). Full lowercase US state names required (e.g., "california" not "CA").
7. companies: Specific hospital or health system names only (e.g., "HCA Healthcare", "Mayo Clinic").
8. keywords: Clinical skills, certifications, tools (e.g., "ACLS", "BLS", "Epic", "laparoscopic", "ventilator management").
9. experience_years: Number only if explicitly stated (e.g., "5+ years" → 5), null otherwise.
10. specialties: Medical specialties not already captured in job_titles (e.g., "cardiology", "orthopedics", "oncology").

IMPORTANT: Do NOT include "health" or PDL role names. Just extract what the user said.`;

export async function parseQueryToFilters(
  naturalLanguage: string,
  lovableApiKey: string
): Promise<ParsedFilters> {
  // Enforce query length limit
  if (naturalLanguage.length > MAX_QUERY_LENGTH) {
    throw new Error(`Query too long (${naturalLanguage.length} chars). Maximum is ${MAX_QUERY_LENGTH} characters.`);
  }

  const models = [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "openai/gpt-5-mini",
  ];
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const isOpenAI = model.startsWith("openai/");
      const bodyObj: Record<string, unknown> = {
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: naturalLanguage },
        ],
      };
      if (isOpenAI) {
        bodyObj.max_completion_tokens = 2000;
      } else {
        bodyObj.temperature = 0.1;
        bodyObj.max_tokens = 400;
      }

      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
        },
        body: JSON.stringify(bodyObj),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error(`AI gateway ${model} failed: ${res.status} - ${errBody}`);
        lastError = new Error(`AI gateway error: ${res.status}`);
        continue;
      }

      const data = await res.json();
      console.log(`AI gateway ${model} responded successfully`);
      let content = data.choices?.[0]?.message?.content?.trim() || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      if (!content) {
        console.error(`AI gateway ${model} returned empty content, trying next`);
        lastError = new Error("AI returned empty response");
        continue;
      }

      try {
        const parsed = JSON.parse(content);
        const filters: ParsedFilters = {
          job_titles: parsed.job_titles ?? [],
          locations: parsed.locations ?? [],
          companies: parsed.companies ?? [],
          keywords: parsed.keywords ?? [],
          experience_years: parsed.experience_years ?? null,
          specialties: parsed.specialties ?? [],
        };

        // Apply keyword expansions to enrich parsed titles
        filters.job_titles = expandTerms(filters.job_titles);
        filters.specialties = expandTerms(filters.specialties);

        return filters;
      } catch {
        console.error("Failed to parse AI response:", content);
        lastError = new Error("Failed to parse AI response");
        continue;
      }
    } catch (e) {
      console.error(`AI gateway ${model} exception:`, e);
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  // Deterministic fallback parser
  console.warn("All AI models failed, using deterministic fallback");
  return deterministicParse(naturalLanguage);
}

// Expand terms using the clinical keyword expansion table
function expandTerms(terms: string[]): string[] {
  const expanded = new Set<string>();
  for (const term of terms) {
    expanded.add(term);
    const key = term.toLowerCase();
    if (CLINICAL_KEYWORD_EXPANSIONS[key]) {
      for (const exp of CLINICAL_KEYWORD_EXPANSIONS[key]) {
        expanded.add(exp);
      }
    }
  }
  return Array.from(expanded);
}

// Deterministic fallback when AI is unavailable
function deterministicParse(query: string): ParsedFilters {
  const lc = query.toLowerCase();
  const filters: ParsedFilters = {
    job_titles: [],
    locations: [],
    companies: [],
    keywords: [],
    experience_years: null,
    specialties: [],
  };

  // Check for known clinical terms
  for (const [key, expansions] of Object.entries(CLINICAL_KEYWORD_EXPANSIONS)) {
    if (lc.includes(key)) {
      // If it's likely a specialty (cardiology, oncology, etc.), add to specialties
      if (key.endsWith("ology") || key.endsWith("rics") || key.endsWith("istry") || key === "critical care" || key === "emergency medicine") {
        filters.specialties.push(...expansions);
      } else {
        filters.job_titles.push(...expansions);
      }
    }
  }

  // Extract experience years
  const expMatch = lc.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience)?/);
  if (expMatch) {
    filters.experience_years = parseInt(expMatch[1]);
  }

  // Deduplicate
  filters.job_titles = [...new Set(filters.job_titles)];
  filters.specialties = [...new Set(filters.specialties)];

  return filters;
}
