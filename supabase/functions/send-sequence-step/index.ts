// supabase/functions/send-sequence-step/index.ts
//
// Pulls due sequence_step_events (scheduled_for <= now, sent_at is null),
// renders merge tags, sends via Resend, writes back the message id.
//
// Invocation:
//   - Cron every minute via pg_cron / Supabase scheduled functions
//   - Optional manual trigger from Campaigns "Send now" button
//
// Env required:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY
//   RESEND_FROM_DOMAIN  (e.g. "mail.oslr.health" — verified in Resend)
//
// This function is independent of the agent_* pipeline; it is the new
// human-driven multi-step sender for the "Campaigns" feature.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 1100;
const MAX_PER_INVOCATION = 200;

interface DueEvent {
  id: string;
  enrollment_id: string;
  step_id: string;
  mailbox_id: string | null;
  step: {
    kind: "email" | "connection_request" | "linkedin_message" | "call";
    subject: string | null;
    body_html: string;
    thread_mode: "new" | "reply";
    step_index: number;
  };
  enrollment: {
    candidate_id: string;
    candidate: {
      email: string | null;
      full_name: string | null;
      title: string | null;
      current_employer: string | null;
      location: string | null;
    };
    sequence: {
      id: string;
      company_id: string;
      owner_id: string;
    };
  };
  mailbox: {
    email: string;
    display_name: string;
  } | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromDomain = Deno.env.get("RESEND_FROM_DOMAIN") ?? "oslr.health";

  if (!resendApiKey) {
    return jsonResponse({ ok: false, error: "RESEND_API_KEY not set" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const due = await fetchDueEvents(supabase);
  if (due.length === 0) {
    return jsonResponse({ ok: true, sent: 0, skipped: 0, elapsed_ms: Date.now() - startedAt });
  }

  let sent = 0;
  let skipped = 0;
  const errors: { id: string; error: string }[] = [];

  for (let i = 0; i < due.length; i += BATCH_SIZE) {
    const batch = due.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((ev) => sendOne(supabase, ev, resendApiKey, fromDomain)));
    results.forEach((r, idx) => {
      const ev = batch[idx];
      if (r.status === "fulfilled" && r.value.ok) sent++;
      else if (r.status === "fulfilled") skipped++;
      else errors.push({ id: ev.id, error: String((r as PromiseRejectedResult).reason) });
    });
    if (i + BATCH_SIZE < due.length) await sleep(BATCH_DELAY_MS);
  }

  return jsonResponse({
    ok: errors.length === 0,
    sent,
    skipped,
    errors,
    elapsed_ms: Date.now() - startedAt,
  });
});

async function fetchDueEvents(supabase: ReturnType<typeof createClient>): Promise<DueEvent[]> {
  const { data, error } = await supabase
    .from("sequence_step_events")
    .select(`
      id, enrollment_id, step_id, mailbox_id,
      step:sequence_steps!inner ( kind, subject, body_html, thread_mode, step_index ),
      enrollment:sequence_enrollments!inner (
        candidate_id, status,
        candidate:candidates!inner ( email, full_name, title, current_employer, location ),
        sequence:sequences!inner ( id, company_id, owner_id )
      ),
      mailbox:mailboxes ( email, display_name )
    `)
    .lte("scheduled_for", new Date().toISOString())
    .is("sent_at", null)
    .eq("enrollment.status", "active")
    .limit(MAX_PER_INVOCATION);

  if (error) {
    console.error("fetchDueEvents error:", error);
    return [];
  }
  return (data ?? []) as unknown as DueEvent[];
}

async function sendOne(
  supabase: ReturnType<typeof createClient>,
  ev: DueEvent,
  resendApiKey: string,
  fromDomain: string,
): Promise<{ ok: boolean; reason?: string }> {
  if (ev.step.kind !== "email") {
    await markSkipped(supabase, ev.id, `non_email_kind:${ev.step.kind}`);
    return { ok: false, reason: "non_email" };
  }

  const recipient = ev.enrollment.candidate.email;
  if (!recipient) {
    await markSkipped(supabase, ev.id, "no_recipient_email");
    return { ok: false, reason: "no_email" };
  }

  const fromEmail = ev.mailbox?.email ?? `hello@${fromDomain}`;
  const fromName = ev.mailbox?.display_name ?? "Oslr";
  const subject = renderMergeTags(ev.step.subject ?? "", ev.enrollment.candidate);
  const html = renderMergeTags(ev.step.body_html, ev.enrollment.candidate);

  let inReplyTo: string | undefined;
  if (ev.step.thread_mode === "reply") {
    inReplyTo = (await previousMessageId(supabase, ev.enrollment_id, ev.step.step_index)) ?? undefined;
  }

  const body: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to: [recipient],
    subject,
    html,
    tags: [
      { name: "sequence_id", value: ev.enrollment.sequence.id },
      { name: "enrollment_id", value: ev.enrollment_id },
      { name: "step_event_id", value: ev.id },
    ],
  };
  if (inReplyTo) {
    body.headers = { "In-Reply-To": inReplyTo, "References": inReplyTo };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      const message = json.error?.message ?? `HTTP ${res.status}`;
      await markFailed(supabase, ev.id, message);
      return { ok: false, reason: "resend_error" };
    }
    await markSent(supabase, ev.id, json.id);
    await logActivity(supabase, ev);
    return { ok: true };
  } catch (e) {
    await markFailed(supabase, ev.id, String(e));
    return { ok: false, reason: "exception" };
  }
}

async function markSent(supabase: ReturnType<typeof createClient>, eventId: string, resendMessageId: string) {
  await supabase
    .from("sequence_step_events")
    .update({ sent_at: new Date().toISOString(), resend_message_id: resendMessageId })
    .eq("id", eventId);
}

async function markSkipped(supabase: ReturnType<typeof createClient>, eventId: string, reason: string) {
  await supabase
    .from("sequence_step_events")
    .update({ sent_at: new Date().toISOString(), resend_message_id: `skipped:${reason}` })
    .eq("id", eventId);
}

async function markFailed(supabase: ReturnType<typeof createClient>, eventId: string, message: string) {
  await supabase
    .from("sequence_step_events")
    .update({ bounce_type: `send_failed:${message.slice(0, 200)}` })
    .eq("id", eventId);
}

async function previousMessageId(
  supabase: ReturnType<typeof createClient>,
  enrollmentId: string,
  currentStepIndex: number,
): Promise<string | null> {
  const { data } = await supabase
    .from("sequence_step_events")
    .select("resend_message_id, step:sequence_steps!inner(step_index)")
    .eq("enrollment_id", enrollmentId)
    .lt("step.step_index", currentStepIndex)
    .order("step(step_index)", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as { resend_message_id?: string } | null)?.resend_message_id ?? null;
}

async function logActivity(supabase: ReturnType<typeof createClient>, ev: DueEvent) {
  await supabase.from("activity_log").insert({
    company_id: ev.enrollment.sequence.company_id,
    candidate_id: ev.enrollment.candidate_id,
    type: "email_sent",
    payload: {
      sequence_id: ev.enrollment.sequence.id,
      enrollment_id: ev.enrollment_id,
      step_event_id: ev.id,
    },
    actor_id: ev.enrollment.sequence.owner_id,
  });
}

function renderMergeTags(template: string, c: DueEvent["enrollment"]["candidate"]): string {
  const firstName = (c.full_name ?? "").split(" ")[0] || "there";
  return template
    .replace(/\{\{\s*first_name\s*\}\}/gi, firstName)
    .replace(/\{\{\s*full_name\s*\}\}/gi, c.full_name ?? "")
    .replace(/\{\{\s*current_company\s*\}\}/gi, c.current_employer ?? "")
    .replace(/\{\{\s*current_employer\s*\}\}/gi, c.current_employer ?? "")
    .replace(/\{\{\s*job_title\s*\}\}/gi, c.title ?? "")
    .replace(/\{\{\s*title\s*\}\}/gi, c.title ?? "")
    .replace(/\{\{\s*location\s*\}\}/gi, c.location ?? "")
    .replace(/\{\{\s*email\s*\}\}/gi, c.email ?? "");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
