/** Client-side clinical profile PDFs. Multiple profiles are bundled into one ZIP. */
import jsPDF from "jspdf";
import JSZip from "jszip";
import type { AnyCandidate, Dossier } from "./candidate-export-adapter";
import { toDossier } from "./candidate-export-adapter";

export interface PdfExportOptions { includeContactInfo?: boolean }

const TEXT: [number, number, number] = [24, 32, 38];
const MUTED: [number, number, number] = [99, 112, 118];
const RULE: [number, number, number] = [224, 231, 228];
const MINT: [number, number, number] = [103, 181, 155];
const MINT_DARK: [number, number, number] = [38, 104, 82];
const MINT_PALE: [number, number, number] = [241, 248, 245];
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const X = 46;
const TOP = 52;
const BOTTOM = 48;
const WIDTH = PAGE_W - X * 2;

function fmtDate(value: string | null): string {
  if (!value) return "";
  const match = value.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!match) return value;
  if (!match[2]) return match[1];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(match[2]) - 1] ?? ""} ${match[1]}`.trim();
}

function dateRange(start: string | null, end: string | null, current: boolean): string {
  const from = fmtDate(start);
  const to = current ? "Present" : fmtDate(end);
  return [from, to].filter(Boolean).join(" - ");
}

function safeSlug(name: string): string {
  return (name || "candidate").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "candidate";
}

class PdfWriter {
  doc = new jsPDF({ unit: "pt", format: "a4" });
  y = TOP;

  constructor() {
    this.doc.setFont("helvetica", "normal");
    this.doc.setProperties({ title: "Oslr Clinical Profile", subject: "Clinical sourcing profile", creator: "Oslr" });
  }

  ensure(height: number) {
    if (this.y + height <= PAGE_H - BOTTOM) return;
    this.doc.addPage();
    this.y = TOP;
  }

  text(text: string, opts: {
    size?: number; bold?: boolean; color?: [number, number, number]; gap?: number;
    maxWidth?: number; x?: number; lineHeight?: number;
  } = {}) {
    if (!text) return 0;
    const size = opts.size ?? 10;
    const x = opts.x ?? X;
    const lineHeight = opts.lineHeight ?? size * 1.38;
    this.doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(opts.color ?? TEXT));
    const lines = this.doc.splitTextToSize(text, opts.maxWidth ?? WIDTH) as string[];
    lines.forEach((line) => {
      this.ensure(lineHeight);
      this.doc.text(line, x, this.y);
      this.y += lineHeight;
    });
    if (opts.gap) this.y += opts.gap;
    return lines.length * lineHeight + (opts.gap ?? 0);
  }

  heading(label: string) {
    this.y += 10;
    // Keep the heading with the first part of its section instead of orphaning it.
    this.ensure(90);
    this.doc.setFillColor(...MINT);
    this.doc.roundedRect(X, this.y - 8, 3, 12, 1.5, 1.5, "F");
    this.text(label.toUpperCase(), { size: 9, bold: true, color: MINT_DARK, x: X + 12, gap: 5 });
    this.doc.setDrawColor(...RULE);
    this.doc.setLineWidth(0.6);
    this.doc.line(X, this.y, X + WIDTH, this.y);
    this.y += 15;
  }
}

function contactBox(w: PdfWriter, d: Dossier) {
  const fields = [
    { label: "Work email", value: d.workEmail },
    { label: "Personal email", value: d.personalEmail },
    { label: "Phone", value: d.phone },
    { label: "LinkedIn", value: d.linkedin ? "Open LinkedIn profile" : "", url: d.linkedin },
  ].filter((field) => field.value);
  if (!fields.length) return;
  const lineHeights = fields.map((field) => Math.max(15, w.doc.splitTextToSize(field.value, WIDTH - 142).length * 12));
  const height = 34 + lineHeights.reduce((sum, n) => sum + n, 0);
  w.ensure(height + 12);
  const top = w.y;
  w.doc.setFillColor(...MINT_PALE);
  w.doc.setDrawColor(...RULE);
  w.doc.roundedRect(X, top, WIDTH, height, 8, 8, "FD");
  w.y += 20;
  w.text("SAVED CONTACT DETAILS", { size: 8, bold: true, color: MINT_DARK, x: X + 14, maxWidth: WIDTH - 28 });
  w.y += 5;
  fields.forEach((field, index) => {
    w.doc.setFont("helvetica", "normal");
    w.doc.setFontSize(8.5);
    w.doc.setTextColor(...MUTED);
    w.doc.text(field.label, X + 14, w.y);
    const lines = w.doc.splitTextToSize(field.value, WIDTH - 142) as string[];
    w.doc.setFont("helvetica", "normal");
    w.doc.setFontSize(9.5);
    w.doc.setTextColor(...TEXT);
    lines.forEach((line: string, lineIndex: number) => w.doc.text(line, X + 122, w.y + lineIndex * 12));
    if (field.url) w.doc.link(X + 122, w.y - 9, WIDTH - 140, Math.max(14, lineHeights[index]), { url: field.url });
    w.y += lineHeights[index];
  });
  w.y = top + height + 15;
}

function snapshot(w: PdfWriter, d: Dossier) {
  const items = [
    d.yearsExperience ? { label: "CLINICAL EXPERIENCE", value: d.yearsExperience } : null,
    d.npi ? { label: "NPI", value: d.npi } : null,
    d.research?.articleCount ? { label: "PUBLICATIONS", value: d.research.articleCount.toLocaleString() } : null,
    d.research?.citations ? { label: "CITATIONS", value: d.research.citations.toLocaleString() } : null,
    d.research?.hIndex ? { label: "H-INDEX", value: d.research.hIndex.toLocaleString() } : null,
  ].filter(Boolean).slice(0, 4) as { label: string; value: string }[];
  if (!items.length) return;
  const gap = 8;
  const cardWidth = (WIDTH - gap * (items.length - 1)) / items.length;
  w.ensure(72);
  const top = w.y;
  items.forEach((item, index) => {
    const x = X + index * (cardWidth + gap);
    w.doc.setFillColor(...MINT_PALE);
    w.doc.roundedRect(x, top, cardWidth, 54, 6, 6, "F");
    w.doc.setFont("helvetica", "bold");
    w.doc.setFontSize(item.value.length > 14 ? 12 : 16);
    w.doc.setTextColor(...TEXT);
    w.doc.text(item.value, x + 10, top + 23, { maxWidth: cardWidth - 20 });
    w.doc.setFont("helvetica", "normal");
    w.doc.setFontSize(6.8);
    w.doc.setTextColor(...MUTED);
    w.doc.text(item.label, x + 10, top + 41, { maxWidth: cardWidth - 20 });
  });
  w.y += 70;
}

function renderDossier(d: Dossier, includeContactInfo: boolean): jsPDF {
  const w = new PdfWriter();
  w.doc.setFont("helvetica", "bold");
  w.doc.setFontSize(15);
  w.doc.setTextColor(...MINT_DARK);
  w.doc.text("oslr", X, 30);
  w.doc.setFont("helvetica", "normal");
  w.doc.setFontSize(8);
  w.doc.setTextColor(...MUTED);
  w.doc.text("CLINICAL PROFILE", X + 42, 29);
  w.doc.text(new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), PAGE_W - X, 29, { align: "right" });

  w.y = 72;
  w.text(d.fullName || "Unnamed clinician", { size: 25, bold: true, gap: 4, lineHeight: 30 });
  const role = [d.currentTitle, d.currentOrg].filter(Boolean).join(" at ");
  if (role) w.text(role, { size: 12, color: TEXT, gap: 3, lineHeight: 16 });
  const meta = [d.specialty, d.location].filter(Boolean).join(" · ");
  if (meta) w.text(meta, { size: 10, color: MUTED, gap: 10 });
  w.doc.setDrawColor(...MINT);
  w.doc.setLineWidth(2);
  w.doc.line(X, w.y, X + 52, w.y);
  w.y += 18;

  snapshot(w, d);
  if (includeContactInfo) contactBox(w, d);
  if (d.summary) {
    w.heading("Profile summary");
    w.text(d.summary, { size: 10, color: TEXT, lineHeight: 14.5 });
  }
  if (d.experience.length) {
    w.heading("Clinical experience");
    d.experience.forEach((entry, index) => {
      w.ensure(52);
      const dotY = w.y - 6;
      w.doc.setFillColor(...(entry.isCurrent ? MINT : RULE));
      w.doc.circle(X + 3, dotY, 3, "F");
      w.text([entry.title, entry.company].filter(Boolean).join(" at ") || "Clinical role", { size: 11, bold: true, x: X + 16, maxWidth: WIDTH - 16, gap: 1 });
      const details = [dateRange(entry.startDate, entry.endDate, entry.isCurrent), entry.location].filter(Boolean).join(" · ");
      if (details) w.text(details, { size: 9, color: MUTED, x: X + 16, maxWidth: WIDTH - 16, gap: 3 });
      if (entry.summary) w.text(entry.summary, { size: 9.5, x: X + 16, maxWidth: WIDTH - 16, lineHeight: 13 });
      if (index < d.experience.length - 1) w.y += 10;
    });
  }
  if (d.education.length) {
    w.heading("Medical education & training");
    d.education.forEach((entry) => {
      w.ensure(42);
      w.text(entry.school || "Institution", { size: 11, bold: true, gap: 1 });
      const qualification = [entry.degree, entry.major].filter(Boolean).join(" · ");
      if (qualification) w.text(qualification, { size: 10, gap: 1 });
      const range = dateRange(entry.startDate, entry.endDate, false);
      if (range) w.text(range, { size: 9, color: MUTED });
      w.y += 9;
    });
  }
  if (d.research) {
    w.heading("Academic research");
    const designation = [d.research.designation, d.research.organisation].filter(Boolean).join(" · ");
    if (designation) w.text(designation, { size: 10, bold: true, gap: 4 });
    const metrics = [
      d.research.articleCount ? `${d.research.articleCount.toLocaleString()} publications` : "",
      d.research.citations ? `${d.research.citations.toLocaleString()} citations` : "",
      d.research.hIndex ? `h-index ${d.research.hIndex}` : "",
      d.research.i10Index ? `i10-index ${d.research.i10Index}` : "",
      d.research.coAuthorCount ? `${d.research.coAuthorCount.toLocaleString()} co-authors` : "",
    ].filter(Boolean).join(" · ");
    if (metrics) w.text(metrics, { size: 9.5, color: MUTED, gap: 5 });
    if (d.research.interests.length) w.text(`Research interests: ${d.research.interests.join(", ")}`, { size: 9.5, gap: 5 });
    d.research.topArticles.filter((article) => article.title).slice(0, 5).forEach((article) => {
      w.ensure(38);
      w.text(article.title, { size: 10, bold: true, gap: 1 });
      const meta = [article.publication, article.year, article.citations ? `${article.citations.toLocaleString()} citations` : ""].filter(Boolean).join(" · ");
      if (meta) w.text(meta, { size: 9, color: MUTED });
      w.y += 8;
    });
  }
  if (d.certifications.length) {
    w.heading("Credentials & certifications");
    w.text(d.certifications.join(" · "), { size: 10 });
  }
  if (d.skills.length) {
    w.heading("Clinical skills");
    w.text(d.skills.slice(0, 30).join(" · "), { size: 10 });
  }

  const pages = w.doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    w.doc.setPage(page);
    w.doc.setDrawColor(...RULE);
    w.doc.setLineWidth(0.5);
    w.doc.line(X, PAGE_H - 32, PAGE_W - X, PAGE_H - 32);
    w.doc.setFont("helvetica", "normal");
    w.doc.setFontSize(7.5);
    w.doc.setTextColor(...MUTED);
    w.doc.text("Prepared by Oslr · Information saved at the time of export", X, PAGE_H - 19);
    w.doc.text(`${page} / ${pages}`, PAGE_W - X, PAGE_H - 19, { align: "right" });
  }
  return w.doc;
}

export function generateDossierPdf(c: AnyCandidate, options: PdfExportOptions = {}): { doc: jsPDF; filename: string; dossier: Dossier } {
  const dossier = toDossier(c);
  const doc = renderDossier(dossier, options.includeContactInfo !== false);
  return { doc, filename: `${safeSlug(dossier.fullName)}-clinical-profile.pdf`, dossier };
}

export async function downloadCandidatePdfs(candidates: AnyCandidate[], options: PdfExportOptions = {}): Promise<void> {
  if (!candidates.length) return;
  if (candidates.length === 1) {
    const { doc, filename } = generateDossierPdf(candidates[0], options);
    doc.save(filename);
    return;
  }
  const zip = new JSZip();
  const seen = new Map<string, number>();
  for (const candidate of candidates) {
    const { doc, filename } = generateDossierPdf(candidate, options);
    const base = filename.replace(/\.pdf$/, "");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    zip.file(count === 0 ? filename : `${base}-${count + 1}.pdf`, doc.output("arraybuffer"));
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oslr-clinical-profiles-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
