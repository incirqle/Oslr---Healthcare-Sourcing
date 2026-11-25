import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { researchInstitutionWorkEmail } from "./institution-email-resolver.ts";
import { observeVerifiedWorkEmail } from "./institution-email-store.ts";

type Row = Record<string, any>;
class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private max = Infinity;
  constructor(private rows: Row[]) {}
  eq(field: string, value: unknown) { this.filters.push((r) => r[field] === value); return this; }
  gt(field: string, value: string) { this.filters.push((r) => String(r[field]) > value); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve(resolve({ data: this.rows.filter((r) => this.filters.every((f) => f(r))).slice(0, this.max), error: null }));
  }
}
class FakeDb {
  rows: Row[] = [];
  from() {
    return {
      upsert: async (row: Row) => {
        const i = this.rows.findIndex((r) => r.scope_key === row.scope_key && r.person_hash === row.person_hash && r.address_hash === row.address_hash);
        if (i >= 0) this.rows[i] = { ...this.rows[i], ...row }; else this.rows.push(row);
        return { error: null };
      },
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
const people = [
  ["alice", "Alice Anderson", "aanderson"],
  ["ben", "Ben Brown", "bbrown"],
  ["carla", "Carla Clark", "cclark"],
] as const;
const profiles = people.map(([id, name]) => ({
  basic_profile: { name },
  experience: { employment_details: { current: [{ name: target.employer, title: "Orthopedic Surgery Resident" }] } },
  social_handles: { professional_network_identifier: { profile_url: `https://www.linkedin.com/in/${id}` } },
}));
const contacts = people.map(([id, , local]) => ({
  linkedin_url: `https://www.linkedin.com/in/${id}`,
  business_email: `${local}@maimo.org`,
  business_email_verified: true,
  personal_emails: [], mobile_phone: null, phones: [], raw: {}, has_contact: true,
}));
const cache = new Map<string, unknown>();
const company = (domain: string | null = "maimo.org") => async () => ({
  ok: true as const,
  data: [{ company_id: 1, name: target.employer, basic_info: { name: target.employer, primary_domain: domain, website: "https://linktr.ee/MaimonidesHealth" } }],
});
const deps = {
  companySearch: company(),
  webSearch: async () => ({ ok: true as const, data: { success: true, results: [{ title: "Maimonides Medical Center | Brooklyn", url: "https://www.google.com/goto?official" }] } }),
  resolveRedirect: async () => "https://maimo.org/",
  search: async () => ({ ok: true as const, data: { profiles, total_count: 3, next_cursor: null, remarks: [] } }),
  contacts: async () => ({ ok: true as const, data: contacts }),
  cacheGet: async (key: string) => cache.has(key) ? { profiles: [cache.get(key)], total_count: 1, next_cursor: null } : null,
  cacheSet: async (key: string, _total: number, rows: unknown[]) => { cache.set(key, rows[0]); },
};

Deno.test("a miss dynamically learns three current colleague patterns and fills the normal work-email value", async () => {
  cache.clear();
  const db = new FakeDb();
  let searchBody: Record<string, unknown> | null = null;
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    search: async (input) => {
      searchBody = input.filters;
      return { ok: true as const, data: { profiles, total_count: 3, next_cursor: null, remarks: [] } };
    },
  });
  assertEquals(result.suggestion?.email, "mmagruder@maimo.org");
  assertEquals(result.audit.outcome, "reconstructed");
  assertEquals(result.audit.evidenceSaved, 3);
  assertEquals(db.rows.length, 3);
  assert(!JSON.stringify(db.rows).includes("aanderson@maimo.org"));
  assert(JSON.stringify(searchBody).includes("business_email_verified"));
  assert(JSON.stringify(searchBody).includes("experience.employment_details.current.title"));
});

Deno.test("the official site and verified colleagues establish the domain when the company only has a link page", async () => {
  cache.clear();
  const db = new FakeDb();
  const result = await researchInstitutionWorkEmail(db, target, { ...deps, companySearch: company(null) });
  assertEquals(result.suggestion?.email, "mmagruder@maimo.org");
  assertEquals(result.audit.domain, "maimo.org");
  assertEquals(result.audit.domainSource, "official_site");
  assertEquals(result.audit.outcome, "reconstructed");
  assert([...cache.keys()].some((key) => key.includes("contact:employer-domain:v3:")));
});

Deno.test("a failed top-result redirect abstains instead of accepting a later directory domain", async () => {
  cache.clear();
  let searched = false;
  const result = await researchInstitutionWorkEmail(new FakeDb(), target, {
    ...deps,
    companySearch: company(null),
    webSearch: async () => ({
      ok: true as const,
      data: { success: true, results: [
        { title: "Maimonides Medical Center | Brooklyn", url: "https://www.google.com/goto?official" },
        { title: "Maimonides Medical Center Doctors | Doximity", url: "https://www.doximity.com/maimonides" },
      ] },
    }),
    resolveRedirect: async () => null,
    search: async () => { searched = true; throw new Error("must not run"); },
  });
  assertEquals(result.suggestion, null);
  assertEquals(result.audit.reason, "employer_domain_not_unambiguous");
  assertEquals(searched, false);
});

Deno.test("the exact organization logic is reused without more provider calls", async () => {
  cache.clear();
  const db = new FakeDb();
  await researchInstitutionWorkEmail(db, target, deps);
  let called = false;
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    companySearch: async () => { called = true; throw new Error("must not run"); },
    search: async () => { called = true; throw new Error("must not run"); },
    contacts: async () => { called = true; throw new Error("must not run"); },
  });
  assertEquals(result.suggestion?.email, "mmagruder@maimo.org");
  assertEquals(result.audit.outcome, "reused");
  assertEquals(called, false);
});

Deno.test("an exact-name employer miss does not guess a domain or call colleagues", async () => {
  cache.clear();
  let searched = false;
  const result = await researchInstitutionWorkEmail(new FakeDb(), target, {
    ...deps,
    companySearch: async () => ({ ok: true as const, data: [{ company_id: 2, name: "Different Medical Center", basic_info: { name: "Different Medical Center", primary_domain: "wrong.org" } }] }),
    search: async () => { searched = true; throw new Error("must not run"); },
  });
  assertEquals(result.suggestion, null);
  assertEquals(result.audit.reason, "employer_not_unambiguous");
  assertEquals(searched, false);
});

Deno.test("wrong-cohort and outside-domain addresses cannot teach the pattern", async () => {
  cache.clear();
  const db = new FakeDb();
  const wrongProfiles = profiles.map((p) => ({
    ...p,
    experience: { employment_details: { current: [{ name: target.employer, title: "Attending Physician" }] } },
  }));
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    search: async () => ({ ok: true as const, data: { profiles: wrongProfiles, total_count: 3, next_cursor: null, remarks: [] } }),
  });
  assertEquals(result.suggestion, null);
  assertEquals(result.audit.colleaguesSelected, 0);
  assertEquals(db.rows.length, 0);
});

Deno.test("a failed colleague contact request is retryable and never cached as evidence", async () => {
  cache.clear();
  const db = new FakeDb();
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    contacts: async () => ({ ok: false as const, status: 429, insufficientCredits: false, detail: "busy" }),
  });
  assertEquals(result.suggestion, null);
  assertEquals(result.audit.outcome, "unavailable");
  assertEquals(result.audit.reason, "colleague_contacts_unavailable");
  assertEquals(db.rows.length, 0);
});

Deno.test("coworker addresses outside the official domain are discarded", async () => {
  cache.clear();
  const db = new FakeDb();
  const mixed = contacts.map((row, i) => ({ ...row, business_email: `${["aanderson", "bbrown", "cclark"][i]}@${i === 2 ? "other.org" : "maimo.org"}` }));
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    companySearch: company(null),
    contacts: async () => ({ ok: true as const, data: mixed }),
  });
  assertEquals(result.suggestion, null);
  assertEquals(result.audit.reason, "insufficient_verified_exact_domain_evidence");
  assertEquals(db.rows.length, 2);
  assert(![...cache.keys()].some((key) => key.includes("contact:employer-domain:v3:")));
});

Deno.test("a broader second pass fills missing colleagues without duplicating people", async () => {
  cache.clear();
  const db = new FakeDb();
  let calls = 0;
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    search: async () => {
      calls++;
      const rows = calls === 1 ? profiles.slice(0, 2) : profiles;
      return { ok: true as const, data: { profiles: rows, total_count: rows.length, next_cursor: null, remarks: [] } };
    },
  });
  assertEquals(result.suggestion?.email, "mmagruder@maimo.org");
  assertEquals(calls, 2);
  assertEquals(result.audit.profilesExamined, 5);
  assertEquals(result.audit.colleaguesSelected, 3);
});

Deno.test("previously observed evidence still requires three independent people", async () => {
  cache.clear();
  const db = new FakeDb();
  await observeVerifiedWorkEmail(db, {
    linkedinUrl: "https://linkedin.com/in/one", fullName: "One Person", employer: target.employer,
    employerDomain: "maimo.org", title: "Resident", workEmail: "operson@maimo.org", verified: true,
  });
  const result = await researchInstitutionWorkEmail(db, target, {
    ...deps,
    search: async () => ({ ok: true as const, data: { profiles: profiles.slice(0, 2), total_count: 2, next_cursor: null, remarks: [] } }),
  });
  assertEquals(result.suggestion, null);
  assertEquals(result.audit.reason, "fewer_than_three_current_same_cohort_colleagues");
});
