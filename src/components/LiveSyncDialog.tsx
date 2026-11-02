import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { SheetsLogo, SlackLogo, ExcelLogo } from "@/components/agents/AgentConnections";
import { Check, Copy, ExternalLink, FileSpreadsheet, Loader2, RefreshCw, Slack, Table2, Trash2, Zap } from "lucide-react";

type Destination = {
  id: string; kind: "google_sheets" | "slack" | "excel_feed"; label: string | null; sheet_url: string | null;
  feed_token: string | null; last_synced_at: string | null; last_error: string | null;
};

const FEED_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/export-feed?token=`;

export async function call<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("exports", { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      const j = await error.context.json().catch(() => null);
      if (j?.error) msg = j.error;
    }
    throw new Error(msg);
  }
  return data as T;
}

export function waitForPopup(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => { window.removeEventListener("message", onMsg); window.clearInterval(poll); };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== "google_sheets") return;
      if (e.data?.type === "appUserConnectorOAuthComplete") { cleanup(); resolve(); }
      else if (e.data?.type === "appUserConnectorOAuthFailed") { cleanup(); popup.close(); reject(new Error(e.data?.reason ?? "Google connection did not finish.")); }
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => { if (popup.closed) { cleanup(); reject(new Error("The Google window was closed.")); } }, 500);
  });
}

const ago = (s: string | null) => {
  if (!s) return "Not synced yet";
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  return m < 1 ? "Synced just now" : m < 60 ? `Synced ${m} min ago` : `Synced ${new Date(s).toLocaleString()}`;
};

export function LiveSyncDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [dests, setDests] = useState<Destination[]>([]);
  const [google, setGoogle] = useState<{ connected: boolean; reconnectRequired: boolean; available: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [webhook, setWebhook] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [l, g] = await Promise.all([
      call<{ destinations: Destination[] }>({ action: "list", project_id: projectId }),
      call<{ connected: boolean; reconnectRequired: boolean; available: boolean }>({ action: "google_status" }),
    ]);
    setDests(l.destinations); setGoogle(g);
  }, [projectId]);

  useEffect(() => { if (open) load().catch((e) => toast.error(e.message)); }, [open, load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(null); }
  };

  const connectGoogle = () => {
    const popup = window.open("", "oslr-google", "width=560,height=720");
    if (!popup) { toast.error("Your browser blocked the Google window. Allow pop-ups and try again."); return; }
    run("google", async () => {
      try {
        const { authorizationUrl } = await call<{ authorizationUrl: string }>({ action: "google_start", origin: window.location.origin });
        const done = waitForPopup(popup);
        popup.location.href = authorizationUrl;
        await done;
        toast.success("Google connected");
      } catch (e) { popup.close(); throw e; }
    });
  };

  const sheet = dests.find((d) => d.kind === "google_sheets");
  const slacks = dests.filter((d) => d.kind === "slack");
  const excel = dests.find((d) => d.kind === "excel_feed");
  const live = dests.length > 0;

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOpen(true)}>
        <Zap className={`h-3.5 w-3.5 ${live ? "text-primary" : ""}`} />
        {live ? "Live sync on" : "Live sync"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Live sync</DialogTitle>
            <DialogDescription>
              Every time someone is added, approved by an agent, gets contact details, or changes stage, it shows up here automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Google Sheets */}
            <section className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium text-sm"><SheetsLogo className="h-5 w-5" />Google Sheets</div>
              {sheet ? (
                <div className="space-y-2">
                  <a href={sheet.sheet_url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                    Open your sheet <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <p className={`text-xs ${sheet.last_error ? "text-destructive" : "text-muted-foreground"}`}>{sheet.last_error ? "Last update did not go through. Oslr will retry." : ago(sheet.last_synced_at)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => run("resync", async () => { await call({ action: "resync", project_id: projectId }); toast.success("Sheet refreshed"); })}>
                      {busy === "resync" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}<span className="ml-1.5">Refresh now</span>
                    </Button>
                    {google?.reconnectRequired && <Button size="sm" className="h-8 text-xs" onClick={connectGoogle}>Reconnect Google</Button>}
                    <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={!!busy} onClick={() => run("rm", async () => { await call({ action: "remove", project_id: projectId, id: sheet.id }); })}>
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />Stop syncing
                    </Button>
                  </div>
                </div>
              ) : google && !google.available ? (
                <p className="text-xs text-muted-foreground">Google Sheets sync is being switched on. Check back soon.</p>
              ) : google?.connected ? (
                <Button size="sm" className="h-9" disabled={!!busy} onClick={() => run("sheet", async () => {
                  try { await call({ action: "create_sheet", project_id: projectId }); toast.success("Sheet created in your Google Drive"); }
                  catch (e) { if (e instanceof Error && /renewed|not connected/i.test(e.message)) await load(); throw e; }
                })}>
                  {busy === "sheet" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Create a live sheet
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Oslr makes a new sheet in your own Google Drive and keeps it up to date. It can only see sheets it creates.</p>
                  <Button size="sm" className="h-9" disabled={!!busy || !google} onClick={connectGoogle}>
                    {busy === "google" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}{google?.reconnectRequired ? "Reconnect Google" : "Connect Google"}
                  </Button>
                </div>
              )}
            </section>

            {/* Slack */}
            <section className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium text-sm"><SlackLogo className="h-5 w-5" />Slack</div>
              {slacks.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{s.label}</p>
                    <p className={`text-xs ${s.last_error ? "text-destructive" : "text-muted-foreground"}`}>{s.last_error ? "Last post did not go through. Oslr will retry." : ago(s.last_synced_at)}</p>
                  </div>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground shrink-0" disabled={!!busy} onClick={() => run("rm", async () => { await call({ action: "remove", project_id: projectId, id: s.id }); })}>Remove</Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Posts new people and found contact details to a channel. In Slack, add the "Incoming Webhooks" app to a channel, then paste its link here.{" "}
                <a className="text-primary hover:underline" href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer">How to get the link</a>
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input value={webhook} onChange={(e) => setWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="h-9 text-sm" />
                <Button size="sm" className="h-9 shrink-0" disabled={!!busy || !webhook.trim()} onClick={() => run("slack", async () => {
                  await call({ action: "create_slack", project_id: projectId, webhook_url: webhook });
                  setWebhook(""); toast.success("Slack connected. Check the channel for a hello message.");
                })}>
                  {busy === "slack" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Add channel
                </Button>
              </div>
            </section>

            {/* Excel */}
            <section className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium text-sm"><ExcelLogo className="h-5 w-5" />Excel</div>
              {excel?.feed_token ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input readOnly value={FEED_BASE + excel.feed_token} className="h-9 text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
                    <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => {
                      navigator.clipboard.writeText(FEED_BASE + excel.feed_token); setCopied(true); setTimeout(() => setCopied(false), 1500);
                    }}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">In Excel: Data, then From Web, paste this link. Excel pulls the latest list every time you press Refresh All. Keep this link private.</p>
                  <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" disabled={!!busy} onClick={() => run("rm", async () => { await call({ action: "remove", project_id: projectId, id: excel.id }); })}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />Turn off this link
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Get a private link Excel can refresh from, so your spreadsheet always matches this project.</p>
                  <Button size="sm" className="h-9" disabled={!!busy} onClick={() => run("excel", async () => { await call({ action: "create_excel", project_id: projectId }); })}>
                    {busy === "excel" && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Create Excel link
                  </Button>
                </div>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
