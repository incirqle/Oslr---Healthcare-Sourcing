/**
 * Fills each export row with information already paid for or public before a file is built:
 * contact details saved from earlier lookups (read only, never a new lookup or charge)
 * and the free federal doctor record (NPI, Open Payments, PubMed, clinical trials).
 */
import { enrichContact } from "@/hooks/useContactEnrich";
import { loadDoctorIntel } from "@/lib/doctorIntel";
import type { AnyCandidate } from "@/lib/candidate-export-adapter";

type Row = Record<string, unknown> & { raw?: Record<string, unknown> };
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const item = items[i++]; await fn(item).catch(() => {}); }
  }));
}

export async function prepareForExport(list: AnyCandidate[], includeContactInfo: boolean): Promise<AnyCandidate[]> {
  const rows = list.map((c) => ({ ...(c as Row), raw: { ...((c as Row).raw ?? {}) } }));

  if (includeContactInfo) {
    await pool(rows.slice(0, 200), 5, async (row) => {
      const url = str(row.linkedin_url) || str(row.raw?.linkedin_url);
      if (!url) return;
      const r = await enrichContact(url, []);
      const c = r?.contact;
      if (!c || r.error) return;
      if (c.work_email && !row.work_email) row.work_email = c.work_email;
      const personal = c.personal_emails?.find((e) => e && e.toLowerCase() !== c.work_email?.toLowerCase());
      if (personal && !row.personal_email) row.personal_email = personal;
      if (c.phone_numbers?.[0] && !row.phone) row.phone = c.phone_numbers[0];
    });
  }

  const needIntel = rows.filter((r) => !r.raw?.doctor_intel && str(r.id) && str(r.full_name));
  if (needIntel.length) {
    const intel = await loadDoctorIntel(needIntel.map((r) => ({
      id: str(r.id), full_name: str(r.full_name), title: str(r.title) || str(r.raw?.job_title),
      location: str(r.location), current_employer: str(r.current_employer) || str(r.raw?.job_company_name),
    })));
    needIntel.forEach((r) => { const d = intel.get(str(r.id)); if (d) r.raw = { ...r.raw, doctor_intel: d }; });
  }
  return rows as AnyCandidate[];
}
