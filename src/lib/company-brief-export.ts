/**
 * Company brief exports: a recruiter-ready PDF and a CSV of the people.
 *
 * The PDF is built to be read, not to mirror the screen. Rules it follows
 * (each one is a problem in the Juicebox company PDF, reviewed 2026-10-18):
 *  - The first lines say which pages were rolled together, the date range
 *    and the date it was generated.
 *  - No funding section and no unexplained citation markers.
 *  - A table never starts at the bottom of a page: a section moves to the
 *    next page when its header and first rows would not fit.
 *  - People are listed by name with role, specialty, training and start.
 *  - It contains only what has been pulled: base facts, the groups the user
 *    pulled, and movement if it was pulled. Export never triggers a pull.
 */

import jsPDF from "jspdf";
import type { CompanyBriefState, MovementPerson, PullGroup, RosterPerson } from "@/hooks/useCompanyBrief";
import { fmtMonth, GROUP_LABEL, GROUP_ORDER, netFlow, OWNERSHIP_LABEL, ROLE_SHORT } from "@/components/company-intel/brief-utils";

const NAVY: [number, number, number] = [10, 31, 68];
const SEAFOAM: [number, number, number] = [122, 197, 176];
const TEXT: [number, number, number] = [17, 24, 39];
const MUTED: [number, number, number] = [107, 114, 128];
const RULE: [number, number, number] = [226, 232, 240];

const PAGE_W = 612; // US Letter, pt
const PAGE_H = 792;
const MX = 48;
const TOP = 52;
const BOTTOM = 56;
const W = PAGE_W - MX * 2;

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "company";
}

/** jsPDF's built-in Helvetica only has Latin-1 glyphs: map curly quotes, dashes and the approx sign, drop the rest. */
const PDF_SUBST: Record<number, string> = { 0x2018: "'", 0x2019: "'", 0x201c: '"', 0x201d: '"', 0x2013: "-", 0x2014: "-", 0x2248: "~" };
function clean(s: string | null | undefined): string {
  let out = "";
  for (const ch of String(s ?? "")) {
    const c = ch.codePointAt(0) ?? 0;
    if (PDF_SUBST[c]) out += PDF_SUBST[c];
    else if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff)) out += ch;
  }
  return out;
}

class Writer {
  doc = new jsPDF({ unit: "pt", format: "letter" });
  y = TOP;
  page = 1;
  constructor(private footer: string) {
    this.doc.setFont("helvetica", "normal");
  }
  fits(h: number) {
    return this.y + h <= PAGE_H - BOTTOM;
  }
  newPage() {
    this.drawFooter();
    this.doc.addPage();
    this.page++;
    this.y = TOP;
  }
  ensure(h: number) {
    if (!this.fits(h)) this.newPage();
  }
  drawFooter() {
    const d = this.doc;
    d.setFontSize(8);
    d.setTextColor(...MUTED);
    d.text(clean(this.footer), MX, PAGE_H - 28);
    d.text(`Page ${this.page}`, PAGE_W - MX, PAGE_H - 28, { align: "right" });
  }
  text(s: string, x: number, opts: { size?: number; bold?: boolean; color?: [number, number, number]; maxW?: number; align?: "left" | "right" } = {}) {
    const d = this.doc;
    d.setFont("helvetica", opts.bold ? "bold" : "normal");
    d.setFontSize(opts.size ?? 10);
    d.setTextColor(...(opts.color ?? TEXT));
    let str = clean(s);
    if (opts.maxW) {
      while (str.length > 1 && d.getTextWidth(str) > opts.maxW) str = str.slice(0, -2);
      if (str !== clean(s)) str = str.replace(/\s*$/, "") + "...";
    }
    d.text(str, x, this.y, { align: opts.align ?? "left" });
  }
  heading(s: string, minFollowing = 60) {
    this.ensure(28 + minFollowing);
    this.y += 10;
    this.text(s, MX, { size: 12, bold: true, color: NAVY });
    this.y += 6;
    this.doc.setDrawColor(...RULE);
    this.doc.setLineWidth(0.6);
    this.doc.line(MX, this.y, MX + W, this.y);
    this.y += 14;
  }
  bar(x: number, w: number, frac: number, color: [number, number, number]) {
    this.doc.setFillColor(241, 245, 249);
    this.doc.rect(x, this.y - 6, w, 6, "F");
    this.doc.setFillColor(...color);
    this.doc.rect(x, this.y - 6, Math.max(2, w * Math.min(1, frac)), 6, "F");
  }
}

type Brief = Pick<CompanyBriefState, "base" | "pulled" | "movement">;

function pulledPeople(b: Brief): { group: PullGroup; people: RosterPerson[] }[] {
  const seen = new Set<string>();
  return GROUP_ORDER.filter((g) => b.pulled[g]).map((g) => ({
    group: g,
    people: (b.pulled[g]?.pages ?? []).flatMap((p) => p.people).filter((p) => {
      const k = p.linkedin_profile_url ?? `${p.name}|${p.title}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }),
  }));
}

export function buildCompanyBriefPdf(b: Brief): { doc: jsPDF; filename: string } {
  const base = b.base!;
  const name = base.display_name;
  const generated = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const w = new Writer(`${name} · Oslr company brief · ${generated}`);

  // Title block
  w.doc.setFillColor(...NAVY);
  w.doc.rect(0, 0, PAGE_W, 6, "F");
  w.y = TOP + 4;
  w.text(name, MX, { size: 20, bold: true, color: NAVY, maxW: W });
  w.y += 16;
  const facts = [
    OWNERSHIP_LABEL[base.ownership.model],
    base.industry,
    [base.hq_city, base.hq_state].filter(Boolean).join(", "),
    base.company_website_domain,
  ].filter(Boolean).join("   ·   ");
  w.text(facts, MX, { size: 10, color: MUTED, maxW: W });
  w.y += 14;
  w.text(`Combines ${base.pages.length} company page${base.pages.length > 1 ? "s" : ""}: ${base.pages.map((p) => p.name).join("; ")}`, MX, { size: 8.5, color: MUTED, maxW: W });
  w.y += 12;
  w.text(`Generated ${generated}.${b.movement ? ` Movement covers the last ${b.movement.window_months} months.` : ""}`, MX, { size: 8.5, color: MUTED });
  w.y += 22;

  const groups = pulledPeople(b);
  const kpis: [string, string][] = [
    ["Employees", base.headcount.total !== null ? String(base.headcount.total) : "-"],
    ["1-year change", base.headcount.yoy_percent !== null ? `${base.headcount.yoy_percent >= 0 ? "+" : ""}${base.headcount.yoy_percent.toFixed(1)}%` : "-"],
    ["Founded", base.year_founded ? String(base.year_founded) : "-"],
    ["Started here", b.movement ? String(b.movement.hires.length) : "-"],
    ["Left", b.movement ? String(b.movement.departures.length) : "-"],
  ];
  const colW = W / kpis.length;
  kpis.forEach(([label], i) => w.text(label, MX + i * colW, { size: 8.5, color: MUTED }));
  w.y += 18;
  kpis.forEach(([, v], i) => w.text(v, MX + i * colW, { size: 18, bold: true, color: TEXT }));
  w.y += 20;

  if (base.description) {
    w.heading("About", 30);
    const lines = w.doc.splitTextToSize(clean(base.description), W) as string[];
    for (const line of lines.slice(0, 8)) {
      w.ensure(13);
      w.text(line, MX, { size: 9.5 });
      w.y += 13;
    }
  }

  if (base.sites.length) {
    w.heading("Where staff work", base.sites.length * 15);
    const max = Math.max(1, ...base.sites.map((s) => s.count));
    for (const site of base.sites) {
      w.ensure(15);
      w.text(site.place, MX, { size: 9.5, maxW: 140 });
      w.bar(MX + 150, W - 200, site.count / max, SEAFOAM);
      w.text(String(site.count), MX + W, { size: 9.5, bold: true, align: "right" });
      w.y += 15;
    }
  }

  if (b.movement) {
    const rows = netFlow(b.movement.hires, b.movement.departures, 10);
    if (rows.length) {
      w.heading("Trades staff with", 18 + Math.min(rows.length, 4) * 15);
      w.text("Company", MX, { size: 8.5, color: MUTED });
      w.text("Came from them", MX + W - 110, { size: 8.5, color: MUTED, align: "right" });
      w.text("Left for them", MX + W, { size: 8.5, color: MUTED, align: "right" });
      w.y += 14;
      for (const r of rows) {
        w.ensure(15);
        w.text(r.company, MX, { size: 9.5, maxW: W - 200 });
        w.text(String(r.joined_from || "-"), MX + W - 110, { size: 9.5, align: "right" });
        w.text(String(r.left_to || "-"), MX + W, { size: 9.5, align: "right" });
        w.y += 15;
      }
    }
  }

  const cols = [MX, MX + 150, MX + 290, MX + 430];
  const header = () => {
    w.text("Name", cols[0], { size: 8.5, color: MUTED });
    w.text("Title", cols[1], { size: 8.5, color: MUTED });
    w.text("Specialty and training", cols[2], { size: 8.5, color: MUTED });
    w.text("Here since", cols[3], { size: 8.5, color: MUTED });
    w.y += 13;
  };
  for (const { group, people } of groups) {
    if (!people.length) continue;
    const title = `${GROUP_LABEL[group]} (${people.length})`;
    w.heading(title, 13 + 3 * 26);
    header();
    for (const person of people) {
      if (!w.fits(26)) {
        w.newPage();
        w.text(`${GROUP_LABEL[group]}, continued`, MX, { size: 9, bold: true, color: NAVY });
        w.y += 16;
        header();
      }
      w.text(person.name, cols[0], { size: 9.5, bold: true, maxW: 140 });
      w.text(person.title ?? ROLE_SHORT[person.role_group], cols[1], { size: 9, maxW: 132 });
      w.text(person.subspecialty ?? person.specialty ?? "", cols[2], { size: 9, maxW: 132 });
      w.text(person.start_date ? fmtMonth(person.start_date) : "-", cols[3], { size: 9 });
      w.y += 11;
      w.text(person.trained_at ? `${person.training_kind === "fellowship" ? "Fellowship" : "Residency"}: ${person.trained_at}` : "", cols[2], { size: 8, color: MUTED, maxW: 132 });
      w.text(person.city ?? "", cols[3], { size: 8, color: MUTED, maxW: W - 430 });
      w.y += 15;
    }
  }

  const moveTable = (title: string, list: MovementPerson[], dir: "joined" | "left") => {
    if (!list.length) return;
    w.heading(`${title} (${list.length})`, 3 * 26);
    for (const m of list) {
      if (!w.fits(26)) {
        w.newPage();
        w.text(`${title}, continued`, MX, { size: 9, bold: true, color: NAVY });
        w.y += 16;
      }
      const date = dir === "joined" ? m.current_company_start_date : m.previous_end_date;
      const role = dir === "joined" ? m.current_title : m.previous_title;
      const other = dir === "joined" ? m.previous_company : m.current_company;
      w.text(m.name, MX, { size: 9.5, bold: true, maxW: 150 });
      w.text(role ?? "", MX + 160, { size: 9, maxW: 250 });
      w.text(fmtMonth(date), MX + W, { size: 9, align: "right" });
      w.y += 11;
      w.text(dir === "joined" ? (other ? `From ${other}` : "") : other ? `Now at ${other}` : "", MX + 160, { size: 8, color: MUTED, maxW: 250 });
      w.y += 15;
    }
  };
  if (b.movement) {
    moveTable("Started here", b.movement.hires, "joined");
    moveTable("Left", b.movement.departures, "left");
  }

  w.drawFooter();
  return { doc: w.doc, filename: `${slug(name)}-company-brief.pdf` };
}

export function downloadCompanyBriefPdf(b: Brief) {
  if (!b.base) return;
  const { doc, filename } = buildCompanyBriefPdf(b);
  doc.save(filename);
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One sheet: pulled people by group, then everyone who started or left, with a column saying which. */
export function buildCompanyCsv(b: Brief): { csv: string; filename: string } {
  const name = b.base?.display_name ?? "company";
  const rows: unknown[][] = [["Status", "Group", "Name", "Title", "Specialty", "Training", "Date", "Other company", "City", "Profile URL"]];
  for (const { group, people } of pulledPeople(b)) {
    for (const p of people) {
      rows.push(["Current", GROUP_LABEL[group], p.name, p.title, p.subspecialty ?? p.specialty, p.trained_at ? `${p.training_kind}: ${p.trained_at}` : "", p.start_date?.slice(0, 7), p.also_at.join("; "), p.city, p.linkedin_profile_url]);
    }
  }
  for (const h of b.movement?.hires ?? []) {
    rows.push(["Started here", ROLE_SHORT[h.role_group], h.name, h.current_title, h.specialty ?? "", "", h.current_company_start_date?.slice(0, 7), h.previous_company, "", h.linkedin_profile_url]);
  }
  for (const d of b.movement?.departures ?? []) {
    rows.push(["Left", ROLE_SHORT[d.role_group], d.name, d.previous_title, d.specialty ?? "", "", d.previous_end_date?.slice(0, 7), d.current_company, "", d.linkedin_profile_url]);
  }
  return { csv: rows.map((r) => r.map(csvCell).join(",")).join("\n"), filename: `${slug(name)}-people.csv` };
}

export function downloadCompanyCsv(b: Brief) {
  if (!b.base) return;
  const { csv, filename } = buildCompanyCsv(b);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
