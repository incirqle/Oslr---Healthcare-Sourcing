# Employer-group audit — 2026-10-14

## The miss

"Find orthopedic surgeons at Kaiser Permanente in Colorado" (run
`clin_mv7cxsfc_9tlysr`, 00:14 UTC) returned 2 people. Crustdata holds 11
Kaiser-affiliated orthopedic surgeons in Colorado. The 9 we missed all list
their employer as **Colorado Permanente Medical Group (CPMG)**, Crustdata
company 1587372, domain kpphysiciancareers.org. The curated Kaiser group
matched only the domains kaiserpermanente.org / kp.org and the names
"kaiser permanente" / "kaiser foundation", with an **empty company-id
list**. CPMG fails all four.

Verified by live probes (about 4 credits):

| Probe | Rows | Orthopedic surgeons |
|---|---|---|
| Colorado + employer contains "kaiser" + orthopedic title/headline | 21 | 2 |
| Colorado + employer contains "permanente" + orthopedic title/headline | 31 | 11 |
| Production filter + one extra variant "permanente" | 12 | 11 (+1 PA the noise filter removes) |

Location, the surgeon-title gate, and the grader were ruled out: every CPMG
surgeon has state = Colorado and passes the role rules; the replay with the
one extra variant returns all 11.

## Why the resolver could not save it

`employer-resolution.ts` only runs for criteria of kind `company`; a curated
alias goes straight to `employer_group`. And even run by hand:

- `/company/identify "Kaiser Permanente"` returns 25 entities, every one
  named "Kaiser Permanente …"; CPMG is not among them.
- The person-index employer autocomplete is **prefix-only**: "kaiser
  permanente" returns 40 "Kaiser Permanente …" names; "permanente" returns
  names starting with "Permanente" (so TPMG, not CPMG). The harvester also
  refused to probe "permanente" because it is inside the stated name.

Both the curated table and the resolver assumed a system's entities carry
the brand as a name **prefix**. Kaiser breaks that in every region.

## Systems with the same shape (now curated, ids verified via free identify)

Physician group or affiliate entity does not carry the brand:

| System | Entities people actually list |
|---|---|
| Kaiser Permanente | The Permanente Medical Group (N. CA), Southern California PMG, Northwest Permanente, Washington PMG, Southeast PMG (GA), Hawaii PMG, Mid-Atlantic PMG, Colorado PMG, Kaiser Foundation Hospitals |
| Sutter Health | Palo Alto Medical Foundation, Sutter Medical Group, Sutter Gould, Sutter East Bay, Sutter Pacific |
| CommonSpirit Health | Dignity Health, Catholic Health Initiatives, Centura Health (retired brand), Virginia Mason Franciscan, Dignity Health Medical Group / Foundation, CHI St. Joseph (TX) |
| Intermountain Health | SCL Health (merged 2022), Intermountain Medical Center |
| Advocate Health | Advocate Aurora Health, Atrium Health, Aurora Health Care, Atrium Health Wake Forest Baptist, Advocate Medical Group |
| Providence | Providence Health & Services, Swedish (Seattle), St. Joseph Health (CA), Covenant Health (Lubbock), Kadlec, Facey, Pacific Medical Centers |
| UCHealth (Colorado) | University of Colorado Hospital, CU Anschutz School of Medicine, CU Medicine, Memorial Hospital (Colorado Springs), Yampa Valley |
| Corewell Health | Beaumont Health, Spectrum Health (renamed 2022; profiles still carry both) |
| Mass General Brigham | Massachusetts General Hospital, Brigham and Women's, Newton-Wellesley, Partners HealthCare (old name), Spaulding |
| BJC HealthCare | Barnes-Jewish Hospital, Washington University School of Medicine, Washington University Physicians |
| Endeavor Health | NorthShore University HealthSystem, Edward-Elmhurst, Swedish Hospital (Chicago), Northwest Community |
| Prisma Health | Greenville Health System, Palmetto Health |
| Ballad Health | Mountain States Health Alliance, Wellmont |
| HealthPartners | Park Nicollet, Regions Hospital |
| M Health Fairview | Fairview Health Services, University of Minnesota Physicians |
| Froedtert | Medical College of Wisconsin, ThedaCare |
| Trinity Health | Saint Joseph Mercy, IHA, Loyola Medicine, MercyOne, Saint Alphonsus, Mount Carmel, St. Peter's Health Partners, Trinity Health Of New England |
| Ascension | Seton, St. Vincent, Via Christi, Sacred Heart, St. John Providence, Genesys, Borgess, Columbia St. Mary's, Wheaton Franciscan |
| Bon Secours Mercy Health | Bon Secours, Mercy Health (Ohio / Kentucky, mercy.com) |
| AdventHealth | Florida Hospital (old name), Adventist hospitals in Colorado |
| Baylor Scott & White | Scott & White, Baylor University Medical Center, HealthTexas Provider Network |
| Northwell Health | North Shore-LIJ (old name), Lenox Hill, Long Island Jewish, Zucker School of Medicine, Nuvance |
| Brown University Health | Lifespan (renamed 2024), Rhode Island Hospital, Miriam, Hasbro, Brown Physicians |
| NewYork-Presbyterian | Columbia University Irving Medical Center, Weill Cornell Medicine, ColumbiaDoctors |
| NYU Langone | NYU Grossman School of Medicine |
| Montefiore | Albert Einstein College of Medicine |
| NYC Health + Hospitals | Bellevue, Elmhurst, Kings County, Jacobi, Lincoln, Harlem, Woodhull, Coney Island, Metropolitan, Queens |
| Yale New Haven Health | Yale School of Medicine, Yale Medicine |
| Beth Israel Lahey Health | Beth Israel Deaconess, Lahey Hospital & Medical Center |
| Hackensack Meridian Health | Jersey Shore University Medical Center, JFK, John Theurer, Ocean, Riverview |
| Dartmouth Health | Dartmouth-Hitchcock (old name), Geisel School of Medicine |
| Allegheny Health Network | Allegheny General, Highmark Health, West Penn |
| UPMC | University of Pittsburgh Physicians, University of Pittsburgh School of Medicine, PinnacleHealth |
| Penn Medicine | University of Pennsylvania Health System, HUP, Pennsylvania Hospital, Perelman School of Medicine, Lancaster General, Chester County, Princeton, Doylestown |
| Johns Hopkins Medicine | Johns Hopkins Hospital, JHU School of Medicine, All Children's, Sibley, Suburban, Howard County General |
| Northwestern Medicine | Northwestern Memorial Hospital, Feinberg School of Medicine, Lurie Children's |
| UChicago Medicine | University of Chicago Medical Center, University of Chicago, Pritzker, Comer, Ingalls |
| Ohio State Wexner | The Ohio State University, OSU College of Medicine, James Cancer Hospital |
| UC Health (Cincinnati) | University of Cincinnati Medical Center / College of Medicine, West Chester Hospital — NOT UCHealth Colorado |
| Michigan Medicine | University of Michigan Health / Hospital / Medical School, Mott, Sparrow |
| UNC Health | UNC Hospitals, UNC School of Medicine, UNC Rex |
| UCLA, UCSF, UC San Diego, UC Davis, UCI, Keck/USC, Stanford, OHSU, UW Medicine, Utah | the university, the school of medicine, the faculty practice |
| Banner Health, HonorHealth | Banner – University Medicine; Scottsdale Healthcare / John C. Lincoln (old names) |

Recent rebrands where profiles still carry the old name: Beaumont and
Spectrum → Corewell (2022), SCL Health → Intermountain (2022), NorthShore and
Edward-Elmhurst → Endeavor (2024), Lifespan → Brown University Health (2024),
Centura → CommonSpirit / AdventHealth (2023), Dartmouth-Hitchcock → Dartmouth
Health (2022), Greenville Health System + Palmetto → Prisma (2019), Florida
Hospital → AdventHealth (2019), Mountain States + Wellmont → Ballad (2018).

## What changed in the engine

- `employer-groups.ts` (new): the curated table, every group with verified
  Crustdata ids, name variants, domains, and query aliases. 50 groups.
- `clinician-criteria.ts`: the **longest** matching alias across all groups
  wins, so "St. John Providence" is Ascension and "Swedish Hospital" is
  Endeavor while "Swedish Medical Center" is Providence.
- `employer-resolution.ts`: the dynamic resolver (used for employers the
  table does not know) now probes the distinctive tokens inside the stated
  name too, so "sutter health" probes "sutter" and "kaiser permanente"
  probes "permanente"; and brand seeds match in both directions ("UPMC"
  finds the University of Pittsburgh seeds).
- `employer-groups.test.ts` (new): every group must carry ids, aliases and
  variants; no generic hospital word may be a bare alias or variant; the
  disambiguation cases above; and the Kaiser / Colorado known answer: the
  emitted filter carries CPMG's id, the "permanente" variant, and the state.

## Adding a system

1. `/company/identify` the system and each affiliate (free). Keep only the
   large health-related entities; note the ids.
2. Add the group: aliases (what a recruiter types), ids, domains, variants
   (what physicians list). Never a generic word as a bare alias or variant.
3. Add it to the renamed-entities test and, for a system you care about, a
   known-answer probe like the Kaiser one.
