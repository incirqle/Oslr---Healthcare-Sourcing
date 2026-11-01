/**
 * Turns the raw region map ("West Palm Beach, FL": 4, "New Jersey, United
 * States": 468, "India": 3476) into the shapes the locations panel charts:
 * US states, US cities, other countries, and office campuses grouped by city.
 * Pure: tested in regions.test.ts.
 */

export interface RegionSplit {
  /** US states, largest first: { place: "New York", count } */
  states: { place: string; count: number }[];
  /** US cities ("New York, NY"), largest first. */
  cities: { place: string; count: number }[];
  /** Non-US countries, largest first. */
  countries: { place: string; count: number }[];
  /** Metro areas ("New York City Metropolitan Area"), largest first. */
  metros: { place: string; count: number }[];
}

const US_STATE_NAMES = new Set([
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
  "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
]);

const METRO = /\b(metro|metroplex|area)\b/i;

export function splitRegions(byRegion: Record<string, number> | null | undefined): RegionSplit {
  const out: RegionSplit = { states: [], cities: [], countries: [], metros: [] };
  if (!byRegion || typeof byRegion !== "object") return out;
  const stateRollup = new Map<string, number>();
  for (const [rawKey, v] of Object.entries(byRegion)) {
    if (typeof v !== "number" || v <= 0) continue;
    const k = rawKey.trim();
    if (!k || k === "United States") continue;
    const stateMatch = /^(.+),\s*United States$/.exec(k);
    if (stateMatch && US_STATE_NAMES.has(stateMatch[1])) {
      stateRollup.set(stateMatch[1], (stateRollup.get(stateMatch[1]) ?? 0) + v);
      continue;
    }
    if (/^[^,]+,\s*[A-Z]{2}$/.test(k)) {
      out.cities.push({ place: k, count: v });
      const st = k.slice(-2);
      stateRollup.set(st, stateRollup.get(st) ?? 0); // ensure the state appears even without a state-level key
      continue;
    }
    if (METRO.test(k)) {
      out.metros.push({ place: k, count: v });
      continue;
    }
    if (!k.includes(",")) out.countries.push({ place: k, count: v });
  }
  // States without a state-level key get the sum of their cities.
  const citySum = new Map<string, number>();
  for (const c of out.cities) {
    const st = c.place.slice(-2);
    citySum.set(st, (citySum.get(st) ?? 0) + c.count);
  }
  const STATE_ABBR: Record<string, string> = { NY: "New York", NJ: "New Jersey", CT: "Connecticut", FL: "Florida", CA: "California", TX: "Texas", MA: "Massachusetts" };
  for (const [abbr, sum] of citySum) {
    const full = STATE_ABBR[abbr];
    if (full && !stateRollup.has(full)) stateRollup.set(full, sum);
    else if (!full && !stateRollup.has(abbr)) stateRollup.set(abbr, sum);
  }
  const byCount = (a: { count: number }, b: { count: number }) => b.count - a.count;
  out.states = [...stateRollup.entries()].map(([place, count]) => ({ place, count })).sort(byCount);
  out.cities.sort(byCount);
  out.countries.sort(byCount);
  out.metros.sort(byCount);
  return out;
}

/** "140 East Ridgewood Avenue, Paramus, NJ, 07652, US" → "Paramus, NJ". */
export function campusOf(address: string): string | null {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  // …, City, State, ZIP, Country
  const state = parts[parts.length - 3];
  const city = parts[parts.length - 4];
  if (!city || !state) return null;
  return `${city}, ${state}`;
}

/** Office street addresses grouped into campuses: { place: "New York, NY", count: 3 }. */
export function campusesFromOffices(offices: string[] | null | undefined): { place: string; count: number }[] {
  if (!offices?.length) return [];
  const m = new Map<string, number>();
  for (const a of offices) {
    const c = campusOf(a);
    if (c) m.set(c, (m.get(c) ?? 0) + 1);
  }
  return [...m.entries()].map(([place, count]) => ({ place, count })).sort((a, b) => b.count - a.count);
}

/** Weekly headcount points → monthly net change, oldest first, last `months` months. */
export function monthlyNetChange(series: { date: string; employee_count: number }[], months = 24): { month: string; delta: number; total: number }[] {
  const pts = series
    .filter((p) => typeof p?.date === "string" && Number.isFinite(p?.employee_count))
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastOfMonth = new Map<string, number>();
  for (const p of pts) lastOfMonth.set(p.date.slice(0, 7), p.employee_count);
  const keys = [...lastOfMonth.keys()].sort();
  const rows = keys.slice(1).map((k, i) => ({ month: k, delta: (lastOfMonth.get(k) ?? 0) - (lastOfMonth.get(keys[i]) ?? 0), total: lastOfMonth.get(k) ?? 0 }));
  return rows.slice(-months);
}
