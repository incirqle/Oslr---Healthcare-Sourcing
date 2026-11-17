import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { rejectCurrentNonManagers, titleKeepsEveryWord } from "./title-vocabulary.ts";
Deno.test("nurse manager never widens to bedside nurse", () => {
  assertFalse(titleKeepsEveryWord("emergency room nurse manager", "emergency room nurse"));
  assert(titleKeepsEveryWord("emergency room nurse manager", "emergency room nurse manager - nights"));
});

Deno.test("stated nurse-manager searches reject current bedside roles but preserve real managers and unknown titles", () => {
  const criteria = [{ kind: "title", enforcement: "hard", value: { terms: ["emergency room nurse manager"] } }] as never;
  const rows = [
    { full_name: "Current bedside", current_employers: [{ title: "Registered Nurse", current: true }] },
    { full_name: "Headline only", job_title: "Staff RN", headline: "Emergency Nurse Manager", current_employers: [] },
    { full_name: "Current manager", current_employers: [{ title: "Clinical Nurse Manager - ED", current: true }] },
    { full_name: "Current director", current_employers: [{ title: "Emergency Department Director", current: true }] },
    { full_name: "Unknown title", current_employers: [{ company: "Hospital", current: true }] },
    { full_name: "Wrong unit", current_employers: [{ title: "Nursing Manager", current: true }], audit_verdict: "weak", audit_reason: "Current manager at an endoscopy center, not an emergency department." },
  ];
  assertEquals(rejectCurrentNonManagers(rows, criteria), 3);
  assertEquals(rows.map((r) => r.audit_verdict ?? null), ["reject", "reject", null, null, null, "reject"]);
});
