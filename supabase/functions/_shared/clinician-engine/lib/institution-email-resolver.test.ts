import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { researchInstitutionWorkEmail } from "./institution-email-resolver.ts";
import { observeVerifiedWorkEmail } from "./institution-email-store.ts";

type Row = Record<string, any>;
class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  constructor(private rows: Row[]) {}
  eq(field: string, value: unknown) { this.filters.push((r) => r[field] === value); return this; }
  gt(field: string, value: string) { this.filters.push((r) => String(r[field]) > value); return this; }
  order() { return this; }
  limit() { return this; }
  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve(resolve({ data: this.rows.filter((r) => this.filters.every((f) => f(r))), error: null }));
  }
}
class FakeDb {
  rows: Row[] = [];
  from() {
    return {
      upsert: async (row: Row) => { this.rows.push(row); return { error: null }; },
      select: () => new FakeQuery(this.rows),
    };
  }
}

const target = {
  linkedinUrl: "https://www.linkedin.com/in/matthew-magruder-025089b2",
  fullName: "Matthew Magruder",
  employer: "Maimonides Medical Center",
  employerDomain: null,
  title: "PGY-4 Orthopedic Surgery Resident",
};
// Real shape: Maimonides lists a link page, staff hold unverified maimonidesmed.org
// addresses, and several staff also list second jobs with other addresses.
const staff = [
  ["joel", "Joel Schwartz", "jschwartz@maimonidesmed.org", false],
  ["ira", "Ira Futterman", "ifutterman@maimonidesmed.org", false],
  ["jacob", "Jacob Khurgin", "jkhurgin@maimonidesmed.org", false],
  ["norman", "Norman Saffra", "nsaffra@maimonidesmed.org", false],
  ["michael", "Michael Mager", "michael@precisionneuro.io", true],
  ["robert", "Robert Ackerman", "robert@linktr.ee", true],
] as const;
const profiles = staff.map(([id, name]) => ({
  basic_profile: { name },
  experience: { employment_details: { current: [{ name: target.employer, crustdata_company_id: 1127784, title: "Attending Physician" }] } },
  social_handles: { professional_network_identifier: { profile_url: `https://www.linkedin.com/in/${id}` } },
}));
const contacts = staff.map(([id, , email, verified]) => ({
  linkedin_url: `https://www.linkedin.com/in/${id}`, business_email: email, business_email_verified: verified,
  personal_emails: [], mobile_phone: null, phones: [], raw: {}, has_contact: true,
}));
function setup(over: Record<string, unknown> = {}) {
  const cache = new Map<string, unknown>();
  const calls = { search: 0, contacts: 0, review: 0 };
  const deps: any = {
    companySearch: async () => ({ ok: true, data: [{ company_id: 1127784, name: target.employer, basic_info: { name: target.employer, primary_domain: "", all_domains: [], website: "https://linktr.ee/MaimonidesHealth" } }] }),
    autocomplete: async () => [target.employer, "MAIMONIDES MEDICAL CENTER - MMC RADIOLOGY FPP", "Maimonides Midwood Community Hospital"],
    search: async () => { calls.search++; return { ok: true, data: { profiles, total_count: profiles.length, next_cursor: null, remarks: [] } }; },
    contacts: async () => { calls.contacts++; return { ok: true, data: contacts }; },
    reason: async (i: any) => { calls.review++; return { decision: { pattern: i.proposedPattern, sharedAcrossRoles: false, sampleIds: [], blockers: [] }, model: "test", elapsedMs: 1 }; },
    cacheGet: async (key: string) => cache.has(key) ? { profiles: [cache.get(key)], total_count: 1, next_cursor: null } : null,
    cacheSet: async (key: string, _t: number, rows: unknown[]) => { cache.set(key, rows[0]); },
    ...over,
  };
  return { deps, cache, calls };
}

Deno.test("Matthew Magruder: a link-page website no longer blocks; coworkers produce mmagruder@maimonidesmed.org", async () => {
  const { deps } = setup();
  const r = await researchInstitutionWorkEmail(new FakeDb(), target, deps);
  assertEquals(r.suggestion?.email, "mmagruder@maimonidesmed.org");
  assertEquals(r.audit.outcome, "reconstructed");
  assertEquals(r.audit.domainSource, "colleagues");
  assertEquals(r.audit.supporters, 4);
});

Deno.test("searches include the employer's own sub-units but not a different similarly named hospital", async () => {
  let filters = "";
  const { deps } = setup({ search: async (i: any) => { filters = JSON.stringify(i.filters); return { ok: true, data: { profiles, total_count: 6, next_cursor: null, remarks: [] } }; } });
  await researchInstitutionWorkEmail(new FakeDb(), target, deps);
  assert(filters.includes("MMC RADIOLOGY FPP"));
  assert(!filters.includes("Midwood"));
});

Deno.test("the next lookup at the same hospital reuses the rule with no provider calls", async () => {
  const { deps, calls } = setup();
  const db = new FakeDb();
  await researchInstitutionWorkEmail(db, target, deps);
  const before = { ...calls };
  const r = await researchInstitutionWorkEmail(db, { ...target, fullName: "Brittany Ammerman", linkedinUrl: "https://www.linkedin.com/in/brittany" }, deps);
  assertEquals(r.suggestion?.email, "bammerman@maimonidesmed.org");
  assertEquals(r.audit.outcome, "reused");
  assertEquals(calls, before);
});

Deno.test("two same-name organizations never pull coworkers", async () => {
  const { deps, calls } = setup({ companySearch: async () => ({ ok: true, data: [
    { company_id: 1, name: target.employer, basic_info: { name: target.employer } },
    { company_id: 2, name: target.employer, basic_info: { name: target.employer } },
  ] }) });
  const r = await researchInstitutionWorkEmail(new FakeDb(), target, deps);
  assertEquals(r.suggestion, null);
  assertEquals(r.audit.reason, "employer_not_unambiguous");
  assertEquals(calls.search, 0);
});

Deno.test("too few coworker examples gives no email and is remembered briefly", async () => {
  const { deps, calls } = setup({ contacts: async () => { calls.contacts++; return { ok: true, data: contacts.slice(0, 2) }; } });
  const db = new FakeDb();
  const first = await researchInstitutionWorkEmail(db, target, deps);
  assertEquals(first.suggestion, null);
  assertEquals(first.audit.reason, "fewer_than_three_institution_examples");
  const searches = calls.search;
  await researchInstitutionWorkEmail(db, target, deps);
  assertEquals(calls.search, searches);
});

Deno.test("a coworker contact outage is retryable, never remembered as a miss", async () => {
  const { deps, cache } = setup({ contacts: async () => ({ ok: false, status: 503, insufficientCredits: false }) });
  const r = await researchInstitutionWorkEmail(new FakeDb(), target, deps);
  assertEquals(r.audit.outcome, "unavailable");
  assert(![...cache.keys()].some((k) => k.includes("institution-miss")));
});

Deno.test("the second-opinion review can veto with a factual blocker; its outage does not block", async () => {
  const veto = setup({ reason: async () => ({ decision: { pattern: null, sharedAcrossRoles: false, sampleIds: [], blockers: ["department mailbox"] }, model: "t", elapsedMs: 1 }) });
  assertEquals((await researchInstitutionWorkEmail(new FakeDb(), target, veto.deps)).suggestion, null);
  const down = setup({ reason: async () => ({ decision: null, model: "t", elapsedMs: 1, error: "timeout" }) });
  assertEquals((await researchInstitutionWorkEmail(new FakeDb(), target, down.deps)).suggestion?.email, "mmagruder@maimonidesmed.org");
});

Deno.test("an address already on record for another person is withheld", async () => {
  const db = new FakeDb();
  await observeVerifiedWorkEmail(db, {
    linkedinUrl: "https://www.linkedin.com/in/someone-else", fullName: "Mark Magruder", employer: target.employer,
    employerDomain: "maimonidesmed.org", title: "Nurse", workEmail: "mmagruder@maimonidesmed.org", verified: true,
  });
  const { deps } = setup();
  const r = await researchInstitutionWorkEmail(db, target, deps);
  assertEquals(r.suggestion, null);
  assertEquals(r.audit.reason, "address_belongs_to_another_person");
});

Deno.test("only provider-verified coworker addresses are saved as reusable evidence, as hashes", async () => {
  const db = new FakeDb();
  const verifiedContacts = contacts.map((c, i) => ({ ...c, business_email_verified: i < 3 }));
  const { deps } = setup({ contacts: async () => ({ ok: true, data: verifiedContacts }) });
  const r = await researchInstitutionWorkEmail(db, target, deps);
  assertEquals(r.audit.evidenceSaved, 3);
  assert(!JSON.stringify(db.rows).includes("jschwartz@"));
});
