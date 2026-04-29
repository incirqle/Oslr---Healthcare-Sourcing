// Mock campaign data — backed in real life by sequences / sequence_steps /
// sequence_enrollments / sequence_step_events. UI never says "sequence".

export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type StepType = "Email" | "Connection Request" | "LinkedIn Message" | "Call";
export type ContactStatus = "Active" | "Paused" | "Completed" | "Bounced";
export type ResponseType =
  | "No response"
  | "Replied"
  | "Interested"
  | "Not interested"
  | "Out of office"
  | "Wrong person";

export interface CampaignStep {
  id: string;
  type: StepType;
  subject?: string;
  body: string;
  fromMailbox: string;
  replyInThread: boolean;
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  businessHoursOnly: boolean;
  timezone: string;
  scheduledAt?: string;
}

export interface CampaignContact {
  id: string;
  fullName: string;
  role: string;
  employer: string;
  step: number; // current step index (1-based)
  status: ContactStatus;
  response: ResponseType;
  opens: number;
  clicks: number;
  engagement: "Low" | "Med" | "High";
  addedBy: string;
  addedByAvatar?: string;
  addedAt: string;
}

export interface MockCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  ownerName: string;
  ownerAvatar?: string;
  createdAt: string;
  steps: CampaignStep[];
  contacts: CampaignContact[];

  // KPI counts
  total: number;
  active: number;
  opened: number;
  clicked: number;
  replied: number;
  interested: number;
  bounced: number;

  // Settings
  useMultipleSenders: boolean;
  newThreadPerSender: boolean;
}

// ---------------------------------------------------------------------------
// Seed pools — healthcare recruiting flavor
// ---------------------------------------------------------------------------

export const MAILBOXES = [
  "steven@oslr.health",
  "hello@oslr.health",
];

const OWNERS = [
  { name: "Steven Flutie-Davis" },
  { name: "Priya Patel" },
  { name: "Marcus Reyes" },
  { name: "Aisha Okafor" },
];

const FIRSTS = [
  "Sarah", "Michael", "Priya", "James", "Aisha", "David", "Emma", "Carlos",
  "Lina", "Noah", "Olivia", "Daniel", "Maya", "Ethan", "Sofia", "Jonah",
  "Hannah", "Rafael", "Chloe", "Marcus", "Yuki", "Amara", "Ben", "Isla",
  "Tomas", "Nadia", "Jordan", "Imani", "Leo", "Anika", "Felix", "Rhea",
  "Kenji", "Zara", "Owen", "Mira",
];

const LASTS = [
  "Patel", "Chen", "Okafor", "Williams", "Garcia", "Kim", "Johnson", "Singh",
  "Rossi", "Andersen", "Nguyen", "Hernandez", "Müller", "Park", "O'Brien",
  "Sato", "Reyes", "Khan", "Cohen", "Diallo", "Tanaka", "Lopez", "Ahmed",
  "Schmidt", "Bauer", "Carter", "Brennan", "Hassan", "Petrov", "Davies",
];

const ROLE_POOLS: Record<string, string[]> = {
  surgery: [
    "Cardiothoracic Surgeon", "Vascular Surgeon", "Orthopedic Surgeon",
    "Neurosurgeon", "Trauma Surgeon", "Plastic Surgeon", "General Surgeon",
  ],
  nursing: [
    "ICU Nurse Manager", "ER Charge Nurse", "NICU Registered Nurse",
    "OR Circulating Nurse", "Cath Lab RN", "Labor & Delivery Nurse",
    "Hospice Nurse", "CRNA", "Nurse Practitioner",
  ],
  allied: [
    "Physical Therapist", "Occupational Therapist", "Speech-Language Pathologist",
    "Respiratory Therapist", "Radiologic Technologist", "MRI Technologist",
    "Surgical Tech", "Clinical Pharmacist",
  ],
  device: [
    "Medical Device Sales Rep", "Cardiac Rhythm Specialist",
    "Orthopedic Implant Rep", "Surgical Robotics Specialist",
    "Clinical Account Manager",
  ],
  primary: [
    "Family Medicine Physician", "Internal Medicine MD", "Pediatrician",
    "Geriatrician", "Hospitalist", "Urgent Care Physician",
  ],
};

const EMPLOYER_POOLS: Record<string, string[]> = {
  systems: [
    "Mayo Clinic", "Cleveland Clinic", "Kaiser Permanente", "NYU Langone",
    "UCSF Health", "Johns Hopkins", "Mass General Brigham", "Cedars-Sinai",
    "Mount Sinai", "Houston Methodist", "Northwestern Medicine",
    "Stanford Health Care",
  ],
  device: [
    "Medtronic", "Stryker", "Boston Scientific", "Abbott", "Edwards Lifesciences",
    "Intuitive Surgical", "Zimmer Biomet", "Johnson & Johnson MedTech",
  ],
  community: [
    "Banner Health", "Sutter Health", "Providence", "AdventHealth", "HCA Healthcare",
    "Trinity Health", "Ascension", "CommonSpirit Health",
  ],
};

function pick<T>(arr: T[], i: number) {
  return arr[((i % arr.length) + arr.length) % arr.length];
}

// Deterministic pseudo-random based on string seed — keeps mocks stable
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Step builders per campaign archetype
// ---------------------------------------------------------------------------

interface StepSpec {
  type: StepType;
  subject?: string;
  body: string;
  delayDays: number;
  mailbox: string;
}

function makeStep(spec: StepSpec, idx: number, isFirst: boolean): CampaignStep {
  return {
    id: `step-${idx + 1}-${Math.random().toString(36).slice(2, 7)}`,
    type: spec.type,
    subject: spec.subject,
    body: spec.body,
    fromMailbox: spec.mailbox,
    replyInThread: !isFirst && spec.type === "Email",
    delayValue: spec.delayDays,
    delayUnit: "days",
    businessHoursOnly: true,
    timezone: "America/Denver (MDT -06:00)",
  };
}

function makeContact(
  campaignId: string,
  idx: number,
  stepCount: number,
  rolePool: string[],
  employerPool: string[],
  profile: "under" | "solid" | "over",
  ownerName: string,
): CampaignContact {
  const rng = seeded(`${campaignId}-c-${idx}`);
  const first = pick(FIRSTS, Math.floor(rng() * FIRSTS.length));
  const last = pick(LASTS, Math.floor(rng() * LASTS.length));
  const role = pick(rolePool, Math.floor(rng() * rolePool.length));
  const employer = pick(employerPool, Math.floor(rng() * employerPool.length));

  // Distribution weights per profile — sum doesn't need to be 1, we sample buckets
  const statusWeights =
    profile === "under"
      ? { Active: 0.45, Paused: 0.15, Completed: 0.2, Bounced: 0.2 }
      : profile === "over"
      ? { Active: 0.7, Paused: 0.05, Completed: 0.22, Bounced: 0.03 }
      : { Active: 0.6, Paused: 0.1, Completed: 0.25, Bounced: 0.05 };

  const responseWeights =
    profile === "under"
      ? { "No response": 0.78, Replied: 0.08, Interested: 0.03, "Not interested": 0.07, "Out of office": 0.03, "Wrong person": 0.01 }
      : profile === "over"
      ? { "No response": 0.45, Replied: 0.22, Interested: 0.22, "Not interested": 0.06, "Out of office": 0.04, "Wrong person": 0.01 }
      : { "No response": 0.62, Replied: 0.15, Interested: 0.13, "Not interested": 0.06, "Out of office": 0.03, "Wrong person": 0.01 };

  const status = weightedPick(statusWeights, rng()) as ContactStatus;
  const response = weightedPick(responseWeights, rng()) as ResponseType;

  const baseOpens = profile === "over" ? 4 : profile === "solid" ? 2 : 1;
  const opens = status === "Bounced" ? 0 : Math.max(0, Math.round(baseOpens + rng() * 5));
  const clicks = status === "Bounced" ? 0 : Math.max(0, Math.round(opens * (0.15 + rng() * 0.35)));
  const engagement: CampaignContact["engagement"] =
    opens + clicks > 6 ? "High" : opens + clicks > 2 ? "Med" : "Low";

  const step =
    status === "Completed" ? stepCount : status === "Bounced" ? Math.max(1, Math.ceil(rng() * stepCount)) : 1 + Math.floor(rng() * stepCount);

  const addedDaysAgo = Math.floor(rng() * 28);
  const addedAt = new Date();
  addedAt.setDate(addedAt.getDate() - addedDaysAgo);

  return {
    id: `${campaignId}-c-${idx + 1}`,
    fullName: `${first} ${last}`,
    role,
    employer,
    step,
    status,
    response,
    opens,
    clicks,
    engagement,
    addedBy: ownerName,
    addedAt: addedAt.toISOString(),
  };
}

function weightedPick(weights: Record<string, number>, r: number): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  const target = r * total;
  for (const [k, w] of entries) {
    acc += w;
    if (target <= acc) return k;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------------------
// Campaign archetypes
// ---------------------------------------------------------------------------

interface Archetype {
  id: string;
  name: string;
  status: CampaignStatus;
  owner: string;
  rolePool: string[];
  employerPool: string[];
  profile: "under" | "solid" | "over";
  stepCount: number;
  enrollmentCount: number;
  createdDaysAgo: number;
  steps: StepSpec[];
}

const EMAIL_INTRO = `<p>Hi {{first_name}},</p><p>I came across your work as {{job_title}} at {{current_company}} — your background in patient outcomes really stood out. We're partnering with several leading health systems on roles that look like a strong match.</p><p>Open to a quick 15-minute chat next week?</p><p>Best,<br/>{{sender_first_name}}</p>`;

const EMAIL_BUMP = `<p>Hi {{first_name}},</p><p>Just floating this back to the top of your inbox. Happy to send the role overview ahead of any call so you can decide if it's worth your time.</p><p>{{sender_first_name}}</p>`;

const EMAIL_VALUE = `<p>Hi {{first_name}},</p><p>Two of the systems we're working with just opened {{job_title}} positions with sign-on bonuses in the $40–60k range and relocation. I can share specifics if helpful.</p><p>{{sender_first_name}}</p>`;

const EMAIL_BREAKUP = `<p>Hi {{first_name}},</p><p>I don't want to keep cluttering your inbox — happy to close the loop here. If timing's better in a few months, just reply "later" and I'll circle back then.</p><p>{{sender_first_name}}</p>`;

const LI_CONNECT = `Hi {{first_name}}, came across your profile while researching top {{job_title}}s in the region — would love to connect.`;
const LI_FOLLOWUP = `Thanks for connecting, {{first_name}}! Quick question — are you open to hearing about {{job_title}} roles at top-tier systems right now, or fully heads-down at {{current_company}}?`;

const CALL_NOTE = `Reference their recent LinkedIn post / publication. Lead with curiosity about their current scope at {{current_company}}, then mention 1–2 named opportunities. Keep under 4 minutes.`;

const ARCHETYPES: Archetype[] = [
  {
    id: "camp-cardio-fellows",
    name: "Cardiothoracic Surgeons — West Coast",
    status: "active",
    owner: "Steven Flutie-Davis",
    rolePool: ROLE_POOLS.surgery,
    employerPool: [...EMPLOYER_POOLS.systems, ...EMPLOYER_POOLS.community],
    profile: "over",
    stepCount: 7,
    enrollmentCount: 42,
    createdDaysAgo: 21,
    steps: [
      { type: "Email", subject: "Quick question about your work at {{current_company}}", body: EMAIL_INTRO, delayDays: 0, mailbox: "steven@oslr.health" },
      { type: "Email", subject: "Re: Quick question about your work at {{current_company}}", body: EMAIL_BUMP, delayDays: 3, mailbox: "steven@oslr.health" },
      { type: "LinkedIn Message", body: LI_CONNECT, delayDays: 2, mailbox: "steven@oslr.health" },
      { type: "Email", subject: "Two CT roles you should see", body: EMAIL_VALUE, delayDays: 4, mailbox: "steven@oslr.health" },
      { type: "Call", body: CALL_NOTE, delayDays: 3, mailbox: "steven@oslr.health" },
      { type: "LinkedIn Message", body: LI_FOLLOWUP, delayDays: 5, mailbox: "steven@oslr.health" },
      { type: "Email", subject: "Closing the loop", body: EMAIL_BREAKUP, delayDays: 7, mailbox: "steven@oslr.health" },
    ],
  },
  {
    id: "camp-icu-nurse-mgrs",
    name: "ICU Nurse Manager Outreach — Q2",
    status: "active",
    owner: "Priya Patel",
    rolePool: ROLE_POOLS.nursing,
    employerPool: [...EMPLOYER_POOLS.systems, ...EMPLOYER_POOLS.community],
    profile: "solid",
    stepCount: 5,
    enrollmentCount: 38,
    createdDaysAgo: 14,
    steps: [
      { type: "Email", subject: "ICU leadership roles — worth a look?", body: EMAIL_INTRO, delayDays: 0, mailbox: "hello@oslr.health" },
      { type: "Email", subject: "Re: ICU leadership roles — worth a look?", body: EMAIL_BUMP, delayDays: 3, mailbox: "hello@oslr.health" },
      { type: "LinkedIn Message", body: LI_CONNECT, delayDays: 2, mailbox: "hello@oslr.health" },
      { type: "Email", subject: "A couple of ICU openings I'd love your take on", body: EMAIL_VALUE, delayDays: 4, mailbox: "hello@oslr.health" },
      { type: "Call", body: CALL_NOTE, delayDays: 3, mailbox: "hello@oslr.health" },
    ],
  },
  {
    id: "camp-device-sales",
    name: "Medical Device Sales — Reactivation",
    status: "paused",
    owner: "Marcus Reyes",
    rolePool: ROLE_POOLS.device,
    employerPool: EMPLOYER_POOLS.device,
    profile: "under",
    stepCount: 2,
    enrollmentCount: 33,
    createdDaysAgo: 31,
    steps: [
      { type: "Email", subject: "Open to a confidential conversation?", body: EMAIL_INTRO, delayDays: 0, mailbox: "steven@oslr.health" },
      { type: "Email", subject: "Re: Open to a confidential conversation?", body: EMAIL_BREAKUP, delayDays: 5, mailbox: "steven@oslr.health" },
    ],
  },
  {
    id: "camp-allied-pt",
    name: "Allied Health — PTs & OTs (Boston)",
    status: "draft",
    owner: "Aisha Okafor",
    rolePool: ROLE_POOLS.allied,
    employerPool: [...EMPLOYER_POOLS.systems, ...EMPLOYER_POOLS.community],
    profile: "solid",
    stepCount: 4,
    enrollmentCount: 30,
    createdDaysAgo: 4,
    steps: [
      { type: "Email", subject: "Boston-area PT roles — quick intro", body: EMAIL_INTRO, delayDays: 0, mailbox: "hello@oslr.health" },
      { type: "Email", subject: "Re: Boston-area PT roles — quick intro", body: EMAIL_BUMP, delayDays: 3, mailbox: "hello@oslr.health" },
      { type: "LinkedIn Message", body: LI_CONNECT, delayDays: 2, mailbox: "hello@oslr.health" },
      { type: "Email", subject: "Closing the loop on PT openings", body: EMAIL_BREAKUP, delayDays: 6, mailbox: "hello@oslr.health" },
    ],
  },
];

function buildCampaign(a: Archetype): MockCampaign {
  const steps = a.steps.map((s, i) => makeStep(s, i, i === 0));
  const contacts = Array.from({ length: a.enrollmentCount }, (_, n) =>
    makeContact(a.id, n, a.stepCount, a.rolePool, a.employerPool, a.profile, a.owner),
  );

  // Derive aggregate KPIs from the seeded contacts so cards match the table
  const total = contacts.length;
  const active = contacts.filter((c) => c.status === "Active").length;
  const bounced = contacts.filter((c) => c.status === "Bounced").length;
  const opened = contacts.filter((c) => c.opens > 0).length;
  const clicked = contacts.filter((c) => c.clicks > 0).length;
  const replied = contacts.filter((c) => c.response !== "No response" && c.status !== "Bounced").length;
  const interested = contacts.filter((c) => c.response === "Interested").length;

  const created = new Date();
  created.setDate(created.getDate() - a.createdDaysAgo);

  return {
    id: a.id,
    name: a.name,
    status: a.status,
    ownerName: a.owner,
    createdAt: created.toISOString(),
    steps,
    contacts,
    total,
    active,
    opened,
    clicked,
    replied,
    interested,
    bounced,
    useMultipleSenders: false,
    newThreadPerSender: false,
  };
}

export const MOCK_CAMPAIGNS: MockCampaign[] = ARCHETYPES.map(buildCampaign);

// ---------------------------------------------------------------------------
// Aggregates + schedule shape
// ---------------------------------------------------------------------------

export function aggregateKpis(campaigns: MockCampaign[]) {
  const sum = (key: keyof MockCampaign) =>
    campaigns.reduce((acc, c) => acc + (c[key] as number), 0);
  return {
    total: sum("total"),
    active: sum("active"),
    opened: sum("opened"),
    clicked: sum("clicked"),
    replied: sum("replied"),
    interested: sum("interested"),
    bounced: sum("bounced"),
  };
}

// Builds a realistic per-day sent vs scheduled shape:
// - past days reflect actual sends (weekday-heavy, weekend dip)
// - today is split sent/scheduled
// - future days are scheduled only, tapering off
export function generateSchedule(
  days: number,
  scoped?: MockCampaign,
): { date: Date; sent: number; scheduled: number; isToday: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const half = Math.floor(days / 2);

  const baseVolume = scoped
    ? Math.max(6, Math.round(scoped.total / 3))
    : Math.max(20, Math.round(MOCK_CAMPAIGNS.reduce((s, c) => s + c.total, 0) / 4));

  const rng = seeded(scoped?.id ?? "global-schedule");

  const out: { date: Date; sent: number; scheduled: number; isToday: boolean }[] = [];
  for (let i = -half; i < days - half; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    const weekendDip = dow === 0 || dow === 6 ? 0.25 : 1;
    const taper = i > 0 ? Math.max(0.2, 1 - i / (days - half) * 0.7) : 1;
    const noise = 0.6 + rng() * 0.8;
    const volume = Math.round(baseVolume * weekendDip * taper * noise);

    const isToday = i === 0;
    const isPast = i < 0;
    out.push({
      date: d,
      sent: isPast ? volume : isToday ? Math.round(volume * 0.45) : 0,
      scheduled: isPast ? 0 : isToday ? Math.round(volume * 0.55) : volume,
      isToday,
    });
  }
  return out;
}

export const MERGE_TAGS = [
  { label: "Spintax Greeting", token: "{{spintax:Hi|Hello|Hey}}" },
  { label: "First Name", token: "{{first_name}}" },
  { label: "Current Company", token: "{{current_company}}" },
  { label: "Job Title", token: "{{job_title}}" },
  { label: "Education", token: "{{education}}" },
  { label: "Sender First Name", token: "{{sender_first_name}}" },
];
