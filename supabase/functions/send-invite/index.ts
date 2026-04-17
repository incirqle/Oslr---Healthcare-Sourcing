import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const inviteId: string | undefined = body?.invite_id;
    if (!inviteId) {
      return new Response(JSON.stringify({ error: "invite_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: invite, error: inviteErr } = await admin
      .from("company_invites")
      .select("id, company_id, email, role, token, invited_by")
      .eq("id", inviteId)
      .single();
    if (inviteErr || !invite) {
      return new Response(JSON.stringify({ error: "Invite not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the caller is a member of the company that owns this invite.
    const { data: isMember } = await admin.rpc("is_company_member", {
      _user_id: userData.user.id,
      _company_id: invite.company_id,
    });
    if (!isMember) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company } = await admin
      .from("companies")
      .select("name")
      .eq("id", invite.company_id)
      .single();

    const { data: inviterProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", invite.invited_by)
      .maybeSingle();

    const origin = req.headers.get("origin") || "https://oslr.health";
    const acceptUrl = `${origin}/auth?invite=${invite.token}`;
    const inviterName =
      inviterProfile?.full_name?.trim() || inviterProfile?.email || "A teammate";
    const companyName = company?.name ?? "their team";

    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (resendKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Oslr <invites@oslr.health>",
          to: [invite.email],
          subject: `${inviterName} invited you to ${companyName} on Oslr`,
          html: `
            <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
              <h1 style="font-size:22px;margin:0 0 12px">You're invited to ${companyName}</h1>
              <p style="font-size:15px;line-height:1.5;color:#334155">
                ${inviterName} has invited you to join <strong>${companyName}</strong> on Oslr — the AI-powered healthcare recruiting platform.
              </p>
              <p style="margin:24px 0">
                <a href="${acceptUrl}" style="background:#10b981;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Accept invite</a>
              </p>
              <p style="font-size:13px;color:#64748b">Or paste this link: ${acceptUrl}</p>
            </div>
          `,
        }),
      });
      emailSent = resendRes.ok;
    }

    return new Response(
      JSON.stringify({ success: true, emailSent, acceptUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
