import type { Candidate } from "@/components/search/SearchResults";
import type { MatchChip } from "@/components/search/match-chips";
import { toTitleCase } from "@/components/search/candidate-ui";

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, "\"\"")}"`;
  }
  return str;
}

export function exportCandidatesCsv(
  candidates: Candidate[],
  matchChipsByCandidate: Map<string, MatchChip[]>,
  fitByCandidate: Map<string, string>,
  filename = "oslr-candidates.csv",
) {
  const headers = [
    "Name",
    "Title",
    "Organization",
    "Location",
    "Years experience",
    "Match chips",
    "LinkedIn URL",
    "Fit",
    "Email",
    "Phone",
  ];
  const rows = candidates.map((c) => {
    const chips = matchChipsByCandidate.get(c.id) ?? [];
    return [
      toTitleCase(c.full_name),
      toTitleCase(c.title ?? ""),
      toTitleCase(c.current_employer ?? ""),
      toTitleCase(c.location ?? ""),
      c.years_experience ?? "",
      chips.map((ch) => ch.label).join("; "),
      c.linkedin_url ?? "",
      fitByCandidate.get(c.id) ?? "unreviewed",
      c.email ?? "",
      c.phone ?? "",
    ].map(escapeCsv).join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");

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
