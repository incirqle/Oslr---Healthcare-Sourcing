import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { domain_id } = await req.json();

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey || !domain_id) {
      return new Response(
        JSON.stringify({ is_verified: false, message: "Email API not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify with Resend
    await fetch(`https://api.resend.com/domains/${domain_id}/verify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });

    // Check status
    const statusRes = await fetch(`https://api.resend.com/domains/${domain_id}`, {
      headers: { Authorization: `Bearer ${resendApiKey}` },
    });

    if (!statusRes.ok) {
      return new Response(
        JSON.stringify({ is_verified: false, message: "Failed to check domain status" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domainData = await statusRes.json();
    const isVerified = domainData.status === "verified" || domainData.status === "active";

    if (isVerified) {
      await serviceClient
        .from("user_sending_domains")
        .update({ is_verified: true })
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({
        is_verified: isVerified,
        status: domainData.status,
        message: isVerified
          ? "Domain verified!"
          : "DNS records not yet propagated. This can take up to 48 hours.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("verify-domain error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
