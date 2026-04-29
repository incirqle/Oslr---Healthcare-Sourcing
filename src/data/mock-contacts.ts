// Mock contact data for the global Contacts database UI.
// Replace with real Supabase-backed hook in a follow-up pass.

export interface MockExperience {
  company: string;
  companyLogo?: string;
  role: string;
  startDate: string; // "Jun 2022"
  endDate: string | "Present";
  duration: string; // "3 yrs 10 mos"
  location?: string;
  salary?: string;
  fundingStage?: string;
  description?: string;
}

export interface MockEducation {
  school: string;
  schoolLogo?: string;
  degree: string;
  major?: string;
  startYear: number;
  endYear: number;
}

export interface MockContact {
  id: string;
  fullName: string;
  currentRole: string;
  organization: string;
  organizationLogo?: string;
  education: string;
  educationLogo?: string;
  location: string;
  dateCreated: string; // ISO
  status: "New" | "Shortlisted" | "Email Sent" | "Replied" | "Hired" | "Rejected";
  subStatus?: string;
  projects: string[];
  tags: string[];
  profiles: {
    linkedin?: string;
    email?: string;
    emailVerified?: boolean;
    phone?: string;
    crunchbase?: string;
    twitter?: string;
  };
  experience: MockExperience[];
  educationList: MockEducation[];
  skills: string[];
  totalYears: number;
  avgTenureYears: number;
  lastContactedAt?: string;
}

const FIRST = ["Sarah", "Michael", "Priya", "James", "Aisha", "David", "Emma", "Carlos", "Lina", "Noah", "Olivia", "Ethan", "Sofia", "Liam", "Maya", "Ben", "Zara", "Henry", "Chloe", "Marcus"];
const LAST = ["Patel", "Chen", "Okafor", "Williams", "Garcia", "Kim", "Johnson", "Singh", "Rossi", "Andersen", "Nakamura", "Brown", "Müller", "Tanaka", "Costa", "Hassan", "Lopez", "Schmidt", "Murphy", "Reyes"];
const ROLES = ["Pediatrician", "Registered Nurse", "Cardiologist", "Nurse Practitioner", "Anesthesiologist", "Physical Therapist", "Emergency Physician", "Family Medicine MD", "Surgical Technologist", "ICU Nurse", "Oncologist", "Radiologist"];
const ORGS = [
  { name: "Mayo Clinic", logo: "https://logo.clearbit.com/mayoclinic.org" },
  { name: "Cleveland Clinic", logo: "https://logo.clearbit.com/clevelandclinic.org" },
  { name: "Johns Hopkins", logo: "https://logo.clearbit.com/hopkinsmedicine.org" },
  { name: "Kaiser Permanente", logo: "https://logo.clearbit.com/kp.org" },
  { name: "NYU Langone", logo: "https://logo.clearbit.com/nyulangone.org" },
  { name: "Mass General Brigham", logo: "https://logo.clearbit.com/massgeneralbrigham.org" },
  { name: "UCSF Health", logo: "https://logo.clearbit.com/ucsf.edu" },
  { name: "Stanford Health Care", logo: "https://logo.clearbit.com/stanfordhealthcare.org" },
];
const SCHOOLS = [
  { name: "Harvard Medical School", logo: "https://logo.clearbit.com/harvard.edu" },
  { name: "Stanford University", logo: "https://logo.clearbit.com/stanford.edu" },
  { name: "Johns Hopkins University", logo: "https://logo.clearbit.com/jhu.edu" },
  { name: "Yale School of Medicine", logo: "https://logo.clearbit.com/yale.edu" },
  { name: "UCSF School of Medicine", logo: "https://logo.clearbit.com/ucsf.edu" },
  { name: "Columbia University", logo: "https://logo.clearbit.com/columbia.edu" },
];
const LOCATIONS = ["Boston, MA", "San Francisco, CA", "New York, NY", "Chicago, IL", "Seattle, WA", "Austin, TX", "Atlanta, GA", "Denver, CO", "Miami, FL", "Portland, OR"];
const PROJECTS_POOL = ["NICU Nurses Q2", "Cardiology Fellows", "ER Physicians — Texas", "Pediatric Hires", "Telehealth Roll-out"];
const TAGS_POOL = ["High Priority", "Warm", "Referral", "Bilingual", "Open to Relocate", "Top Candidate", "Follow Up"];
const SKILLS_POOL = ["BLS", "ACLS", "PALS", "EMR (Epic)", "Triage", "Patient Education", "Critical Care", "Telemetry", "Wound Care", "IV Therapy", "Pediatrics", "Neonatal Care"];
const STATUSES: MockContact["status"][] = ["New", "Shortlisted", "Email Sent", "Replied", "Hired"];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function pickN<T>(arr: T[], n: number, seed: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[(seed + i * 3) % arr.length]);
  return Array.from(new Set(out));
}

function makeContact(i: number): MockContact {
  const first = pick(FIRST, i);
  const last = pick(LAST, i * 7 + 3);
  const role = pick(ROLES, i * 2);
  const org = pick(ORGS, i);
  const school = pick(SCHOOLS, i * 5);
  const loc = pick(LOCATIONS, i * 3);
  const status = pick(STATUSES, i);
  const projects = pickN(PROJECTS_POOL, (i % 4), i);
  const tags = pickN(TAGS_POOL, (i % 3), i * 2);
  const skills = pickN(SKILLS_POOL, 4 + (i % 4), i);

  const date = new Date(2026, (i % 12), 1 + (i % 27));
  const lastContacted = status !== "New"
    ? new Date(2026, ((i + 2) % 12), 1 + (i % 27)).toISOString()
    : undefined;

  const exp2 = pick(ORGS, i + 1);
  const exp3 = pick(ORGS, i + 2);

  return {
    id: `mock-${i + 1}`,
    fullName: `${first} ${last}`,
    currentRole: role,
    organization: org.name,
    organizationLogo: org.logo,
    education: school.name,
    educationLogo: school.logo,
    location: loc,
    dateCreated: date.toISOString(),
    status,
    subStatus: status === "Email Sent" ? "Awaiting Reply" : status === "Replied" ? "Positive" : undefined,
    projects,
    tags,
    profiles: {
      linkedin: `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${org.name.toLowerCase().replace(/[^a-z]/g, "")}.org`,
      emailVerified: i % 3 !== 0,
      phone: i % 4 === 0 ? `+1 (555) ${String(100 + i).padStart(3, "0")}-${String(1000 + i * 7).slice(-4)}` : undefined,
      crunchbase: i % 5 === 0 ? `https://crunchbase.com/person/${first.toLowerCase()}-${last.toLowerCase()}` : undefined,
      twitter: i % 6 === 0 ? `https://x.com/${first.toLowerCase()}${last.toLowerCase()}` : undefined,
    },
    experience: [
      {
        company: org.name,
        companyLogo: org.logo,
        role,
        startDate: "Jun 2022",
        endDate: "Present",
        duration: "3 yrs 10 mos",
        location: loc,
        salary: "$220,000 - $400,000",
        fundingStage: "Employed during Series A",
        description: `Lead clinician on the ${role.toLowerCase()} team. Mentors residents, coordinates with multidisciplinary teams, and drives quality-improvement initiatives across the unit.`,
      },
      {
        company: exp2.name,
        companyLogo: exp2.logo,
        role: "Senior Clinical Lead",
        startDate: "Aug 2018",
        endDate: "May 2022",
        duration: "3 yrs 10 mos",
        location: pick(LOCATIONS, i + 4),
        description: "Managed a 12-person clinical team across two campuses.",
      },
      {
        company: exp3.name,
        companyLogo: exp3.logo,
        role: "Resident",
        startDate: "Jul 2014",
        endDate: "Jul 2018",
        duration: "4 yrs",
        location: pick(LOCATIONS, i + 5),
        description: "Completed residency program with rotations in ICU, ER, and pediatrics.",
      },
    ],
    educationList: [
      {
        school: school.name,
        schoolLogo: school.logo,
        degree: "MD",
        major: "Internal Medicine",
        startYear: 2010,
        endYear: 2014,
      },
      {
        school: pick(SCHOOLS, i + 2).name,
        schoolLogo: pick(SCHOOLS, i + 2).logo,
        degree: "BSc",
        major: "Biology",
        startYear: 2006,
        endYear: 2010,
      },
    ],
    skills,
    totalYears: 8 + (i % 12),
    avgTenureYears: 2 + (i % 4),
    lastContactedAt: lastContacted,
  };
}

export const MOCK_CONTACTS: MockContact[] = Array.from({ length: 137 }, (_, i) => makeContact(i));

export const ALL_TAGS = TAGS_POOL;
export const ALL_PROJECTS = PROJECTS_POOL;
export const ALL_STATUSES = STATUSES;
