import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMergeLink } from "@mergeapi/react-merge-link";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Check, Loader2, Search, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SheetsLogo, SlackLogo, ExcelLogo } from "@/components/agents/AgentConnections";

type Sys = { slug: string; name: string; line: string; logo: string; soon?: boolean };
const L = (f: string) => `/site/assets/img/logos/${f}.png`;
const ATS: Sys[] = [
  { slug: "workday", name: "Workday", line: "Health systems and large hospital networks", logo: L("workday") },
  { slug: "oracle-taleo", name: "Oracle Taleo", line: "Enterprise hospital recruiting", logo: L("oracle-taleo") },
  { slug: "ukg-pro-recruiting", name: "UKG Pro Recruiting", line: "Regional hospitals and health systems", logo: L("ukg") },
  { slug: "icims", name: "iCIMS", line: "Enterprise healthcare talent teams", logo: L("icims"), soon: true },
  { slug: "bullhorn", name: "Bullhorn", line: "Physician and clinical search firms", logo: L("bullhorn"), soon: true },
  { slug: "greenhouse", name: "Greenhouse", line: "Growing clinical groups", logo: L("greenhouse"), soon: true },
  { slug: "smartrecruiters", name: "SmartRecruiters", line: "Multi-site provider groups", logo: L("smartrecruiters") },
  { slug: "lever", name: "Lever", line: "Specialty clinics and practice groups", logo: L("lever") },
];
const CRM: Sys[] = [
  { slug: "salesforce", name: "Salesforce", line: "Physician relations and MSO teams", logo: L("crm-sf") },
  { slug: "microsoft-dynamics-sales", name: "Microsoft Dynamics 365", line: "Enterprise hospital networks", logo: L("microsoft-dynamics-365") },
  { slug: "hubspot", name: "HubSpot", line: "Independent and growing practices", logo: L("hubspot") },
  { slug: "pipedrive", name: "Pipedrive", line: "Boutique recruiting and specialty groups", logo: L("pipedrive") },
  { slug: "zoho-crm", name: "Zoho CRM", line: "Practices on the Zoho suite", logo: L("zoho-crm") },
];

type Conn = { id: string; provider: string; provider_name: string | null; status: string; last_synced_at: string | null; last_error: string | null };
type Status = { plan: string | null; allowed: boolean; ready: boolean; connections: Conn[] };

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("merge-integrations", { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) { const j = await error.context.json().catch(() => null); if (j?.error) msg = j.error; }
    throw new Error(msg);
  }
  return data as T;
}

export function IntegrationsPanel() {
  const nav = useNavigate();
  const [st, setSt] = useState<Status | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [upsell, setUpsell] = useState(false);
  const [link, setLink] = useState<{ token: string; slug: string } | null>(null);

  const load = useCallback(() => call<Status>({ action: "status" }).then(setSt).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const onSuccess = useCallback(async (public_token: string) => {
    if (!link) return;
    try { await call({ action: "complete", provider: link.slug, public_token }); toast.success("Connected."); await load(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLink(null); setBusy(null); }
  }, [link, load]);
  const { open, isReady } = useMergeLink({ linkToken: link?.token ?? "", onSuccess, onExit: () => { setLink(null); setBusy(null); } });
  useEffect(() => { if (link && isReady) open(); }, [link, isReady, open]);

  const connect = async (s: Sys) => {
    if (!st?.allowed) return setUpsell(true);
    if (!st.ready) return toast.error("Integrations are being switched on. Try again shortly.");
    setBusy(s.slug);
    try { const r = await call<{ link_token: string }>({ action: "link_token", provider: s.slug }); setLink({ token: r.link_token, slug: s.slug }); }
    catch (e) { toast.error((e as Error).message); setBusy(null); }
  };
  const disconnect = async (c: Conn) => {
    setBusy(c.provider);
    try { await call({ action: "disconnect", id: c.id }); toast.success("Disconnected."); await load(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  };

  const match = (s: Sys) => !q || s.name.toLowerCase().includes(q.toLowerCase());
  const byProvider = useMemo(() => new Map((st?.connections ?? []).map((c) => [c.provider, c])), [st]);
  const locked = st && !st.allowed;

  const Card = ({ s }: { s: Sys }) => {
    const c = byProvider.get(s.slug);
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <img src={s.logo} alt="" width={40} height={40} className="h-10 w-10 rounded-lg bg-white object-contain p-1" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{s.name}</p>
            <p className="text-xs text-muted-foreground">{s.line}</p>
          </div>
        </div>
        <div className="mt-auto flex items-center gap-2">
          {s.soon && !c ? (
            <Badge variant="secondary">Coming soon</Badge>
          ) : c ? (
            <>
              <span className="inline-flex items-center gap-1 text-sm text-primary"><Check className="h-4 w-4" />Connected</span>
              <Button size="sm" variant="ghost" className="ml-auto" disabled={busy === s.slug} onClick={() => disconnect(c)}>Disconnect</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={!st || busy === s.slug} onClick={() => connect(s)}>
              {busy === s.slug ? <Loader2 className="h-4 w-4 animate-spin" /> : locked ? <Lock className="h-3.5 w-3.5" /> : null}
              Connect
            </Button>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, line, items }: { title: string; line: string; items: Sys[] }) => {
    const shown = items.filter(match);
    if (!shown.length) return null;
    return (
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
          {locked && <Badge variant="secondary">Included on Pro</Badge>}
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">{line}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map((s) => <Card key={s.slug} s={s} />)}</div>
      </section>
    );
  };

  const dests = [
    { name: "Google Sheets", line: "A live sheet that fills itself", Logo: SheetsLogo },
    { name: "Slack", line: "Post approved people into a channel", Logo: SlackLogo },
    { name: "Microsoft Excel", line: "A live workbook you refresh", Logo: ExcelLogo },
  ].filter((d) => !q || d.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-10">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search integrations" className="pl-9" />
      </div>
      <Section title="Applicant tracking systems" line="Send the clinicians you find straight into your ATS as new candidates." items={ATS} />
      <Section title="CRM" line="Add clinicians to your CRM as contacts for physician relations and outreach." items={CRM} />
      {dests.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Live project exports</h2>
          <p className="-mt-2 text-sm text-muted-foreground">Included on every plan. Set these up from any project or agent.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dests.map((d) => (
              <div key={d.name} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-2"><d.Logo className="h-6 w-6" /></span>
                  <div><p className="font-medium text-foreground">{d.name}</p><p className="text-xs text-muted-foreground">{d.line}</p></div>
                </div>
                <Button size="sm" variant="outline" className="mt-auto self-start" onClick={() => nav("/projects")}>Open a project</Button>
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialog open={upsell} onOpenChange={setUpsell}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ATS and CRM connections are on Pro</DialogTitle>
            <DialogDescription>Send clinicians straight into Workday, Salesforce and the rest of your systems on Pro and Enterprise. Your current plan keeps Google Sheets, Slack and Excel exports.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setUpsell(false)}>Not now</Button>
            <Button onClick={() => nav("/settings?tab=billing")}>Upgrade to Pro</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Integrations() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connect the systems your team already works in</p>
        </div>
        <IntegrationsPanel />
      </div>
    </AppLayout>
  );
}
