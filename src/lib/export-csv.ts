import type { AnyCandidate } from "./candidate-export-adapter";
import { toExportRow } from "./candidate-export-adapter";

export interface CandidateExportOptions {
  includeContactInfo?: boolean;
}

type Column = { header: string; value: (row: ReturnType<typeof toExportRow>) => string; contact?: boolean };

const COLUMNS: Column[] = [
  { header: "First name", value: (r) => r.firstName },
  { header: "Last name", value: (r) => r.lastName },
  { header: "Location", value: (r) => r.location },
  { header: "LinkedIn", value: (r) => r.linkedin },
  { header: "Personal Email", value: (r) => r.personalEmail, contact: true },
  { header: "Personal Email Verification", value: (r) => r.personalEmailVerification, contact: true },
  { header: "Work Email", value: (r) => r.workEmail, contact: true },
  { header: "Work Email Verification", value: (r) => r.workEmailVerification, contact: true },
  { header: "Phone Numbers", value: (r) => r.phoneNumbers, contact: true },
  { header: "Current Title", value: (r) => r.currentTitle },
  { header: "Current Org Name", value: (r) => r.currentOrg },
  { header: "Education", value: (r) => r.education },
  { header: "Average Tenure (Years)", value: (r) => r.avgTenureYears },
  { header: "Current Tenure (Years)", value: (r) => r.currentTenureYears },
  { header: "Total Experience (Years)", value: (r) => r.totalExperienceYears },
];

const LINKEDIN_COLUMNS: Column[] = [
  { header: "First Name", value: (r) => r.firstName },
  { header: "Last Name", value: (r) => r.lastName },
  { header: "LinkedIn Profile URL", value: (r) => r.linkedin },
  { header: "Email Address", value: (r) => r.workEmail || r.personalEmail, contact: true },
  { header: "Current Job Title", value: (r) => r.currentTitle },
  { header: "Current Company", value: (r) => r.currentOrg },
  { header: "Location", value: (r) => r.location },
];

function csvCell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(candidates: AnyCandidate[], columns: Column[], options: CandidateExportOptions = {}): string {
  const includeContactInfo = options.includeContactInfo !== false;
  const visibleColumns = columns.filter((column) => includeContactInfo || !column.contact);
  const rows = candidates.map((candidate) => {
    const row = toExportRow(candidate);
    return visibleColumns.map((column) => csvCell(column.value(row))).join(",");
  });
  return [visibleColumns.map((column) => csvCell(column.header)).join(","), ...rows].join("\n");
}

export function buildCandidatesCsv(candidates: AnyCandidate[], options: CandidateExportOptions = {}): string {
  return buildCsv(candidates, COLUMNS, options);
}

export function buildLinkedInRecruiterCsv(candidates: AnyCandidate[], options: CandidateExportOptions = {}): string {
  return buildCsv(candidates, LINKEDIN_COLUMNS, options);
}

function download(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCandidatesCsv(candidates: AnyCandidate[], filename?: string, options: CandidateExportOptions = {}) {
  const ts = new Date().toISOString().slice(0, 10);
  download(buildCandidatesCsv(candidates, options), filename ?? `oslr-candidates-${ts}.csv`);
}

export function downloadLinkedInRecruiterCsv(candidates: AnyCandidate[], options: CandidateExportOptions = {}) {
  const ts = new Date().toISOString().slice(0, 10);
  download(buildLinkedInRecruiterCsv(candidates, options), `oslr-linkedin-recruiter-${ts}.csv`);
}
