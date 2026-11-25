import { describe, expect, it } from "vitest";
import { buildNarrowedQuery } from "@/lib/broad-search";

describe("buildNarrowedQuery", () => {
  it("replaces United States scope with the user's city", () => {
    expect(buildNarrowedQuery("Every physician in the United States", "Dallas"))
      .toBe("Every physician, Dallas");
  });

  it("removes across-the-US wording before adding a specialty", () => {
    expect(buildNarrowedQuery("All doctors across the US", "pediatric surgery"))
      .toBe("All doctors, pediatric surgery");
  });

  it("removes nationwide wording before adding a hospital", () => {
    expect(buildNarrowedQuery("Every nurse nationwide", "Mayo Clinic"))
      .toBe("Every nurse, Mayo Clinic");
  });

  it("trims empty surrounding punctuation without changing the user's refinement", () => {
    expect(buildNarrowedQuery("Every physician in the United States.", "  cardiology  "))
      .toBe("Every physician, cardiology");
  });
});
