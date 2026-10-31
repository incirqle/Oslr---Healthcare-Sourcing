// ATS and CRM connections through Merge.dev. Pro and Enterprise only, checked here on the server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SYSTEMS, plansAllowIntegrations, toAtsCandidate, toCrmContact, type CandidateRow } from "../_shared/merge.ts";

const MERGE = "https://api.merge.dev/api";
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function merge(path: string, init: RequestInit = {}, accountToken?: string) {
  const key = Deno.env.get("MERGE_API_KEY");
  if (!key) throw new Error("Integrations are not switched on yet.");
  const res = await fetch(`${MERGE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json",
      ...(accountToken ? { "X-Account-Token": accountToken } : {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`Merge ${res.status}: ${text.slice(0, 300)}`);
  return body;
}

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
    const { data: feat } = await admin.from("company_features").select("plan").eq("company_id", companyId).maybeSingle();
    const plan = (feat?.plan as string | null) ?? null;
    const allowed = plansAllowIntegrations(plan);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "status") {
      const { data } = await admin.from("workspace_integrations")
        .select("id, category, provider, provider_name, status, last_synced_at, last_error, created_at").eq("company_id", companyId);
      return json({ plan, allowed, ready: !!Deno.env.get("MERGE_API_KEY"), connections: data ?? [] });
    }

    if (!allowed) return json({ error: "ATS and CRM connections are included on Pro and Enterprise.", upgrade: true }, 403);

    if (action === "link_token") {
      const slug = String(body.provider ?? "");
      const sys = SYSTEMS[slug];
      if (!sys) return json({ error: "Unknown system" }, 400);
      const { data: co } = await admin.from("companies").select("name").eq("id", companyId).maybeSingle();
      const r = await merge("/integrations/create-link-token", {
        method: "POST",
        body: JSON.stringify({
          end_user_origin_id: companyId, end_user_organization_name: co?.name ?? "Oslr workspace",
          end_user_email_address: user.email, categories: [sys.category], integration: slug,
        }),
      });
      return json({ link_token: r.link_token });
    }

    if (action === "complete") {
      const slug = String(body.provider ?? "");
      const sys = SYSTEMS[slug];
      const pub = String(body.public_token ?? "");
      if (!sys || !pub || pub.length > 500) return json({ error: "Bad request" }, 400);
      const r = await merge(`/integrations/account-token/${encodeURIComponent(pub)}`);
      const { error } = await admin.from("workspace_integrations").upsert({
        company_id: companyId, category: sys.category, provider: slug, provider_name: r.integration?.name ?? sys.name,
        account_token: r.account_token, status: "connected", last_error: null, created_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: "company_id,provider" });
      if (error) throw error;
      return json({ ok: true });
    }

    const loadConn = async (id: string) => {
      const { data } = await admin.from("workspace_integrations").select("*").eq("id", id).eq("company_id", companyId).maybeSingle();
      return data;
    };

    if (action === "disconnect") {
      const conn = await loadConn(String(body.id ?? ""));
      if (!conn) return json({ error: "Not found" }, 404);
      await merge(`/${conn.category}/v1/delete-account`, { method: "POST" }, conn.account_token).catch((e) => console.warn(e));
      await admin.from("workspace_integrations").delete().eq("id", conn.id);
      return json({ ok: true });
    }

    if (action === "push") {
      const conn = await loadConn(String(body.id ?? ""));
      if (!conn) return json({ error: "Not found" }, 404);
      const projectId = String(body.project_id ?? "");
      const { data: rows } = await admin.from("candidates")
        .select("full_name, title, current_employer, email, phone, linkedin_url, location")
        .eq("company_id", companyId).eq("project_id", projectId).limit(500);
      const list = (rows ?? []) as CandidateRow[];
      let sent = 0, failed = 0, lastErr: string | null = null;
      let remoteUser: string | undefined;
      if (conn.category === "ats") {
        const u = await merge("/ats/v1/users?page_size=1", {}, conn.account_token).catch(() => null);
        remoteUser = u?.results?.[0]?.id;
      }
      for (const c of list) {
        try {
          if (conn.category === "ats") {
            await merge("/ats/v1/candidates", { method: "POST", body: JSON.stringify({ model: toAtsCandidate(c), remote_user_id: remoteUser }) }, conn.account_token);
          } else {
            await merge("/crm/v1/contacts", { method: "POST", body: JSON.stringify({ model: toCrmContact(c) }) }, conn.account_token);
          }
          sent++;
        } catch (e) { failed++; lastErr = e instanceof Error ? e.message.slice(0, 300) : "Send failed"; }
      }
      await admin.from("workspace_integrations").update({ last_synced_at: new Date().toISOString(), last_error: lastErr }).eq("id", conn.id);
      return json({ sent, failed });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Something went wrong" }, 500);
  }
});
