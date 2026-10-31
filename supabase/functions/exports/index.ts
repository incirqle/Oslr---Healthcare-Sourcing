// Live export destinations for a project: Google Sheets, Slack, Excel live link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authorizeAppUserOAuth, disconnectAppUser, exchangeAppUserOAuthCode } from "../_shared/appUserConnector.ts";
import {
  GATEWAY_BASE_URL, GOOGLE_SHEETS_SCOPES, SheetsError, createSheet, encrypt, getConnection,
  postSlack, saveConnectionKey, upsertSheetRows,
} from "../_shared/exports.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SAFE_COLUMNS = "id, project_id, kind, label, sheet_url, feed_token, active, last_synced_at, last_error, created_at, created_by";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Sign in required" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Sign in required" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: prof } = await admin.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle();
    const companyId = prof?.company_id as string | undefined;
    if (!companyId) return json({ error: "No workspace found." }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "google_status") {
      const c = await getConnection(admin, user.id, "google_sheets").catch(() => null);
      return json({ connected: !!c && !c.reconnectRequired, reconnectRequired: !!c?.reconnectRequired, available: !!Deno.env.get("GOOGLE_SHEETS_APP_USER_CONNECTOR_CLIENT_API_KEY") });
    }
    if (action === "google_start") {
      const clientAPIKey = Deno.env.get("GOOGLE_SHEETS_APP_USER_CONNECTOR_CLIENT_API_KEY");
      if (!clientAPIKey) return json({ error: "Google Sheets is not set up for Oslr yet." }, 503);
      const origin = typeof body.origin === "string" && /^https?:\/\/[^/]+$/.test(body.origin) ? body.origin : null;
      if (!origin) return json({ error: "Bad origin" }, 400);
      const existing = await getConnection(admin, user.id, "google_sheets").catch(() => null);
      const { authorizationUrl } = await authorizeAppUserOAuth({
        gatewayBaseUrl: GATEWAY_BASE_URL, connectorId: "google_sheets", appUserId: user.id, clientAPIKey,
        returnUrl: new URL("/oauth/google-sheets/return", origin).toString(),
        connectionAPIKey: existing?.key, credentialsConfiguration: { scopes: GOOGLE_SHEETS_SCOPES },
      });
      return json({ authorizationUrl });
    }
    if (action === "google_complete") {
      if (typeof body.code !== "string" || body.code.length > 2000) return json({ error: "Bad code" }, 400);
      const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(GATEWAY_BASE_URL, body.code);
      if (connectorId !== "google_sheets") return json({ error: "Wrong connection" }, 400);
      await saveConnectionKey(admin, user.id, connectorId, connectionAPIKey);
      return json({ ok: true });
    }
    if (action === "google_disconnect") {
      const c = await getConnection(admin, user.id, "google_sheets").catch(() => null);
      if (c) await disconnectAppUser({ gatewayBaseUrl: GATEWAY_BASE_URL, connectionAPIKey: c.key, connectorId: "google_sheets" }).catch((e) => console.warn(e));
      await admin.from("app_user_connections").delete().eq("user_id", user.id).eq("connector_id", "google_sheets");
      await admin.from("export_destinations").update({ active: false, last_error: "Google was disconnected" }).eq("created_by", user.id).eq("kind", "google_sheets");
      return json({ ok: true });
    }

    // Project-scoped actions.
    const projectId = typeof body.project_id === "string" ? body.project_id : null;
    const { data: project } = projectId
      ? await admin.from("projects").select("id, name, company_id").eq("id", projectId).maybeSingle()
      : { data: null };
    if (!project || project.company_id !== companyId) return json({ error: "Project not found." }, 404);

    if (action === "list") {
      const { data } = await admin.from("export_destinations").select(SAFE_COLUMNS).eq("project_id", project.id).eq("active", true).order("created_at");
      return json({ destinations: data ?? [] });
    }

    const allCandidates = async () => {
      const { data } = await admin.from("candidates").select("*").eq("project_id", project.id).order("created_at");
      return data ?? [];
    };

    if (action === "create_sheet") {
      try {
        const sheet = await createSheet(admin, user.id, `Oslr · ${project.name}`);
        const { data: dest, error } = await admin.from("export_destinations").insert({
          company_id: companyId, project_id: project.id, kind: "google_sheets", created_by: user.id,
          label: "Google Sheet", spreadsheet_id: sheet.spreadsheetId, sheet_url: sheet.url,
        }).select("*").single();
        if (error) throw error;
        await upsertSheetRows(admin, dest, await allCandidates());
        await admin.from("export_destinations").update({ last_synced_at: new Date().toISOString() }).eq("id", dest.id);
        return json({ ok: true, url: sheet.url });
      } catch (e) {
        if (e instanceof SheetsError) return json({ error: e.message, reconnectRequired: e.reconnect }, e.reconnect ? 409 : 502);
        throw e;
      }
    }
    if (action === "create_slack") {
      const url = typeof body.webhook_url === "string" ? body.webhook_url.trim() : "";
      if (!/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/.test(url)) {
        return json({ error: "That does not look like a Slack webhook link. It starts with https://hooks.slack.com/services/" }, 400);
      }
      try {
        await postSlack(url, `Oslr is now posting updates for "${project.name}" here.`);
      } catch (e) {
        return json({ error: "Slack did not accept that link. " + (e instanceof Error ? e.message : "") }, 400);
      }
      const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 60) : "Slack channel";
      const { error } = await admin.from("export_destinations").insert({
        company_id: companyId, project_id: project.id, kind: "slack", created_by: user.id, label, secret_ciphertext: await encrypt(url),
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "create_excel") {
      const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error } = await admin.from("export_destinations").insert({
        company_id: companyId, project_id: project.id, kind: "excel_feed", created_by: user.id, label: "Excel live link", feed_token: token,
      });
      if (error) throw error;
      return json({ ok: true });
    }
    if (action === "remove") {
      await admin.from("export_destinations").update({ active: false }).eq("id", body.id).eq("project_id", project.id);
      return json({ ok: true });
    }
    if (action === "resync") {
      const { data: dests } = await admin.from("export_destinations").select("*").eq("project_id", project.id).eq("active", true).eq("kind", "google_sheets");
      const rows = await allCandidates();
      for (const d of dests ?? []) {
        try {
          await upsertSheetRows(admin, d, rows);
          await admin.from("export_destinations").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", d.id);
        } catch (e) {
          await admin.from("export_destinations").update({ last_error: e instanceof Error ? e.message.slice(0, 300) : "Sync failed" }).eq("id", d.id);
        }
      }
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("exports error", e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
