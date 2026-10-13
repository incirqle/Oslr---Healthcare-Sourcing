---
name: Geography search behavior
description: City asks are state-clipped 15mi circles; thin markets widen to 50mi, labelled; regions come from the gazetteer
type: feature
---
- The search engine is the Crustdata v2 clinician engine in `supabase/functions/_shared/clinician-engine/`. There is no other people-data provider.
- A city ask is `state =` AND (`city =` OR full-location contains OR a 15 mi geo circle around "city, state") — see `build-clinician-query.ts`.
- When a city ask returns fewer than 25 people, the circle widens to 50 mi, the widening is labelled in `relaxed[]`, and the core city still ranks first (`handler.ts`, thin-city block).
- Regional phrases (South Florida, Bay Area, DMV, New England…) map through `SUB_STATE_REGIONS` / `MULTI_STATE_REGIONS` in `clinician-criteria.ts`; a typed city always beats a parser-volunteered region.
- The response carries `geo_scope` (requested city/state, whether geography was widened); the search page shows a banner when it was.
