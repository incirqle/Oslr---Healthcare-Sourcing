import type { AgentPreferences } from "./agent-brain.ts";

export interface LanguageRules { favor: string[]; avoid: string[]; exclude: string[]; skip_cities: string[]; skip_employers: string[] }
export interface Steering extends LanguageRules { reply: string; brief: string | null; per_day: number | null; status: "pause" | "resume" | null }
export const RULE_FEATURES = ["role:owner", "role:leadership", "role:trainee", "role:clinician", "setting:academic", "setting:hospital", "setting:private"];
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const strings = (v: unknown): string[] => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string").map(s => s.trim().slice(0, 120)).filter(Boolean))].slice(0, 12) : [];

export function validateRules(value: unknown, available: string[]): LanguageRules {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const allowed = new Set([...RULE_FEATURES, ...available]);
  const keys = (x: unknown) => strings(x).filter(f => allowed.has(f));
  return { favor: keys(v.favor), avoid: keys(v.avoid), exclude: keys(v.exclude), skip_cities: strings(v.skip_cities), skip_employers: strings(v.skip_employers) };
}

export function applyLanguageRules(prefs: AgentPreferences, rules: LanguageRules): AgentPreferences {
  const weights = { ...prefs.weights };
  for (const f of rules.favor) weights[f] = Math.min(3, (weights[f] ?? 1) * 1.4);
  for (const f of rules.avoid) weights[f] = Math.max(0.05, (weights[f] ?? 1) * 0.4);
  const merge = (a: string[], b: string[]) => [...new Map([...a, ...b].map(s => [norm(s), s])).values()];
  return { ...prefs, weights, skip: { cities: merge(prefs.skip.cities, rules.skip_cities), employers: merge(prefs.skip.employers, rules.skip_employers), features: merge(prefs.skip.features ?? [], rules.exclude) } };
}

export function steeringPatch(agent: { status: string; brief: string }, value: unknown, available: string[]) {
  const v = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const patch: Record<string, unknown> = {};
  if (v.per_day !== null && v.per_day !== undefined) {
    if (typeof v.per_day !== "number" || !Number.isInteger(v.per_day) || v.per_day < 1 || v.per_day > 10) throw new Error("Choose between 1 and 10 people per day.");
    patch.per_day = v.per_day;
  }
  if (typeof v.brief === "string" && v.brief.trim()) {
    if (v.brief.trim().length < 8 || v.brief.length > 500) throw new Error("The updated brief must be between 8 and 500 characters.");
    if (v.brief.trim() !== agent.brief) patch.brief = v.brief.trim();
  }
  if (v.status === "pause" && ["sourcing", "calibrating"].includes(agent.status)) { patch.status = "paused"; patch.pause_reason = "Paused by you"; }
  if (v.status === "resume") {
    if (agent.status !== "paused") throw new Error("Only a paused agent can be resumed.");
    patch.status = "sourcing"; patch.pause_reason = null; patch.empty_runs = 0;
  }
  return { patch, rules: validateRules(v, available), reply: typeof v.reply === "string" ? v.reply.trim() : "" };
}

const arr = { type: "array", items: { type: "string" } };
export const RULE_PROPERTIES = { favor: arr, avoid: arr, exclude: arr, skip_cities: arr, skip_employers: arr };
export const RULE_SCHEMA = { type: "object", additionalProperties: false, required: Object.keys(RULE_PROPERTIES), properties: RULE_PROPERTIES };
export const STEER_SCHEMA = { type: "object", additionalProperties: false, required: ["reply", "brief", "per_day", "status", ...Object.keys(RULE_PROPERTIES)], properties: { ...RULE_PROPERTIES, reply: { type: "string" }, brief: { type: ["string", "null"] }, per_day: { type: ["integer", "null"] }, status: { type: ["string", "null"], enum: ["pause", "resume", null] } } };