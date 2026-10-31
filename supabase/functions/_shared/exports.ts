// Live exports: Google Sheets (each user's own Google account), Slack (incoming webhook) and Excel (live feed link).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appUserReconnectRequired, callAsAppUser } from "./appUserConnector.ts";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const GOOGLE_SHEETS_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
];

export const HEADERS = ["Name", "Title", "Employer", "Location", "Status", "Email", "Phone", "LinkedIn", "Notes", "Added", "Last updated", "Oslr ID"];

// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

export function rowFor(c: Row): string[] {
  const d = (s: string | null | undefined) => (s ? new Date(s).toISOString().slice(0, 10) : "");
  return [
    c.full_name ?? "", c.title ?? "", c.current_employer ?? "", c.location ?? "", c.status ?? "",
    c.email ?? "", c.phone ?? "", c.linkedin_url ?? "", (c.notes ?? "").slice(0, 2000),
    d(c.created_at), d(c.updated_at), c.id,
  ];
}

export function csvFor(rows: string[][]): string {
  const esc = (v: string) => {
    // Neutralize spreadsheet formulas from untrusted text.
    const s = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [HEADERS, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

// --- Encryption for stored secrets (Slack webhook URL, connection keys). ---
async function aesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APP_USER_CONNECTION_KEY_SECRET");
  const material = raw
    ? Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
    : new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("oslr-exports:" + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encrypt(plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), new TextEncoder().encode(plain)));
  const buf = new Uint8Array(iv.length + ct.length); buf.set(iv); buf.set(ct, iv.length);
  return btoa(String.fromCharCode(...buf));
}
export async function decrypt(stored: string): Promise<string> {
  const buf = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.subarray(0, 12) }, await aesKey(), buf.subarray(12));
  return new TextDecoder().decode(pt);
}

export async function saveConnectionKey(admin: SupabaseClient, userId: string, connectorId: string, key: string) {
  const { error } = await admin.from("app_user_connections").upsert({
    user_id: userId, connector_id: connectorId, connection_key_ciphertext: await encrypt(key),
    reconnect_required: false, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,connector_id" });
  if (error) throw error;
}
export async function getConnection(admin: SupabaseClient, userId: string, connectorId: string) {
  const { data } = await admin.from("app_user_connections").select("connection_key_ciphertext, reconnect_required")
    .eq("user_id", userId).eq("connector_id", connectorId).maybeSingle();
  if (!data) return null;
  return { key: await decrypt(data.connection_key_ciphertext), reconnectRequired: data.reconnect_required as boolean };
}

export class SheetsError extends Error {
  constructor(message: string, public status: number, public reconnect = false) { super(message); }
}

/** Google Sheets call as the destination owner. */
export async function sheets(admin: SupabaseClient, userId: string, path: string, init?: RequestInit): Promise<Row> {
  const conn = await getConnection(admin, userId, "google_sheets");
  if (!conn) throw new SheetsError("Google is not connected.", 401, true);
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: conn.key, connectorId: "google_sheets",
    path: `/v4${path}`, init: { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } },
    requiredScopes: GOOGLE_SHEETS_SCOPES,
  });
  if (await appUserReconnectRequired(res)) {
    await admin.from("app_user_connections").update({ reconnect_required: true }).eq("user_id", userId).eq("connector_id", "google_sheets");
    throw new SheetsError("Google access needs to be renewed.", 401, true);
  }
  const text = await res.text();
  if (!res.ok) throw new SheetsError(`Google Sheets ${res.status}: ${text.slice(0, 300)}`, res.status);
  return text ? JSON.parse(text) : {};
}

const lastRowOf = (range: string | undefined): number | null => {
  const m = range?.match(/![A-Z]+(\d+)(?::[A-Z]+(\d+))?$/);
  return m ? Number(m[2] ?? m[1]) : null;
};

/** Update rows already in the sheet in place; append new ones and remember their row numbers. Never clears the sheet. */
export async function upsertSheetRows(admin: SupabaseClient, dest: Row, candidates: Row[]) {
  if (!candidates.length) return;
  const { data: mapped } = await admin.from("export_rows").select("candidate_id, row_number")
    .eq("destination_id", dest.id).in("candidate_id", candidates.map((c) => c.id));
  const rowOf = new Map((mapped ?? []).map((m) => [m.candidate_id, m.row_number as number]));
  const updates = candidates.filter((c) => rowOf.has(c.id));
  const fresh = candidates.filter((c) => !rowOf.has(c.id));
  if (updates.length) {
    await sheets(admin, dest.created_by, `/spreadsheets/${dest.spreadsheet_id}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: updates.map((c) => ({ range: `Candidates!A${rowOf.get(c.id)}:L${rowOf.get(c.id)}`, values: [rowFor(c)] })),
      }),
    });
  }
  if (fresh.length) {
    const r = await sheets(admin, dest.created_by, `/spreadsheets/${dest.spreadsheet_id}/values/Candidates!A:L:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST", body: JSON.stringify({ values: fresh.map(rowFor) }),
    });
    const end = lastRowOf(r?.updates?.updatedRange);
    if (end) {
      const start = end - fresh.length + 1;
      await admin.from("export_rows").upsert(fresh.map((c, i) => ({ destination_id: dest.id, candidate_id: c.id, row_number: start + i })));
    }
  }
}

export async function createSheet(admin: SupabaseClient, userId: string, title: string) {
  const s = await sheets(admin, userId, "/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: "Candidates", gridProperties: { frozenRowCount: 1 } } }],
    }),
  });
  await sheets(admin, userId, `/spreadsheets/${s.spreadsheetId}/values/Candidates!A1:L1?valueInputOption=RAW`, {
    method: "PUT", body: JSON.stringify({ values: [HEADERS] }),
  });
  return { spreadsheetId: s.spreadsheetId as string, url: s.spreadsheetUrl as string };
}

export async function postSlack(webhookUrl: string, text: string, blocks?: unknown[]) {
  const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, blocks }) });
  if (!res.ok) throw new Error(`Slack ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export function slackMessage(projectName: string, events: { event: string; c: Row }[], appUrl: string, projectId: string) {
  const label: Record<string, string> = { added: "Added", contact: "Contact found", status: "Status changed", updated: "Updated" };
  const lines = events.slice(0, 15).map(({ event, c }) => {
    const bits = [c.title, c.current_employer, c.location].filter(Boolean).join(" · ");
    const contact = event === "contact" ? [c.email, c.phone].filter(Boolean).join(" · ") : event === "status" ? `now ${c.status}` : "";
    return `• *${label[event] ?? "Updated"}:* ${c.full_name}${bits ? ` (${bits})` : ""}${contact ? ` — ${contact}` : ""}`;
  });
  if (events.length > 15) lines.push(`…and ${events.length - 15} more`);
  const text = `Oslr · ${projectName}\n${lines.join("\n")}`;
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*Oslr · ${projectName}*\n${lines.join("\n")}` } },
      { type: "actions", elements: [{ type: "button", text: { type: "plain_text", text: "Open project" }, url: `${appUrl}/projects/${projectId}` }] },
    ],
  };
}
