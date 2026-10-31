// export-sync: runs every minute. Pushes queued project changes to Google Sheets and Slack.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt, postSlack, slackMessage, upsertSheetRows } from "../_shared/exports.ts";

const APP_URL = "https://oslr.health";
const MAX_ATTEMPTS = 5;

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: pending } = await admin.rpc("claim_export_outbox", { _limit: 300 });
  if (!pending?.length) return Response.json({ processed: 0 });

  const byProject = new Map<string, typeof pending>();
  for (const p of pending) byProject.set(p.project_id, [...(byProject.get(p.project_id) ?? []), p]);
  let processed = 0;

  for (const [projectId, items] of byProject) {
    const ids = [...new Set(items.map((i) => i.candidate_id))];
    const [{ data: cands }, { data: dests }, { data: project }] = await Promise.all([
      admin.from("candidates").select("*").in("id", ids),
      admin.from("export_destinations").select("*").eq("project_id", projectId).eq("active", true),
      admin.from("projects").select("name").eq("id", projectId).maybeSingle(),
    ]);
    const byId = new Map((cands ?? []).map((c) => [c.id, c]));
    let failed: string | null = null;

    for (const d of dests ?? []) {
      try {
        if (d.kind === "google_sheets") {
          await upsertSheetRows(admin, d, [...byId.values()]);
        } else if (d.kind === "slack" && d.secret_ciphertext) {
          // Only the moments that matter: new people and found contact details.
          const seen = new Set<string>();
          const events = items.filter((i) => (i.event === "added" || i.event === "contact") && byId.has(i.candidate_id))
            .filter((i) => { const k = i.event + i.candidate_id; if (seen.has(k)) return false; seen.add(k); return true; })
            .map((i) => ({ event: i.event, c: byId.get(i.candidate_id)! }));
          if (events.length) {
            const m = slackMessage(project?.name ?? "Project", events, APP_URL, projectId);
            await postSlack(await decrypt(d.secret_ciphertext), m.text, m.blocks);
          }
        }
        if (d.kind !== "excel_feed") {
          await admin.from("export_destinations").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", d.id);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message.slice(0, 300) : "Sync failed";
        console.error("[export-sync]", d.id, msg);
        await admin.from("export_destinations").update({ last_error: msg }).eq("id", d.id);
        failed = msg;
      }
    }

    const now = new Date().toISOString();
    for (const i of items) {
      const attempts = i.attempts + 1;
      await admin.from("export_outbox").update(
        failed && attempts < MAX_ATTEMPTS ? { attempts, error: failed, claimed_at: null } : { attempts, processed_at: now, error: failed },
      ).eq("id", i.id);
    }
    processed += items.length;
  }
  return Response.json({ processed });
});
