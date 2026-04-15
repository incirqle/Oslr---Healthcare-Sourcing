import { cn } from "@/lib/utils";

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