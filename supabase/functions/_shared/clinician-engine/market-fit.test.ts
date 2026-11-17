import { assertEquals } from "jsr:@std/assert@1";
import { rankOutOfMarketLast } from "./market-fit.ts";

Deno.test("a New York search ranks a Colorado program last, keeps it in the list", () => {
  const rows = [
    { full_name: "Eric Roth", job_company_name: "Children's Hospital Colorado" },
    { full_name: "Allison Morgan", job_company_name: "NYU Langone Health" },
  ];
  const out = rankOutOfMarketLast(rows, ["new york"]);
  assertEquals(out.map((r) => r.full_name), ["Allison Morgan", "Eric Roth"]);
});

Deno.test("an employer naming the searched state is not out of market", () => {
  const rows = [
    { full_name: "A", job_company_name: "State University of New York" },
    { full_name: "B", job_company_name: "Mount Sinai" },
  ];
  assertEquals(rankOutOfMarketLast(rows, ["new york"]).map((r) => r.full_name), ["A", "B"]);
});
