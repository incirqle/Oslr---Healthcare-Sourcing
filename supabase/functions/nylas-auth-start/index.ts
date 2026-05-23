// Returns a Nylas hosted-auth URL for the signed-in user.
// POST { provider: 'google' | 'microsoft' } -> { auth_url }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  NYLAS_API_URI,
  callbackUrl,
  appOrigin,
  signState,
  scopesFor,
  getEnv,
} from "../_shared/nylas.ts";

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

    const { provider } = await req.json();
    if (provider !== "google" && provider !== "microsoft") {
      return json({ error: "Unsupported provider" }, 400);
    }

    const state = await signState({
      user_id: userData.user.id,
      origin: appOrigin(req),
      ts: Date.now(),
    });

    const params = new URLSearchParams({
      client_id: getEnv("NYLAS_CLIENT_ID"),
      redirect_uri: callbackUrl(),
      response_type: "code",
      provider,
      access_type: "offline",
      state,
      scope: scopesFor(provider).join(" "),
    });

    const auth_url = `${NYLAS_API_URI}/v3/connect/auth?${params.toString()}`;
    return json({ auth_url });
  } catch (e) {
    console.error("nylas-auth-start error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
