import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  clinicalCohort,
  hasAddressCollision,
  institutionalEmailCandidate,
  learnInstitutionKnowledge,
  matchingEmailPatterns,
  nameVariants,
  normalizeDomain,
  normalizeEmail,
  normalizeOrganization,
  type InstitutionObservation,
} from "./institution-email.ts";

const NOW = new Date("2026-11-25T00:00:00Z");
const scope = { organization: "Example Medical Center", domain: "example.org", cohort: "physician" };
const observation = (n: number, name: string, email: string, extra: Partial<InstitutionObservation> = {}): InstitutionObservation => ({
  person_hash: `person-${n}`,
  address_hash: `address-${n}`,
  organization_name: "Example Medical Center",
  domain: "example.org",
  cohort: "physician",
  patterns: matchingEmailPatterns(name, email),
  observed_at: "2026-11-01T00:00:00Z",
  verified: true,
  identity_bound: true,
  current_affiliation: true,
  ...extra,
});
const supportedRows = () => [
  observation(1, "Ada Lovelace", "ada.lovelace@example.org"),
  observation(2, "Grace Hopper", "grace.hopper@example.org"),
  observation(3, "Katherine Johnson", "katherine.johnson@example.org"),
];

Deno.test("normalizes employer names and exact domains without merging affiliates", () => {
  assertEquals(normalizeOrganization(" Example  Medical & Research Center "), "example medical and research center");
  assertEquals(normalizeDomain("https://www.Example.org/path"), "example.org");
  assertEquals(normalizeDomain("not a domain"), null);
  assertEquals(normalizeEmail("ADA.LOVELACE@example.org"), "ada.lovelace@example.org");
  assertEquals(normalizeEmail("bad@@example.org"), null);
});

Deno.test("separates trainees, nurses, faculty and physicians", () => {
  assertEquals(clinicalCohort("PGY-5 Orthopedic Surgery Resident"), "graduate_medical_trainee");
  assertEquals(clinicalCohort("Nurse Manager"), "nursing");
  assertEquals(clinicalCohort("Assistant Professor of Medicine"), "faculty");
  assertEquals(clinicalCohort("Hospitalist"), "physician");
});

Deno.test("learns one convention from three independent current verified people", () => {
  const k = learnInstitutionKnowledge(supportedRows(), scope, NOW);
  assertEquals(k.state, "supported");
  assertEquals(k.pattern, "first.last");
  assertEquals(k.sampleCount, 3);
  assertEquals(institutionalEmailCandidate("Mark Sonderman", k), "mark.sonderman@example.org");
});

Deno.test("two colleague samples are not enough", () => {
  assertEquals(learnInstitutionKnowledge(supportedRows().slice(0, 2), scope, NOW).state, "insufficient_evidence");
});

Deno.test("aliases do not masquerade as independent people or addresses", () => {
  const rows = supportedRows();
  rows[1] = { ...rows[1], person_hash: rows[0].person_hash };
  rows[2] = { ...rows[2], address_hash: rows[0].address_hash };
  assertEquals(learnInstitutionKnowledge(rows, scope, NOW).state, "insufficient_evidence");
});

Deno.test("mixed, ambiguous and opaque conventions abstain", () => {
  const mixed = [...supportedRows(), observation(4, "Alan Turing", "aturing@example.org")];
  assertEquals(learnInstitutionKnowledge(mixed, scope, NOW).state, "mixed_or_opaque");
  const ambiguous = supportedRows().map((r) => ({ ...r, patterns: ["first.last", "firstlast"] }));
  assertEquals(learnInstitutionKnowledge(ambiguous, scope, NOW).state, "ambiguous");
  const opaque = supportedRows().map((r) => ({ ...r, patterns: [] }));
  assertEquals(learnInstitutionKnowledge(opaque, scope, NOW).state, "mixed_or_opaque");
});

Deno.test("wrong organization, role cohort and domain never teach the scope", () => {
  const rows = supportedRows();
  rows[0] = { ...rows[0], organization_name: "Another Hospital" };
  rows[1] = { ...rows[1], cohort: "nursing" };
  rows[2] = { ...rows[2], domain: "university.edu" };
  assertEquals(learnInstitutionKnowledge(rows, scope, NOW).state, "insufficient_evidence");
});

Deno.test("stale, future, unverified, unbound and former-affiliation evidence is excluded", () => {
  const invalid: Partial<InstitutionObservation>[] = [
    { observed_at: "2025-01-01T00:00:00Z" },
    { observed_at: "2027-01-01T00:00:00Z" },
    { verified: false },
    { identity_bound: false },
    { current_affiliation: false },
  ];
  for (const patch of invalid) {
    const rows = supportedRows();
    rows[0] = { ...rows[0], ...patch };
    assertEquals(learnInstitutionKnowledge(rows, scope, NOW).state, "insufficient_evidence");
    assertEquals(learnInstitutionKnowledge(rows, scope, NOW).sampleCount, 2);
  }
});

Deno.test("credentials and accents normalize while compound names retain ambiguity", () => {
  assertEquals(institutionalEmailCandidate("José García, MD", learnInstitutionKnowledge([
    observation(1, "Ana Garcia", "ana.garcia@example.org"),
    observation(2, "Luis Torres", "luis.torres@example.org"),
    observation(3, "Maria Lopez", "maria.lopez@example.org"),
  ], scope, NOW)), "jose.garcia@example.org");
  assertEquals(nameVariants("Mary-Kate Olsen").length > 1, true);
  const k = learnInstitutionKnowledge(supportedRows(), scope, NOW);
  assertEquals(institutionalEmailCandidate("Mary-Kate Olsen", k), null);
});

Deno.test("office mailboxes and malformed addresses cannot teach a pattern", () => {
  assertEquals(matchingEmailPatterns("Residency Office", "residency@example.org"), []);
  assertEquals(matchingEmailPatterns("Ada Lovelace", "not-an-email"), []);
});

Deno.test("an address already tied to another person is a collision", () => {
  assertEquals(hasAddressCollision("same", "target", [{ person_hash: "other", address_hash: "same" }]), true);
  assertEquals(hasAddressCollision("same", "target", [{ person_hash: "target", address_hash: "same" }]), false);
  assertEquals(hasAddressCollision("different", "target", [{ person_hash: "other", address_hash: "same" }]), false);
});

Deno.test("a supported pattern still produces only an unverified hypothesis", () => {
  const k = learnInstitutionKnowledge(supportedRows(), scope, NOW);
  const candidate = institutionalEmailCandidate("Mark Sonderman", k);
  assertEquals(candidate, "mark.sonderman@example.org");
  assertEquals("verification" in k, false);
});
