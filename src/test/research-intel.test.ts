import { describe, expect, it } from "vitest";
import {
  clinicalTrialsNameQuery,
  doctorIntelCacheComplete,
  extractClinicalTrials,
  personNameMatches,
} from "../../supabase/functions/doctor-intel/research";
import { hasUsableProfileEnrichment, withoutDeniedFields } from "../../supabase/functions/search-people/profile-quality";
import { hasUsableProfileEnrichment as hasUsableStoredEnrichment } from "@/lib/profile-enrichment";

const trialPayload = {
  studies: [{
    protocolSection: {
      identificationModule: { nctId: "NCT05329584", briefTitle: "InSpace Accelerated Rehabilitation Study" },
      statusModule: { overallStatus: "RECRUITING", startDateStruct: { date: "2022-02-07" } },
      sponsorCollaboratorsModule: { leadSponsor: { name: "Stryker Endoscopy" } },
      designModule: { phases: ["NA"] },
      contactsLocationsModule: {
        overallOfficials: [{ name: "Colleen Roden, MS", role: "STUDY_DIRECTOR" }],
        locations: [{ state: "New York", contacts: [
          { name: "Anthony Finocchiaro", role: "CONTACT" },
          { name: "Michael Fu, MD", role: "SUB_INVESTIGATOR" },
        ] }],
      },
    },
  }],
};

describe("doctor research matching", () => {
  it("searches both overall officials and site investigators", () => {
    const query = clinicalTrialsNameQuery("Michael", "Fu");
    expect(query).toContain('AREA[OverallOfficialName]"Michael Fu"');
    expect(query).toContain('AREA[LocationContactName]"Michael Fu"');
  });

  it("matches full registry names without accepting a surname collision", () => {
    expect(personNameMatches("Michael", "Fu", "Michael Fu, MD")).toBe(true);
    expect(personNameMatches("Michael", "Fu", "Fu, Michael")).toBe(true);
    expect(personNameMatches("Michael", "Fu", "Michael C Fu, Professor")).toBe(true);
    expect(personNameMatches("Michael", "Fu", "Michael Fuentes, MD")).toBe(false);
    expect(personNameMatches("Michael", "Fu", "Daniel Fu, MD")).toBe(false);
  });

  it("includes a doctor listed as a site sub-investigator and keeps their role", () => {
    const result = extractClinicalTrials(trialPayload, { first: "Michael", last: "Fu", state: "NY" }, "new york");
    expect(result.count).toBe(1);
    expect(result.studies[0].nctId).toBe("NCT05329584");
    expect(result.studies[0].role).toBe("Sub-investigator");
  });

  it("includes study chairs and directors, not only principal investigators", () => {
    const payload = structuredClone(trialPayload);
    payload.studies[0].protocolSection.contactsLocationsModule.overallOfficials = [
      { name: "Michael Fu, MD", role: "STUDY_CHAIR" },
    ];
    payload.studies[0].protocolSection.contactsLocationsModule.locations = [];
    const result = extractClinicalTrials(payload, { first: "Michael", last: "Fu" });
    expect(result.count).toBe(1);
    expect(result.studies[0].role).toBe("Study chair");
  });

  it("does not save a partial research response when PubMed failed", () => {
    expect(doctorIntelCacheComplete({ npi: { npi: null }, publications: null, trials: { count: 0 }, payments: null })).toBe(false);
    expect(doctorIntelCacheComplete({ npi: { npi: null }, publications: { count: 0 }, trials: { count: 0 }, payments: null })).toBe(true);
  });
});

describe("profile enrichment cache quality", () => {
  const blank = { full_name: "", summary: "", experience: [], education: [], skills: [], certifications: [], research_profile: null };

  it("rejects blank profile shells on the server and in the browser", () => {
    expect(hasUsableProfileEnrichment(blank)).toBe(false);
    expect(hasUsableStoredEnrichment(blank)).toBe(false);
  });

  it("keeps a real academic research match", () => {
    const enriched = { ...blank, research_profile: { profile_url: "https://example.org/author", article_count: 12 } };
    expect(hasUsableProfileEnrichment(enriched)).toBe(true);
    expect(hasUsableStoredEnrichment(enriched)).toBe(true);
  });

  it("removes only rejected field sections and preserves available research", () => {
    const fields = ["basic_profile.name", "honors", "certifications", "research_profiles"];
    expect(withoutDeniedFields(fields, ["honors", "certifications"])).toEqual(["basic_profile.name", "research_profiles"]);
    expect(withoutDeniedFields(fields, ["research_profiles.profile_url"])).toEqual(["basic_profile.name", "honors", "certifications"]);
  });
});
