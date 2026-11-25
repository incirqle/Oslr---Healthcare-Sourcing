import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { observeVerifiedWorkEmail, suggestInstitutionWorkEmail } from "./institution-email-store.ts";

type Row = Record<string, any>;
class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private max = Infinity;
  constructor(private rows: Row[]) {}
  eq(field: string, value: unknown) { this.filters.push((r) => r[field] === value); return this; }
  gt(field: string, value: string) { this.filters.push((r) => String(r[field]) > value); return this; }
  order(_field: string, _options: unknown) { return this; }
  limit(n: number) { this.max = n; return this; }
  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    return Promise.resolve(resolve({ data: this.rows.filter((r) => this.filters.every((f) => f(r))).slice(0, this.max), error: null }));
  }
}
class FakeDb {
  rows: Row[] = [];
  from(_table: string) {
    return {
      upsert: async (row: Row, _options: unknown) => {
        const i = this.rows.findIndex((r) => r.scope_key === row.scope_key && r.person_hash === row.person_hash && r.address_hash === row.address_hash);
        if (i >= 0) this.rows[i] = { ...this.rows[i], ...row }; else this.rows.push(row);
        return { error: null };
      },
      select: (_fields: string) => new FakeQuery(this.rows),
    };
  }
}

const base = {
  employer: "Example Medical Center",
  employerDomain: "example.org",
  title: "Physician",
  verified: true,
};
async function seed(db: FakeDb, domain = "example.org") {
  const people = [
    ["https://linkedin.com/in/ada", "Ada Lovelace", "ada.lovelace"],
    ["https://linkedin.com/in/grace", "Grace Hopper", "grace.hopper"],
    ["https://linkedin.com/in/katherine", "Katherine Johnson", "katherine.johnson"],
  ];
  for (const [linkedinUrl, fullName, local] of people) {
    await observeVerifiedWorkEmail(db, { ...base, employerDomain: domain, linkedinUrl, fullName, workEmail: `${local}@${domain}` });
  }
}

Deno.test("evidence persistence stores hashes and patterns, never raw colleague contact data", async () => {
  const db = new FakeDb();
  await seed(db);
  assertEquals(db.rows.length, 3);
  const serialized = JSON.stringify(db.rows);
  assertEquals(serialized.includes("ada.lovelace"), false);
  assertEquals(serialized.includes("Ada Lovelace"), false);
  assertEquals(serialized.includes("linkedin.com/in/ada"), false);
  assertEquals(db.rows.every((r) => r.person_hash.length === 64 && r.address_hash.length === 64), true);
  assertEquals(db.rows.every((r) => r.patterns.includes("first.last")), true);
});

Deno.test("an employer-domain mismatch cannot teach the institution", async () => {
  const db = new FakeDb();
  await observeVerifiedWorkEmail(db, {
    ...base, linkedinUrl: "https://linkedin.com/in/other", fullName: "Other Person", workEmail: "other.person@outside.com",
  });
  assertEquals(db.rows.length, 0);
  await observeVerifiedWorkEmail(db, {
    ...base, verified: false, linkedinUrl: "https://linkedin.com/in/other", fullName: "Other Person", workEmail: "other.person@example.org",
  });
  assertEquals(db.rows.length, 0);
});

Deno.test("three exact-scope observations yield one explicitly unverified suggestion", async () => {
  const db = new FakeDb();
  await seed(db);
  const suggestion = await suggestInstitutionWorkEmail(db, {
    linkedinUrl: "https://linkedin.com/in/mark", fullName: "Mark Sonderman", employer: base.employer,
    employerDomain: base.employerDomain, title: base.title,
  });
  assertEquals(suggestion?.email, "mark.sonderman@example.org");
  assertEquals(suggestion?.verification, "unverified");
  assertEquals(suggestion?.sampleCount, 3);
});

Deno.test("multiple supported employer domains abstain instead of guessing an affiliation", async () => {
  const db = new FakeDb();
  await seed(db, "example.org");
  await seed(db, "university.edu");
  const suggestion = await suggestInstitutionWorkEmail(db, {
    linkedinUrl: "https://linkedin.com/in/mark", fullName: "Mark Sonderman", employer: base.employer,
    employerDomain: null, title: base.title,
  });
  assertEquals(suggestion, null);
});

Deno.test("a candidate address tied to a different profile is withheld", async () => {
  const db = new FakeDb();
  await seed(db);
  await observeVerifiedWorkEmail(db, {
    ...base, linkedinUrl: "https://linkedin.com/in/other-mark", fullName: "Mark Sonderman", workEmail: "mark.sonderman@example.org",
  });
  const suggestion = await suggestInstitutionWorkEmail(db, {
    linkedinUrl: "https://linkedin.com/in/target-mark", fullName: "Mark Sonderman", employer: base.employer,
    employerDomain: base.employerDomain, title: base.title,
  });
  assertEquals(suggestion, null);
});
