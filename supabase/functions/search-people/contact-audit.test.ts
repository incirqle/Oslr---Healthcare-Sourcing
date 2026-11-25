import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ContactAudit } from "./contact-audit.ts";

Deno.test("every enabled lookup persists its ordered steps and private reconstruction outcome", async () => {
  const rows: Record<string, unknown>[] = [];
  const audit = new ContactAudit({ from: () => ({ insert: async (row: Record<string, unknown>) => { rows.push(row); return { error: null }; } }) }, {
    companyId: "company-1", userId: "user-1", linkedinUrl: "https://www.linkedin.com/in/target",
    candidateName: "Target Person", employer: "Example Medicine", requested: ["work_email"], enabled: true,
  });
  audit.step("instant", "miss", { fields: [] });
  audit.step("institution_research", "found", { detail: "reconstructed" });
  audit.record({ found: ["work_email"], work_email: "tperson@example.org", employer_domain: "example.org", charged: 2 });
  await audit.finish(200, "found");
  assertEquals(rows.length, 1);
  assertEquals(rows[0].status, "found");
  assertEquals((rows[0].steps as unknown[]).length, 2);
  assertEquals((rows[0].result as Record<string, unknown>).work_email, "tperson@example.org");
  assertEquals(rows[0].employer_domain, "example.org");
});

Deno.test("read-only cache checks do not create lookup audit rows", async () => {
  let writes = 0;
  const audit = new ContactAudit({ from: () => ({ insert: async () => { writes++; return { error: null }; } }) }, {
    companyId: "company-1", userId: "user-1", linkedinUrl: "https://www.linkedin.com/in/target",
    candidateName: null, employer: null, requested: [], enabled: false,
  });
  await audit.finish(200, "cached");
  assertEquals(writes, 0);
});
