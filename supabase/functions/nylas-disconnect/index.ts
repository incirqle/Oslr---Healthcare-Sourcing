// Disconnects a connected mailbox. POST { mailbox_id }
// Revokes the Nylas grant and deletes the user_mailboxes row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { nylasFetch, getEnv } from "../_shared/nylas.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabase = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not authenticated");

    const { mailbox_id } = await req.json();
    if (!mailbox_id) throw new Error("mailbox_id required");

    const { data: mb, error: mbErr } = await supabase
      .from("user_mailboxes")
      .select("id, nylas_grant_id, user_id")
      .eq("id", mailbox_id)
      .maybeSingle();
    if (mbErr || !mb) throw new Error("Mailbox not found");
    if (mb.user_id !== userData.user.id) throw new Error("Forbidden");

    // Best-effort revoke; do not fail the row deletion if Nylas 404s
    try {
      const res = await nylasFetch(`/v3/grants/${mb.nylas_grant_id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) {
        console.warn("Nylas revoke non-OK:", res.status, await res.text());
      }
    } catch (e) {
      console.warn("Nylas revoke failed:", (e as Error).message);
    }

    const { error: delErr } = await supabase
      .from("user_mailboxes")
      .delete()
      .eq("id", mailbox_id);
    if (delErr) throw new Error(delErr.message);

    return json({ ok: true });
  } catch (e) {
    console.error("nylas-disconnect error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
