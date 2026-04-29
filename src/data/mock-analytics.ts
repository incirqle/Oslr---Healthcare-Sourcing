// Mock data for /analytics — backed in real life by mv_sequence_stats and
// activity_log. Generated deterministically so the charts feel alive but
// stay stable between renders.
//
// Pulls names/owners/inboxes from mock-campaigns where possible.

import { MOCK_CAMPAIGNS, MAILBOXES } from "./mock-campaigns";

// ---------------------------------------------------------------------------
// Seeded RNG
// ---------------------------------------------------------------------------
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
// Shared option pools
// ---------------------------------------------------------------------------

export const ANALYTICS_USERS = [
  "Steven Flutie-Davis",
  "Priya Patel",
  "Marcus Reyes",
  "Aisha Okafor",
];

export const ANALYTICS_INBOXES = [
  { display: "Steven @ Oslr", email: "steven@oslr.health" },
  { display: "Hello @ Oslr", email: "hello@oslr.health" },
  { display: "Steven @ Incirqle", email: "steven@pitchsink.com" },
  ...MAILBOXES.filter((m) => !["steven@oslr.health", "hello@oslr.health"].includes(m)).map(
    (email) => ({ display: email.split("@")[0], email })
  ),
];

export const ANALYTICS_PROJECTS = [
  { id: "p-cardio", name: "Cardiothoracic Surgeons — West Coast" },
  { id: "p-icu", name: "ICU Nurse Manager — Q2" },
  { id: "p-device", name: "Medical Device Sales — National" },
  { id: "p-allied", name: "Allied Health — Boston" },
  { id: "p-primary", name: "Primary Care — Texas Metros" },
];

export type GroupBy = "Days" | "Weeks" | "Months";
export type DateRangePreset = "7d" | "30d" | "90d" | "1y" | "custom";

export const DATE_PRESETS: { value: DateRangePreset; label: string; days: number }[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "1y", label: "Last 1 year", days: 365 },
];

// ---------------------------------------------------------------------------
// Outreach KPIs (derived from mock campaigns + a noise factor)
// ---------------------------------------------------------------------------

export interface OutreachKpis {
  totalRuns: number;
  emailsSent: number;
  opens: { num: number; den: number };
  clicks: { num: number; den: number };
  replies: { num: number; den: number };
  interested: { num: number; den: number };
  bounces: { num: number; den: number };
}

export function getOutreachKpis(): OutreachKpis {
  const totalContacts = MOCK_CAMPAIGNS.reduce((s, c) => s + c.total, 0);
  const totalSteps = MOCK_CAMPAIGNS.reduce((s, c) => s + c.steps.length * c.total, 0);
  const opened = MOCK_CAMPAIGNS.reduce((s, c) => s + c.opened, 0);
  const clicked = MOCK_CAMPAIGNS.reduce((s, c) => s + c.clicked, 0);
  const replied = MOCK_CAMPAIGNS.reduce((s, c) => s + c.replied, 0);
  const interested = MOCK_CAMPAIGNS.reduce((s, c) => s + c.interested, 0);
  const bounced = MOCK_CAMPAIGNS.reduce((s, c) => s + c.bounced, 0);

  // Pad numbers so the dashboard feels populated
  const sent = Math.round(totalSteps * 0.62);
  return {
    totalRuns: totalContacts + 421,
    emailsSent: sent,
    opens: { num: opened * 6 + 110, den: sent },
    clicks: { num: clicked * 5 + 38, den: sent },
    replies: { num: replied * 3 + 24, den: sent },
    interested: { num: interested * 3 + 12, den: sent },
    bounces: { num: bounced * 4 + 9, den: sent },
  };
}

// ---------------------------------------------------------------------------
// Time series builders
// ---------------------------------------------------------------------------

export interface TimeBucket {
  label: string;
  date: Date;
}

export function buildBuckets(days: number, group: GroupBy): TimeBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: TimeBucket[] = [];

  if (group === "Days") {
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.push({
        date: d,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
  } else if (group === "Weeks") {
    const weeks = Math.max(2, Math.ceil(days / 7));
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      buckets.push({
        date: d,
        label: `Wk ${weekNumber(d)}`,
      });
    }
  } else {
    const months = Math.max(2, Math.ceil(days / 30));
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - i, 1);
      buckets.push({
        date: d,
        label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      });
    }
  }
  return buckets;
}

function weekNumber(d: Date) {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = (d.getTime() - start.getTime()) / 86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}

// Campaign runs over time — User vs Agent
export function buildRunsOverTime(days: number, group: GroupBy) {
  const buckets = buildBuckets(days, group);
  const rng = seeded(`runs-${days}-${group}`);
  return buckets.map((b, i) => {
    const base = 18 + Math.round(rng() * 40);
    const trend = 1 + i / buckets.length;
    return {
      label: b.label,
      user: Math.round(base * trend),
      agent: Math.round(base * trend * (0.35 + rng() * 0.4)),
    };
  });
}

// Emails sent vs scheduled — past = sent only, future = scheduled only
export function buildEmailsSentScheduled(days: number, group: GroupBy) {
  const buckets = buildBuckets(days, group);
  const rng = seeded(`emails-${days}-${group}`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Add forward-looking buckets (~30% of length) for "scheduled"
  const future = Math.max(2, Math.round(buckets.length * 0.3));
  const extra: TimeBucket[] = [];
  for (let i = 1; i <= future; i++) {
    const d = new Date(today);
    if (group === "Days") d.setDate(d.getDate() + i);
    else if (group === "Weeks") d.setDate(d.getDate() + i * 7);
    else d.setMonth(d.getMonth() + i, 1);
    extra.push({
      date: d,
      label:
        group === "Months"
          ? d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
          : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }

  const all = [...buckets, ...extra];
  return all.map((b) => {
    const isFuture = b.date.getTime() > today.getTime();
    const base = 80 + Math.round(rng() * 120);
    return {
      label: b.label,
      sent: isFuture ? 0 : base,
      scheduled: isFuture ? Math.round(base * 0.7) : 0,
      isToday: b.date.getTime() === today.getTime(),
    };
  });
}

// ---------------------------------------------------------------------------
// Leaderboard — derived from MOCK_CAMPAIGNS + extras
// ---------------------------------------------------------------------------

export interface LeaderboardRow {
  id: string;
  name: string;
  status: "active" | "closed" | "draft";
  owner: string;
  inboxDisplay: string;
  inboxEmail: string;
  runs: number;
  steps: number;
  emails: number;
  opened: number;
  clicked: number;
  replied: number;
  interested: number;
  createdAt: string;
}

export function getLeaderboard(): LeaderboardRow[] {
  const fromMocks: LeaderboardRow[] = MOCK_CAMPAIGNS.map((c, i) => {
    const inbox = ANALYTICS_INBOXES[i % ANALYTICS_INBOXES.length];
    const emails = c.steps.length * c.total;
    return {
      id: c.id,
      name: c.name,
      status: c.status === "archived" ? "closed" : c.status === "draft" ? "draft" : "active",
      owner: c.ownerName,
      inboxDisplay: inbox.display,
      inboxEmail: inbox.email,
      runs: c.total,
      steps: c.steps.length,
      emails,
      opened: c.opened,
      clicked: c.clicked,
      replied: c.replied,
      interested: c.interested,
      createdAt: c.createdAt,
    };
  });

  // Add a few closed/older campaigns for variety
  const extra: LeaderboardRow[] = [
    {
      id: "camp-or-tech",
      name: "OR Surgical Techs — Midwest",
      status: "closed",
      owner: "Marcus Reyes",
      inboxDisplay: "Hello @ Oslr",
      inboxEmail: "hello@oslr.health",
      runs: 56,
      steps: 4,
      emails: 56 * 4,
      opened: 38,
      clicked: 21,
      replied: 14,
      interested: 9,
      createdAt: daysAgoIso(74),
    },
    {
      id: "camp-crna",
      name: "CRNA Outreach — National",
      status: "closed",
      owner: "Aisha Okafor",
      inboxDisplay: "Steven @ Incirqle",
      inboxEmail: "steven@pitchsink.com",
      runs: 88,
      steps: 6,
      emails: 88 * 6,
      opened: 71,
      clicked: 33,
      replied: 27,
      interested: 18,
      createdAt: daysAgoIso(120),
    },
    {
      id: "camp-pharm",
      name: "Clinical Pharmacists — Pacific NW",
      status: "active",
      owner: "Priya Patel",
      inboxDisplay: "Hello @ Oslr",
      inboxEmail: "hello@oslr.health",
      runs: 24,
      steps: 3,
      emails: 24 * 3,
      opened: 14,
      clicked: 8,
      replied: 5,
      interested: 3,
      createdAt: daysAgoIso(8),
    },
  ];

  return [...fromMocks, ...extra];
}

function daysAgoIso(d: number) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  return dt.toISOString();
}

// ---------------------------------------------------------------------------
// Usage page data
// ---------------------------------------------------------------------------

export function buildActivityOverTime(days: number, group: GroupBy) {
  const buckets = buildBuckets(days, group);
  const rng = seeded(`activity-${days}-${group}`);
  return buckets.map((b) => {
    const base = 20 + Math.round(rng() * 30);
    return {
      label: b.label,
      searches: base + Math.round(rng() * 25),
      reveals: Math.round(base * 1.4),
      campaigns: Math.round(base * 0.8),
    };
  });
}

export function buildTopUsers() {
  const rng = seeded("top-users");
  return ANALYTICS_USERS.map((u) => ({
    name: u,
    activity: 80 + Math.round(rng() * 320),
  })).sort((a, b) => b.activity - a.activity);
}

export function buildActivityByType(days: number, group: GroupBy) {
  const buckets = buildBuckets(days, group);
  const rng = seeded(`abt-${days}-${group}`);
  return buckets.map((b, i) => {
    const t = i / buckets.length;
    return {
      label: b.label,
      searches: Math.round(30 + t * 40 + rng() * 20),
      reveals: Math.round(50 + t * 60 + rng() * 25),
      campaigns: Math.round(20 + t * 30 + rng() * 15),
      replies: Math.round(8 + t * 16 + rng() * 8),
    };
  });
}

export function buildUsagePivot(days: number) {
  const months = buildBuckets(days, "Months");
  const rng = seeded(`pivot-${days}`);
  const rows = ANALYTICS_USERS.map((user) => {
    const cells = months.map(() => 30 + Math.round(rng() * 220));
    return { user, cells, total: cells.reduce((s, c) => s + c, 0) };
  });
  const totals = months.map((_, i) => rows.reduce((s, r) => s + r.cells[i], 0));
  return { months, rows, totals, grandTotal: totals.reduce((s, c) => s + c, 0) };
}

// ---------------------------------------------------------------------------
// Projects funnel
// ---------------------------------------------------------------------------

export interface FunnelRow {
  id: string;
  name: string;
  owner: string;
  newCount: number;
  contacted: number;
  interested: number;
  hired: number;
  trend: number[]; // per-week
}

export function getFunnelRows(weeks: number = 12): FunnelRow[] {
  return ANALYTICS_PROJECTS.map((p, idx) => {
    const rng = seeded(`funnel-${p.id}`);
    const newCount = 60 + Math.round(rng() * 240);
    const contacted = Math.round(newCount * (0.45 + rng() * 0.35));
    const interested = Math.round(contacted * (0.18 + rng() * 0.25));
    const hired = Math.round(interested * (0.08 + rng() * 0.18));
    const trend = Array.from({ length: weeks }, () => 2 + Math.round(rng() * 18));
    return {
      id: p.id,
      name: p.name,
      owner: ANALYTICS_USERS[idx % ANALYTICS_USERS.length],
      newCount,
      contacted,
      interested,
      hired,
      trend,
    };
  });
}
