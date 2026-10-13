/**
 * @vitest-environment node
 *
 * Runs the clinician engine's Deno.test suites under vitest, plus the
 * reproduction of the 2026-10-12 live failure ("orthopedic surgeons in
 * Miami, Florida"), so `npm test` covers the search engine without Deno.
 *
 * The engine files are imported by URL built at runtime (not a literal
 * specifier) so the Vite app's type-check does not pull Deno-only modules
 * into its program.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, it, expect } from "vitest";

type DenoTest = { name: string; fn: () => unknown | Promise<unknown> };
const collected: DenoTest[] = [];

(globalThis as unknown as { Deno: unknown }).Deno = {
  env: { get: () => undefined },
  readTextFile: async (p: string) => fs.readFileSync(p, "utf8"),
  readDir: async function* (d: string) {
    for (const n of fs.readdirSync(d)) {
      const st = fs.statSync(`${d}/${n}`);
      yield { name: n, isFile: st.isFile(), isDirectory: st.isDirectory() };
    }
  },
  test: (a: string | { name: string; fn?: DenoTest["fn"] }, b?: DenoTest["fn"]) => {
    if (typeof a === "string") collected.push({ name: a, fn: b! });
    else collected.push({ name: a.name, fn: (a.fn ?? b)! });
  },
};

const engineDir = path.resolve(process.cwd(), "supabase/functions/_shared/clinician-engine") + "/";
const adapterDir = path.resolve(process.cwd(), "supabase/functions/search-people") + "/";
const load = (dir: string, file: string) => import(/* @vite-ignore */ dir + file);

await load(engineDir, "clinician-criteria.test.ts");
const engineCount = collected.length;
await load(adapterDir, "refine-filters.test.ts");

describe("clinician engine (Deno suites)", () => {
  for (const t of collected.slice(0, engineCount)) it(t.name, async () => { await t.fn(); });
});

describe("search-people adapter (Deno suites)", () => {
  for (const t of collected.slice(engineCount)) it(t.name, async () => { await t.fn(); });
});

describe("live failure 2026-10-12: orthopedic surgeons in Miami, Florida", async () => {
  const { validateAIOutput, expandParsedKeywords } = await load(engineDir, "parse-query.ts");
  const { mapParsedToCriteria, reconcileParsedClinicianIntent } = await load(engineDir, "clinician-criteria.ts");
  const { buildClinicianQuery } = await load(engineDir, "build-clinician-query.ts");
  const { splitRoleClassNoise } = await load(engineDir, "noise-filter.ts");

  const query = "Find orthopedic surgeons in Miami, Florida.";
  const parsed = validateAIOutput({
    role_class: "surgeon",
    job_titles: [],
    specialty: "orthopedic surgery",
    specialties: ["orthopedic surgery"],
    specialty_tense: "current",
    location: { city: "miami", state: "florida", city_confidence: 0.95, state_confidence: 0.95 },
  }) as Record<string, unknown>;
  expandParsedKeywords(parsed, query);
  const criteria = mapParsedToCriteria(reconcileParsedClinicianIntent(parsed, query), []);
  const tree = buildClinicianQuery(criteria);
  const leaves: Array<{ field: string; value: unknown }> = [];
  const walk = (n: { conditions?: unknown[]; field?: string; value?: unknown }) =>
    n.conditions ? (n.conditions as typeof n[]).forEach(walk) : leaves.push(n as { field: string; value: unknown });
  walk(tree);
  const titleValues = new Set(
    leaves.filter((l) => l.field === "experience.employment_details.current.title").map((l) => String(l.value)),
  );

  it("the role gate is surgeon-shaped", () => {
    const role = criteria.find((c: { kind: string }) => c.kind === "role_class");
    expect(role.label).toBe("Orthopedic Surgeons");
    expect(titleValues.has("orthopedic surgeon")).toBe(true);
    expect(titleValues.has("orthopaedic surgeon")).toBe(true);
    expect(titleValues.has("orthopedist")).toBe(true);
    expect(titleValues.has("spine surgeon")).toBe(true);
  });

  it("never gates on bare doctor / physician / surgeon", () => {
    // "doctor" is gone entirely (it admitted Doctors of Physical Therapy).
    expect(titleValues.has("doctor")).toBe(false);
    // "physician" / "surgeon" survive ONLY inside the employer-qualified arm:
    // an AND with a specialty-named employer, never as a free-standing OR
    // member of the role gate.
    type Node = { op?: string; conditions?: Node[]; field?: string; value?: unknown };
    const top = tree as Node;
    const roleGroup = (top.conditions ?? []).find((n) =>
      n.op === "or" && (n.conditions ?? []).some((c) => c.field && String(c.value) === "orthopedic surgeon")
    );
    expect(roleGroup).toBeTruthy();
    const bare = new Set(["physician", "surgeon", "doctor", "md"]);
    const departments = new Set(["orthopedic surgery", "orthopaedic surgery", "orthopedics", "orthopaedics"]);
    for (const member of roleGroup!.conditions ?? []) {
      if (member.field) {
        // Free-standing members are person titles: never a bare physician
        // word, never a department name.
        expect(bare.has(String(member.value))).toBe(false);
        expect(departments.has(String(member.value))).toBe(false);
      } else {
        // The two qualified arms are ANDs: generic word + specialty employer,
        // or physician word + department name in the same title.
        expect(member.op).toBe("and");
        const fieldsInArm = new Set(
          (member.conditions ?? []).flatMap((c) => (c.conditions ?? []).map((l) => l.field)),
        );
        const employerArm = fieldsInArm.has("experience.employment_details.current.company_name");
        const departmentArm = !employerArm &&
          fieldsInArm.size === 1 && fieldsInArm.has("experience.employment_details.current.title");
        expect(employerArm || departmentArm).toBe(true);
      }
    }
  });

  it("keeps the Miami location clause intact", () => {
    expect(leaves.some((l) => l.field === "basic_profile.location.state" && l.value === "florida")).toBe(true);
    expect(leaves.some((l) => l.field === "basic_profile.location" && JSON.stringify(l.value).includes("miami, florida"))).toBe(true);
  });

  it("the noise filter removes the rows the grader had to reject", () => {
    // Titles and headlines from the 50 cached rows of run clin_mv5vk2al_xreozy.
    const rows = [
      { job_title: "Founder", headline: "Doctor of Physical Therapy | Dry Needling | Spinal Manipulation" },
      { job_title: "Physician Recruiter", headline: "Physician Recruiter - I provide clinicians more career opportunities" },
      { job_title: "Founder and Area Sales Representative", headline: "Partnering with Hand & Plastic Surgeons Across Southeast Florida" },
      { job_title: "Physical Therapist", headline: "Doctor of Physical Therapy" },
      { job_title: "Physician Assistant Certified", headline: "Urology" },
      { job_title: "Orthopedic Physician Assistant", headline: "Physician Assistant, Orthopedics" },
      { job_title: "Regional Sales Director, Southeast, Pharmacy Automation", headline: "Doctor of Business Administration" },
      { job_title: "Physician Consultant", headline: "Recruiter @ Weatherby Healthcare | Orthopedic Surgery, Recruiting" },
      { job_title: "Senior Sales Representative", headline: "Area Director | OR l Supply Chain l Orthobiologics" },
      // Real orthopedic surgeons from the same pool.
      { job_title: "Orthopaedic Traumatologist", headline: "Orthopaedic Trauma Surgeon" },
      { job_title: "Vice Chairman Department of Orthopaedic Surgery", headline: "Orthopaedic Surgeon (Hip and Knee Replacement) at HCA" },
      { job_title: "Medical Doctor", headline: "Medical Doctor at Orthopedic Care Partners" },
      { job_title: "Spine Surgeon, Director of the Spine Research Program", headline: "Spine Surgeon at the University of Miami" },
      { job_title: "Team Physician", headline: "Orthopedic Sports Medicine Surgeon" },
      { job_title: "Founder", headline: "Orthopedic Hand Surgeon, Reluctant Healthcare Entrepreneur" },
    ];
    const { clean, noise } = splitRoleClassNoise(rows, criteria);
    expect(noise.length).toBe(9);
    expect(clean.length).toBe(6);
    for (const n of noise) expect(String(n.audit_reason)).toMatch(/^Not a surgeon/);
  });
});
