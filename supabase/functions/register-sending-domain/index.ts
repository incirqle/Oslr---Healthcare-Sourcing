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

    const { domain, from_name, from_email } = await req.json();

    if (!domain || !from_name || !from_email) {
      return new Response(JSON.stringify({ error: "domain, from_name, and from_email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user already has a domain
    const { data: existing } = await serviceClient
      .from("user_sending_domains")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "Domain already registered. Delete existing domain first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Register with Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let resendDomainId = null;
    let dnsRecords = null;

    if (resendApiKey) {
      const resendRes = await fetch("https://api.resend.com/domains", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: domain }),
      });

      if (resendRes.ok) {
        const resendData = await resendRes.json();
        resendDomainId = resendData.id;
        dnsRecords = resendData.records;
      } else {
        console.error("Resend domain registration failed:", await resendRes.text());
      }
    }

    // Insert domain record
    const { error: insertErr } = await serviceClient
      .from("user_sending_domains")
      .insert({
        user_id: user.id,
        domain,
        from_name,
        from_email,
        resend_domain_id: resendDomainId,
        dns_records: dnsRecords,
        is_verified: false,
      });

    if (insertErr) throw insertErr;

    return new Response(
      JSON.stringify({
        domain_id: resendDomainId,
        dns_records: dnsRecords,
        is_verified: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("register-sending-domain error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
