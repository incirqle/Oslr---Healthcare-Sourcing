// Nylas redirects the user's browser here after they authorize.
// GET ?code=...&state=... -> exchanges code for grant, upserts user_mailboxes, then redirects to the app.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  NYLAS_API_URI,
  callbackUrl,
  verifyState,
  getEnv,
} from "../_shared/nylas.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  // Default fallback destination if state can't be decoded
  let returnOrigin = "https://oslr.health";

  try {
    if (errorParam) throw new Error(`Provider returned error: ${errorParam}`);
    if (!code || !stateRaw) throw new Error("Missing code or state");

    const state = await verifyState(stateRaw);
    returnOrigin = state.origin || returnOrigin;

    // Exchange code -> grant
    const tokenRes = await fetch(`${NYLAS_API_URI}/v3/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: getEnv("NYLAS_CLIENT_ID"),
        client_secret: getEnv("NYLAS_API_KEY"),
        code,
        redirect_uri: callbackUrl(),
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenJson)}`);
    }

    const grantId: string = tokenJson.grant_id;
    const providerEmail: string = tokenJson.email;
    const provider: string = (tokenJson.provider || "").toLowerCase();
    const scopeStr: string = tokenJson.scope || "";

    // Resolve company_id from the user's profile
    const admin = createClient(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("company_id")
      .eq("user_id", state.user_id)
      .maybeSingle();
    if (profErr || !profile?.company_id) {
      throw new Error("User profile or company not found");
    }

    const { error: upsertErr } = await admin
      .from("user_mailboxes")
      .upsert(
        {
          user_id: state.user_id,
          company_id: profile.company_id,
          provider,
          email: providerEmail,
          nylas_grant_id: grantId,
          scopes: scopeStr ? scopeStr.split(/[, ]+/).filter(Boolean) : null,
          status: "active",
          last_error: null,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,email" },
      );
    if (upsertErr) throw new Error(`Upsert failed: ${upsertErr.message}`);

    return Response.redirect(
      `${returnOrigin}/settings?mailbox=connected`,
      302,
    );
  } catch (e) {
    console.error("nylas-oauth-callback error:", e);
    const msg = encodeURIComponent((e as Error).message);
    return Response.redirect(
      `${returnOrigin}/settings?mailbox=error&reason=${msg}`,
      302,
    );
  }
});
