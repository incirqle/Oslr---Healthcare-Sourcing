/**
 * Out-of-market rows are removed. Profiles often keep "New York" as their
 * personal city after moving to a program elsewhere; the current primary
 * employer (named state, or a known out-of-state institution) and a stated
 * relocation goal decide the market, and a mismatch drops the row entirely.
 */
const STATES = [
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut",
  "delaware", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
  "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan",
  "minnesota", "mississippi", "missouri", "montana", "nebraska", "nevada",
  "new hampshire", "new jersey", "new mexico", "new york", "north carolina", "north dakota",
  "ohio", "oklahoma", "oregon", "pennsylvania", "rhode island", "south carolina",
  "south dakota", "tennessee", "texas", "utah", "vermont", "virginia", "washington",
  "west virginia", "wisconsin", "wyoming",
].sort((a, b) => b.length - a.length);

/** Institutions whose names don't carry their state. */
const INSTITUTIONS: Array<[RegExp, string]> = [
  [/\bduke\b/, "north carolina"], [/\bgeisinger\b/, "pennsylvania"], [/\byale\b/, "connecticut"],
  [/\bharvard\b|mass general|brigham|beth israel deaconess|boston children/, "massachusetts"],
  [/\bjohns hopkins\b/, "maryland"], [/\bmayo clinic\b/, "minnesota"], [/\bcleveland clinic\b/, "ohio"],
  [/\bstanford\b|\bucla\b|\bucsf\b|cedars.sinai|kerlan|\bscoi\b/, "california"],
  [/\bemory\b/, "georgia"], [/\bvanderbilt\b/, "tennessee"], [/\brush\b/, "illinois"],
  [/\bnorthwestern\b/, "illinois"], [/\bpenn medicine\b|\bupenn\b|rothman|jefferson/, "pennsylvania"],
  [/\bupmc\b/, "pennsylvania"], [/\bbaylor\b|ut southwestern|houston methodist|\bmd anderson\b/, "texas"],
  [/andrews (institute|sports)/, "florida"], [/\bsteadman\b/, "colorado"],
  [/\bhackensack\b|rutgers/, "new jersey"], [/\bbrown university\b|lifespan/, "rhode island"],
  [/\bdartmouth\b/, "new hampshire"], [/\bwashington university\b|\bwustl\b/, "missouri"],
];

const REGIONS: Array<[RegExp, string]> = [
  [/southern california|northern california|bay area|los angeles|san diego|orange county/, "california"],
  [/new england|boston/, "massachusetts"], [/pacific northwest|seattle/, "washington"],
  [/chicago/, "illinois"], [/texas|dallas|houston|austin/, "texas"], [/florida|miami/, "florida"],
];

type Row = Record<string, unknown>;

function stateIn(text: string): string | null {
  const t = text.toLowerCase();
  if (!t) return null;
  for (const [re, s] of INSTITUTIONS) if (re.test(t)) return s;
  for (const s of STATES) if (new RegExp(`\\b${s}\\b`).test(t)) return s;
  return null;
}

function primaryEmployer(row: Row): string {
  const list = Array.isArray(row.current_employers) ? row.current_employers as Row[] : [];
  const primary = list.find((e) => e?.is_primary) ?? list[0];
  return String(primary?.name ?? row.job_company_name ?? "");
}

/** A stated move: "seeking employment ... in the Southern California area". */
export function statedRelocationState(row: Row): string | null {
  const text = `${row.summary ?? ""} ${row.headline ?? ""}`.toLowerCase();
  const m = text.match(/(seeking|looking for|relocat\w*|moving)[^.]{0,120}/);
  if (!m) return null;
  for (const [re, s] of REGIONS) if (re.test(m[0])) return s;
  return stateIn(m[0]);
}

export function outOfMarketReason(row: Row, searchStates: string[]): string | null {
  if (searchStates.length === 0) return null;
  const employerState = stateIn(primaryEmployer(row));
  if (employerState && !searchStates.includes(employerState)) return `current employer in ${employerState}`;
  const moving = statedRelocationState(row);
  if (moving && !searchStates.includes(moving)) return `seeking work in ${moving}`;
  return null;
}

/** Keeps in-market rows in order; out-of-market rows are removed. */
export function removeOutOfMarket<T extends Row>(rows: T[], searchStates: string[]): { kept: T[]; removed: T[] } {
  const states = searchStates.map((s) => s.toLowerCase().trim()).filter(Boolean);
  if (states.length === 0) return { kept: rows, removed: [] };
  const kept: T[] = [];
  const removed: T[] = [];
  for (const r of rows) (outOfMarketReason(r, states) ? removed : kept).push(r);
  return { kept, removed };
}
