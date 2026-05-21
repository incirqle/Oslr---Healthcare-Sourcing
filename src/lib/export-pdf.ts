/**
 * Client-side PDF dossier generator using jsPDF.
 * One PDF per candidate; multiple candidates get bundled into a single .zip via jszip.
 */

import jsPDF from "jspdf";
import JSZip from "jszip";
import type { AnyCandidate, Dossier } from "./candidate-export-adapter";
import { toDossier } from "./candidate-export-adapter";

// Tokens (CMYK-ish neutral with mint accent — keeps PDF print-friendly)
const COLOR_TEXT: [number, number, number] = [24, 24, 27];
const COLOR_MUTED: [number, number, number] = [113, 113, 122];
const COLOR_RULE: [number, number, number] = [228, 228, 231];
const COLOR_ACCENT: [number, number, number] = [120, 200, 175]; // mint

const PAGE_W = 595.28; // A4 pt
const PAGE_H = 841.89;
const MARGIN_X = 48;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

function fmtDate(d: string | null): string {
  if (!d) return "";
  // PDL often gives YYYY-MM or YYYY
  const m = d.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return d;
  const year = m[1];
  const month = m[2];
  if (!month) return year;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const idx = Number(month) - 1;
  return `${monthNames[idx] ?? ""} ${year}`.trim();
}

function dateRange(start: string | null, end: string | null, isCurrent: boolean): string {
  const s = fmtDate(start);
  const e = isCurrent || !end ? "Present" : fmtDate(end);
  if (!s && !e) return "";
  if (!s) return e;
  if (!e) return s;
  return `${s} – ${e}`;
}

function safeSlug(name: string): string {
  return (name || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "candidate";
}

/** Writer holds doc + current y cursor and handles page-break/wrap. */
class PdfWriter {
  doc: jsPDF;
  y = MARGIN_TOP;

  constructor() {
    this.doc = new jsPDF({ unit: "pt", format: "a4" });
    this.doc.setFont("helvetica", "normal");
  }

  ensure(spaceNeeded: number) {
    if (this.y + spaceNeeded > PAGE_H - MARGIN_BOTTOM) {
      this.doc.addPage();
      this.y = MARGIN_TOP;
    }
  }

  text(
    text: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: [number, number, number];
      gap?: number;
      maxWidth?: number;
      family?: "helvetica" | "times";
    } = {},
  ) {
    if (!text) return;
    const size = opts.size ?? 10;
    const color = opts.color ?? COLOR_TEXT;
    // Use Times for bold (Helvetica-Bold has a known rendering quirk in poppler).
    const family = opts.family ?? (opts.bold ? "times" : "helvetica");
    this.doc.setFont(family, opts.bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(text, opts.maxWidth ?? CONTENT_W) as string[];
    const lineHeight = size * 1.35;
    for (const line of lines) {
      this.ensure(lineHeight);
      this.doc.text(line, MARGIN_X, this.y);
      this.y += lineHeight;
    }
    if (opts.gap) this.y += opts.gap;
  }

  rule(color: [number, number, number] = COLOR_RULE, thickness = 0.5, gap = 12) {
    this.ensure(thickness + gap);
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(thickness);
    this.doc.line(MARGIN_X, this.y, MARGIN_X + CONTENT_W, this.y);
    this.y += gap;
  }

  sectionHeading(label: string) {
    this.y += 6;
    this.ensure(28);
    this.text(label.toUpperCase(), { size: 9, bold: false, color: COLOR_MUTED, gap: 6, family: "helvetica" });
    this.doc.setDrawColor(...COLOR_RULE);
    this.doc.setLineWidth(0.5);
    this.doc.line(MARGIN_X, this.y - 2, MARGIN_X + CONTENT_W, this.y - 2);
    this.y += 6;
  }
}

function renderDossier(d: Dossier): jsPDF {
  const w = new PdfWriter();

  // Wordmark
  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(10);
  w.doc.setTextColor(...COLOR_ACCENT);
  w.doc.text("oslr", PAGE_W - MARGIN_X, MARGIN_TOP - 24, { align: "right" });

  // Name
  w.text(d.fullName || "Unnamed Candidate", { size: 24, gap: 4 });

  // Subline
  const subline = [d.currentTitle, d.currentOrg].filter(Boolean).join(" at ");
  if (subline) w.text(subline, { size: 11.5, color: COLOR_MUTED, gap: 2 });
  if (d.location) w.text(d.location, { size: 10, color: COLOR_MUTED, gap: 8 });

  // Accent rule
  w.doc.setDrawColor(...COLOR_ACCENT);
  w.doc.setLineWidth(1.5);
  w.doc.line(MARGIN_X, w.y, MARGIN_X + 40, w.y);
  w.y += 16;

  // Contact lines
  if (d.linkedin) w.text(d.linkedin, { size: 9.5, color: COLOR_MUTED });
  if (d.email) w.text(d.email, { size: 9.5, color: COLOR_MUTED });
  if (d.phone) w.text(d.phone, { size: 9.5, color: COLOR_MUTED });

  // Summary
  if (d.summary) {
    w.sectionHeading("Summary");
    w.text(d.summary, { size: 10, gap: 4 });
  }

  // Experience
  if (d.experience.length) {
    w.sectionHeading("Experience");
    d.experience.forEach((e, idx) => {
      const heading = [e.title, e.company].filter(Boolean).join(" at ");
      w.text(heading || "Role", { size: 11.5, color: COLOR_TEXT, gap: 1 });
      const range = dateRange(e.startDate, e.endDate, e.isCurrent);
      const meta = [range, e.location].filter(Boolean).join(" · ");
      if (meta) w.text(meta, { size: 9.5, color: COLOR_MUTED, gap: 4 });
      if (e.summary) w.text(e.summary, { size: 10, gap: idx === d.experience.length - 1 ? 0 : 10 });
      else w.y += idx === d.experience.length - 1 ? 0 : 6;
    });
  }

  // Education
  if (d.education.length) {
    w.sectionHeading("Education");
    d.education.forEach((e) => {
      w.text(e.school || "School", { size: 11.5, color: COLOR_TEXT, gap: 1 });
      const parts = [e.degree, e.major].filter(Boolean).join(", ");
      if (parts) w.text(parts, { size: 10, gap: 1 });
      const range = dateRange(e.startDate, e.endDate, false);
      if (range) w.text(range, { size: 9.5, color: COLOR_MUTED, gap: 8 });
      else w.y += 6;
    });
  }

  // Skills
  if (d.skills.length) {
    w.sectionHeading("Skills");
    w.text(d.skills.join(", "), { size: 10 });
  }

  return w.doc;
}

export function generateDossierPdf(c: AnyCandidate): { doc: jsPDF; filename: string; dossier: Dossier } {
  const dossier = toDossier(c);
  const doc = renderDossier(dossier);
  const filename = `${safeSlug(dossier.fullName)}.pdf`;
  return { doc, filename, dossier };
}

export async function downloadCandidatePdfs(candidates: AnyCandidate[]): Promise<void> {
  if (candidates.length === 0) return;

  if (candidates.length === 1) {
    const { doc, filename } = generateDossierPdf(candidates[0]);
    doc.save(filename);
    return;
  }

  const zip = new JSZip();
  const seen = new Map<string, number>();
  for (const c of candidates) {
    const { doc, filename } = generateDossierPdf(c);
    // dedupe filename collisions
    const base = filename.replace(/\.pdf$/, "");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const name = count === 0 ? filename : `${base}-${count + 1}.pdf`;
    const arrayBuffer = doc.output("arraybuffer");
    zip.file(name, arrayBuffer);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oslr-profiles-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
