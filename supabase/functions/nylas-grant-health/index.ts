// Daily cron: verify each user_mailbox grant is still valid.
// Marks invalid grants so the UI can prompt reconnection.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nylasFetch } from "../_shared/nylas.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: mailboxes } = await admin
    .from("user_mailboxes")
    .select("id, nylas_grant_id, status");

  let checked = 0;
  let invalidated = 0;
  for (const m of mailboxes ?? []) {
    checked++;
    try {
      const res = await nylasFetch(`/v3/grants/${m.nylas_grant_id}`);
      if (res.status === 401 || res.status === 402 || res.status === 404) {
        await admin
          .from("user_mailboxes")
          .update({ status: "invalid", last_error: `grant_check_${res.status}` })
          .eq("id", m.id);
        invalidated++;
      } else if (res.ok && m.status !== "active") {
        await admin
          .from("user_mailboxes")
          .update({ status: "active", last_error: null })
          .eq("id", m.id);
      }
    } catch (e) {
      await admin
        .from("user_mailboxes")
        .update({ last_error: String(e) })
        .eq("id", m.id);
    }
  }

  return new Response(JSON.stringify({ checked, invalidated }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
