import { describe, expect, it } from "vitest";
import { campusesFromOffices, campusOf, monthlyNetChange, splitRegions } from "./regions";

const HSS = {
  "Bronx, NY": 293,
  "Brooklyn, NY": 463,
  "Egypt": 517,
  "Greater Delhi Area": 396,
  "India": 3476,
  "New Jersey, United States": 468,
  "New York City Metropolitan Area": 4667,
  "New York, NY": 2649,
  "New York, United States": 4097,
  "United States": 6816,
  "West Palm Beach, FL": 4,
  "Jupiter, FL": 3,
  "Florida, United States": 10,
};

describe("splitRegions", () => {
  const r = splitRegions(HSS);

  it("rolls US states up from state-level keys", () => {
    expect(r.states).toContainEqual({ place: "New York", count: 4097 });
    expect(r.states).toContainEqual({ place: "New Jersey", count: 468 });
    expect(r.states).toContainEqual({ place: "Florida", count: 10 });
  });

  it("keeps US cities, including Florida campuses", () => {
    expect(r.cities).toContainEqual({ place: "West Palm Beach, FL", count: 4 });
    expect(r.cities).toContainEqual({ place: "New York, NY", count: 2649 });
  });

  it("separates metros and countries", () => {
    expect(r.metros.map((m) => m.place)).toContain("New York City Metropolitan Area");
    expect(r.countries.map((c) => c.place)).toContain("India");
    expect(r.countries.map((c) => c.place)).not.toContain("United States");
  });

  it("handles empty input", () => {
    expect(splitRegions(null).states).toEqual([]);
    expect(splitRegions(undefined).cities).toEqual([]);
  });
});

describe("campusOf", () => {
  it("pulls city and state from a street address", () => {
    expect(campusOf("140 East Ridgewood Avenue, Paramus, NJ, 07652, US")).toBe("Paramus, NJ");
    expect(campusOf("475 E 72nd St, New York, NY, 10021, US")).toBe("New York, NY");
  });
  it("rejects junk", () => {
    expect(campusOf("unknown")).toBeNull();
  });
});

describe("campusesFromOffices", () => {
  it("groups offices by city", () => {
    const c = campusesFromOffices([
      "475 E 72nd St, New York, NY, 10021, US",
      "635 Madison Ave, New York, NY, 10022, US",
      "1 Blachley Rd, Stamford, CT, 06902, US",
    ]);
    expect(c).toEqual([
      { place: "New York, NY", count: 2 },
      { place: "Stamford, CT", count: 1 },
    ]);
  });
});

describe("monthlyNetChange", () => {
  it("takes the last weekly point of each month and diffs it", () => {
    const rows = monthlyNetChange([
      { date: "2026-01-05", employee_count: 100 },
      { date: "2026-01-26", employee_count: 110 },
      { date: "2026-02-02", employee_count: 105 },
      { date: "2026-02-23", employee_count: 120 },
    ]);
    expect(rows).toEqual([{ month: "2026-02", delta: 10, total: 120 }]);
  });
});
