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

const OWNERS = [
  { name: "Steven Flutie-Davis", avatar: undefined },
  { name: "Priya Patel", avatar: undefined },
  { name: "Marcus Reyes", avatar: undefined },
  { name: "Aisha Okafor", avatar: undefined },
];

const NAMES = [
  "Q2 NICU Outreach",
  "Cardiology Fellows — West Coast",
  "ER Physician Reactivation",
  "Telehealth Pediatricians",
  "Travel Nurse Refresh",
  "Anesthesiology Senior Hires",
  "Allied Health — Boston",
  "Rural Family Medicine",
];

const ROLES = ["Pediatrician", "RN", "ICU Nurse", "Cardiologist", "ER Physician", "NP", "Anesthesiologist"];
const EMPLOYERS = ["Mayo Clinic", "Cleveland Clinic", "Kaiser Permanente", "NYU Langone", "UCSF Health", "Johns Hopkins"];
const FIRSTS = ["Sarah", "Michael", "Priya", "James", "Aisha", "David", "Emma", "Carlos", "Lina", "Noah", "Olivia"];
const LASTS = ["Patel", "Chen", "Okafor", "Williams", "Garcia", "Kim", "Johnson", "Singh", "Rossi", "Andersen"];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}

function makeStep(i: number, isFirst: boolean): CampaignStep {
  const types: StepType[] = ["Email", "Email", "Email", "LinkedIn Message", "Call"];
  const type = isFirst ? "Email" : pick(types, i + 1);
  return {
    id: `step-${i + 1}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    subject: type === "Email" ? (isFirst ? "Quick question about your work at {{current_company}}" : "Re: Quick question about your work at {{current_company}}") : undefined,
    body:
      type === "Email"
        ? `<p>Hi {{first_name}},</p><p>I came across your work at {{current_company}} and was really impressed by your background as a {{job_title}}. We're working with several leading health systems on roles that might be a fit.</p><p>Open to a quick chat next week?</p><p>Best,<br/>{{sender_first_name}}</p>`
        : type === "Call"
        ? "Intro yourself + reference their LinkedIn post on patient outcomes. Ask if they're open to exploring new opportunities."
        : `Hi {{first_name}}, would love to connect — I work with health systems hiring for {{job_title}} roles.`,
    fromMailbox: "outreach@oslr.health",
    replyInThread: !isFirst && type === "Email",
    delayValue: isFirst ? 0 : pick([2, 3, 5, 7], i),
    delayUnit: isFirst ? "days" : "days",
    businessHoursOnly: true,
    timezone: "America/Denver (MDT -06:00)",
  };
}

function makeContact(i: number, stepCount: number): CampaignContact {
  const first = pick(FIRSTS, i);
  const last = pick(LASTS, i * 3 + 1);
  const opens = (i * 7) % 9;
  const clicks = (i * 3) % 4;
  const engagement: CampaignContact["engagement"] =
    opens + clicks > 6 ? "High" : opens + clicks > 2 ? "Med" : "Low";
  const responseOptions: ResponseType[] = ["No response", "No response", "No response", "Replied", "Interested", "Not interested", "Out of office"];
  const statusOptions: ContactStatus[] = ["Active", "Active", "Active", "Paused", "Completed", "Bounced"];
  return {
    id: `c-${i + 1}`,
    fullName: `${first} ${last}`,
    role: pick(ROLES, i),
    employer: pick(EMPLOYERS, i + 2),
    step: 1 + (i % stepCount),
    status: pick(statusOptions, i),
    response: pick(responseOptions, i),
    opens,
    clicks,
    engagement,
    addedBy: pick(OWNERS, i).name,
    addedAt: new Date(2026, 3, 1 + (i % 28)).toISOString(),
  };
}

function makeCampaign(i: number): MockCampaign {
  const owner = pick(OWNERS, i);
  const stepCount = 3 + (i % 4);
  const steps = Array.from({ length: stepCount }, (_, s) => makeStep(s, s === 0));
  const total = 50 + i * 37;
  const active = Math.round(total * 0.62);
  const opened = Math.round(total * (0.4 + (i % 3) * 0.1));
  const clicked = Math.round(opened * 0.3);
  const replied = Math.round(opened * 0.18);
  const interested = Math.round(replied * 0.55);
  const bounced = Math.round(total * 0.04);
  const contactCount = Math.min(total, 30);
  return {
    id: `camp-${i + 1}`,
    name: pick(NAMES, i),
    status: i === 0 ? "draft" : i % 5 === 0 ? "paused" : "active",
    ownerName: owner.name,
    createdAt: new Date(2026, 2, 10 + i).toISOString(),
    steps,
    contacts: Array.from({ length: contactCount }, (_, n) => makeContact(n + i, stepCount)),
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

export const MOCK_CAMPAIGNS: MockCampaign[] = Array.from({ length: 6 }, (_, i) => makeCampaign(i));

// Aggregate KPI helpers
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

// Mock schedule data — generates per-day sent vs scheduled counts centered on today
export function generateSchedule(days: number, scoped?: MockCampaign): { date: Date; sent: number; scheduled: number; isToday: boolean }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const half = Math.floor(days / 2);
  const out: { date: Date; sent: number; scheduled: number; isToday: boolean }[] = [];
  const seedScale = scoped ? Math.max(8, Math.round(scoped.total / 12)) : 60;
  for (let i = -half; i < days - half; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const noise = Math.abs(Math.sin(d.getDate() + (scoped ? scoped.id.length : 0))) * seedScale;
    const isPast = i < 0;
    const isToday = i === 0;
    out.push({
      date: d,
      sent: isPast ? Math.round(noise) : isToday ? Math.round(noise * 0.4) : 0,
      scheduled: isPast ? 0 : Math.round(noise * (isToday ? 0.6 : 1)),
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

export const MAILBOXES = [
  "outreach@oslr.health",
  "team@oslr.health",
  "hiring@oslr.health",
];
