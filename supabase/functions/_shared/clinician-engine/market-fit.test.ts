import { assertEquals } from "jsr:@std/assert@1";
import { removeOutOfMarket } from "./market-fit.ts";

const names = (rows: Array<{ full_name: string }>) => rows.map((r) => r.full_name);

Deno.test("a New York search removes people whose current program is in another state", () => {
  const rows = [
    { full_name: "Eric Roth", job_company_name: "Children's Hospital Colorado" },
    { full_name: "Troy Amen", job_company_name: "Duke University" },
    { full_name: "Austin Kloc", job_company_name: "Geisinger" },
    { full_name: "Shuaibu Sha Ali", job_company_name: "Yale New Haven Health" },
    { full_name: "Allison Morgan", job_company_name: "NYU Langone Health" },
  ];
  assertEquals(names(removeOutOfMarket(rows, ["new york"]).kept), ["Allison Morgan"]);
});

Deno.test("the primary current employer decides, not an older residency still marked current", () => {
  const rows = [{
    full_name: "Troy Amen", job_company_name: "Hospital for Special Surgery",
    current_employers: [{ name: "Duke University", is_primary: true }, { name: "Hospital for Special Surgery", is_primary: false }],
  }];
  assertEquals(removeOutOfMarket(rows, ["new york"]).kept.length, 0);
});

Deno.test("someone who says they are seeking work in Southern California is removed from a New York search", () => {
  const rows = [{ full_name: "Bhavik Patel", job_company_name: "NYU Langone Health",
    summary: "I am now seeking employment as Hand specialist in the Southern California area, where my family still resides." }];
  assertEquals(removeOutOfMarket(rows, ["new york"]).kept.length, 0);
});

Deno.test("New York employers stay", () => {
  const rows = [
    { full_name: "A", job_company_name: "State University of New York Downstate" },
    { full_name: "B", job_company_name: "Mount Sinai Health System" },
  ];
  assertEquals(names(removeOutOfMarket(rows, ["new york"]).kept), ["A", "B"]);
});

Deno.test("a New York City search removes same-state employers outside the city", () => {
  const row = { current_employers: [{ name: "Stony Brook University", is_primary: true }] };
  assertEquals(removeOutOfMarket([row], ["new york"], "new york city").kept.length, 0);
  const nyc = { current_employers: [{ name: "NYU Langone Health", is_primary: true }] };
  assertEquals(removeOutOfMarket([nyc], ["new york"], "new york city").kept.length, 1);
});

Deno.test("a local teaching employer overrides a stale home city and blank state", () => {
  const rows = [
    { full_name: "Metro label", location_locality: null, location_region: null, current_employers: [{ name: "Hospital for Special Surgery", is_primary: true }] },
    { full_name: "Stale home", location_locality: "Stanford", location_region: "California", current_employers: [{ name: "Hospital for Special Surgery", is_primary: true }] },
    { full_name: "Commuter", location_locality: "Cherry Hill", location_region: "New Jersey", current_employers: [{ name: "Maimonides Medical Center", is_primary: true }] },
  ];
  assertEquals(removeOutOfMarket(rows, ["new york"], "new york city").kept.length, 3);
});

Deno.test("border metro employer states are accepted without weakening other-state rejection", () => {
  const rows = [
    { full_name: "Maryland campus", current_employers: [{ name: "Johns Hopkins", is_primary: true }] },
    { full_name: "California campus", current_employers: [{ name: "Stanford Medicine", is_primary: true }] },
  ];
  const split = removeOutOfMarket(rows, ["district of columbia", "maryland", "virginia"], "washington");
  assertEquals(names(split.kept), ["Maryland campus"]);
  assertEquals(names(split.removed), ["California campus"]);
});

Deno.test("employer headquarters reject a nearby-metro or out-of-state primary program", () => {
  const rows = [
    { full_name: "Miami program", current_employers: [{ name: "Larkin Health System", title: "Orthopaedic Surgery Resident", company_hq_location: "Miami, Florida, United States", is_primary: true }] },
    { full_name: "Newark program", current_employers: [{ name: "Newark Beth Israel Medical Center", title: "Resident Physician", company_hq_location: "Newark, New Jersey, United States", is_primary: true }] },
    { full_name: "NYC program", current_employers: [{ name: "Hospital for Special Surgery", title: "Orthopaedic Surgery Resident", company_hq_location: "New York, New York, United States", is_primary: true }] },
  ];
  assertEquals(names(removeOutOfMarket(rows, ["new york"], "new york city").kept), ["NYC program"]);
});

Deno.test("a local research appointment cannot rescue an out-of-market residency", () => {
  const row = {
    full_name: "Toronto resident",
    _workplace_anchors: ["hospital for special surgery", "weill cornell"],
    current_employers: [
      { name: "University of Toronto", title: "Resident Doctor, Division of Orthopaedic Surgery", is_primary: true },
      { name: "Hospital for Special Surgery", title: "Research Investigator", is_primary: false },
    ],
  };
  assertEquals(removeOutOfMarket([row], ["new york"], "new york city").kept.length, 0);
});

Deno.test("the actual local residency survives stale home and secondary research records", () => {
  const row = {
    full_name: "Local resident",
    location_locality: "Bristol",
    location_region: "Rhode Island",
    _workplace_anchors: ["columbia university irving", "newyork-presbyterian"],
    current_employers: [
      { name: "Columbia University Irving Medical Center", title: "Orthopedic Surgery Resident", company_hq_location: "New York, New York, United States", is_primary: true },
      { name: "Independent Research Institute", title: "Research Investigator", is_primary: false },
    ],
  };
  assertEquals(removeOutOfMarket([row], ["new york"], "new york city").kept.length, 1);
});

Deno.test("an NYU Long Island residency is outside an NYC-only resident search", () => {
  const row = { current_employers: [{ name: "NYU Grossman Long Island School of Medicine", title: "Orthopaedic Surgery Resident", is_primary: true }] };
  assertEquals(removeOutOfMarket([row], ["new york"], "new york city").kept.length, 0);
});
