/**
 * employer-groups.ts — curated health-system employer groups.
 *
 * THE KAISER LESSON (2026-10-14). "Find orthopedic surgeons at Kaiser
 * Permanente in Colorado" returned 2 of the 11 Kaiser-affiliated
 * orthopedic surgeons Crustdata holds for Colorado. The other 9 list their
 * employer as "Colorado Permanente Medical Group (CPMG)": a separate
 * Crustdata entity (id 1587372, domain kpphysiciancareers.org) whose name
 * does not contain "Kaiser". The group below had an EMPTY id list and only
 * the variants "kaiser permanente" / "kaiser foundation", so the physicians'
 * actual employer never matched. Neither the curated table nor the dynamic
 * resolver (employer-resolution.ts) could have found CPMG: both assume a
 * system's entities carry the brand as a name PREFIX, and the person-index
 * autocomplete is prefix-only.
 *
 * Every Kaiser region is a separate Permanente Medical Group, and many
 * other systems have the same shape — the physicians' legal employer does
 * not carry the system's brand (Sutter → Palo Alto Medical Foundation,
 * BJC → Washington University Physicians, UCHealth → CU Anschutz, Advocate
 * Health → Atrium / Aurora, academic systems → the medical school) or the
 * brand was renamed and profiles still carry the old name (Beaumont /
 * Spectrum → Corewell, SCL Health → Intermountain, NorthShore → Endeavor,
 * Lifespan → Brown University Health, Centura → CommonSpirit).
 *
 * Every id below was resolved live through FREE /company/identify calls on
 * 2026-10-14 (probe transcript in the commit that added this file). Rules:
 *   - every group carries ≥1 verified company id (tested) — an id-less
 *     group is exactly the bug this file fixes;
 *   - aliases are whole-phrase matches on the user's stated employer and
 *     the LONGEST matching alias across all groups wins (so "St. John
 *     Providence" is Ascension, not Providence);
 *   - name variants are whole-phrase substring matches on the employer
 *     name people list; keep them distinctive. A generic word ("mercy",
 *     "baptist", "methodist", "memorial") is never a variant on its own.
 *   - domains are matched on the employer's website domain.
 *
 * Changing a group changes which people a named-employer search can find.
 * Probe before you edit; add a known-answer test when you do.
 */

export interface EmployerGroupDef {
  label: string;
  /** Lowercase phrases in a query that mean this group. */
  aliases: string[];
  /**
   * Anchor crustdata company ids, resolved via free /company/identify.
   * NEVER a bare short-token name filter ("VA").
   */
  company_ids: number[];
  domains: string[];
  /** Employer-name substring variants ORed in for entities the id set missed. */
  name_variants: string[];
}

export const EMPLOYER_GROUPS: Record<string, EmployerGroupDef> = {
  /* ------------------------------------------------------------ */
  /*  Government                                                   */
  /* ------------------------------------------------------------ */
  va: {
    label: "VA (Veterans Affairs)",
    aliases: [
      "the va", "va ", "veterans affairs", "veteran affairs", "veterans health", "veterans administration",
      "veterans health administration", "department of veterans affairs", "va hospital", "va medical center",
      "vamc", "veterans hospital", "va health care system", "va healthcare system",
    ],
    company_ids: [
      1129891, // U.S. Department of Veterans Affairs (va.gov, 10001+) — what most VA physicians list
      6891547, // South Texas Veterans Health Care System
      7575637, // Gulf Coast Veterans Health Care System
      6820262, // Southeast Louisiana Veterans Health Care System
      12974094, // VA Pacific Island Health Care System
      8082851, // Salem VA (Veterans Health Administration)
      6503188, // VA Eastern Colorado Health Care System (2026-10-14)
      6690641, // VA Puget Sound Health Care System
      10577774, // VA Puget Sound - American Lake Division
      8581685, // VA Boston Healthcare System - Jamaica Plain
      6108613, // Atlanta VA Medical Center
      6329118, // Memphis VA Medical Center
      6352687, // Coatesville VA Medical Center
    ],
    domains: ["va.gov"],
    name_variants: [
      // Measured 2026-10-14 in Colorado: the first five found 132 physicians,
      // the additions below take it to 142 (misspellings, the singular
      // "Veteran Affairs", "VA Hospital", "VAMC").
      "veterans affairs",
      "veterans health administration",
      "veterans health care system",
      "va medical center",
      "va healthcare system",
      "veteran affairs",
      "veterans administration",
      "va health care system",
      "va hospital",
      "veterans hospital",
      "vamc",
      "department of veteran",
      "veterans health",
    ],
  },
  ihs: {
    label: "Indian Health Service",
    aliases: ["indian health service", "ihs", "tribal health"],
    company_ids: [1296287],
    domains: ["ihs.gov"],
    name_variants: ["indian health service", "indian health", "tribal health"],
  },
  /* ------------------------------------------------------------ */
  /*  Department of Defense / Military Health System (2026-10-14)   */
  /*                                                                */
  /*  Military physicians tag the SERVICE ("US Army", "US Navy",    */
  /*  "USN", "United States Air Force") far more often than the      */
  /*  hospital; the hospital records are duplicated; podiatrists    */
  /*  never tag the hospital. A facility is service + geography, so */
  /*  the group carries every service and every facility record,   */
  /*  and MILITARY_FACILITIES below supplies the metro for a named  */
  /*  base. Guard and Reserve are a SEPARATE group: a civilian      */
  /*  surgeon with a part-time commission is a different population.*/
  /*  Never use afreserve.com / goang.com as reserve signals — they  */
  /*  are the active Air Force entity's own domains.                */
  /* ------------------------------------------------------------ */
  dod: {
    label: "Department of Defense (military health)",
    aliases: [
      "dod", "department of defense", "military", "military health", "military health system",
      "defense health agency", "dha", "active duty", "armed forces", "uniformed services", "medical corps",
      "us army", "u.s. army", "united states army", "army medicine", "army medical",
      "us navy", "u.s. navy", "united states navy", "navy medicine", "navy medical",
      "us air force", "u.s. air force", "united states air force", "usaf", "air force", "air force medical",
      "us marine corps", "marine corps", "military treatment facility", "mtf",
      "military hospital", "military medical center", "army hospital", "naval hospital", "naval medical center",
      "army medical center", "army community hospital",
      // facility nicknames — MILITARY_FACILITIES narrows these to the base
      "walter reed", "bethesda naval", "wrnmmc", "brooke army", "bamc", "sammc", "madigan", "tripler", "womack",
      "evans army", "balboa", "nmcsd", "nmc portsmouth", "portsmouth naval", "naval medical center portsmouth",
      "camp lejeune", "landstuhl", "eisenhower army", "darnall", "william beaumont army", "wbamc", "keller army",
      "martin army", "winn army", "blanchfield", "fort belvoir community hospital", "wright-patterson medical",
      "wright patterson medical", "david grant medical", "keesler medical", "mike o'callaghan", "usafa",
      "uniformed services university", "usuhs",
    ],
    company_ids: [
      1040041, // US Army (army.mil) — the single most common tag
      1476804, // United States Department of the Army
      9988770, // U.S. Army Medical Command
      1034053, // US Navy (navy.mil)
      2056768, // United States Department of the Navy
      1980549, // US Navy Bureau of Medicine and Surgery
      1100685, // United States Air Force
      1295078, // United States Air Force Academy
      1040040, // United States Marine Corps
      1257916, // Defense Health Agency
      3083301, // Defense Health Agency (dha.mil)
      61296201, // Defense Health Network East
      8221751, // Military Health System (health.mil)
      1690954, // Uniformed Services University
      6066156, // Walter Reed National Military Medical Center
      2216341, // Walter Reed Army Medical Center (legacy)
      4947246, // Brooke Army Medical Center
      6410911, // Tripler Army Medical Center
      6355570, // Madigan Army Medical Center
      7446990, // Womack Army Medical Center
      1224616, // Womack Army Medical Center (duplicate record)
      7661026, // Evans Army Community Hospital
      2004532, // Keller Army Community Hospital
      6584223, // Martin Army Community Hospital
      6286319, // Winn Army Community Hospital
      8177843, // Blanchfield Army Community Hospital
      7223295, // Naval Medical Center Portsmouth
      6797583, // Naval Medical Center Camp Lejeune
      6518802, // Naval Medical Center San Diego
      7423349, // Naval Medical Center San Diego (duplicate record)
      6239042, // Landstuhl Regional Medical Center
      21232352, // Wright Patterson Medical Center
      7790094, // David Grant Medical Center
      13873681, // David Grant Medical Center (GME)
    ],
    domains: ["army.mil", "navy.mil", "af.mil", "airforce.com", "marines.mil", "dha.mil", "health.mil", "tricare.mil", "usuhs.edu"],
    name_variants: [
      "us army", "u.s. army", "united states army", "us navy", "u.s. navy", "united states navy", "usn",
      "us air force", "u.s. air force", "united states air force", "usaf", "united states marine corps", "us marine corps",
      "defense health agency", "defense health network", "military health system", "department of defense",
      "army medical center", "army community hospital", "army hospital", "naval medical center", "naval hospital",
      "naval health clinic", "navy medicine", "army medicine", "army medical corps", "navy medical corps",
      "air force medical", "uniformed services", "military medical center", "military hospital",
      "walter reed", "landstuhl", "fort belvoir community hospital", "wright-patterson medical center",
      "wright patterson medical center", "david grant medical center", "keesler medical center", "air force academy",
      "nmcsd", "medical group-usaf", "medical group usaf",
      // Air Force clinics are "Nth Medical Group". A bare "medical group" variant
      // matches every civilian "X Medical Group" (it inflated a 2026-10-14 count
      // from 285 to 662), so the major ones are enumerated.
      "1st medical group", "4th medical group", "6th medical group", "10th medical group", "15th medical group",
      "18th medical group", "20th medical group", "23d medical group", "23rd medical group", "27th special operations medical group",
      "28th medical group", "45th medical group", "48th medical group", "52nd medical group", "55th medical group",
      "59th medical wing", "60th medical group", "75th medical group", "81st medical group", "86th medical group",
      "88th medical group", "90th medical group", "96th medical group", "97th medical group", "99th medical group",
      "325th medical group", "412th medical group", "579th medical group", "633d medical group", "633rd medical group",
      "673d medical group", "673rd medical group",
    ],
  },
  guard_reserve: {
    label: "Guard and Reserve",
    aliases: [
      "guard and reserve", "guard or reserve", "reserve component", "reservist", "reservists",
      "army reserve", "army reserves", "us army reserve", "u.s. army reserve", "united states army reserve",
      "navy reserve", "navy reserves", "us navy reserve", "u.s. navy reserve", "united states navy reserve",
      "air force reserve", "air force reserves", "us air force reserve", "u.s. air force reserve", "air force reserve command",
      "national guard", "army national guard", "air national guard", "usar", "usnr", "afrc", "ang",
    ],
    company_ids: [
      1477295, // United States Army Reserve
      1086585, // U.S. Navy Reserve
      6668052, // United States Air Force Reserve
      906200, // Army National Guard
      1293040, // Air National Guard
      32500162, // Air National Guard (second record)
    ],
    // nationalguard.com only. afreserve.com / goang.com belong to the active
    // Air Force entity and would tag every active Air Force surgeon as Reserve.
    domains: ["nationalguard.com"],
    name_variants: [
      "army reserve", "army reserves", "navy reserve", "navy reserves", "air force reserve", "air force reserves",
      "army national guard", "air national guard", "usar", "usnr", "reserve component",
      // NOT bare "national guard": the Saudi "Ministry of National Guard Health
      // Affairs" employs hundreds of surgeons and matched it (2026-10-14).
    ],
  },

  /* ------------------------------------------------------------ */
  /*  National / multi-state systems                               */
  /* ------------------------------------------------------------ */
  hca: {
    label: "HCA Healthcare",
    aliases: ["hca", "hca healthcare", "hca florida", "hca houston", "medical city healthcare", "tristar health"],
    company_ids: [1125547],
    domains: ["hcahealthcare.com"],
    name_variants: ["hca healthcare", "medical city healthcare", "hca florida", "hca houston", "hca midwest", "tristar health"],
  },
  kaiser: {
    label: "Kaiser Permanente",
    aliases: ["kaiser", "kaiser permanente", "permanente", "permanente medical group", "kaiser foundation"],
    company_ids: [
      1046130, // Kaiser Permanente (kp.org, 10001+)
      6088378, // The Permanente Medical Group, Inc. — Northern California
      7452744, // Southern California Permanente Medical Group
      6063957, // Northwest Permanente
      1891287, // Washington Permanente Medical Group
      1898899, // The Southeast Permanente Medical Group (Georgia)
      1110270, // Hawaii Permanente Medical Group
      1042769, // Mid-Atlantic Permanente Medical Group
      7672337, // Kaiser Permanente - Mid-Atlantic Permanente Medical Group (MAPMG)
      1587372, // Colorado Permanente Medical Group (CPMG) — the 2026-10-14 miss
      13707173, // COLORADO PERMANENTE MEDICAL GROUP, P.C.
      1142331, // Kaiser Permanente Northwest
      815485, // Kaiser Permanente Hawaii
      7653860, // Kaiser Permanente Georgia
      9237083, // Kaiser Foundation Hospitals
    ],
    domains: ["kaiserpermanente.org", "kp.org", "permanente.org", "kpphysiciancareers.org", "wpmgcareers.org", "tspmg.com", "kpinhawaii.com"],
    name_variants: ["kaiser permanente", "kaiser foundation", "permanente"],
  },
  commonspirit: {
    label: "CommonSpirit Health",
    aliases: ["commonspirit", "common spirit", "dignity health", "catholic health initiatives", "chi health", "centura", "centura health", "virginia mason franciscan", "chi st. luke", "chi st luke", "chi memorial", "chi franciscan"],
    company_ids: [
      1143102, // CommonSpirit Health
      1074270, // Dignity Health
      1204276, // Centura Health (Colorado / Kansas, retired brand)
      1111818, // Virginia Mason Franciscan Health
      7730181, // Dignity Health Medical Group
      1110930, // Dignity Health Medical Foundation
      1110127, // Catholic Health Initiatives Colorado
      11471323, // Catholic Health Initiatives - Iowa
      1110001, // St. Joseph Health (CHI, Texas)
    ],
    domains: ["commonspirit.org", "commonspirit.careers", "centura.org", "dhmf.org", "chistjoseph.org", "stlukeshealth.org", "stanthonyhosp.org", "stmarycorwin.org"],
    name_variants: ["commonspirit", "dignity health", "catholic health initiatives", "centura", "virginia mason franciscan", "chi health", "chi st. luke", "chi st luke", "chi memorial", "chi franciscan", "chi st. vincent", "chi st. alexius"],
  },
  ascension: {
    label: "Ascension",
    aliases: ["ascension", "ascension health", "seton healthcare", "dell seton", "wheaton franciscan", "via christi", "columbia st. mary", "columbia st mary", "st. john providence", "st john providence", "genesys", "borgess", "amita health"],
    company_ids: [
      782006, // Ascension
      10516912, // Ascension Seton
      17645737, // Ascension St. Vincent
      6138235, // Seton Healthcare Family
      1111755, // Ascension Via Christi
      6098382, // Ascension Sacred Heart
      6417761, // Bay Medical Sacred Heart
      6241614, // St. John Providence
      2206161, // Genesys Health System
      6065107, // Borgess Health
      6510573, // Columbia St. Mary's
      7221891, // Columbia St. Mary's Hospital
      18736005, // Wheaton Franciscan Healthcare - St. Francis
      23908623, // Wheaton Franciscan Healthcare - Elmbrook Memorial
      17895125, // Wheaton Franciscan Inc - St Joseph
    ],
    domains: ["ascension.org", "seton.net", "dellchildrens.org", "stjohnhealthsystem.com", "sacred-heart.org", "amitahealth.org", "genesys.org"],
    name_variants: ["ascension", "seton healthcare", "seton medical center", "dell seton", "dell children", "wheaton franciscan", "via christi", "columbia st. mary", "columbia st mary", "st. john providence", "st john providence", "genesys", "borgess", "amita health"],
  },
  trinity: {
    label: "Trinity Health",
    aliases: ["trinity health", "saint joseph mercy", "st. joseph mercy", "st joseph mercy", "iha", "loyola medicine", "loyola university medical center", "mercyone", "mercy one", "saint alphonsus", "mount carmel health", "st. peter's health partners", "trinity health of new england", "holy cross health"],
    company_ids: [
      1151123, // Trinity Health
      1111210, // Trinity Health (second entity)
      1891430, // Saint Joseph Mercy Health System
      2220240, // Trinity Health MI
      5494233, // IHA
      1111677, // Loyola Medicine
      6728453, // Loyola University Medical Center
      1672968, // MercyOne
      6062237, // Trinity Health Of New England
      1111661, // Mount Carmel Health System
      1229043, // St. Peter's Health Partners
      1110122, // Trinity Health Mid-Atlantic
    ],
    domains: ["trinity-health.org", "trinityhealth.org", "trinityhealthmichigan.org", "stjoeshealth.org", "ihacares.com", "loyolamedicine.org", "mercyone.org", "trinityhealthofne.org", "mountcarmelhealth.com", "sphp.com", "saintalphonsus.org", "trinityhealthma.org"],
    name_variants: ["trinity health", "saint joseph mercy", "st. joseph mercy", "st joseph mercy", "iha", "loyola medicine", "loyola university medical center", "mercyone", "saint alphonsus", "mount carmel", "st. peter's health partners", "holy cross health"],
  },
  bon_secours: {
    label: "Bon Secours Mercy Health",
    aliases: ["bon secours", "bon secours mercy", "bon secours mercy health", "bsmh"],
    company_ids: [
      1144873, // Bon Secours Mercy Health
      2541939, // Bon Secours
      1144879, // Mercy Health (mercy.com / bsmhealth.org — Ohio & Kentucky)
    ],
    domains: ["bsmhealth.org", "bonsecours.com", "mercy.com"],
    name_variants: ["bon secours", "mercy health cincinnati", "mercy health toledo", "mercy health lorain", "mercy health youngstown", "mercy health springfield", "mercy health lima", "mercy health st. vincent", "mercy health st. rita"],
  },
  adventhealth: {
    label: "AdventHealth",
    aliases: ["adventhealth", "advent health", "florida hospital"],
    company_ids: [
      1069539, // AdventHealth
      6163372, // Florida Hospital (legacy name)
    ],
    domains: ["adventhealth.com", "joinadventhealth.com", "floridahospital.com"],
    name_variants: ["adventhealth", "advent health", "florida hospital", "adventist health system", "adventist hospital"],
  },
  providence: {
    label: "Providence",
    aliases: ["providence", "providence health", "providence st. joseph", "providence st joseph", "providence swedish", "swedish", "swedish medical center", "swedish health services", "kadlec", "facey", "pacific medical centers", "pacmed", "covenant health lubbock"],
    company_ids: [
      1142333, // Providence
      1142325, // Providence Health & Services
      1111654, // St. Joseph Health (Providence, California)
      1111757, // Covenant Health (Providence, Lubbock)
      1111158, // Kadlec
      1111780, // Providence Swedish
      7711477, // Swedish Medical Center - First Hill
      9636082, // Swedish Medical Center - Cherry Hill
      9201802, // Swedish Medical Center - Edmonds
      13359340, // Swedish Medical Center - Ballard
      1109722, // Facey Medical Group & Facey Medical Foundation
      7884977, // Providence St Joseph Medical Center
    ],
    domains: ["providence.org", "providence.jobs", "providenceswedish.org", "kadlec.org", "covenanthealth.org", "facey.com", "pacmed.org", "swedish.org"],
    name_variants: ["providence", "swedish medical center", "swedish health services", "kadlec", "facey medical", "pacific medical centers", "st. joseph health", "st joseph health", "st. joseph hospital orange", "mission hospital laguna", "hoag"],
  },
  sutter: {
    label: "Sutter Health",
    aliases: ["sutter", "sutter health", "palo alto medical foundation", "pamf", "sutter medical group", "sutter gould", "sutter east bay"],
    company_ids: [
      1005474, // Sutter Health
      6240145, // Sutter Health (CPMC research entity)
      6603188, // Sutter Medical Group
      8281168, // Sutter Gould Medical Foundation
      1995334, // Sutter East Bay Medical Foundation
      2051819, // Palo Alto Medical Foundation
      1894002, // Sutter Pacific Medical Foundation
    ],
    domains: ["sutterhealth.org", "suttereastbaydoctors.org", "sutterpacific.org", "pamf.org"],
    name_variants: ["sutter", "palo alto medical foundation", "pamf", "california pacific medical center", "mills-peninsula", "mills peninsula"],
  },
  intermountain: {
    label: "Intermountain Health",
    aliases: ["intermountain", "intermountain health", "intermountain healthcare", "scl health", "intermountain medical"],
    company_ids: [
      1143649, // Intermountain Health
      920585, // SCL Health (now Intermountain)
      7596486, // Intermountain Medical Center
    ],
    domains: ["intermountainhealthcare.org", "sclhealth.org"],
    name_variants: ["intermountain health", "intermountain healthcare", "intermountain medical center", "intermountain medical group", "scl health", "primary children's hospital", "lds hospital"],
  },
  advocate_health: {
    label: "Advocate Health",
    aliases: ["advocate health"],
    company_ids: [
      1144135, // Advocate Health (parent, 2022)
      640974, // Advocate Aurora Health
      1057343, // Atrium Health
      811594, // Aurora Health Care
      1142397, // Atrium Health Wake Forest Baptist
      1110633, // Advocate Medical Group
    ],
    domains: ["advocatehealth.org", "advocateaurorahealth.org", "atriumhealth.org", "aurorahealthcare.org", "aah.org", "wakehealth.edu", "advocatehealth.com"],
    name_variants: ["advocate health", "advocate aurora", "advocate medical group", "advocate children", "advocate lutheran", "advocate christ", "advocate good samaritan", "advocate illinois masonic", "advocate condell", "advocate sherman", "atrium health", "aurora health care", "aurora medical center", "aurora st. luke", "wake forest baptist", "carolinas healthcare", "carolinas medical center", "levine children", "levine cancer"],
  },
  advocate_aurora: {
    label: "Advocate Aurora Health",
    aliases: ["advocate aurora", "advocate aurora health", "aurora health care", "aurora health", "advocate medical group", "advocate health care", "advocate healthcare", "advocate christ", "advocate lutheran", "advocate good samaritan", "advocate illinois masonic", "advocate condell", "advocate sherman", "advocate children"],
    company_ids: [
      640974, // Advocate Aurora Health
      811594, // Aurora Health Care
      1110633, // Advocate Medical Group
      1144135, // Advocate Health (parent)
    ],
    domains: ["advocateaurorahealth.org", "aurorahealthcare.org", "aah.org", "advocatehealth.com", "advocatehealth.org"],
    name_variants: ["advocate aurora", "advocate health", "advocate medical group", "advocate children", "advocate lutheran", "advocate christ", "advocate good samaritan", "advocate illinois masonic", "advocate condell", "advocate sherman", "aurora health care", "aurora medical center", "aurora st. luke", "aurora sinai", "aurora baycare"],
  },
  atrium: {
    label: "Atrium Health",
    aliases: ["atrium", "atrium health", "wake forest baptist", "atrium health wake forest", "carolinas healthcare system", "carolinas medical center", "levine children", "levine cancer institute", "atrium health navicent", "navicent health"],
    company_ids: [
      1057343, // Atrium Health
      1142397, // Atrium Health Wake Forest Baptist
      1144135, // Advocate Health (parent)
    ],
    domains: ["atriumhealth.org", "wakehealth.edu", "advocatehealth.org"],
    name_variants: ["atrium health", "wake forest baptist", "wake forest university school of medicine", "wake forest school of medicine", "carolinas healthcare", "carolinas medical center", "levine children", "levine cancer", "navicent"],
  },
  corewell: {
    label: "Corewell Health",
    aliases: ["corewell", "corewell health", "beaumont", "beaumont health", "spectrum health", "william beaumont"],
    company_ids: [
      1008436, // Corewell Health
      6510631, // Corewell Health (second entity)
      1125790, // Beaumont Health
      6072132, // Spectrum Health
    ],
    domains: ["corewellhealth.org", "spectrumhealth.org", "beaumont.org"],
    name_variants: ["corewell", "beaumont health", "beaumont hospital", "william beaumont", "spectrum health", "helen devos", "butterworth hospital", "blodgett hospital", "lakeland health"],
  },
  bsw: {
    label: "Baylor Scott & White Health",
    aliases: ["baylor scott & white", "baylor scott and white", "bswh", "scott & white", "scott and white", "baylor university medical center", "baylor health care", "healthtexas"],
    company_ids: [1142304],
    domains: ["bswhealth.com", "bswhealth.org"],
    name_variants: ["baylor scott & white", "baylor scott and white", "scott & white", "scott and white", "baylor university medical center", "baylor health care system", "baylor medical center", "baylor all saints", "baylor regional medical center", "healthtexas provider network"],
  },
  northwell: {
    label: "Northwell Health",
    aliases: ["northwell", "northwell health", "north shore-lij", "north shore lij", "lenox hill", "long island jewish", "zucker school of medicine", "hofstra northwell", "nuvance"],
    company_ids: [
      1237547, // Northwell Health
      1127786, // Lenox Hill Hospital
    ],
    domains: ["northwell.edu", "nuvancehealth.org", "danburyhospital.org", "westchesterhealth.com"],
    name_variants: ["northwell", "north shore-lij", "north shore lij", "north shore university hospital", "lenox hill", "long island jewish", "zucker school of medicine", "hofstra northwell", "cohen children", "staten island university hospital", "southside hospital", "huntington hospital", "nuvance", "danbury hospital", "vassar brothers"],
  },
  endeavor: {
    label: "Endeavor Health",
    aliases: ["endeavor health", "northshore university healthsystem", "northshore university", "northshore university health", "edward-elmhurst", "edward elmhurst", "swedish covenant", "swedish hospital", "northwest community healthcare", "northwest community hospital"],
    company_ids: [
      1144070, // Endeavor Health
      1111795, // NorthShore University HealthSystem
      1110895, // Edward-Elmhurst Health
      1110903, // Swedish Hospital (Chicago)
    ],
    domains: ["endeavorhealth.org", "northshore.org", "eehealth.org", "swedishcovenant.org", "nch.org"],
    name_variants: ["endeavor health", "northshore university healthsystem", "northshore university health", "edward-elmhurst", "edward elmhurst", "edward hospital", "elmhurst hospital", "elmhurst memorial", "swedish covenant", "swedish hospital", "northwest community healthcare", "northwest community hospital", "evanston hospital", "glenbrook hospital", "highland park hospital", "skokie hospital", "linden oaks"],
  },
  prisma: {
    label: "Prisma Health",
    aliases: ["prisma", "prisma health", "greenville health system", "palmetto health"],
    company_ids: [
      1036812, // Prisma Health
      6259684, // Greenville Health System
      1824555, // Palmetto Health
    ],
    domains: ["prismahealth.org", "ghs.org", "palmettohealth.org"],
    name_variants: ["prisma health", "greenville health system", "greenville memorial", "palmetto health", "palmetto richland"],
  },
  ballad: {
    label: "Ballad Health",
    aliases: ["ballad", "ballad health", "mountain states health alliance", "wellmont"],
    company_ids: [
      1208595, // Ballad Health
      1111702, // Wellmont Health System
    ],
    domains: ["balladhealth.org", "wellmont.org", "msha.com"],
    name_variants: ["ballad health", "mountain states health alliance", "wellmont", "johnson city medical center", "holston valley", "bristol regional"],
  },
  healthpartners: {
    label: "HealthPartners",
    aliases: ["healthpartners", "park nicollet", "regions hospital"],
    company_ids: [
      6035779, // HealthPartners
      13391476, // Park Nicollet
    ],
    domains: ["healthpartners.com", "parknicollet.com", "tria.com", "lakeviewhealth.org"],
    name_variants: ["healthpartners", "park nicollet", "regions hospital", "tria orthopedic", "methodist hospital st. louis park"],
  },
  fairview: {
    label: "M Health Fairview",
    aliases: ["m health fairview", "fairview health", "fairview", "university of minnesota physicians", "m physicians", "university of minnesota medical center", "university of minnesota medical school"],
    company_ids: [
      1111752, // Fairview Health Services
      1111465, // University of Minnesota Physicians
    ],
    domains: ["fairview.org", "mphysicians.org", "mhealthfairview.org"],
    name_variants: ["m health fairview", "fairview health", "fairview", "university of minnesota physicians", "university of minnesota medical center", "university of minnesota medical school", "m physicians", "masonic children"],
  },
  froedtert: {
    label: "Froedtert & the Medical College of Wisconsin",
    aliases: ["froedtert", "froedtert health", "medical college of wisconsin", "mcw", "thedacare"],
    company_ids: [
      1111648, // Froedtert Health
      1299158, // Medical College of Wisconsin
    ],
    domains: ["froedtert.com", "mcw.edu", "thedacare.org"],
    name_variants: ["froedtert", "medical college of wisconsin", "thedacare", "mcw"],
  },
  banner: {
    label: "Banner Health",
    aliases: ["banner", "banner health", "banner university", "banner - university", "banner md anderson"],
    company_ids: [1111828],
    domains: ["bannerhealth.com"],
    name_variants: ["banner health", "banner university", "banner - university", "banner md anderson", "banner desert", "banner estrella", "banner thunderbird", "banner boswell", "banner gateway", "banner baywood", "banner del webb", "banner north colorado"],
  },
  honorhealth: {
    label: "HonorHealth",
    aliases: ["honorhealth", "honor health", "scottsdale healthcare", "john c. lincoln", "john c lincoln"],
    company_ids: [1111798],
    domains: ["honorhealth.com"],
    name_variants: ["honorhealth", "honor health", "scottsdale healthcare", "john c. lincoln", "john c lincoln"],
  },

  /* ------------------------------------------------------------ */
  /*  Academic systems — physicians list the hospital, the school   */
  /*  of medicine, or the faculty practice interchangeably.         */
  /* ------------------------------------------------------------ */
  uchealth: {
    label: "UCHealth (University of Colorado)",
    aliases: ["uchealth", "university of colorado health", "university of colorado hospital", "university of colorado", "cu medicine", "cu anschutz", "anschutz", "university of colorado school of medicine", "poudre valley", "memorial hospital colorado springs"],
    company_ids: [
      1304813, // UCHealth
      6524064, // UCHealth - Yampa Valley Medical Center
      7529263, // University of Colorado Health at Memorial Hospital North
      670107, // University of Colorado Anschutz
      6041104, // University of Colorado Anschutz School of Medicine
      11095976, // CU Anschutz Department of Medicine
      70225548, // Office of Advanced Practice, CU Anschutz School of Medicine / UCH
      8879652, // University of Colorado Anschutz Cancer Center
    ],
    domains: ["uchealth.org", "cuanschutz.edu"],
    name_variants: ["uchealth", "university of colorado health", "university of colorado hospital", "university of colorado school of medicine", "university of colorado anschutz", "university of colorado denver", "cu medicine", "cu anschutz", "anschutz medical campus", "poudre valley hospital", "medical center of the rockies"],
  },
  uc_cincinnati: {
    label: "UC Health (Cincinnati)",
    aliases: ["uc health", "university of cincinnati medical center", "university of cincinnati college of medicine", "west chester hospital"],
    company_ids: [1110325],
    domains: ["uchealth.com", "uc.edu"],
    name_variants: ["uc health", "uc medical center", "university of cincinnati medical center", "university of cincinnati college of medicine", "west chester hospital"],
  },
  mgb: {
    label: "Mass General Brigham",
    aliases: ["mass general brigham", "mgb", "partners healthcare", "massachusetts general", "mass general", "mgh", "brigham and women", "brigham & women", "the brigham", "bwh", "newton-wellesley", "newton wellesley", "spaulding rehabilitation", "mclean hospital"],
    company_ids: [
      1125867, // Mass General Brigham
      1125869, // Massachusetts General Hospital
      7586062, // Massachusetts General Hospital (second entity)
      1081020, // Brigham and Women's Hospital
      1110977, // Newton-Wellesley Hospital
      1037903, // Harvard Medical School and Massachusetts General Hospital
      1110979, // Partners HealthCare at Home & Spaulding Rehabilitation Network
    ],
    domains: ["massgeneralbrigham.org", "massgeneral.org", "brighamandwomens.org", "partners.org", "mgh.harvard.edu", "nwh.org", "spauldingrehab.org", "bwhihub.org"],
    name_variants: ["mass general brigham", "massachusetts general", "mass general", "brigham and women", "brigham & women", "partners healthcare", "newton-wellesley", "newton wellesley", "spaulding rehabilitation", "mclean hospital", "mgh", "bwh"],
  },
  bilh: {
    label: "Beth Israel Lahey Health",
    aliases: ["beth israel lahey", "bilh", "beth israel deaconess", "bidmc", "lahey hospital", "lahey clinic", "lahey health"],
    company_ids: [
      1125868, // Beth Israel Lahey Health
      1093464, // Beth Israel Deaconess Medical Center
      1111635, // Lahey Hospital & Medical Center
    ],
    domains: ["bilh.org", "bidmc.org", "lahey.org"],
    name_variants: ["beth israel lahey", "beth israel deaconess", "bidmc", "lahey hospital", "lahey clinic", "lahey health", "mount auburn hospital", "winchester hospital", "anna jaques"],
  },
  nyp: {
    label: "NewYork-Presbyterian",
    aliases: ["newyork-presbyterian", "new york-presbyterian", "new york presbyterian", "nyp", "columbia university irving medical center", "columbia university medical center", "columbiadoctors", "columbia doctors", "weill cornell", "vagelos college of physicians"],
    company_ids: [
      1127781, // NewYork-Presbyterian Hospital
      1127788, // Columbia University Irving Medical Center
      1127787, // Weill Cornell Medicine
    ],
    domains: ["nyp.org", "columbiadoctors.org", "cumc.columbia.edu", "weill.cornell.edu", "columbiaortho.org", "columbiaradiology.org"],
    name_variants: ["newyork-presbyterian", "new york-presbyterian", "new york presbyterian", "nyp", "columbia university irving medical center", "columbia university medical center", "columbiadoctors", "columbia doctors", "weill cornell", "vagelos college of physicians"],
  },
  nyu: {
    label: "NYU Langone Health",
    aliases: ["nyu langone", "nyu grossman", "nyu school of medicine", "nyu medical center", "nyu winthrop"],
    company_ids: [
      1127785, // NYU Langone Health
      6104477, // NYU Grossman School of Medicine
    ],
    domains: ["nyulangone.org", "med.nyu.edu"],
    name_variants: ["nyu langone", "nyu grossman", "nyu school of medicine", "nyu medical center", "nyu winthrop", "nyu hospitals center", "bellevue hospital"],
  },
  montefiore: {
    label: "Montefiore Einstein",
    aliases: ["montefiore", "montefiore einstein", "albert einstein college of medicine", "einstein college of medicine"],
    company_ids: [
      1111710, // Montefiore Medical Center
      1080006, // Albert Einstein College of Medicine
    ],
    domains: ["montefiore.org", "einsteinmed.edu", "montefioreeinstein.org", "montekids.org"],
    name_variants: ["montefiore", "albert einstein college of medicine", "einstein college of medicine"],
  },
  nyc_hh: {
    label: "NYC Health + Hospitals",
    aliases: ["nyc health + hospitals", "nyc health and hospitals", "nyc health hospitals", "health + hospitals", "new york city health and hospitals", "hhc"],
    company_ids: [6054923],
    domains: ["nychealthandhospitals.org", "nychhc.org"],
    name_variants: ["nyc health + hospitals", "nyc health and hospitals", "nyc health hospitals", "health + hospitals", "health and hospitals corporation", "bellevue hospital", "elmhurst hospital center", "kings county hospital", "jacobi medical center", "lincoln medical center", "harlem hospital", "woodhull", "coney island hospital", "metropolitan hospital center", "queens hospital center", "north central bronx"],
  },
  yale: {
    label: "Yale New Haven Health",
    aliases: ["yale new haven", "yale-new haven", "ynhh", "yale medicine", "yale school of medicine", "yale health"],
    company_ids: [
      810076, // Yale New Haven Health
      6039299, // Yale School of Medicine
      1627064, // Yale Medicine
    ],
    domains: ["ynhhs.org", "ynhh.org", "yalemedicine.org", "medicine.yale.edu"],
    name_variants: ["yale new haven", "yale-new haven", "yale medicine", "yale school of medicine", "bridgeport hospital", "greenwich hospital", "lawrence + memorial", "lawrence and memorial", "northeast medical group"],
  },
  hackensack: {
    label: "Hackensack Meridian Health",
    aliases: ["hackensack meridian", "hackensack", "meridian health", "jersey shore university medical center", "jfk medical center", "john theurer"],
    company_ids: [
      632944, // Hackensack Meridian Health
      1111192, // Jersey Shore University Medical Center
      1902014, // John Theurer Cancer Center at Hackensack University Medical Center
    ],
    domains: ["hackensackmeridianhealth.org", "hmhn.org", "jerseyshoreuniversitymedicalcenter.com", "meridianhealth.com", "jtcancercenter.org"],
    name_variants: ["hackensack meridian", "hackensack university medical center", "hackensackumc", "meridian health", "jersey shore university medical center", "jfk medical center", "ocean university medical center", "riverview medical center", "john theurer", "palisades medical center", "raritan bay medical center"],
  },
  brown_health: {
    label: "Brown University Health",
    aliases: ["brown university health", "brown health", "lifespan", "rhode island hospital", "miriam hospital", "hasbro children", "warren alpert medical school", "brown physicians"],
    company_ids: [
      1111729, // Brown University Health
      6232985, // Lifespan (legacy name)
      6074976, // Rhode Island Hospital
    ],
    domains: ["brownhealth.org", "lifespan.org", "brownphysicians.org", "miriamhospital.org", "brownsurgicalassociates.org"],
    name_variants: ["brown university health", "brown health", "lifespan", "rhode island hospital", "miriam hospital", "hasbro children", "bradley hospital", "newport hospital", "warren alpert medical school", "brown physicians", "brown surgical associates", "brown emergency medicine"],
  },
  dartmouth: {
    label: "Dartmouth Health",
    aliases: ["dartmouth health", "dartmouth-hitchcock", "dartmouth hitchcock", "geisel school of medicine"],
    company_ids: [
      1223677, // Dartmouth Health
      7887593, // Dartmouth-Hitchcock Medical Center
    ],
    domains: ["dartmouth-health.org", "dartmouth-hitchcock.org", "hitchcock.org"],
    name_variants: ["dartmouth health", "dartmouth-hitchcock", "dartmouth hitchcock", "geisel school of medicine", "cheshire medical center"],
  },
  ahn: {
    label: "Allegheny Health Network",
    aliases: ["allegheny health network", "ahn", "allegheny general", "highmark health", "west penn hospital"],
    company_ids: [1080021],
    domains: ["ahn.org", "highmarkhealth.org"],
    name_variants: ["allegheny health network", "allegheny general", "highmark health", "west penn hospital", "forbes hospital", "jefferson hospital pittsburgh", "saint vincent hospital erie"],
  },
  upmc: {
    label: "UPMC",
    aliases: ["upmc", "university of pittsburgh medical center", "university of pittsburgh physicians", "university of pittsburgh school of medicine", "pitt medicine", "pinnacle health", "pinnaclehealth", "magee-womens", "magee womens", "children's hospital of pittsburgh"],
    company_ids: [
      904878, // UPMC
      8944315, // University of Pittsburgh Physicians
    ],
    domains: ["upmc.com", "upmc.edu", "pinnaclehealth.org", "upmcphysicianresources.com"],
    name_variants: ["upmc", "university of pittsburgh medical center", "university of pittsburgh physicians", "university of pittsburgh school of medicine", "pinnacle health", "pinnaclehealth", "children's hospital of pittsburgh", "magee-womens", "magee womens"],
  },
  penn: {
    label: "Penn Medicine",
    aliases: ["penn medicine", "university of pennsylvania health system", "upenn health", "hospital of the university of pennsylvania", "pennsylvania hospital", "penn presbyterian", "perelman school of medicine", "lancaster general", "chester county hospital", "princeton health", "doylestown health"],
    company_ids: [
      1127590, // Penn Medicine, University of Pennsylvania Health System
      929816, // Penn Medicine Princeton Health
      1111063, // Penn Medicine Doylestown Health
      1111638, // Penn Medicine Lancaster General Health
      930120, // Penn Medicine Chester County Hospital
      6651892, // Pennsylvania Hospital of the University of Pennsylvania Health System
      6036517, // University of Pennsylvania Perelman School of Medicine
    ],
    domains: ["pennmedicine.org", "pennhealth.com", "uphs.upenn.edu", "med.upenn.edu", "lancastergeneralhealth.org", "chestercountyhospital.org", "princetonhcs.org", "doylestownhealth.org"],
    name_variants: ["penn medicine", "university of pennsylvania health system", "hospital of the university of pennsylvania", "pennsylvania hospital", "penn presbyterian", "perelman school of medicine", "university of pennsylvania school of medicine", "lancaster general", "chester county hospital", "princeton health", "doylestown health"],
  },
  hopkins: {
    label: "Johns Hopkins Medicine",
    aliases: ["johns hopkins", "john hopkins", "hopkins medicine", "johns hopkins hospital", "johns hopkins medicine", "johns hopkins all children", "sibley memorial", "suburban hospital bethesda", "howard county general"],
    company_ids: [
      1128877, // Johns Hopkins Medicine
      6052091, // Johns Hopkins Hospital
      6042889, // The Johns Hopkins University School of Medicine
      1110778, // Johns Hopkins All Children's Hospital
    ],
    domains: ["hopkinsmedicine.org", "jhmi.edu", "jhu.edu", "hopkinsallchildrens.org"],
    name_variants: ["johns hopkins", "john hopkins", "sibley memorial", "suburban hospital", "howard county general", "wilmer eye institute"],
  },
  bjc: {
    label: "BJC HealthCare",
    aliases: ["bjc", "bjc healthcare", "barnes-jewish", "barnes jewish", "washington university physicians", "washu medicine", "washington university school of medicine", "siteman cancer", "st. louis children's hospital", "missouri baptist medical center"],
    company_ids: [
      6150890, // BJC HealthCare
      1111824, // Barnes-Jewish Hospital
      6060534, // Washington University School of Medicine in St. Louis
      60868143, // Washington University Physicians
    ],
    domains: ["bjc.org", "barnesjewish.org", "wustl.edu", "washu.edu", "wuphysicians.wustl.edu"],
    name_variants: ["bjc", "barnes-jewish", "barnes jewish", "washington university school of medicine", "washington university physicians", "washu medicine", "washington university in st. louis", "siteman cancer", "st. louis children's hospital", "missouri baptist medical center", "christian hospital northeast"],
  },
  northwestern: {
    label: "Northwestern Medicine",
    aliases: ["northwestern medicine", "northwestern memorial", "northwestern university feinberg", "feinberg school of medicine", "northwestern medical group", "lurie children"],
    company_ids: [
      1144074, // Northwestern Medicine
      1111802, // Northwestern Memorial Hospital
      24725234, // Northwestern Memorial Hospital (second entity)
      4238326, // Northwestern University - The Feinberg School of Medicine
    ],
    domains: ["nm.org", "nmh.org", "feinberg.northwestern.edu"],
    name_variants: ["northwestern medicine", "northwestern memorial", "northwestern university feinberg", "feinberg school of medicine", "northwestern medical group", "lurie children", "central dupage hospital", "delnor hospital", "lake forest hospital"],
  },
  uchicago: {
    label: "UChicago Medicine",
    aliases: ["uchicago medicine", "university of chicago medicine", "university of chicago medical center", "university of chicago hospitals", "pritzker school of medicine", "comer children", "ingalls memorial"],
    company_ids: [
      860024, // UChicago Medicine
      2132190, // The University of Chicago Medical Center
      1529132, // University of Chicago
    ],
    domains: ["uchicagomedicine.org", "uchospitals.edu", "bsd.uchicago.edu"],
    name_variants: ["uchicago medicine", "university of chicago medicine", "university of chicago medical center", "university of chicago hospitals", "university of chicago", "pritzker school of medicine", "comer children", "ingalls memorial"],
  },
  osu: {
    label: "The Ohio State University Wexner Medical Center",
    aliases: ["ohio state university wexner", "osu wexner", "wexner medical center", "ohio state university medical center", "ohio state university college of medicine", "james cancer hospital", "the ohio state university"],
    company_ids: [
      37368, // The Ohio State University Wexner Medical Center
      6278439, // The Ohio State University College of Medicine
      6035630, // The Ohio State University
    ],
    domains: ["osumc.edu", "wexnermedical.osu.edu", "osu.edu"],
    name_variants: ["wexner medical center", "ohio state university medical center", "ohio state university college of medicine", "the ohio state university", "ohio state university", "james cancer hospital", "nationwide children"],
  },
  michigan: {
    label: "Michigan Medicine",
    aliases: ["michigan medicine", "university of michigan health", "university of michigan hospital", "university of michigan medical school", "university of michigan medical center", "u of m health", "um health", "mott children", "sparrow hospital", "sparrow health"],
    company_ids: [1298845],
    domains: ["michiganmedicine.org", "uofmhealth.org", "med.umich.edu", "sparrow.org"],
    name_variants: ["michigan medicine", "university of michigan health", "university of michigan hospital", "university of michigan medical school", "university of michigan medical center", "u of m health", "um health", "mott children", "c.s. mott", "sparrow hospital", "sparrow health", "metro health hospital"],
  },
  unc: {
    label: "UNC Health",
    aliases: ["unc health", "unc healthcare", "unc hospitals", "unc medical center", "unc school of medicine", "unc rex", "rex healthcare", "rex hospital", "unc physicians network"],
    company_ids: [
      1298113, // UNC Health
      6058776, // UNC School of Medicine
      2187380, // UNC School of Medicine (second entity)
    ],
    domains: ["unchealth.org", "unchealthcare.org", "med.unc.edu"],
    name_variants: ["unc health", "unc healthcare", "unc hospitals", "unc medical center", "unc school of medicine", "unc rex", "rex healthcare", "rex hospital", "unc physicians", "university of north carolina school of medicine", "university of north carolina hospitals"],
  },
  ucla: {
    label: "UCLA Health",
    aliases: ["ucla health", "ucla medical center", "ronald reagan ucla", "david geffen school of medicine", "ucla"],
    company_ids: [
      1074161, // UCLA Health
      6062294, // David Geffen School of Medicine at UCLA
    ],
    domains: ["uclahealth.org", "medschool.ucla.edu", "ucla.edu"],
    name_variants: ["ucla health", "ucla medical center", "ronald reagan ucla", "david geffen school of medicine", "ucla mattel", "ucla"],
  },
  ucsf: {
    label: "UCSF Health",
    aliases: ["ucsf", "ucsf health", "ucsf medical center", "university of california san francisco", "university of california, san francisco", "ucsf benioff", "zuckerberg san francisco general"],
    company_ids: [
      1111777, // UCSF Health
      15597, // University of California, San Francisco
    ],
    domains: ["ucsfhealth.org", "ucsf.edu", "ucsfmissionbayhospitals.org"],
    name_variants: ["ucsf", "university of california san francisco", "university of california, san francisco", "zuckerberg san francisco general"],
  },
  ucsd: {
    label: "UC San Diego Health",
    aliases: ["uc san diego health", "uc san diego", "ucsd health", "ucsd", "university of california san diego", "university of california, san diego"],
    company_ids: [1039082],
    domains: ["health.ucsd.edu", "ucsd.edu"],
    name_variants: ["uc san diego", "ucsd", "university of california san diego", "university of california, san diego", "jacobs medical center", "moores cancer center"],
  },
  ucdavis: {
    label: "UC Davis Health",
    aliases: ["uc davis health", "uc davis", "university of california davis", "university of california, davis"],
    company_ids: [1088058],
    domains: ["health.ucdavis.edu", "ucdavis.edu"],
    name_variants: ["uc davis", "university of california davis", "university of california, davis"],
  },
  uci: {
    label: "UCI Health",
    aliases: ["uci health", "uc irvine health", "uc irvine medical center", "uc irvine", "university of california irvine", "university of california, irvine"],
    company_ids: [1143101],
    domains: ["ucihealth.org", "uci.edu"],
    name_variants: ["uci health", "uc irvine", "university of california irvine", "university of california, irvine"],
  },
  keck: {
    label: "Keck Medicine of USC",
    aliases: ["keck medicine", "keck medicine of usc", "keck hospital", "keck school of medicine", "usc verdugo hills", "usc arcadia", "usc norris", "university of southern california keck"],
    company_ids: [
      1111556, // Keck Medicine of USC
      6066285, // Keck School of Medicine of the University of Southern California
    ],
    domains: ["keckmedicine.org", "keck.usc.edu", "usc.edu"],
    name_variants: ["keck medicine", "keck hospital", "keck school of medicine", "usc verdugo hills", "usc arcadia", "usc norris", "university of southern california"],
  },
  stanford: {
    label: "Stanford Medicine",
    aliases: ["stanford medicine", "stanford health care", "stanford healthcare", "stanford hospital", "stanford university school of medicine", "stanford school of medicine", "stanford children", "lucile packard", "stanford medicine partners", "stanford"],
    company_ids: [
      1134466, // Stanford Health Care
      1473476, // Stanford University School of Medicine
      6824013, // Stanford University School of Medicine (second entity)
      1085340, // Stanford Medicine Children's Health
      1892498, // Stanford Medicine Partners
    ],
    domains: ["stanfordhealthcare.org", "med.stanford.edu", "stanfordchildrens.org", "universityhealthcarealliance.org"],
    name_variants: ["stanford medicine", "stanford health care", "stanford healthcare", "stanford hospital", "stanford university school of medicine", "stanford school of medicine", "stanford children", "lucile packard", "stanford medicine partners", "stanford university"],
  },
  ohsu: {
    label: "OHSU",
    aliases: ["ohsu", "oregon health & science", "oregon health and science", "oregon health sciences university"],
    company_ids: [1082802],
    domains: ["ohsu.edu"],
    name_variants: ["ohsu", "oregon health & science", "oregon health and science", "oregon health sciences university", "doernbecher"],
  },
  uw_medicine: {
    label: "UW Medicine",
    aliases: ["uw medicine", "university of washington medical center", "university of washington school of medicine", "uw medical center", "harborview", "uw physicians", "fred hutch", "fred hutchinson"],
    company_ids: [
      1080671, // UW Medicine
      1144643, // University of Washington - School of Medicine
      1142993, // Harborview Medical Center
      6724131, // Harborview Medical Center (second entity)
    ],
    domains: ["uwmedicine.org", "uw.edu", "washington.edu", "fredhutch.org", "nwhospital.org"],
    name_variants: ["uw medicine", "university of washington medical center", "university of washington school of medicine", "university of washington - school of medicine", "uw medical center", "harborview", "uw physicians", "fred hutch", "fred hutchinson", "valley medical center renton", "northwest hospital seattle"],
  },
  utah: {
    label: "University of Utah Health",
    aliases: ["university of utah health", "university of utah hospital", "university of utah school of medicine", "huntsman cancer", "u of u health"],
    company_ids: [1204283],
    domains: ["healthcare.utah.edu", "utah.edu"],
    name_variants: ["university of utah health", "university of utah hospital", "university of utah school of medicine", "university of utah", "huntsman cancer", "u of u health", "moran eye center"],
  },
};

/** The service-level DoD entities: what a named base is combined with. */
export const DOD_SERVICE_IDS: readonly number[] = [
  1040041, 1476804, 9988770, 1034053, 2056768, 1980549, 1100685, 1295078, 1040040,
  1257916, 3083301, 61296201, 8221751, 1690954,
];
export const DOD_SERVICE_VARIANTS: readonly string[] = [
  "us army", "u.s. army", "united states army", "us navy", "u.s. navy", "united states navy", "usn",
  "us air force", "u.s. air force", "united states air force", "usaf", "united states marine corps", "us marine corps",
  "defense health agency", "defense health network", "military health system", "department of defense",
  "navy medicine", "army medicine", "army medical corps", "navy medical corps", "air force medical", "uniformed services",
];

/* ------------------------------------------------------------------ */
/*  Military treatment facilities — service + geography               */
/* ------------------------------------------------------------------ */

/**
 * A named base hospital narrows the dod group to its own records PLUS every
 * service entity (people tag "US Navy", not the hospital), and supplies the
 * metro the location clip should use when the user gave none. The facility
 * ids and variants also drive a location-free recall pass: military
 * clinicians rotate every 2-4 years and many never update their location,
 * so a facility-tagged profile in another state is a transfer signal, not
 * noise (Balboa probe, 2026-10-14: 3 of 9 staff surgeons listed other
 * states).
 */
export interface MilitaryFacilityDef {
  label: string;
  /** Lowercase phrases in a query that mean this facility (nicknames first). */
  aliases: string[];
  /** Every Crustdata record for the facility (duplicates are common). */
  company_ids: number[];
  /** Employer-name variants people actually list. */
  name_variants: string[];
  /** Metro for the location clip when the user named only the base. */
  city: string | null;
  state: string | null;
}

export const MILITARY_FACILITIES: Record<string, MilitaryFacilityDef> = {
  nmcsd: {
    label: "Naval Medical Center San Diego (Balboa)",
    aliases: ["balboa", "nmcsd", "naval medical center san diego", "navy medicine readiness and training command san diego", "balboa naval"],
    company_ids: [6518802, 7423349],
    name_variants: ["naval medical center san diego", "naval medical center - san diego", "naval medical center -san diego", "nmcsd", "balboa naval", "naval hospital san diego", "navy medicine readiness and training command san diego"],
    city: "san diego", state: "california",
  },
  walter_reed: {
    label: "Walter Reed National Military Medical Center",
    aliases: ["walter reed", "wrnmmc", "bethesda naval", "national naval medical center"],
    company_ids: [6066156, 2216341],
    name_variants: ["walter reed", "national naval medical center", "wrnmmc"],
    city: "bethesda", state: "maryland",
  },
  bamc: {
    label: "Brooke Army Medical Center",
    aliases: ["brooke army", "bamc", "sammc", "san antonio military medical center"],
    company_ids: [4947246],
    name_variants: ["brooke army medical center", "bamc", "san antonio military medical center", "sammc"],
    city: "san antonio", state: "texas",
  },
  madigan: {
    label: "Madigan Army Medical Center",
    aliases: ["madigan"],
    company_ids: [6355570],
    name_variants: ["madigan"],
    city: "tacoma", state: "washington",
  },
  tripler: {
    label: "Tripler Army Medical Center",
    aliases: ["tripler"],
    company_ids: [6410911],
    name_variants: ["tripler"],
    city: "honolulu", state: "hawaii",
  },
  womack: {
    label: "Womack Army Medical Center",
    aliases: ["womack", "fort bragg", "fort liberty"],
    company_ids: [7446990, 1224616],
    name_variants: ["womack"],
    city: "fayetteville", state: "north carolina",
  },
  evans: {
    label: "Evans Army Community Hospital",
    aliases: ["evans army", "fort carson"],
    company_ids: [7661026],
    name_variants: ["evans army community hospital", "evans army"],
    city: "colorado springs", state: "colorado",
  },
  nmc_portsmouth: {
    label: "Naval Medical Center Portsmouth",
    aliases: ["nmc portsmouth", "portsmouth naval", "naval medical center portsmouth", "nmcp"],
    company_ids: [7223295],
    name_variants: ["naval medical center portsmouth", "nmc portsmouth", "nmcp", "naval hospital portsmouth"],
    city: "portsmouth", state: "virginia",
  },
  nmc_camp_lejeune: {
    label: "Naval Medical Center Camp Lejeune",
    aliases: ["camp lejeune"],
    company_ids: [6797583],
    name_variants: ["camp lejeune"],
    city: "jacksonville", state: "north carolina",
  },
  landstuhl: {
    label: "Landstuhl Regional Medical Center",
    aliases: ["landstuhl"],
    company_ids: [6239042],
    name_variants: ["landstuhl"],
    city: null, state: null,
  },
  eisenhower: {
    label: "Dwight D. Eisenhower Army Medical Center",
    aliases: ["eisenhower army", "fort gordon", "fort eisenhower"],
    company_ids: [],
    name_variants: ["eisenhower army medical center", "eisenhower army"],
    city: "augusta", state: "georgia",
  },
  darnall: {
    label: "Carl R. Darnall Army Medical Center",
    aliases: ["darnall", "fort hood", "fort cavazos"],
    company_ids: [],
    name_variants: ["darnall army medical center", "darnall"],
    city: "killeen", state: "texas",
  },
  wbamc: {
    label: "William Beaumont Army Medical Center",
    aliases: ["william beaumont army", "wbamc", "fort bliss"],
    company_ids: [],
    name_variants: ["william beaumont army medical center", "wbamc"],
    city: "el paso", state: "texas",
  },
  keller: {
    label: "Keller Army Community Hospital",
    aliases: ["keller army", "west point hospital"],
    company_ids: [2004532],
    name_variants: ["keller army community hospital", "keller army"],
    city: "west point", state: "new york",
  },
  martin: {
    label: "Martin Army Community Hospital",
    aliases: ["martin army", "fort benning", "fort moore"],
    company_ids: [6584223],
    name_variants: ["martin army community hospital", "martin army"],
    city: "columbus", state: "georgia",
  },
  winn: {
    label: "Winn Army Community Hospital",
    aliases: ["winn army", "fort stewart"],
    company_ids: [6286319],
    name_variants: ["winn army community hospital", "winn army"],
    city: "hinesville", state: "georgia",
  },
  blanchfield: {
    label: "Blanchfield Army Community Hospital",
    aliases: ["blanchfield", "fort campbell"],
    company_ids: [8177843],
    name_variants: ["blanchfield"],
    city: "clarksville", state: "tennessee",
  },
  fort_belvoir: {
    label: "Fort Belvoir Community Hospital",
    aliases: ["fort belvoir community hospital", "fort belvoir"],
    company_ids: [],
    name_variants: ["fort belvoir community hospital", "fort belvoir"],
    city: "fort belvoir", state: "virginia",
  },
  wright_patterson: {
    label: "Wright-Patterson Medical Center",
    aliases: ["wright-patterson medical", "wright patterson medical", "wright-patterson", "wright patterson", "88th medical group"],
    company_ids: [21232352],
    name_variants: ["wright-patterson medical center", "wright patterson medical center", "wright-patterson", "wright patterson", "88th medical group"],
    city: "dayton", state: "ohio",
  },
  david_grant: {
    label: "David Grant Medical Center (Travis AFB)",
    aliases: ["david grant medical", "david grant", "travis afb", "travis air force base", "60th medical group"],
    company_ids: [7790094, 13873681],
    name_variants: ["david grant medical center", "david grant", "60th medical group", "travis air force base"],
    city: "fairfield", state: "california",
  },
  keesler: {
    label: "Keesler Medical Center",
    aliases: ["keesler medical", "keesler", "81st medical group"],
    company_ids: [],
    name_variants: ["keesler medical center", "keesler", "81st medical group"],
    city: "biloxi", state: "mississippi",
  },
  ocallaghan: {
    label: "Mike O'Callaghan Military Medical Center (Nellis AFB)",
    aliases: ["mike o'callaghan", "o'callaghan", "nellis", "99th medical group"],
    company_ids: [],
    name_variants: ["o'callaghan", "o'callahan", "99th medical group", "nellis air force base"],
    city: "las vegas", state: "nevada",
  },
  usafa: {
    label: "10th Medical Group (Air Force Academy)",
    aliases: ["usafa", "air force academy hospital", "10th medical group"],
    company_ids: [1295078],
    name_variants: ["10th medical group", "usaf academy hospital", "air force academy"],
    city: "colorado springs", state: "colorado",
  },
  naval_hospital_jacksonville: {
    label: "Naval Hospital Jacksonville",
    aliases: ["naval hospital jacksonville", "nh jacksonville"],
    company_ids: [],
    name_variants: ["naval hospital jacksonville"],
    city: "jacksonville", state: "florida",
  },
  naval_hospital_pensacola: {
    label: "Naval Hospital Pensacola",
    aliases: ["naval hospital pensacola"],
    company_ids: [],
    name_variants: ["naval hospital pensacola"],
    city: "pensacola", state: "florida",
  },
  naval_hospital_camp_pendleton: {
    label: "Naval Hospital Camp Pendleton",
    aliases: ["camp pendleton"],
    company_ids: [],
    name_variants: ["camp pendleton"],
    city: "oceanside", state: "california",
  },
  naval_hospital_bremerton: {
    label: "Naval Hospital Bremerton",
    aliases: ["naval hospital bremerton", "bremerton naval"],
    company_ids: [],
    name_variants: ["naval hospital bremerton"],
    city: "bremerton", state: "washington",
  },
};
