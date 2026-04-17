import { cn } from "@/lib/utils";

/**
 * Acronyms / credentials we want preserved in uppercase regardless of source case.
 * Matched as standalone tokens (boundary-checked) so "MS" inside "Microsoft" stays unchanged.
 */
const PRESERVE_UPPER = new Set([
  "MD", "DO", "DDS", "DMD", "DPM", "DC", "OD", "PA", "PA-C", "NP", "FNP", "ARNP",
  "RN", "BSN", "MSN", "DNP", "CRNA", "LPN", "LVN", "CNA", "APRN",
  "MBA", "MS", "MA", "BA", "BS", "PHD", "MPH", "DRPH", "PHARMD", "MSW", "MFT",
  "EMT", "ICU", "ER", "OR", "ENT", "OB", "GYN", "OB/GYN", "GI", "ID",
  "ACLS", "BLS", "PALS", "TNCC", "NRP",
  "FACS", "FACC", "FAAP", "FACOG", "FACEP", "FAANS", "FAAOS", "FAHA", "FCCP", "FSCAI",
  "USA", "UK", "EU", "NYC", "LA", "DC",
  "CEO", "CTO", "CFO", "COO", "VP", "MD/PHD",
]);

/**
 * Small connector words kept lowercase mid-string (still capitalized at start).
 */
const LOWER_CONNECTORS = new Set([
  "of", "the", "a", "an", "and", "or", "for", "in", "on", "at", "to", "by", "with",
  "&",
]);

/**
 * Normalize human text for display: title-case words, preserve known acronyms,
 * keep small connectors lowercase mid-string. Safe on names, titles, schools,
 * organizations, locations.
 */
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  // If string already contains mixed case (e.g. "iPad", "PhD"), assume the
  // upstream value is intentional and leave it alone.
  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  if (hasLower && hasUpper) return trimmed;

  return trimmed
    .split(/(\s+|[\/\-,])/) // keep delimiters as separate tokens
    .map((token, idx, arr) => {
      if (/^\s+$/.test(token) || /^[\/\-,]$/.test(token)) return token;
      const upper = token.toUpperCase();
      if (PRESERVE_UPPER.has(upper)) return upper;
      const lower = token.toLowerCase();
      // Lowercase connectors mid-string only
      if (idx > 0 && LOWER_CONNECTORS.has(lower)) return lower;
      // Standard title case for the token; handle simple apostrophes (O'Brien)
      return lower
        .split("'")
        .map((part, i) =>
          i === 0
            ? part.charAt(0).toUpperCase() + part.slice(1)
            : part.charAt(0).toUpperCase() + part.slice(1),
        )
        .join("'");
    })
    .join("");
}

/**
 * Degree normalization dictionary — collapse verbose PDL degree strings into
 * tight recruiter-friendly labels. Returns null if no clean label can be derived.
 */
const DEGREE_MAP: Array<[RegExp, string]> = [
  [/doctor of medicine/i, "MD"],
  [/doctor of osteopathic medicine/i, "DO"],
  [/doctor of dental (surgery|medicine)/i, "DDS"],
  [/doctor of nursing practice/i, "DNP"],
  [/doctor of philosophy/i, "PhD"],
  [/doctor of pharmacy/i, "PharmD"],
  [/doctor of podiatric medicine/i, "DPM"],
  [/doctor of chiropractic/i, "DC"],
  [/doctor of optometry/i, "OD"],
  [/master of business administration/i, "MBA"],
  [/master of public health/i, "MPH"],
  [/master of science in nursing/i, "MSN"],
  [/master of social work/i, "MSW"],
  [/master of science/i, "MS"],
  [/master of arts/i, "MA"],
  [/bachelor of science in nursing/i, "BSN"],
  [/bachelor of science/i, "BS"],
  [/bachelor of arts/i, "BA"],
  [/associate of (science|arts)/i, "AS"],
];

/** Strip the redundant degree-category suffix PDL appends ("doctorates", "masters", etc). */
const DEGREE_CATEGORY_TAIL = /(,\s*)?(doctorates?|masters?|bachelors?|associates?|certificates?)\s*$/i;

export interface FormattedDegree {
  /** Short degree code, e.g. "MD", "BSN". null if unrecognized. */
  code: string | null;
  /** Major / specialization, e.g. "Medicine", "Computer Science". null if absent. */
  major: string | null;
  /** Pre-formatted display string ready for the UI, e.g. "MD, Medicine". */
  display: string | null;
}

/**
 * Parse a PDL degree value (string or object) into a clean display string.
 * Returns { display: null } when nothing recognizable is present — caller should
 * then omit the line entirely rather than show "Degree not available".
 */
export function formatDegree(raw: unknown): FormattedDegree {
  if (!raw) return { code: null, major: null, display: null };
  let degreeStr: string | null = null;
  let majorStr: string | null = null;

  if (typeof raw === "string") {
    degreeStr = raw;
  } else if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    degreeStr = (obj.degree as string) ?? (obj.name as string) ?? null;
    majorStr =
      (obj.major as string) ??
      (Array.isArray(obj.majors) ? (obj.majors[0] as string) : null) ??
      null;
  }

  if (!degreeStr) return { code: null, major: null, display: null };

  // Strip PDL category tail (e.g. "doctor of medicine, doctorates")
  let cleaned = degreeStr.replace(DEGREE_CATEGORY_TAIL, "").trim();
  // Some PDL values bury the major after a "·" or "-" — split it off.
  const sep = cleaned.match(/\s*[·\-–]\s*/);
  if (sep && !majorStr) {
    const parts = cleaned.split(sep[0]);
    cleaned = parts[0].trim();
    majorStr = parts.slice(1).join(" ").trim() || null;
  }

  // Map verbose to short code
  let code: string | null = null;
  for (const [pattern, label] of DEGREE_MAP) {
    if (pattern.test(cleaned)) {
      code = label;
      break;
    }
  }
  // If nothing matched but the string itself is already a short acronym, keep it.
  if (!code) {
    const upper = cleaned.toUpperCase().replace(/[^A-Z]/g, "");
    if (upper.length >= 2 && upper.length <= 5 && PRESERVE_UPPER.has(upper)) {
      code = upper;
    } else if (cleaned.length > 0 && cleaned.length <= 8 && /^[A-Za-z.]+$/.test(cleaned)) {
      code = cleaned.toUpperCase().replace(/\./g, "");
    }
  }

  const major = majorStr ? toTitleCase(majorStr) : null;

  let display: string | null = null;
  if (code && major) display = `${code}, ${major}`;
  else if (code) display = code;
  else if (major) display = major;

  return { code, major, display };
}

/**
 * Render an unknown value (often `{name: "..."}` or `{title: "..."}` from PDL)
 * as a clean string. Returns null if no usable value found — callers should skip
 * the entry entirely rather than render `[object Object]`.
 */
export function renderNamedValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const candidates = [obj.name, obj.title, obj.label, obj.display, obj.value];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) return c.trim();
    }
  }
  return null;
}

/**
 * Format a PDL date that may have only a year (year-only → "2012"; year+month → "Jan 2012").
 * PDL returns "2012", "2012-01", or "2012-01-15". We never fabricate a December default
 * for year-only values.
 */
export function formatDateLabelSmart(dateValue: string | null | undefined): string {
  if (!dateValue) return "Present";
  const trimmed = String(dateValue).trim();
  if (!trimmed) return "Present";

  // Year only — render as just the year.
  if (/^\d{4}$/.test(trimmed)) return trimmed;

  // Year-month or full ISO — show "Mon YYYY".
  const ymMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (ymMatch) {
    const [, y, m] = ymMatch;
    const d = new Date(Number(y), Number(m) - 1, 1);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const AVATAR_TONES = [
  "avatar-tone-0",
  "avatar-tone-1",
  "avatar-tone-2",
  "avatar-tone-3",
  "avatar-tone-4",
  "avatar-tone-5",
  "avatar-tone-6",
  "avatar-tone-7",
] as const;

/**
 * Medical credentials / suffixes that PDL sometimes merges into full_name.
 * We strip these so "fscai jason hatch" becomes "jason hatch".
 */
const CREDENTIAL_PATTERNS = [
  /\b(fscai|facc|faha|fccp|facs|facep|faap|facog|faans|faaos)\b/gi,
  /\b(md|do|dds|dmd|dpm|phd|pharmd|dnp|drph|mph|mba|ms|ma|bs|ba)\b/gi,
  /\b(rn|lpn|lvn|cna|crna|aprn|fnp|pa-?c|np)\b/gi,
  /\b(board certified)\b/gi,
  /,\s*$/,
];

export function cleanDisplayName(rawName: string): string {
  let name = rawName;
  for (const pattern of CREDENTIAL_PATTERNS) {
    name = name.replace(pattern, "");
  }
  // Collapse extra whitespace and trim
  name = name.replace(/\s{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, "").trim();
  // If we accidentally stripped everything, fall back to the original
  return name.length >= 2 ? name : rawName;
}

/**
 * Normalize LinkedIn URL — PDL often returns without protocol.
 */
export function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

export function formatSalary(salary: string | null | undefined): string | null {
  if (!salary) return null;

  const trimmed = salary.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(">")) return "$250K+";
  if (trimmed.startsWith("<")) return "< $20K";

  const parts = trimmed.split("-").map((part) => part.trim().replace(/,/g, ""));
  if (parts.length === 2) {
    const low = Math.round(Number.parseInt(parts[0], 10) / 1000);
    const high = Math.round(Number.parseInt(parts[1], 10) / 1000);
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return `$${low}K – $${high}K`;
    }
  }

  const single = Number.parseInt(trimmed.replace(/,/g, ""), 10);
  if (!Number.isNaN(single)) {
    return `$${Math.round(single / 1000)}K`;
  }

  return trimmed;
}

export function getInitials(name: string): string {
  return name
    .replace(/^(Dr\.?\s*)/i, "")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarToneClass(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function formatDateLabel(dateValue: string | null | undefined): string {
  if (!dateValue) return "Present";

  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return dateValue;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function formatExperienceDuration(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  if (!startDate) return null;

  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) return null;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) return `${Math.max(remainingMonths, 1)}m`;
  if (remainingMonths === 0) return `${years}y`;

  return `${years}y ${remainingMonths}m`;
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19ZM8.34 10.09H5.67V18H8.34V10.09ZM7.01 5.83C6.15 5.83 5.46 6.52 5.46 7.38C5.46 8.23 6.15 8.93 7.01 8.93C7.86 8.93 8.55 8.23 8.55 7.38C8.55 6.52 7.86 5.83 7.01 5.83ZM18.33 13.13C18.33 10.75 17.82 8.92 15.04 8.92C13.71 8.92 12.82 9.65 12.45 10.34H12.41V9.14H9.85V18H12.52V13.61C12.52 12.45 12.74 11.33 14.18 11.33C15.6 11.33 15.62 12.66 15.62 13.68V18H18.29L18.33 13.13Z" />
    </svg>
  );
}