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

    // Get the user's domain
    const { data: domain } = await serviceClient
      .from("user_sending_domains")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!domain) {
      return new Response(
        JSON.stringify({ error: "No domain found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Delete from Resend if configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && domain.resend_domain_id) {
      try {
        await fetch(`https://api.resend.com/domains/${domain.resend_domain_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${resendApiKey}` },
        });
      } catch (e) {
        console.error("Resend domain delete failed:", e);
      }
    }

    // Delete from DB
    await serviceClient
      .from("user_sending_domains")
      .delete()
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ deleted: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("delete-domain error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
