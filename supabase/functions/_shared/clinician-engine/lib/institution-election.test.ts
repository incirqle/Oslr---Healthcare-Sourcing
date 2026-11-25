import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { domainRelatesToOrganization, electInstitutionEmail, isInstitutionCandidateDomain, type CoworkerEmail } from "./institution-election.ts";

const org = "Maimonides Medical Center";
let n = 0;
const s = (name: string, email: string, cohort = "physician", extra: Partial<CoworkerEmail> = {}): CoworkerEmail =>
  ({ personKey: `https://www.linkedin.com/in/p${n++}`, name, email, cohort, providerVerified: false, primaryEmployer: true, ...extra });
const input = { organization: org, targetCohort: "graduate_medical_trainee" };

Deno.test("link pages, directories and mailbox providers are never an institution domain", () => {
  for (const d of ["linktr.ee", "doximity.com", "gmail.com", "mapy.com", "sites.google.com"]) assertEquals(isInstitutionCandidateDomain(d), null);
  assertEquals(isInstitutionCandidateDomain("maimonidesmed.org"), "maimonidesmed.org");
});

Deno.test("an institution domain must carry the employer's distinctive name or be its listed domain", () => {
  assertEquals(domainRelatesToOrganization("maimonidesmed.org", org), true);
  assertEquals(domainRelatesToOrganization("downstate.edu", org), false);
  assertEquals(domainRelatesToOrganization("hss.edu", "Hospital for Special Surgery"), true);
});

Deno.test("Maimonides: four unverified name-matching coworkers elect maimonidesmed.org and first-initial-last-name", () => {
  const r = electInstitutionEmail([
    s("Joel Schwartz", "jschwartz@maimonidesmed.org"), s("Ira Futterman", "ifutterman@maimonidesmed.org"),
    s("Jacob Khurgin", "jkhurgin@maimonidesmed.org"), s("Norman Saffra", "nsaffra@maimonidesmed.org"),
    s("Michael Mager", "michael@precisionneuro.io", "physician", { providerVerified: true }),
    s("Roee Ber", "roee.ber@nyulangone.org", "physician", { providerVerified: true }),
    s("Robert Ackerman", "robert@linktr.ee", "other_clinical_staff", { providerVerified: true }),
  ], input);
  assertEquals(r.domain, "maimonidesmed.org");
  assertEquals(r.pattern, "flast");
  assertEquals(r.supporters.length, 4);
});

Deno.test("two coworkers are not enough to elect a rule", () => {
  const r = electInstitutionEmail([s("Joel Schwartz", "jschwartz@maimonidesmed.org"), s("Ira Futterman", "ifutterman@maimonidesmed.org")], input);
  assertEquals(r.pattern, null);
  assertEquals(r.reason, "fewer_than_three_institution_examples");
});

Deno.test("old addresses from a previous school never become the employer's domain", () => {
  const r = electInstitutionEmail([
    s("Ann Lee", "ann.lee@downstate.edu"), s("Bo Kim", "bo.kim@downstate.edu"), s("Cy Park", "cy.park@downstate.edu"),
  ], input);
  assertEquals(r.domain, null);
});

Deno.test("a large sample tolerates a couple of legacy addresses (NYU Langone: 31 first.last, 2 flast)", () => {
  const rows = Array.from({ length: 31 }, (_, i) => s(`Person${"abcdefghijklmnopqrstuvwxyzabcde"[i]}x Last${i}x`.replace(/\d/g, (d) => "abcdefghij"[+d]), ""));
  const named = rows.map((r) => { const [f, l] = r.name.toLowerCase().split(" "); return { ...r, email: `${f}.${l}@nyulangone.org` }; });
  const out = electInstitutionEmail([...named, s("Matt Peddie", "mpeddie@nyulangone.org"), s("Jason Johnson", "jjohnson@nyulangone.org")], { organization: "NYU Langone Health", targetCohort: "physician" });
  assertEquals(out.pattern, "first.last");
});

Deno.test("a small sample with any disagreement abstains", () => {
  const r = electInstitutionEmail([
    s("Joel Schwartz", "jschwartz@maimonidesmed.org"), s("Ira Futterman", "ifutterman@maimonidesmed.org"),
    s("Jacob Khurgin", "jkhurgin@maimonidesmed.org"), s("Gabriel Sandu", "gsandu@maimonidesmed.org"),
    s("Norman Saffra", "norman.saffra@maimonidesmed.org"),
  ], input);
  assertEquals(r.pattern, null);
  assertEquals(r.reason, "split_naming_convention");
});

Deno.test("two equally supported institution domains abstain", () => {
  const r = electInstitutionEmail([
    s("Ann Lee", "alee@stanford.edu"), s("Bo Kim", "bkim@stanford.edu"), s("Cy Park", "cpark@stanford.edu"),
    s("Di Wu", "dwu@stanfordhealthcare.org"), s("Ed Fox", "efox@stanfordhealthcare.org"), s("Fa Oh", "foh@stanfordhealthcare.org"),
  ], { organization: "Stanford Health Care", targetCohort: "nursing" });
  assertEquals(r.reason, "multiple_institution_mail_domains");
});

Deno.test("trainees visibly using a different institution domain abstain", () => {
  const r = electInstitutionEmail([
    s("Ann Lee", "alee@maimonidesmed.org"), s("Bo Kim", "bkim@maimonidesmed.org"), s("Cy Park", "cpark@maimonidesmed.org"),
    s("Di Wu", "di.wu@maimonidesgme.org", "graduate_medical_trainee"), s("Ed Fox", "ed.fox@maimonidesgme.org", "graduate_medical_trainee"),
  ], input);
  assertEquals(r.pattern, null);
});

Deno.test("the same person or address counts once", () => {
  const a = s("Joel Schwartz", "jschwartz@maimonidesmed.org");
  const r = electInstitutionEmail([a, { ...a }, { ...a, personKey: "other" }], input);
  assertEquals(r.pattern, null);
});
