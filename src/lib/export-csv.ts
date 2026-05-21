import type { AnyCandidate } from "./candidate-export-adapter";
import { toExportRow } from "./candidate-export-adapter";

const HEADERS = [
  "First name",
  "Last name",
  "Location",
  "LinkedIn",
  "Personal Email",
  "Personal Email Verification",
  "Work Email",
  "Work Email Verification",
  "Phone Numbers",
  "GitHub",
  "Current Title",
  "Current Org Name",
  "Education",
  "Average Tenure (Years)",
  "Current Tenure (Years)",
  "Total Experience (Years)",
];

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCandidatesCsv(candidates: AnyCandidate[]): string {
  const rows = candidates.map((c) => {
    const r = toExportRow(c);
    return [
      r.firstName,
      r.lastName,
      r.location,
      r.linkedin,
      r.personalEmail,
      r.personalEmailVerification,
      r.workEmail,
      r.workEmailVerification,
      r.phoneNumbers,
      r.github,
      r.currentTitle,
      r.currentOrg,
      r.education,
      r.avgTenureYears,
      r.currentTenureYears,
      r.totalExperienceYears,
    ]
      .map(csvCell)
      .join(",");
  });
  return [HEADERS.map(csvCell).join(","), ...rows].join("\n");
}

export function downloadCandidatesCsv(candidates: AnyCandidate[], filename?: string) {
  const csv = buildCandidatesCsv(candidates);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  link.download = filename ?? `oslr-candidates-${ts}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
