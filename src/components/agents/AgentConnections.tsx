import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { call, waitForPopup } from "@/components/LiveSyncDialog";
import { cn } from "@/lib/utils";

/* Brand marks: providers' own colors, intentionally fixed. */
export function SlackLogo({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 122.8 122.8" className={className} aria-hidden="true">
    <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
    <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
    <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
    <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
  </svg>;
}
export function SheetsLogo({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 48 66" className={className} aria-hidden="true">
    <path d="M29 0H4.5A4.5 4.5 0 0 0 0 4.5v57A4.5 4.5 0 0 0 4.5 66h39a4.5 4.5 0 0 0 4.5-4.5V19L29 0z" fill="#0f9d58" />
    <path d="M29 0v14.5a4.5 4.5 0 0 0 4.5 4.5H48L29 0z" fill="#87ceac" />
    <path d="M11 30v22h26V30H11zm11.5 18.5H14.5V44h8v4.5zm0-7.5H14.5v-4.5h8V41zm11 7.5h-8V44h8v4.5zm0-7.5h-8v-4.5h8V41z" fill="#f1f1f1" />
  </svg>;
}
export function ExcelLogo({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <rect x="14" y="6" width="30" height="36" rx="3" fill="#21a366" />
    <rect x="4" y="12" width="22" height="24" rx="3" fill="#107c41" />
    <path d="M9.5 18h3.6l2.4 4.4 2.5-4.4h3.4l-4.1 6 4.2 6h-3.6l-2.5-4.5-2.5 4.5H9.4l4.2-6-4.1-6z" fill="#fff" />
  </svg>;
}
export function TeamsLogo({ className = "h-5 w-5" }: { className?: string }) {
  return <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <circle cx="36" cy="12" r="5" fill="#7b83eb" /><rect x="28" y="19" width="16" height="17" rx="4" fill="#7b83eb" />
    <circle cx="24" cy="10" r="6" fill="#5059c9" /><rect x="12" y="18" width="22" height="22" rx="4" fill="#5059c9" />
    <rect x="4" y="14" width="22" height="22" rx="3" fill="#4b53bc" />
    <path d="M9 19h12v3h-4.5v10h-3V22H9v-3z" fill="#fff" />
  </svg>;
}

type Kind = "google_sheets" | "slack" | "excel_feed";
type Dest = { id: string; kind: Kind; label: string | null; sheet_url: string | null; feed_token: string | null; last_synced_at: string | null; last_error: string | null };
type Google = { connected: boolean; reconnectRequired: boolean; available: boolean };
type Opt = { id: Kind | "teams"; name: string; line: string; Logo: ComponentType<{ className?: string }>; soon?: boolean };
const OPTIONS: Opt[] = [
  { id: "slack", name: "Slack", line: "Post each approved person into a channel", Logo: SlackLogo },
  { id: "google_sheets", name: "Google Sheets", line: "A live sheet that fills itself", Logo: SheetsLogo },
  { id: "excel_feed", name: "Microsoft Excel", line: "A live workbook you refresh", Logo: ExcelLogo },
  { id: "teams", name: "Microsoft Teams", line: "Coming soon", Logo: TeamsLogo, soon: true },
];
const FEED_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/export-feed?token=`;
const when = (s: string | null) => s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null;

/** "Send approved people to": goes out the moment you approve, plus a catch-up every morning. */
export function AgentConnections({ projectId }: { projectId: string }) {
  const [dests, setDests] = useState<Dest[] | null>(null);
  const [google, setGoogle] = useState<Google | null>(null);
  const [picked, setPicked] = useState<Kind | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [hook, setHook] = useState("");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [l, g] = await Promise.all([
        call<{ destinations: Dest[] }>({ action: "list", project_id: projectId }),
        call<Google>({ action: "google_status" }),
      ]);
      setDests(l.destinations); setGoogle(g);
      setPicked((p) => p ?? l.destinations[0]?.kind ?? null);
    } catch { setDests([]); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); await load(); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(null); }
  };

  const sheet = dests?.find((d) => d.kind === "google_sheets");
  const slacks = dests?.filter((d) => d.kind === "slack") ?? [];
  const excel = dests?.find((d) => d.kind === "excel_feed");
  const primary = sheet ?? slacks[0] ?? excel;
  const live = primary ? OPTIONS.find((o) => o.id === primary.kind) : undefined;
  const problem = dests?.find((d) => d.last_error);
  const lastAt = dests?.map((d) => d.last_synced_at).filter(Boolean).sort().pop() ?? null;
  const summary = !dests ? "Checking..." : !primary ? "Not connected. Approved people stay here."
    : problem ? "Last update did not go through. Press Send now."
    : `${dests.length > 1 ? `${dests.length} places` : "Live"}${lastAt ? ` · last ${when(lastAt)}` : ""}`;

  const sendNow = () => run("send", async () => { await call({ action: "resync", project_id: projectId }); toast.success("Sent. Everyone approved is up to date."); });

  const connectSheets = () => {
    const needsGoogle = !google?.connected || google.reconnectRequired;
    const popup = needsGoogle ? window.open("", "oslr-google", "width=560,height=720") : null;
    if (needsGoogle && !popup) { toast.error("Your browser blocked the Google window. Allow pop-ups and try again."); return; }
    run("sheet", async () => {
      if (popup) {
        try {
          const { authorizationUrl } = await call<{ authorizationUrl: string }>({ action: "google_start", origin: window.location.origin });
          const done = waitForPopup(popup);
          popup.location.href = authorizationUrl;
          await done;
        } catch (e) { popup.close(); throw e; }
      }
      if (!sheet) await call({ action: "create_sheet", project_id: projectId });
      toast.success(sheet ? "Reconnected to Google" : "Your Google Sheet is ready");
    });
  };

  const current = OPTIONS.find((o) => o.id === picked);
  return (
    <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        {live ? <live.Logo className="h-4 w-4 shrink-0" /> : <Send className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <p className="min-w-0 flex-1 text-[13px]">
          <span className="font-medium">{live ? live.name : "Send approved people"}</span>
          <span className={cn("ml-2", problem ? "text-destructive" : "text-muted-foreground")}>{summary}</span>
        </p>
        {sheet?.sheet_url && <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs"><a href={sheet.sheet_url} target="_blank" rel="noreferrer">Open sheet<ExternalLink className="ml-1 h-3 w-3" /></a></Button>}
        {primary && <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={sendNow} disabled={!!busy}>
          {busy === "send" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}Send now
        </Button>}
        <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {primary ? "Change" : "Connect"}<ChevronDown className={cn("ml-1 h-3 w-3 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </div>

      {open && <div className="border-t border-border/60 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Send approved people to</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Goes out the moment you approve someone or find their contact details, plus a catch-up every morning.</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 w-full min-w-[210px] justify-between gap-2 sm:w-auto" disabled={!!busy}>
                <span className="flex min-w-0 items-center gap-2">{current ? <><current.Logo className="h-4 w-4 shrink-0" /><span className="truncate">{current.name}</span></> : <span className="text-muted-foreground">Choose a connection</span>}</span>
                <ChevronDown className="h-4 w-4 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Connections</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {OPTIONS.map((o) => {
                const on = o.id === "slack" ? slacks.length > 0 : o.id === "google_sheets" ? !!sheet : o.id === "excel_feed" ? !!excel : false;
                return <DropdownMenuItem key={o.id} disabled={o.soon} onSelect={() => !o.soon && setPicked(o.id as Kind)} className="gap-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background"><o.Logo className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{o.name}</span><span className="block text-xs text-muted-foreground">{o.line}</span></span>
                  {on && <Check className="h-4 w-4 text-mint" />}
                </DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {picked === "google_sheets" && <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-start gap-3">
            <SheetsLogo className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{sheet ? "Live in Google Sheets" : "Google Sheets"}</p>
              <p className="text-xs text-muted-foreground">{sheet ? "New approvals and contact details show up on their own." : "Sign in with Google and we make a sheet in your Drive. Everyone you approve is added automatically."}</p>
              {google?.reconnectRequired && <p className="mt-2 text-xs text-muted-foreground">Reconnect Google to resume updates. Your sheet and approved people are safe.</p>}
              {google && !google.available && <p className="mt-2 text-xs text-muted-foreground">Google Sheets is being switched on. Check back soon.</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {sheet?.sheet_url && <Button size="sm" variant="outline" asChild><a href={sheet.sheet_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Open sheet</a></Button>}
            {sheet && <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={!!busy} onClick={() => run("rm", async () => { await call({ action: "remove", project_id: projectId, id: sheet.id }); })}>Stop</Button>}
            {(!sheet || google?.reconnectRequired) && <Button size="sm" className="bg-mint text-mint-foreground hover:bg-mint/90" onClick={connectSheets} disabled={!!busy || !google?.available}>
              {busy === "sheet" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <SheetsLogo className="mr-1.5 h-4 w-4" />}
              {google?.reconnectRequired ? "Reconnect Google" : "Connect Google Sheets"}
            </Button>}
          </div>
        </div>}

        {picked === "slack" && <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {slacks.map((s) => <div key={s.id} className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <SlackLogo className="h-4 w-4" />
            <span className="min-w-0 flex-1"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-mint align-middle" />Live in Slack {s.label}{s.last_synced_at ? ` · last ${when(s.last_synced_at)}` : ""}</span>
            <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("rm", async () => { await call({ action: "remove", project_id: projectId, id: s.id }); })}>Stop</Button>
          </div>)}
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Open <a className="inline-flex items-center gap-0.5 underline" href="https://my.slack.com/services/new/incoming-webhook/" target="_blank" rel="noreferrer">this Slack page<ExternalLink className="h-3 w-3" /></a> (works on free Slack).</li>
            <li>Pick the channel and click <b>Add Incoming Webhooks integration</b>.</li>
            <li>Copy the link Slack shows you and paste it below.</li>
          </ol>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://hooks.slack.com/services/..." className="h-10 min-w-0 flex-1" disabled={!!busy} />
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Channel name (optional)" className="h-10 sm:w-48" disabled={!!busy} />
            <Button className="h-10 bg-mint text-mint-foreground hover:bg-mint/90" disabled={!!busy || !hook.trim()} onClick={() => run("slack", async () => {
              await call({ action: "create_slack", project_id: projectId, webhook_url: hook, label: label ? `#${label.replace(/^#/, "")}` : undefined });
              setHook(""); setLabel("");
              await call({ action: "resync", project_id: projectId }).catch(() => null);
              toast.success("Connected to Slack. Check the channel for a hello message.");
            })}>
              {busy === "slack" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <SlackLogo className="mr-1.5 h-4 w-4" />}Connect
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">We post a test message first so you can see it worked.</p>
        </div>}

        {picked === "excel_feed" && <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
          <div className="flex items-start gap-3">
            <ExcelLogo className="h-6 w-6 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Live Excel workbook</p>
              <p className="text-xs text-muted-foreground">Copy the link. In Excel choose Data, then From Web, paste it and click OK. Click Refresh All any time to pull in new approvals.</p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <ol className="min-w-0 flex-1 list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
              <li>Click <b>Copy link</b></li><li>In Excel: Data, From Web, paste, OK</li>
            </ol>
            <div className="flex gap-2">
              <Button size="sm" className="bg-mint text-mint-foreground hover:bg-mint/90" disabled={!!busy} onClick={() => run("excel", async () => {
                let token = excel?.feed_token;
                if (!token) {
                  await call({ action: "create_excel", project_id: projectId });
                  const l = await call<{ destinations: Dest[] }>({ action: "list", project_id: projectId });
                  token = l.destinations.find((d) => d.kind === "excel_feed")?.feed_token ?? null;
                }
                if (!token) throw new Error("Could not make the link. Please try again.");
                await navigator.clipboard.writeText(FEED_BASE + token);
                setCopied(true); window.setTimeout(() => setCopied(false), 2000);
                toast.success("Link copied. In Excel choose Data, then From Web, and paste.");
              })}>
                {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}Copy link
              </Button>
              {excel && <Button size="icon" variant="ghost" aria-label="Make a new private link" title="Make a new private link" disabled={!!busy} onClick={() => {
                if (!window.confirm("Make a new link? Any workbook using the old link will stop updating.")) return;
                void run("rotate", async () => { await call({ action: "remove", project_id: projectId, id: excel.id }); await call({ action: "create_excel", project_id: projectId }); toast.success("New link ready. Copy it again."); });
              }}>{busy === "rotate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}</Button>}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">Keep this link private.</p>
        </div>}
      </div>}
    </section>
  );
}
