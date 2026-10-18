import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Zap, FolderKanban, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useCreditBalance } from "@/hooks/useContactEnrich";
import { fetchSearchUsage, type SearchUsage } from "@/lib/search-meter";
import { CreditsPanel } from "@/pages/Credits";

const TABS = ["general", "team", "billing", "monitoring"] as const;

export default function TeamSettings() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.includes(params.get("tab") as never) ? params.get("tab")! : "general";
  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your account, team, credits and usage in one place</p>
        </div>
        <Tabs value={tab} onValueChange={(v) => { params.set("tab", v); params.delete("checkout"); setParams(params, { replace: true }); }}>
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="billing">Billing & Credits</TabsTrigger>
            <TabsTrigger value="monitoring">Usage</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="mt-6"><GeneralTab /></TabsContent>
          <TabsContent value="team" className="mt-6"><TeamTab /></TabsContent>
          <TabsContent value="billing" className="mt-6"><CreditsPanel /></TabsContent>
          <TabsContent value="monitoring" className="mt-6"><MonitoringTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function GeneralTab() {
  const { user } = useAuth();
  const { companyId } = useCompany();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings-general", companyId, user?.id],
    enabled: !!companyId && !!user,
    queryFn: async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("companies").select("name").eq("id", companyId!).maybeSingle(),
        supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { company: c?.name ?? "", name: p?.full_name ?? "" };
    },
  });
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState("");
  useEffect(() => { if (data) { setCompany(data.company); setName(data.name); } }, [data]);

  const save = async () => {
    if (!companyId || !user) return;
    setSaving(true);
    const [a, b] = await Promise.all([
      supabase.from("companies").update({ name: company.trim() || "My Team" }).eq("id", companyId),
      supabase.from("profiles").update({ full_name: name.trim() || null }).eq("user_id", user.id),
    ]);
    setSaving(false);
    if (a.error || b.error) return toast.error("Couldn't save. Only workspace admins can rename the workspace.");
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["settings-general"] });
  };

  const changePw = async () => {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    setPw(""); toast.success("Password updated");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Workspace & profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Workspace name</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Your name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email ?? ""} disabled className="max-w-sm" /></div>
          <div className="flex justify-end"><Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Password</CardTitle></CardHeader>
        <CardContent className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5 max-w-sm"><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <Button size="sm" variant="outline" onClick={changePw}>Update password</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TeamTab() {
  const { companyId } = useCompany();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["settings-members", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").eq("company_id", companyId!),
        supabase.from("user_roles").select("user_id, role").eq("company_id", companyId!),
      ]);
      return (p ?? []).map((m) => ({ ...m, role: r?.find((x) => x.user_id === m.user_id)?.role ?? "recruiter" }));
    },
  });

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader><CardTitle className="font-display text-base">Members</CardTitle><CardDescription>People with access to this workspace</CardDescription></CardHeader>
        <CardContent className="divide-y divide-border">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-3 text-sm">
              <div><p className="font-medium">{m.full_name || m.email}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
              <Badge variant="outline" className="capitalize">{m.role}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Search; label: string; value: string | number; sub?: string }) {
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </CardContent></Card>
  );
}

function MonitoringTab() {
  const { companyId } = useCompany();
  const balance = useCreditBalance(companyId);
  const [usage, setUsage] = useState<SearchUsage | null>(null);
  useEffect(() => { fetchSearchUsage().then(setUsage); }, []);
  const { data } = useQuery({
    queryKey: ["settings-monitoring", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
      const [tx, saved, projects, recent] = await Promise.all([
        supabase.from("credit_transactions").select("credits, kind").eq("company_id", companyId!).gte("created_at", monthStart.toISOString()),
        supabase.from("candidates").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("company_id", companyId!),
        supabase.from("search_history").select("id, query_text, result_count, created_at").eq("company_id", companyId!).gte("created_at", weekAgo).order("created_at", { ascending: false }).limit(25),
      ]);
      const spent = (tx.data ?? []).filter((t) => t.credits < 0).reduce((s, t) => s + -t.credits, 0);
      const found = (tx.data ?? []).filter((t) => t.credits < 0).length;
      return { spent, found, saved: saved.count ?? 0, projects: projects.count ?? 0, recent: recent.data ?? [] };
    },
  });
  const pct = usage ? Math.min(100, (usage.used / usage.limit) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Today's searches</CardTitle><CardDescription>New searches count toward the daily limit. Paging and repeat searches are free.</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm"><span>{usage ? `${usage.used} of ${usage.limit} used` : "Loading…"}</span><span className="text-muted-foreground">Resets midnight UTC</span></div>
          <Progress value={pct} className="h-2" />
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Zap} label="Credits left" value={balance ?? "-"} />
        <Stat icon={Activity} label="Credits used this month" value={data?.spent ?? "-"} sub={data ? `${data.found} contact details found` : undefined} />
        <Stat icon={Users} label="Saved contacts" value={data?.saved ?? "-"} />
        <Stat icon={FolderKanban} label="Projects" value={data?.projects ?? "-"} />
      </div>
      <Card>
        <CardHeader><CardTitle className="font-display text-base">Searches in the last 7 days</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border p-0">
          {(data?.recent.length ?? 0) === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No searches yet.</p> :
            data!.recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-6 py-3 text-sm">
                <span className="truncate">{r.query_text}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.result_count ?? 0} results · {new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
