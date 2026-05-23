// Public one-click unsubscribe handler. Inserts into email_suppressions
// and renders a small confirmation page. Supports GET (link) and POST
// (RFC 8058 List-Unsubscribe-Post).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function page(title: string, body: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#111}h1{font-size:20px;margin-bottom:8px}p{color:#555;line-height:1.5}</style></head><body><h1>${title}</h1>${body}</body></html>`;
  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  let token = url.searchParams.get("t");
  if (!token && req.method === "POST") {
    try {
      const form = await req.formData();
      token = (form.get("t") as string) ?? null;
    } catch (_) { /* ignore */ }
  }

  if (!token) {
    return page("Invalid link", `<p>Missing token.</p>`);
  }

  const { data: rec } = await admin
    .from("email_unsubscribe_tokens")
    .select("company_id, email")
    .eq("token", token)
    .single();

  if (!rec) {
    return page("Invalid or expired link", `<p>This unsubscribe link is no longer valid.</p>`);
  }

  await admin.from("email_suppressions").upsert(
    {
      company_id: rec.company_id,
      email: rec.email,
      reason: "unsubscribe",
    },
    { onConflict: "company_id,email" },
  );

  return page(
    "You're unsubscribed",
    `<p><strong>${rec.email}</strong> has been removed. You won't receive further messages from this campaign sender.</p>`,
  );
});
