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
