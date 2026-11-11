// Background jobs accept only internal callers: the server key, or the private job token the scheduler sends.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export function isServiceKey(req: Request) {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return same(bearer, key);
}

export async function isInternalJob(req: Request, admin: SupabaseClient) {
  if (isServiceKey(req)) return true;
  const sent = req.headers.get("x-oslr-job-token") ?? "";
  if (!sent) return false;
  const { data } = await admin.from("internal_job_token").select("token").eq("id", 1).maybeSingle();
  return same(sent, data?.token ?? "");
}

export const unauthorized = () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
