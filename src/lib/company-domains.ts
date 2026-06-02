/**
 * Curated map of common healthcare system / employer names → canonical web
 * domain. Used so logos and enrichment lookups don't fall back to a guess
 * like "uchealth.com" when the real domain is "uchealth.org".
 *
 * Keys are aggressively normalized (lowercased, alphanumerics only).
 */

const RAW_HEALTH_DOMAINS: Record<string, string> = {
  // UCHealth (Colorado)
  uchealth: "uchealth.org",
  uchealthcolorado: "uchealth.org",
  universityofcoloradohealth: "uchealth.org",
  universityofcoloradohospital: "uchealth.org",
  uchealthuniversityofcoloradohospital: "uchealth.org",

  // Other big US systems
  mayoclinic: "mayoclinic.org",
  clevelandclinic: "clevelandclinic.org",
  johnshopkins: "hopkinsmedicine.org",
  johnshopkinsmedicine: "hopkinsmedicine.org",
  johnshopkinshospital: "hopkinsmedicine.org",
  johnshopkinsuniversity: "jhu.edu",
  kaiserpermanente: "kp.org",
  nyulangone: "nyulangone.org",
  nyulangonehealth: "nyulangone.org",
  massgeneralbrigham: "massgeneralbrigham.org",
  massachusettsgeneralhospital: "massgeneral.org",
  brighamandwomenshospital: "brighamandwomens.org",
  ucsfhealth: "ucsfhealth.org",
  ucsf: "ucsf.edu",
  stanfordhealthcare: "stanfordhealthcare.org",
  stanfordhealth: "stanfordhealthcare.org",
  stanford: "stanford.edu",
  ucla: "uclahealth.org",
  uclahealth: "uclahealth.org",
  uclamedicalcenter: "uclahealth.org",
  cedarssinai: "cedars-sinai.org",
  cedarssinaimedicalcenter: "cedars-sinai.org",
  mountsinai: "mountsinai.org",
  nyp: "nyp.org",
  newyorkpresbyterian: "nyp.org",
  hcahealthcare: "hcahealthcare.com",
  hcahealthcareinc: "hcahealthcare.com",
  intermountainhealthcare: "intermountainhealthcare.org",
  intermountainhealth: "intermountainhealth.org",
  banner: "bannerhealth.com",
  bannerhealth: "bannerhealth.com",
  ascensionhealth: "ascension.org",
  ascension: "ascension.org",
  providence: "providence.org",
  providencehealthservices: "providence.org",
  sutter: "sutterhealth.org",
  sutterhealth: "sutterhealth.org",
  dignityhealth: "dignityhealth.org",
  commonspirit: "commonspirit.org",
  commonspirithealth: "commonspirit.org",
  trinityhealth: "trinity-health.org",
  advocatehealth: "advocatehealth.org",
  advocateaurorahealth: "aah.org",
  northwell: "northwell.edu",
  northwellhealth: "northwell.edu",
  duke: "dukehealth.org",
  dukehealth: "dukehealth.org",
  dukeuniversityhospital: "dukehealth.org",
  emory: "emoryhealthcare.org",
  emoryhealthcare: "emoryhealthcare.org",
  geisinger: "geisinger.org",
  henryford: "henryford.com",
  henryfordhealth: "henryford.com",
  yalenewhavenhealth: "ynhhs.org",
  yalenewhaven: "ynhhs.org",
  upenn: "pennmedicine.org",
  pennmedicine: "pennmedicine.org",
  pennsylvaniahospital: "pennmedicine.org",
  upmc: "upmc.com",
  childrenshospitalofphiladelphia: "chop.edu",
  chop: "chop.edu",
  bostonchildrens: "childrenshospital.org",
  bostonchildrenshospital: "childrenshospital.org",
  texashealthresources: "texashealth.org",
  baylorscottandwhite: "bswhealth.com",
  memorialhermann: "memorialhermann.org",
  houstonmethodist: "houstonmethodist.org",
  mdanderson: "mdanderson.org",
  mdandersoncancercenter: "mdanderson.org",
  hss: "hss.edu",
  hospitalforspecialsurgery: "hss.edu",

  // VA & federal
  va: "va.gov",
  veteransaffairs: "va.gov",
  departmentofveteransaffairs: "va.gov",
};

function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Resolve a company display name to a canonical web domain.
 * Returns null when we don't have a confident mapping — callers should
 * decide whether to fall back to a guess or render an initial.
 */
export function resolveCompanyDomain(
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  const key = normalizeKey(name);
  if (!key) return null;
  return RAW_HEALTH_DOMAINS[key] ?? null;
}

/**
 * Normalize a raw domain-looking string (may be a URL) to a bare host.
 */
export function normalizeDomain(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const host = s
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  return host && host.includes(".") ? host : null;
}
