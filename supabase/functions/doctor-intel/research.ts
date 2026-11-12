export type TrialPerson = {
  first: string;
  last: string;
  state?: string | null;
};

type Row = Record<string, unknown>;

const NAME_SUFFIXES = new Set([
  "dr", "md", "do", "phd", "mph", "ms", "msc", "mba", "dpt", "rn",
  "facs", "faaos", "faan", "facep", "facp", "professor", "prof",
]);

function nameTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && !NAME_SUFFIXES.has(token));
}

/** Exact first + last match, allowing a middle name/initial, reversed registry
 * order, and credentials. A shared surname alone is never enough. */
export function personNameMatches(first: string, last: string, candidate: string): boolean {
  const firstTokens = nameTokens(first);
  const lastTokens = nameTokens(last);
  const tokens = nameTokens(candidate);
  const f = firstTokens[0];
  const l = lastTokens[lastTokens.length - 1];
  if (!f || !l || tokens.length < 2) return false;
  return (
    (tokens[0] === f && tokens[tokens.length - 1] === l) ||
    (tokens[0] === f && tokens[1] === l) ||
    (tokens[0] === l && tokens[1] === f)
  );
}

export function clinicalTrialsNameQuery(first: string, last: string): string {
  const name = `${first} ${last}`.replace(/"/g, "").trim();
  return `(AREA[OverallOfficialName]"${name}" OR AREA[LocationContactName]"${name}")`;
}

export function trialRoleLabel(role: unknown): string | null {
  if (typeof role !== "string" || !role) return null;
  const labels: Record<string, string> = {
    PRINCIPAL_INVESTIGATOR: "Principal investigator",
    SUB_INVESTIGATOR: "Sub-investigator",
    STUDY_CHAIR: "Study chair",
    STUDY_DIRECTOR: "Study director",
    CONTACT: "Study contact",
  };
  return labels[role] ?? role.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function list(value: unknown): Row[] {
  return Array.isArray(value) ? value as Row[] : [];
}

/** Include overall officials AND site contacts/investigators. Registry names
 * are matched exactly; when a state is known, a trial must involve that state
 * unless the registry provides no locations. */
export function extractClinicalTrials(payload: Row, person: TrialPerson, stateName?: string | null) {
  const wantedState = stateName?.toLowerCase() || null;
  const studies = list(payload.studies).flatMap((study) => {
    const ps = (study.protocolSection ?? {}) as Row;
    const contactsModule = (ps.contactsLocationsModule ?? {}) as Row;
    const locations = list(contactsModule.locations);
    const officials = list(contactsModule.overallOfficials).map((o) => ({
      name: String(o.name ?? ""), role: o.role, state: null as string | null,
    }));
    const sitePeople = locations.flatMap((location) =>
      list(location.contacts).map((contact) => ({
        name: String(contact.name ?? ""), role: contact.role,
        state: typeof location.state === "string" ? location.state : null,
      }))
    );
    const matchingOfficials = officials.filter((o) => personNameMatches(person.first, person.last, o.name));
    const matchingSitePeople = sitePeople.filter((o) => personNameMatches(person.first, person.last, o.name));
    const states = locations
      .map((l) => typeof l.state === "string" ? l.state.toLowerCase() : "")
      .filter(Boolean);
    const officialMatch = matchingOfficials.length > 0 &&
      (!wantedState || states.length === 0 || states.includes(wantedState));
    const siteMatch = matchingSitePeople.some((o) =>
      !wantedState || !o.state || o.state.toLowerCase() === wantedState
    );
    if (!officialMatch && !siteMatch) return [];

    const accepted = [
      ...(officialMatch ? matchingOfficials : []),
      ...(siteMatch ? matchingSitePeople.filter((o) => !wantedState || !o.state || o.state.toLowerCase() === wantedState) : []),
    ];
    const roles = [...new Set(accepted.map((o) => trialRoleLabel(o.role)).filter((r): r is string => !!r))];
    const matchedLocations = [...new Set(accepted.map((o) => o.state).filter((s): s is string => !!s))];
    const identification = (ps.identificationModule ?? {}) as Row;
    const status = (ps.statusModule ?? {}) as Row;
    const design = (ps.designModule ?? {}) as Row;
    const sponsors = (ps.sponsorCollaboratorsModule ?? {}) as Row;
    const nctId = String(identification.nctId ?? "");
    if (!nctId) return [];
    return [{
      nctId,
      title: identification.briefTitle ?? null,
      status: status.overallStatus ?? null,
      phase: list(design.phases).join(", ") || null,
      sponsor: ((sponsors.leadSponsor ?? {}) as Row).name ?? null,
      start: ((status.startDateStruct ?? {}) as Row).date ?? null,
      url: `https://clinicaltrials.gov/study/${nctId}`,
      role: roles.join(", ") || null,
      location: matchedLocations.join(", ") || null,
    }];
  });
  return { count: studies.length, studies: studies.slice(0, 10) };
}

/** A transient failure in any requested source must not become a year-long
 * cached answer. Empty successful results are cacheable; null failures are not. */
export function doctorIntelCacheComplete(data: Row | null | undefined): boolean {
  if (!data || data.npi == null || data.publications == null || data.trials == null) return false;
  const npi = (data.npi ?? {}) as Row;
  return !npi.npi || data.payments != null;
}
