/**
 * Out-of-market employers rank last. A profile can say "New York" while the
 * person's current program is in Colorado; when the current employer's name
 * names a different state, push that row below everyone else. Never removes.
 */
const STATES: Record<string, string> = {
  alabama: "alabama", alaska: "alaska", arizona: "arizona", arkansas: "arkansas",
  california: "california", colorado: "colorado", connecticut: "connecticut",
  delaware: "delaware", florida: "florida", georgia: "georgia", hawaii: "hawaii",
  idaho: "idaho", illinois: "illinois", indiana: "indiana", iowa: "iowa",
  kansas: "kansas", kentucky: "kentucky", louisiana: "louisiana", maine: "maine",
  maryland: "maryland", massachusetts: "massachusetts", michigan: "michigan",
  minnesota: "minnesota", mississippi: "mississippi", missouri: "missouri",
  montana: "montana", nebraska: "nebraska", nevada: "nevada",
  "new hampshire": "new hampshire", "new jersey": "new jersey", "new mexico": "new mexico",
  "north carolina": "north carolina", "north dakota": "north dakota", ohio: "ohio",
  oklahoma: "oklahoma", oregon: "oregon", pennsylvania: "pennsylvania",
  "rhode island": "rhode island", "south carolina": "south carolina",
  "south dakota": "south dakota", tennessee: "tennessee", texas: "texas", utah: "utah",
  vermont: "vermont", virginia: "virginia", washington: "washington",
  "west virginia": "west virginia", wisconsin: "wisconsin", wyoming: "wyoming",
};

type Row = Record<string, unknown>;

export function employerNamedState(row: Row): string | null {
  const name = String(row.job_company_name ?? "").toLowerCase();
  if (!name) return null;
  // Longest names first so "west virginia" wins over "virginia".
  for (const s of Object.keys(STATES).sort((a, b) => b.length - a.length)) {
    if (new RegExp(`\\b${s}\\b`).test(name)) return s;
  }
  return null;
}

export function isOutOfMarket(row: Row, searchStates: string[]): boolean {
  if (searchStates.length === 0) return false;
  const named = employerNamedState(row);
  if (!named) return false;
  // "New York" inside "West Virginia"? no; but "Washington" also matches
  // "Washington Heights" style names only via the word, accept that risk
  // only when the searched states don't include it.
  return !searchStates.includes(named);
}

/** Stable: in-market rows keep their order, out-of-market rows go last. */
export function rankOutOfMarketLast<T extends Row>(rows: T[], searchStates: string[]): T[] {
  const states = searchStates.map((s) => s.toLowerCase().trim()).filter(Boolean);
  if (states.length === 0) return rows;
  const inside: T[] = [];
  const outside: T[] = [];
  for (const r of rows) {
    if (isOutOfMarket(r, states)) {
      (r as Row).out_of_market = true;
      outside.push(r);
    } else inside.push(r);
  }
  return [...inside, ...outside];
}
