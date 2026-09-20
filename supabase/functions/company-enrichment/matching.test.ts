import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { distinctiveTokens, pickBestCandidate, selectRelatedEntityIds } from "./matching.ts";

// Shape of /screener/identify rows, trimmed to what matching reads.
const co = (company_id: number, company_name: string, linkedin_headcount = 0, company_website_domain = "") =>
  ({ company_id, company_name, linkedin_headcount, company_website_domain });

Deno.test("distinctive tokens ignore generic company words", () => {
  assertEquals(distinctiveTokens("Auzenne Pain"), ["auzenne"]);
  assertEquals(distinctiveTokens("Southern Vascular & Pain Management"), ["vascular"]);
  assertEquals(distinctiveTokens("Jackson Neurosurgery Clinic"), ["jackson", "neurosurgery"]);
  assertEquals(distinctiveTokens("Pain Management Group"), []);
});

Deno.test("primary: the small practice beats a large company that only shares 'pain'", () => {
  const list = [
    co(1, "National Pain Care", 12_000),
    co(2, "Pain Treatment Centers of America", 4_000),
    co(3, "Auzenne Pain Management", 8),
  ];
  assertEquals(pickBestCandidate(list, "Auzenne Pain", null)?.company_id, 3);
});

Deno.test("primary: exact name and domain still outrank everything", () => {
  const list = [
    co(1, "Auzenne Pain Management", 8),
    co(2, "Auzenne Pain", 3, "auzennepain.com"),
  ];
  assertEquals(pickBestCandidate(list, "Auzenne Pain", null)?.company_id, 2);
  assertEquals(pickBestCandidate(list, "Auzenne Pain", "auzennepain.com")?.company_id, 2);
  assertEquals(pickBestCandidate(list, "Auzenne Pain", "www.auzennepain.com")?.company_id, 2);
});

Deno.test("primary: no name or domain evidence at all → null, not the biggest company", () => {
  const list = [co(1, "National Pain Care", 12_000), co(2, "Pain Treatment Centers", 4_000)];
  assertEquals(pickBestCandidate(list, "Auzenne Pain", null), null);
});

Deno.test("entity set: one generic word no longer fans out to 25 unrelated companies", () => {
  const list = [
    co(3, "Auzenne Pain Management"),
    ...Array.from({ length: 24 }, (_, i) => co(100 + i, `Pain Clinic ${i}`)),
    co(4, "Auzenne Pain & Spine"),
  ];
  const ids = selectRelatedEntityIds(list, 3, "Auzenne Pain");
  assertEquals(ids, [3, 4]);
});

Deno.test("entity set: a fully generic name requires every token, and the cap holds", () => {
  const list = [
    co(1, "Pain Management Group"),
    co(2, "Pain Management Group of Texas"),
    co(3, "Pain Clinic"),
    ...Array.from({ length: 30 }, (_, i) => co(200 + i, `Pain Management Group ${i}`)),
  ];
  const ids = selectRelatedEntityIds(list, 1, "Pain Management Group");
  assert(!ids.includes(3));
  assert(ids.includes(2));
  assertEquals(ids.length, 10);
});

Deno.test("entity set: health-system fragmentation still folds together on the distinctive token", () => {
  const list = [
    co(1, "UCHealth"),
    co(2, "UCHealth Memorial Hospital"),
    co(3, "UCHealth Poudre Valley Hospital"),
    co(4, "University Hospital"),
  ];
  assertEquals(selectRelatedEntityIds(list, 1, "UCHealth"), [1, 2, 3]);
});
