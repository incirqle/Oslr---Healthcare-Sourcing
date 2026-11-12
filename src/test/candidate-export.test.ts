import { describe, expect, it } from "vitest";
import { buildCandidatesCsv, buildLinkedInRecruiterCsv } from "@/lib/export-csv";
import { toDossier, type AnyCandidate } from "@/lib/candidate-export-adapter";

const people = [
  {
    id: "1", full_name: "Ada Lovelace", title: "Orthopedic Surgeon",
    current_employer: "UCHealth", location: "Denver, CO", email: "ada@example.org",
    phone: "303-555-0100", linkedin_url: "https://linkedin.com/in/ada", skills: ["Sports Medicine"],
  },
  {
    id: "2", full_name: "Grace Hopper", title: "Cardiologist",
    current_employer: "Example Health", location: "Boulder, CO", email: "grace@example.org",
    phone: "303-555-0101", linkedin_url: "https://linkedin.com/in/grace", skills: [],
  },
] as unknown as AnyCandidate[];

describe("candidate exports", () => {
  it("exports only the selected people when given a selection", () => {
    const selected = [people[1]];
    const csv = buildCandidatesCsv(selected);
    expect(csv).toContain("Grace");
    expect(csv).not.toContain("Ada");
    expect(csv.trim().split("\n")).toHaveLength(2);
  });

  it("removes email, verification and phone columns when contact details are excluded", () => {
    const csv = buildCandidatesCsv(people, { includeContactInfo: false });
    expect(csv).not.toContain("Personal Email");
    expect(csv).not.toContain("Work Email");
    expect(csv).not.toContain("Phone Numbers");
    expect(csv).not.toContain("ada@example.org");
    expect(csv).not.toContain("303-555-0100");
    expect(csv).toContain("LinkedIn");
    expect(csv).toContain("Orthopedic Surgeon");
  });

  it("creates a simplified LinkedIn Recruiter file", () => {
    const csv = buildLinkedInRecruiterCsv([people[0]]);
    expect(csv.split("\n")[0]).toBe("First Name,Last Name,LinkedIn Profile URL,Email Address,Current Job Title,Current Company,Location");
    expect(csv).toContain("https://linkedin.com/in/ada");
    expect(csv).toContain("ada@example.org");
  });

  it("uses saved enrichment, registry and research data without another lookup", () => {
    const [candidate] = people;
    const saved = {
      ...candidate,
      raw: {
        enriched: {
          work_email: "ada@uchealth.org",
          personal_emails: ["ada.personal@example.org"],
          phone_numbers: ["303-555-0199"],
          inferred_years_experience: 14,
          experience: [{ title: { name: "Sports Medicine Physician" }, company: { name: "UCHealth" }, start_date: "2018-01", end_date: null, is_primary: true }],
          education: [{ school: { name: "Example Medical School" }, degrees: ["MD"], majors: ["Medicine"], start_date: "2004", end_date: "2008" }],
          research_profile: {
            designation: "Associate Professor", organisation: "Example University", interests: ["Cartilage repair"],
            article_count: 27, citations: 840, h_index: 12, i10_index: 16, co_author_count: 61,
            top_articles: [{ title: "Cartilage repair outcomes", publication: "Example Journal", year: "2025", citations: 44, url: "https://example.org/article" }],
          },
        },
        doctor_intel: { npi: { npi: "1234567890", specialty: "Orthopedic Surgery" } },
      },
    } as unknown as AnyCandidate;
    const dossier = toDossier(saved);
    expect(dossier.workEmail).toBe("ada@uchealth.org");
    expect(dossier.personalEmail).toBe("ada.personal@example.org");
    expect(dossier.npi).toBe("1234567890");
    expect(dossier.yearsExperience).toBe("14 years");
    expect(dossier.education[0].school).toBe("Example Medical School");
    expect(dossier.research?.articleCount).toBe(27);
    expect(dossier.research?.topArticles[0].title).toBe("Cartilage repair outcomes");
  });

  it("neutralizes spreadsheet formulas in every CSV format", () => {
    const malicious = [{ ...people[0], full_name: "=HYPERLINK(\"https://invalid.example\")" }] as unknown as AnyCandidate[];
    expect(buildCandidatesCsv(malicious)).toContain("'=HYPERLINK");
    expect(buildLinkedInRecruiterCsv(malicious)).toContain("'=HYPERLINK");
  });
});
