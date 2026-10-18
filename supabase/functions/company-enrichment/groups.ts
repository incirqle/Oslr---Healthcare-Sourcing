/**
 * groups.ts: the people groups a user can preview and pull for a company,
 * and the /person/search filters behind them. Pure: no I/O (groups.test.ts).
 *
 * The flow (decided 2026-10-18): opening a company shows base data only.
 * Each group then gets a preview count (a 1-row query: 0.03 credits, the
 * API's total_count is the count). The user checks the groups they want
 * and pulls them, paying per profile returned (0.03 credits each), 50 at a
 * time. Nothing in a group is paid for until someone asks for it.
 *
 * Every filter keeps the company match and the title match inside ONE AND
 * group per arm, so both land on the same current job entry. Verified live
 * 2026-10-18 on Dallas Plastic Surgery Institute: the doctors filter
 * returned the 10 surgeons who list the practice and excluded a surgeon
 * whose only entry there is a 2018 fellowship title.
 */

import type { EntityMatcher } from "./matching.ts";

export type PullGroup = "doctors" | "trainees" | "apps" | "nurses" | "clinical" | "executive" | "admin";

export const PULL_GROUPS: readonly PullGroup[] = ["doctors", "trainees", "apps", "nurses", "clinical", "executive", "admin"];

export interface GroupDef {
  label: string;
  /** One line under the label in the picker. */
  hint: string;
  /** Whole-word title phrases ([.]); any one matches. */
  any: string[];
  /** Title substrings that rule a row out ((!)), applied to the same entry. */
  not: string[];
}

export const GROUP_DEFS: Record<PullGroup, GroupDef> = {
  doctors: {
    label: "Doctors",
    hint: "Physicians and surgeons, MD and DO",
    any: [
      "surgeon", "physician", "medical doctor", "doctor", "attending", "hospitalist", "medical director",
      "anesthesiologist", "cardiologist", "radiologist", "dermatologist", "neurologist", "urologist",
      "oncologist", "gastroenterologist", "pulmonologist", "nephrologist", "endocrinologist",
      "rheumatologist", "ophthalmologist", "psychiatrist", "pediatrician", "internist", "intensivist",
      "neonatologist", "obstetrician", "gynecologist", "orthopedist", "orthopaedist", "podiatrist",
      "otolaryngologist", "pathologist", "physiatrist",
    ],
    not: [
      "assistant", "associate", "liaison", "recruit", "sourcing", "scribe", "student", "technologist",
      "coordinator", "navigator", "resident", "fellow", "physical therap", "relations",
    ],
  },
  trainees: {
    label: "Residents and fellows",
    hint: "Current residents and fellows",
    any: ["resident physician", "resident", "fellow", "fellowship", "chief resident"],
    not: ["pharmacy", "research fellow", "program", "coordinator", "manager", "summer", "student", "fellow of"],
  },
  apps: {
    label: "PAs, NPs and CRNAs",
    hint: "Physician assistants, nurse practitioners, nurse anesthetists",
    any: [
      "physician assistant", "physician associate", "pa-c", "nurse practitioner", "aprn", "fnp", "np",
      "advanced practice", "crna", "nurse anesthetist",
    ],
    not: ["student", "recruit", "liaison"],
  },
  nurses: {
    label: "Nurses",
    hint: "RNs, LPNs, OR and PACU nurses",
    any: ["registered nurse", "rn", "nurse", "lpn", "lvn", "bsn", "rnfa", "cnor", "circulator", "circulating"],
    not: ["practitioner", "anesthetist", "student", "assistant", "recruit"],
  },
  clinical: {
    label: "Clinical staff",
    hint: "Medical assistants, surgical techs, therapists, athletic trainers",
    any: [
      "medical assistant", "cma", "surgical tech", "surgical technologist", "surgical assistant", "scrub",
      "technician", "technologist", "physical therapist", "occupational therapist", "athletic trainer",
      "hand therapist", "therapist", "sonographer", "x-ray", "radiologic", "phlebotomist", "scribe",
      "patient care tech", "esthetician", "aesthetician",
    ],
    not: ["student", "pharmacy", "recruit", "intern"],
  },
  executive: {
    label: "Executive staff",
    hint: "Owners, partners, C-suite, practice administrators",
    any: [
      "ceo", "chief executive", "coo", "chief operating", "cfo", "chief financial", "chief", "president",
      "vice president", "executive director", "administrator", "owner", "founder", "managing partner",
    ],
    not: ["assistant", "student", "intern"],
  },
  admin: {
    label: "Admin and front office",
    hint: "Managers, coordinators, front desk, billing, scheduling",
    any: [
      "manager", "coordinator", "front desk", "receptionist", "scheduler", "billing", "biller", "coder",
      "office", "credentialing", "insurance", "patient services", "patient access", "secretary",
      "accounting", "marketing", "human resources", "specialist", "representative",
    ],
    not: ["nurse", "physician", "surgeon", "medical assistant", "student", "intern"],
  },
};

/** Profiles returned per pull page. 50 × 0.03 = 1.5 credits a page at most. */
export const PULL_PAGE_SIZE = 50;

const CUR = "experience.employment_details.current";

// deno-lint-ignore no-explicit-any
type Filter = any;

/**
 * Current job at the company AND a title in the group, on the same entry.
 * Two arms when the company has a usable written name: linked by id, or
 * named with the page unlinked (most staff at private practices).
 * `specialty` narrows doctors and trainees ("orthopaedic", "spine").
 */
export function groupFilter(m: EntityMatcher, group: PullGroup, specialty?: string | null): Filter {
  const def = GROUP_DEFS[group];
  const titles: Filter[] = [
    { op: "or", conditions: def.any.map((v) => ({ field: `${CUR}.title`, type: "[.]", value: v })) },
    ...def.not.map((v) => ({ field: `${CUR}.title`, type: "(!)", value: v })),
  ];
  const spec = specialty?.trim();
  if (spec) titles.push({ field: `${CUR}.title`, type: "(.)", value: spec });
  const byId = { op: "and", conditions: [{ field: `${CUR}.company_id`, type: "in", value: [...m.ids] }, ...titles] };
  if (!m.phrase) return byId;
  const byName = { op: "and", conditions: [{ field: `${CUR}.company_name`, type: "[.]", value: m.phrase }, ...titles] };
  return { op: "or", conditions: [byId, byName] };
}

/** Movement over the window: who started a job here, who ended one here and no longer works here. */
export function movementFilters(m: EntityMatcher, since: string): { hires: Filter; departures: Filter } {
  const arm = (base: string, extra: Filter[]) => {
    const byId = { op: "and", conditions: [{ field: `${base}.company_id`, type: "in", value: [...m.ids] }, ...extra] };
    if (!m.phrase) return byId;
    return { op: "or", conditions: [byId, { op: "and", conditions: [{ field: `${base}.company_name`, type: "[.]", value: m.phrase }, ...extra] }] };
  };
  return {
    hires: arm(CUR, [{ field: `${CUR}.start_date`, type: "=>", value: since }]),
    departures: {
      op: "and",
      conditions: [
        arm("experience.employment_details", [{ field: "experience.employment_details.end_date", type: "=>", value: since }]),
        { field: `${CUR}.company_id`, type: "not_in", value: [...m.ids] },
      ],
    },
  };
}

export function isPullGroup(v: unknown): v is PullGroup {
  return typeof v === "string" && (PULL_GROUPS as readonly string[]).includes(v);
}
