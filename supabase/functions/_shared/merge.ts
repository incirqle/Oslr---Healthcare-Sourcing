// Merge.dev unified ATS and CRM: plan gate, allowed systems, and Oslr candidate mapping.
export type Category = "ats" | "crm";

/** The curated systems Oslr offers. Slugs are Merge integration slugs. */
export const SYSTEMS: Record<string, { name: string; category: Category }> = {
  workday: { name: "Workday", category: "ats" },
  "oracle-taleo": { name: "Oracle Taleo", category: "ats" },
  "ukg-pro-recruiting": { name: "UKG Pro Recruiting", category: "ats" },
  icims: { name: "iCIMS", category: "ats" },
  bullhorn: { name: "Bullhorn", category: "ats" },
  greenhouse: { name: "Greenhouse", category: "ats" },
  smartrecruiters: { name: "SmartRecruiters", category: "ats" },
  lever: { name: "Lever", category: "ats" },
  salesforce: { name: "Salesforce", category: "crm" },
  "microsoft-dynamics-sales": { name: "Microsoft Dynamics 365", category: "crm" },
  hubspot: { name: "HubSpot", category: "crm" },
  pipedrive: { name: "Pipedrive", category: "crm" },
  "zoho-crm": { name: "Zoho CRM", category: "crm" },
};

/** ATS and CRM connections are included on Pro and Enterprise only. */
export function plansAllowIntegrations(plan: string | null | undefined): boolean {
  return plan === "pro" || plan === "enterprise";
}

export type CandidateRow = {
  full_name: string; title: string | null; current_employer: string | null; email: string | null;
  phone: string | null; linkedin_url: string | null; location: string | null;
};

export function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first_name: parts[0] ?? "", last_name: "" };
  return { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] };
}

export function toAtsCandidate(c: CandidateRow) {
  return {
    ...splitName(c.full_name),
    title: c.title ?? undefined,
    company: c.current_employer ?? undefined,
    email_addresses: c.email ? [{ value: c.email, email_address_type: "WORK" }] : [],
    phone_numbers: c.phone ? [{ value: c.phone, phone_number_type: "MOBILE" }] : [],
    urls: c.linkedin_url ? [{ value: c.linkedin_url, url_type: "SOCIAL_MEDIA" }] : [],
    locations: c.location ? [c.location] : [],
    tags: ["Oslr"],
  };
}

export function toCrmContact(c: CandidateRow) {
  return {
    ...splitName(c.full_name),
    email_addresses: c.email ? [{ email_address: c.email, email_address_type: "Work" }] : [],
    phone_numbers: c.phone ? [{ phone_number: c.phone, phone_number_type: "Mobile" }] : [],
    addresses: c.location ? [{ city: c.location }] : [],
  };
}
