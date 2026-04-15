import type { SalaryPreset } from "@/constants/clinicalSalaryPresets";

export interface PDLSearchQuery {
  bool: {
    must?: object[];
    filter: object[];
  };
}

export function buildClinicalSearchQuery(
  preset: SalaryPreset,
  options: {
    location?: string;
    requireExperience?: boolean;
    additionalFilters?: object[];
  } = {}
): PDLSearchQuery {
  const filters: object[] = [
    { terms: { job_title_class: preset.jobTitleClasses } },
    { term: { location_country: "united states" } },
  ];

  if (preset.salaryBuckets?.length) {
    filters.push({ terms: { inferred_salary: preset.salaryBuckets } });
  }

  if (options.location) {
    filters.push({ term: { location_name: options.location } });
  }

  // Experience filter — opt-in only.
  // WARNING: lowers recall significantly on nursing profiles due to lower fill rate.
  if (options.requireExperience && preset.experienceHint) {
    filters.push({ range: { inferred_years_experience: preset.experienceHint } });
  }

  if (options.additionalFilters?.length) {
    filters.push(...options.additionalFilters);
  }

  return { bool: { filter: filters } };
}

export function buildMultiPresetQuery(
  presets: SalaryPreset[],
  options: Parameters<typeof buildClinicalSearchQuery>[1] = {}
): PDLSearchQuery {
  if (presets.length === 1) {
    return buildClinicalSearchQuery(presets[0], options);
  }

  return {
    bool: {
      filter: [
        { term: { location_country: "united states" } },
        ...(options.location ? [{ term: { location_name: options.location } }] : []),
      ],
      must: [
        {
          bool: {
            should: presets.map((preset) => ({
              bool: {
                filter: [
                  { terms: { job_title_class: preset.jobTitleClasses } },
                  { terms: { inferred_salary: preset.salaryBuckets } },
                ],
              },
            })),
            minimum_should_match: 1,
          },
        },
      ],
    },
  };
}
