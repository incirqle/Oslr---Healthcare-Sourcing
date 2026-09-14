/**
 * specialty-companies.ts — the company-graph half of deep specialty recall,
 * inverted for healthcare (blueprint §12.1, §13).
 *
 * "Nurses at cardiac hospitals", "PGY-3s at podiatric residency programs":
 * the specialty is a statement about the EMPLOYER that the person rarely
 * repeats. Care-delivery organisations and residency programs declare their
 * specialities on their own company pages — so specialty → companies that
 * declare it → their current people, under the same non-specialty hard
 * constraints. Present-tense by construction (current employees), which is
 * why this pass survives the tense doctrine untouched (blueprint §5.4).
 *
 * The reference restricted the graph to device MANUFACTURERS; Oslr targets
 * the inverse population: hospitals, health systems, practices, and the
 * education/residency side.
 */

import { companySearchV2 } from "./lib/crustdata-v2.ts";
import { connectorVariants } from "./build-clinician-query.ts";

export const SPECIALTY_COMPANY_LIMIT = 100;

/** Care-delivery + training-program industry tags. */
const CARE_DELIVERY_INDUSTRIES = [
  "Hospitals and Health Care",
  "Medical Practices",
  "Mental Health Care",
  "Home Health Care Services",
  "Higher Education",
];

const memo = new Map<string, number[]>();

export async function resolveSpecialtyCompanyIds(
  terms: readonly string[],
): Promise<number[]> {
  const key = [...terms].map((t) => t.toLowerCase().trim()).sort().join("|");
  if (!key) return [];
  const cached = memo.get(key);
  if (cached) return cached;

  const variants = [...new Set(terms.flatMap((t) => connectorVariants(t)))];
  const r = await companySearchV2({
    filters: {
      op: "and",
      conditions: [
        {
          op: "or",
          conditions: variants.map((v) => ({
            field: "taxonomy.professional_network_specialities",
            type: "(.)",
            value: v,
          })),
        },
        {
          field: "taxonomy.professional_network_industry",
          type: "in",
          value: CARE_DELIVERY_INDUSTRIES,
        },
      ],
    },
    limit: SPECIALTY_COMPANY_LIMIT,
  });

  if (!r.ok) {
    console.warn(`[specialty-companies] company search declined (${r.status}) — graph pass skipped`);
    return [];
  }
  const ids = r.data.map((h) => h.company_id);
  memo.set(key, ids);
  console.log(JSON.stringify({ event: "specialty_companies", specialty: key, companies: ids.length }));
  return ids;
}
