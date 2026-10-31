// export-feed: a private live link Excel (Data > From Web) refreshes from. Always the current project list.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { csvFor, rowFor } from "../_shared/exports.ts";

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Not found", { status: 404 });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: dest } = await admin.from("export_destinations").select("id, project_id")
    .eq("feed_token", token).eq("kind", "excel_feed").eq("active", true).maybeSingle();
  if (!dest) return new Response("Not found", { status: 404 });
  const { data } = await admin.from("candidates").select("*").eq("project_id", dest.project_id).order("created_at");
  await admin.from("export_destinations").update({ last_synced_at: new Date().toISOString() }).eq("id", dest.id);
  return new Response("\uFEFF" + csvFor((data ?? []).map(rowFor)), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store", "Content-Disposition": 'inline; filename="oslr-project.csv"' },
  });
});
