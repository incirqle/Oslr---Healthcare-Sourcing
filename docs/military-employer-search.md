# Military and VA physicians — how they list themselves (learned 2026-10-14)

Probed live against Crustdata on Naval Medical Center San Diego ("Balboa",
Bob Wilson Drive, now Navy Medicine Readiness and Training Command San
Diego). The same shape holds for every military treatment facility.

## The two halves

Orthopaedic surgeons and podiatrists tied to Balboa split into two
populations that only overlap by two people:

| How they tag their employer | Rows | Staff surgeons found | Found the other way |
|---|---|---|---|
| The facility ("Naval Medical Center San Diego", "NMCSD", "Naval Medical Center - San Diego") | 20 | 9 (McDonald, Perry, Putko, Waggoner, Kerr, Wheatley, Katsma, Provencher, Smith) + 4 residents | 2 |
| The service ("US Navy", "USN", "U.S. Navy", navy.mil) with a San Diego-area location | 30 | 8 more (Colon-Morillo, Hanley, Vier, Fitzgerald, Wimmer, Hanna, Flint, Gilley) + 3 podiatrists (Hart, Le, Tukuafu) | 2 |

A search by facility name alone returns about half the surgeons and none
of the podiatrists. Podiatrists tag the service, never the hospital.

## Rules the engine has to follow

1. **A military facility is service + geography, not a company name.** When
   a query names Balboa, Walter Reed, Brooke, Madigan, Tripler, Womack,
   Portsmouth, Camp Lejeune, Evans, the employer clause must OR the
   facility's records (all duplicates) with the parent service entity
   (US Navy 1034053, US Army 1040041, US Air Force 1100685, Defense Health
   Agency 1257916 / 3083301, their .mil domains) and let the location
   filter do the facility's work.
2. **Nicknames are first-class aliases.** "Balboa" = NMCSD; "Bethesda" and
   "Walter Reed" = WRNMMC; "BAMC" / "SAMMC" = Brooke; "Madigan" = Joint
   Base Lewis-McChord; "Tripler" = Honolulu; "Womack" = Fort Bragg /
   Liberty; "Portsmouth" = NMC Portsmouth; "Landstuhl". Official names
   changed in 2019-2023 (Navy Medicine Readiness and Training Command X)
   and almost nobody uses them on a profile.
3. **Crustdata holds duplicate company records per facility.** NMCSD has at
   least two (6518802, 7423349), Womack two (7446990, 1224616), Walter Reed
   two (6066156 WRNMMC, 2216341 WRAMC). Every group carries all of them.
4. **Location is a signal, not a filter, for military clinicians.** They
   rotate every 2-4 years and many never update. Of the 9 facility-tagged
   staff surgeons, 3 list another state (Katsma: Norfolk; Wheatley: New
   Orleans; Cully, a PA: Silver Spring) and are likely transferred; 1
   service-tagged surgeon lists San Diego but his headline says Okinawa.
   A hard state clip drops the first kind and keeps the second. The right
   behaviour: keep the facility-tagged rows whatever their location and
   mark "lists another location, likely transferred"; for service-tagged
   rows use the location clip, and let the grader read the headline.
5. **Stale profiles are common.** Provencher left the Navy years ago;
   Smith is now at UC San Diego Health but still lists NMCSD as a current
   employer. The grader must weigh the newest employer over the facility
   match, and the UI should show the full current-employer list.
6. **Residents and support staff are half the hits.** The existing
   training-stage criterion handles "resident"; the surgeon role gate cuts
   technicians, corpsmen, nurse coordinators and PAs. Do not loosen it for
   military searches.
7. **The most reliable cross-check is outside Crustdata**: the facility's
   own department pages and residency faculty roster. Treat LinkedIn-sourced
   duty stations as unconfirmed until a human checks.

## What was built (2026-10-14, commit after this doc)

- `employer-groups.ts`: `dod` group (every service entity, DHA, MHS, USU,
  every base-hospital record including duplicates, the .mil domains, the
  service-name variants, the enumerated Air Force "Nth Medical Group"
  clinics); `guard_reserve` group (Reserve and Guard entities, names and
  titles only — never the Air Force's afreserve.com / goang.com domains,
  never the bare "national guard" variant); `ihs` group; the VA group gains
  the measured variants and seven more facility records.
- `MILITARY_FACILITIES`: 27 bases with nicknames, every Crustdata record,
  the employer-name variants people list, and the metro. A named base
  becomes its own records + every service entity, clipped to the base's
  metro when the user gave no location.
- `handler.ts`: a location-free facility recall pass (up to 50 rows) pulls
  facility-tagged profiles in other states; `annotateFacilityLocation`
  attaches "lists Norfolk, Virginia; facility-tagged, likely transferred"
  instead of dropping them.
- `military-affiliation.ts`: active / reserve / likely_reserve / veteran per
  row; a DoD ask sets Guard, Reserve and civilian-primary rows aside with
  the evidence, a Guard/Reserve ask sets active-only rows aside; the thin
  "Surgeon at US Army" shells are set aside under either military ask. The
  foreign traps (Saudi National Guard, Australian Army Reserve, Royal Navy)
  never read as military.
- Parser: rules and examples for "DoD", "military", "active duty", a base
  nickname, "reservist" / "Guard"; the deterministic fallback maps the same
  words. Grader: a MILITARY AND VA rule plus "military affiliation" and
  "location note" profile lines.
- UI: an Active duty / Guard-Reserve / Veteran tag on the row, the transfer
  note under the location, and the set-aside line names the new buckets.
- Tests: 19 new (military-affiliation.test.ts), including the Balboa and
  Colorado known answers.

## Still open

- Civilian-primary detection is a name heuristic (hospital / health /
  medical / clinic / ortho / surg …). A reservist whose civilian employer
  has an opaque name ("Tenaya") reads as active. The grader sees the full
  employer list and the rule tells it to weigh the newest employer.
- Podiatrists at branch clinics (Camp Pendleton, North Island) list "US
  Navy" with a San Diego address; the metro clip keeps them, the facility
  cannot be confirmed from the profile.
