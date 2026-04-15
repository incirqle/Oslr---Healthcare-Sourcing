---
name: Geography search fix
description: Small/resort towns search locally first, no metro injection; cascade only at total < 2
type: feature
---
- Small/resort towns (Vail, Aspen, etc.) are NOT mapped to metros in CITY_TO_METRO
- Only major metro cities get metro clause injection in buildPDLQuery
- Default radius for non-metro cities is 15mi (was 50mi)
- Cascade triggers only when total < 2 (was results.length < 3)
- applyStep uses isLocationClause() to properly replace nested location bool blocks
- Response includes geo_scope metadata: requested_city, requested_state, geo_expanded, effective_scope
- Frontend shows amber banner when geo expansion occurred
