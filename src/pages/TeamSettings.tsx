import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Users,
  Zap,
  CreditCard,
  Plug,
  Activity,
  ArrowUpRight,
  Copy,
  Mail,
  Plus,
  Download,
  Loader2,
  ShieldCheck,
  Check,
  LockKeyhole,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany } from "@/hooks/useCompany";
import { useCreditBalance } from "@/hooks/useContactEnrich";
import { useInvites } from "@/hooks/useInvites";
import { IntegrationsPanel } from "@/pages/Integrations";
import { EmbeddedCheckoutDialog } from "@/components/EmbeddedCheckoutDialog";
import {
  billingRequest,
  money,
  monthlyMemberSpend,
  saveInvoice,
  type Member,
  type Invoice,
  type PlanOption,
} from "@/lib/settings-data";

const sections = [
  { id: "general", label: "Workspace & profile", icon: Building2 },
  { id: "team", label: "Team & seats", icon: Users },
  { id: "credits", label: "Shared credits & limits", icon: Zap },
  { id: "billing", label: "Billing & invoices", icon: CreditCard },
  { id: "integrations", label: "Connections", icon: Plug },
  { id: "monitoring", label: "Usage & activity", icon: Activity },
];
type Status = {
  subscribed: boolean;
  plan?: string | null;
  interval?: string | null;
  renews_at?: string | null;
  status?: string | null;
  monthly_credits?: number;
  seats_used?: number;
  cancel_at_period_end?: boolean;
};
function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="border-b border-border pb-9 last:border-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export default function TeamSettings() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = sections.some((s) => s.id === requested) ? requested : "general";
  const { companyId } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();
  const balance = useCreditBalance(companyId);
  const context = useQuery({
    queryKey: ["settings-context", companyId, user?.id],
    enabled: !!companyId && !!user,
    queryFn: async () => {
      if (!companyId || !user) throw new Error("Workspace not ready");
      const start = new Date();
      start.setUTCDate(1);
      start.setUTCHours(0, 0, 0, 0);
      const [c, p, r, t, l, b, f, e] = await Promise.all([
        supabase.from("companies").select("name").eq("id", companyId).single(),
        supabase
          .from("profiles")
          .select("user_id,full_name,email")
          .eq("company_id", companyId),
        supabase
          .from("user_roles")
          .select("user_id,role")
          .eq("company_id", companyId),
        supabase
          .from("credit_transactions")
          .select("id,user_id,credits,kind,note,candidate_name,created_at")
          .eq("company_id", companyId)
          .gte("created_at", start.toISOString())
          .order("created_at", { ascending: false }),
        supabase
          .from("member_credit_limits")
          .select("user_id,monthly_limit")
          .eq("company_id", companyId),
        supabase
          .from("credit_balances")
          .select("monthly_allowance")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("company_features")
          .select("plan")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("billing_exemptions")
          .select("unlimited_access")
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);
      for (const result of [c, p, r, t, l, b, f, e])
        if (result.error) throw result.error;
      const tx = t.data ?? [];
      const members: Member[] = (p.data ?? []).map((m) => ({
        ...m,
        role: r.data?.find((x) => x.user_id === m.user_id)?.role ?? "viewer",
        spent: monthlyMemberSpend(tx, m.user_id),
        cap:
          l.data?.find((x) => x.user_id === m.user_id)?.monthly_limit ?? null,
      }));
      return {
        name: c.data.name,
        members,
        tx,
        allowance: b.data?.monthly_allowance ?? 0,
        plan: f.data?.plan ?? null,
        unlimited: e.data?.unlimited_access === true,
        isAdmin:
          r.data?.some((x) => x.user_id === user.id && x.role === "admin") ===
          true,
      };
    },
  });
  const data = context.data;
  const status = useQuery({
    queryKey: ["settings-billing", companyId],
    enabled: !!companyId,
    queryFn: () => billingRequest<Status>("status"),
    retry: 1,
  });
  const catalog = useQuery({
    queryKey: ["settings-catalog", companyId],
    enabled: !!companyId,
    queryFn: () => billingRequest<{ plans: PlanOption[] }>("catalog"),
    staleTime: 300000,
    retry: 1,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["settings-context"] });
    window.dispatchEvent(new Event("oslr:credits"));
  };
  const plan = data?.plan;
  const selected = sections.find((s) => s.id === tab) ?? sections[0];
  const planLabel =
    plan === "pro"
      ? "Pro"
      : plan === "enterprise"
        ? "Enterprise"
        : plan === "beta"
          ? "Early access"
          : status.data?.subscribed
            ? "Starter"
            : "Workspace";
  return (
    <AppLayout>
      <div className="w-full space-y-8 pb-8">
        <header className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-7">
          <div>
            <p className="text-sm font-medium text-primary mb-2">
              {data?.name ?? "Your workspace"}
            </p>
            <h1 className="font-display text-3xl font-bold">Settings</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="px-3 py-1.5">
              {planLabel}
            </Badge>
            <span className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {data?.members.length ?? "–"} members
            </span>
          </div>
        </header>
        <div className="grid gap-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-12">
          <nav
            aria-label="Settings sections"
            className="flex gap-1 overflow-x-auto lg:flex-col lg:self-start lg:sticky lg:top-20 pb-2"
          >
            {sections.map((s) => (
              <Button
                key={s.id}
                variant={tab === s.id ? "secondary" : "ghost"}
                className={`justify-start gap-3 shrink-0 h-11 ${tab === s.id ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("tab", s.id);
                  next.delete("checkout");
                  setParams(next, { replace: true });
                }}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </Button>
            ))}
          </nav>
          <div className="min-w-0 space-y-9">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {data?.isAdmin ? "Workspace administrator" : "Workspace member"}
              <span className="mx-1">/</span>
              {selected.label}
            </div>
            {context.isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : context.error ? (
              <p role="alert" className="text-destructive">
                Couldn't load workspace details.{" "}
                <Button variant="outline" onClick={() => context.refetch()}>
                  Try again
                </Button>
              </p>
            ) : (
              data && (
                <>
                  {tab === "general" && (
                    <General
                      name={data.name}
                      member={data.members.find((m) => m.user_id === user?.id)}
                      isAdmin={data.isAdmin}
                      companyId={companyId}
                      onSaved={invalidate}
                    />
                  )}
                  {tab === "team" && (
                    <Team
                      members={data.members}
                      plan={plan}
                      isAdmin={data.isAdmin}
                      catalog={catalog.data?.plans}
                      onBilling={() => setParams({ tab: "billing" })}
                    />
                  )}
                  {tab === "credits" && (
                    <Credits
                      members={data.members}
                      balance={balance}
                      allowance={status.data?.monthly_credits ?? data.allowance}
                      unlimited={data.unlimited}
                      isAdmin={data.isAdmin}
                      companyId={companyId}
                      options={catalog.data?.plans}
                      plan={plan}
                      onSaved={invalidate}
                    />
                  )}
                  {tab === "billing" && (
                    <Billing
                      status={status.data}
                      statusError={status.isError}
                      unlimited={data.unlimited}
                      isAdmin={data.isAdmin}
                      options={catalog.data?.plans}
                      catalogError={catalog.isError}
                      onChanged={() => status.refetch()}
                    />
                  )}
                  {tab === "integrations" && (
                    <Section title="Workspace connections">
                      <IntegrationsPanel />
                    </Section>
                  )}
                  {tab === "monitoring" && (
                    <>
                      <Section
                        title="Credit activity"
                        description="All workspace credit changes this calendar month. Member limits reset on the first day of each month at midnight UTC."
                      >
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-left text-muted-foreground">
                                <th className="pb-3 font-medium">Date</th>
                                <th className="pb-3 font-medium">Activity</th>
                                <th className="pb-3 font-medium">Member</th>
                                <th className="pb-3 text-right font-medium">
                                  Credits
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {data.tx.map((t) => (
                                <tr
                                  key={t.id}
                                  className="border-b border-border/50"
                                >
                                  <td className="py-4 whitespace-nowrap pr-4">
                                    {new Date(
                                      t.created_at,
                                    ).toLocaleDateString()}
                                  </td>
                                  <td className="py-4 pr-4">
                                    {t.note || t.kind.replace(/_/g, " ")}
                                    {t.candidate_name && (
                                      <p className="text-muted-foreground text-xs">
                                        {t.candidate_name}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-4 pr-4">
                                    {data.members.find(
                                      (m) => m.user_id === t.user_id,
                                    )?.email ?? "Workspace"}
                                  </td>
                                  <td className="py-4 text-right tabular-nums">
                                    {t.credits > 0 ? "+" : ""}
                                    {t.credits}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {!data.tx.length && (
                            <p className="py-12 text-muted-foreground text-center">
                              No credit activity this month.
                            </p>
                          )}
                        </div>
                      </Section>
                      <SearchActivity companyId={companyId} />
                    </>
                  )}
                </>
              )
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
function General({
  name,
  member,
  isAdmin,
  companyId,
  onSaved,
}: {
  name: string;
  member?: Member;
  isAdmin: boolean;
  companyId: string | null;
  onSaved: () => void;
}) {
  const [workspace, setWorkspace] = useState(name);
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!companyId || !member) return;
    setBusy(true);
    try {
      const p = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("user_id", member.user_id);
      if (p.error) throw p.error;
      if (isAdmin) {
        const c = await supabase
          .from("companies")
          .update({ name: workspace.trim() || name })
          .eq("id", companyId);
        if (c.error) throw c.error;
      }
      toast.success("Changes saved");
      onSaved();
    } catch {
      toast.error("Could not save your changes");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Section
        title="Workspace"
        description="Your team's identity and access."
        action={
          <Button onClick={save} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Save changes
          </Button>
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-2">
            <Label>Workspace role</Label>
            <div className="h-10 flex items-center gap-2 text-sm capitalize">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {member?.role ?? "Member"}
            </div>
          </div>
        </div>
      </Section>
      <Section title="Your profile">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Full name</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Email address</Label>
            <Input id="profile-email" value={member?.email ?? ""} disabled />
          </div>
        </div>
      </Section>
      <Section
        title="Security"
        description="Change your password without changing your team's access."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2 flex-1 max-w-md">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={pw.length < 8}
            onClick={async () => {
              const { error } = await supabase.auth.updateUser({
                password: pw,
              });
              if (error) toast.error(error.message);
              else {
                setPw("");
                toast.success("Password updated");
              }
            }}
          >
            <LockKeyhole className="h-4 w-4 mr-2" />
            Update password
          </Button>
        </div>
      </Section>
    </>
  );
}
function Team({
  members,
  plan,
  isAdmin,
  catalog,
  onBilling,
}: {
  members: Member[];
  plan: string | null | undefined;
  isAdmin: boolean;
  catalog?: PlanOption[];
  onBilling: () => void;
}) {
  const { list, create, revoke } = useInvites();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "recruiter" | "viewer">(
    "recruiter",
  );
  const [sending, setSending] = useState<string | null>(null);
  const pending = (list.data ?? []).filter((i) => !i.accepted_at);
  const cap =
    plan === "enterprise"
      ? null
      : (catalog?.find((p) => p.id === plan)?.seats ??
        (plan === "pro" ? 5 : 1));
  const full = cap !== null && members.length + pending.length >= cap;
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(
        `https://oslr.health/auth?invite=${encodeURIComponent(token)}`,
      );
      toast.success("Invitation link copied");
    } catch {
      toast.error("Could not copy the invitation link");
    }
  };
  const invite = async () => {
    try {
      const i = await create.mutateAsync({ email, role });
      setOpen(false);
      setEmail("");
      toast[i.emailSent ? "success" : "warning"](
        i.emailSent
          ? "Invitation emailed"
          : "Invitation created. Copy the link to share it.",
      );
    } catch (e) {
      toast.error(
        (e as Error).message.includes("seat_limit")
          ? "Your available seats are all reserved."
          : (e as Error).message,
      );
    }
  };
  return (
    <>
      <Section
        title="Team & seats"
        description={`${members.length} active ${members.length === 1 ? "member" : "members"} · ${pending.length} pending ${pending.length === 1 ? "invitation" : "invitations"}${cap === null ? "" : ` · ${cap} seat maximum`}`}
        action={
          isAdmin && (
            <Button onClick={() => (full ? onBilling() : setOpen(true))}>
              <Plus className="h-4 w-4 mr-2" />
              {full ? "Review plan" : "Invite teammate"}
            </Button>
          )
        }
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Shared monthly pool</p>
            <p className="mt-2 text-2xl font-semibold">
              {plan === "pro"
                ? `${(members.length * 500).toLocaleString()} credits`
                : plan === "enterprise"
                  ? "Custom allocation"
                  : "150 credits"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {plan === "pro"
                ? "500 credits per active seat, shared across the entire team. Pending invitations do not add credits."
                : "All members use the same workspace credit balance."}
            </p>
          </div>
          <div className="border-l-0 md:border-l border-border md:pl-6">
            <p className="text-sm font-medium">Seat billing</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Your existing subscription amount is shown in Billing. Additional
              seats are not currently billed separately. No extra seat price has
              been introduced.
            </p>
          </div>
        </div>
      </Section>
      <Section
        title="Members"
        description="Admins manage workspace settings, invitations and billing. Recruiters source clinicians. Viewers have read-only access."
      >
        <div className="divide-y divide-border">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-4 py-5">
              <div className="h-10 w-10 shrink-0 rounded-full bg-secondary flex items-center justify-center text-primary font-semibold">
                {(m.full_name || m.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{m.full_name || m.email}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {m.email}
                </p>
              </div>
              <Badge variant="outline" className="capitalize">
                {m.role}
              </Badge>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Pending invitations"
        description="Each pending invitation reserves a seat until it is accepted or cancelled."
      >
        {list.isError ? (
          <p className="text-destructive">Could not load invitations.</p>
        ) : pending.length ? (
          <div className="divide-y divide-border">
            {pending.map((i) => (
              <div
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div>
                  <p className="text-sm font-medium break-all">{i.email}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-1">
                    {i.role} · invited{" "}
                    {new Date(i.created_at).toLocaleDateString()}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copy(i.token)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={sending === i.id}
                      onClick={async () => {
                        setSending(i.id);
                        const { data, error } = await supabase.functions.invoke(
                          "send-invite",
                          { body: { invite_id: i.id } },
                        );
                        setSending(null);
                        if (error || !data?.emailSent)
                          toast.error(
                            "Email could not be delivered. Share the link instead.",
                          );
                        else toast.success("Invitation resent");
                      }}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Resend
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate(i.id, {
                          onError: () =>
                            toast.error("Could not cancel invitation"),
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-sm text-muted-foreground">
            No pending invitations.
          </p>
        )}
      </Section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              Reserve a workspace seat. Your teammate shares the existing credit
              pool.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@practice.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as typeof role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="recruiter">Recruiter</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              {plan === "pro"
                ? "When accepted, this seat adds 500 credits to the shared pool. Set a spending limit in Shared credits & limits after they join."
                : "Credit limits can be set once your teammate joins."}
            </p>
            <Button
              className="w-full"
              disabled={create.isPending || !/^\S+@\S+\.\S+$/.test(email)}
              onClick={invite}
            >
              {create.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send invitation
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function Credits({
  members,
  balance,
  allowance,
  unlimited,
  isAdmin,
  companyId,
  options,
  plan,
  onSaved,
}: {
  members: Member[];
  balance: number | null;
  allowance: number;
  unlimited: boolean;
  isAdmin: boolean;
  companyId: string | null;
  options?: PlanOption[];
  plan: string | null | undefined;
  onSaved: () => void;
}) {
  const spent = members.reduce((s, m) => s + m.spent, 0);
  const rates = options?.find((p) => p.id === plan)?.contact_costs;
  return (
    <>
      <Section
        title="One shared credit pool"
        description="Member limits are spending guardrails, not separate balances. Every charged contact lookup and agent build uses the workspace pool."
      >
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 mb-7">
          <div>
            <p className="text-sm text-muted-foreground">Available now</p>
            <p className="text-3xl font-semibold mt-2 text-primary">
              {unlimited ? "Unlimited" : (balance?.toLocaleString() ?? "–")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Monthly allocation</p>
            <p className="text-3xl font-semibold mt-2">
              {unlimited
                ? "Included"
                : allowance
                  ? allowance.toLocaleString()
                  : "Not set"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Team spending this month
            </p>
            <p className="text-3xl font-semibold mt-2">
              {spent.toLocaleString()}
            </p>
          </div>
        </div>
        {!unlimited && (
          <Progress
            value={
              allowance ? Math.min(100, ((balance ?? 0) / allowance) * 100) : 0
            }
            className="h-2"
          />
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Unused subscription credits expire at the monthly reset. Annual
          subscriptions receive credits one month at a time.
        </p>
      </Section>
      <Section
        title="Member spending limits"
        description="Limits reset on the first of each calendar month at midnight UTC. No limit means a member can use the available shared balance. Set 0 to pause new credit spending."
      >
        <div className="divide-y divide-border">
          {members.map((m) => (
            <MemberLimit
              key={m.user_id}
              member={m}
              isAdmin={isAdmin}
              companyId={companyId}
              onSaved={onSaved}
            />
          ))}
        </div>
      </Section>
      <Section
        title="Contact lookup costs"
        description="Charged only when contact details are found. Previously unlocked details remain available across your workspace without another charge."
      >
        {rates ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["work_email", "Work email"],
              ["personal_email", "Personal email"],
              ["phone", "Phone number"],
            ].map(([key, label]) => (
              <div key={key} className="border border-border rounded-lg p-5">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-xl font-semibold">
                  {rates[key]} {rates[key] === 1 ? "credit" : "credits"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Contact costs appear when your plan information is available.
          </p>
        )}
      </Section>
    </>
  );
}
function MemberLimit({
  member: m,
  isAdmin,
  companyId,
  onSaved,
}: {
  member: Member;
  isAdmin: boolean;
  companyId: string | null;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(m.cap === null ? "" : String(m.cap));
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(m.cap === null ? "" : String(m.cap)), [m.cap]);
  const save = async () => {
    if (!companyId) return;
    const n = value === "" ? null : Number(value);
    if (n !== null && (!Number.isSafeInteger(n) || n < 0))
      return toast.error("Enter a whole number of credits");
    setBusy(true);
    const result =
      n === null
        ? await supabase
            .from("member_credit_limits")
            .delete()
            .eq("company_id", companyId)
            .eq("user_id", m.user_id)
        : await supabase
            .from("member_credit_limits")
            .upsert({
              company_id: companyId,
              user_id: m.user_id,
              monthly_limit: n,
              updated_at: new Date().toISOString(),
            });
    setBusy(false);
    if (result.error) toast.error("Could not save credit limit");
    else {
      toast.success("Credit limit saved");
      onSaved();
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-5 py-5">
      <div className="min-w-0 flex-1 basis-48">
        <p className="font-medium break-all">{m.full_name || m.email}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {m.spent.toLocaleString()} spent
          {m.cap === null
            ? " · No member limit"
            : ` of ${m.cap.toLocaleString()} credits`}
        </p>
        {m.cap !== null && (
          <Progress
            className="mt-2 h-1 max-w-xs"
            value={m.cap ? Math.min(100, (m.spent / m.cap) * 100) : 100}
          />
        )}
      </div>
      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Input
            aria-label={`Credit limit for ${m.email}`}
            type="number"
            min="0"
            step="1"
            placeholder="No limit"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-32"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy || value === (m.cap === null ? "" : String(m.cap))}
            onClick={save}
          >
            Save limit
          </Button>
        </div>
      ) : (
        <Badge variant="outline">
          {m.cap === null ? "No limit" : `${m.cap} credits / month`}
        </Badge>
      )}
    </div>
  );
}
function Billing({
  status,
  statusError,
  unlimited,
  isAdmin,
  options,
  catalogError,
  onChanged,
}: {
  status?: Status;
  statusError: boolean;
  unlimited: boolean;
  isAdmin: boolean;
  options?: PlanOption[];
  catalogError: boolean;
  onChanged: () => void;
}) {
  const [pick, setPick] = useState<"starter" | "pro" | "beta">("starter");
  const [year, setYear] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { companyId } = useCompany();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [prepared, setPrepared] = useState<{ blob: Blob; name: string } | null>(null);
  const invoices = useQuery({
    queryKey: ["settings-invoices", companyId],
    enabled: isAdmin && !!companyId,
    queryFn: () =>
      billingRequest<{
        invoices: Invoice[];
        payment_method: {
          brand: string;
          last4: string;
          exp_month: number;
          exp_year: number;
        } | null;
      }>("invoices"),
    retry: 1,
  });
  const plan = options?.find((p) => p.id === status?.plan);
  const price = plan?.prices.find((p) => p.interval === status?.interval);
  const selected = options
    ?.find((p) => p.id === pick)
    ?.prices.find(
      (p) => p.interval === (year && pick !== "beta" ? "year" : "month"),
    );
  const portal = async () => {
    setBusy(true);
    try {
      const d = await billingRequest<{ url: string }>("portal");
      window.location.assign(d.url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const download = async (i: Invoice) => {
    setDownloading(i.id);
    try {
      const { data, error } = await supabase.functions.invoke("billing", {
        body: { action: "invoice_pdf", invoice_id: i.id },
      });
      if (error || !(data instanceof Blob) || data.size === 0)
        throw new Error("Invoice download unavailable");
      setPrepared({ blob: data, name: `oslr-invoice-${i.number || i.id}.pdf` });
    } catch {
      toast.error("Could not download this invoice. Please try again.");
    } finally {
      setDownloading(null);
    }
  };
  return (
    <>
      <Section
        title="Your subscription"
        description="Prices below come directly from your billing account. No additional seat charge has been added."
        action={
          isAdmin &&
          status?.subscribed && (
            <div className="flex flex-wrap gap-2">
              {status.plan !== "pro" && options?.find(p => p.id === "pro") && <Button onClick={() => setUpgradeOpen(true)} disabled={busy}>Upgrade to Pro</Button>}
              <Button variant="outline" onClick={portal} disabled={busy}>
                Manage subscription
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )
        }
      >
        {statusError ? (
          <p role="alert" className="text-destructive">
            Billing is temporarily unavailable. Your subscription has not been
            changed.
          </p>
        ) : !status ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <div className="flex flex-wrap gap-8 items-start justify-between">
            <div>
              <Badge variant="outline" className="capitalize mb-4">
                {unlimited
                  ? "Unlimited pass"
                  : status.subscribed
                    ? (status.status ?? "Active")
                    : "No active subscription"}
              </Badge>
              <p className="font-display text-2xl font-bold capitalize">
                {unlimited
                  ? "Approved access"
                  : status.subscribed
                    ? status.plan === "beta"
                      ? "Early access"
                      : `${status.plan} plan`
                    : "Choose your plan"}
              </p>
              {price?.amount !== null && price?.amount !== undefined && (
                <p className="text-xl mt-3">
                  {money(price.amount, price.currency)}{" "}
                  <span className="text-sm text-muted-foreground">
                    / {status.interval === "year" ? "year" : "month"}
                  </span>
                </p>
              )}
              {status.renews_at && (
                <p className="text-sm text-muted-foreground mt-3">
                  {status.cancel_at_period_end ? "Ends" : "Renews"}{" "}
                  {new Date(status.renews_at).toLocaleDateString()}
                </p>
              )}
            </div>
            {isAdmin && !status.subscribed && !unlimited && (
              <div className="space-y-3 min-w-0">
                <div className="flex gap-1 flex-wrap">
                  {(options ?? []).map((p) => (
                    <Button
                      key={p.id}
                      variant={pick === p.id ? "secondary" : "ghost"}
                      onClick={() => setPick(p.id)}
                      className="capitalize"
                    >
                      {p.id === "beta" ? "Early access" : p.id}
                    </Button>
                  ))}
                </div>
                {pick !== "beta" && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={!year ? "secondary" : "ghost"}
                      onClick={() => setYear(false)}
                    >
                      Monthly
                    </Button>
                    <Button
                      size="sm"
                      variant={year ? "secondary" : "ghost"}
                      onClick={() => setYear(true)}
                    >
                      Annual
                    </Button>
                  </div>
                )}
                <Button
                  disabled={!selected || selected.amount === null}
                  onClick={() => setCheckout(true)}
                >
                  Subscribe
                  {selected?.amount !== null && selected?.amount !== undefined
                    ? ` · ${money(selected.amount, selected.currency)}`
                    : ""}
                </Button>
              </div>
            )}
          </div>
        )}
        {catalogError && (
          <p className="text-sm text-muted-foreground mt-4">
            Current prices could not be loaded. No estimated prices are shown.
          </p>
        )}
        {!isAdmin && (
          <p className="text-sm text-muted-foreground mt-4">
            Ask your workspace admin to manage billing.
          </p>
        )}
        <EmbeddedCheckoutDialog
          open={checkout}
          onOpenChange={setCheckout}
          plan={pick}
          interval={year && pick !== "beta" ? "year" : "month"}
        />
        <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}><DialogContent><DialogHeader><DialogTitle>Upgrade to Pro</DialogTitle><DialogDescription>Your current billing interval is retained. Your billing account calculates any prorated charge before issuing the invoice.</DialogDescription></DialogHeader><p className="text-sm">{(() => { const next=options?.find(p=>p.id==='pro')?.prices.find(p=>p.interval===status?.interval); return next?.amount!==null&&next?.amount!==undefined?`${money(next.amount,next.currency)} per ${status?.interval==='year'?'year':'month'}`:'Current price unavailable'; })()}</p><Button disabled={busy} onClick={async()=>{setBusy(true);try{await billingRequest('upgrade',{interval:status?.interval});setUpgradeOpen(false);onChanged();toast.success('Upgraded to Pro');}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}}>Confirm upgrade</Button></DialogContent></Dialog>
        <Dialog open={!!prepared} onOpenChange={open=>{if(!open)setPrepared(null);}}><DialogContent><DialogHeader><DialogTitle>Invoice ready</DialogTitle><DialogDescription>Your official invoice PDF is ready to save.</DialogDescription></DialogHeader><Button onClick={()=>{if(!prepared)return;saveInvoice(prepared.blob,prepared.name);setPrepared(null);}}><Download className="h-4 w-4 mr-2"/>Download PDF</Button></DialogContent></Dialog>
      </Section>
      {isAdmin && (
        <>
          <Section
            title="Payment method"
            action={
              status?.subscribed && (
                <Button variant="outline" onClick={portal}>
                  Update payment method
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              )
            }
          >
            {invoices.data?.payment_method ? (
              <div className="flex items-center gap-4">
                <CreditCard className="h-8 w-8 text-primary" />
                <div>
                  <p className="capitalize font-medium">
                    {invoices.data.payment_method.brand} ····{" "}
                    {invoices.data.payment_method.last4}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Expires {invoices.data.payment_method.exp_month}/
                    {invoices.data.payment_method.exp_year}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {invoices.isLoading
                  ? "Checking payment details…"
                  : "No default payment method available."}
              </p>
            )}
          </Section>
          <Section
            title="Invoices"
            description="Your 12 most recent official invoices. Download the PDF here or open the hosted invoice."
          >
            {invoices.isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : invoices.isError ? (
              <div className="flex gap-3 items-center">
                <p className="text-sm text-destructive">
                  Could not load invoices.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => invoices.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : !invoices.data?.invoices.length ? (
              <div className="py-12 text-center">
                <CreditCard className="h-7 w-7 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No invoices yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Invoices will appear when your subscription is billed.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="font-medium pb-3">Invoice</th>
                      <th className="font-medium pb-3">Date</th>
                      <th className="font-medium pb-3">Amount</th>
                      <th className="font-medium pb-3">Status</th>
                      <th className="font-medium pb-3 text-right">Documents</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.data.invoices.map((i) => (
                      <tr key={i.id} className="border-b border-border/50">
                        <td className="py-4 pr-4 whitespace-nowrap">
                          {i.number ?? i.id}
                        </td>
                        <td className="py-4 pr-4 whitespace-nowrap">
                          {new Date(i.created * 1000).toLocaleDateString()}
                        </td>
                        <td className="py-4 pr-4 whitespace-nowrap">
                          {money(i.amount, i.currency)}
                        </td>
                        <td className="py-4 pr-4">
                          <Badge variant="outline" className="capitalize">
                            {i.status}
                          </Badge>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex justify-end gap-2">
                            {i.has_pdf && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={downloading === i.id}
                                onClick={() => download(i)}
                              >
                                {downloading === i.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Download className="h-4 w-4 mr-2" />
                                )}
                                PDF
                              </Button>
                            )}
                            {i.hosted_url && (
                              <Button variant="ghost" size="icon" asChild>
                                <a
                                  href={i.hosted_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Open invoice ${i.number ?? i.id}`}
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </>
      )}
    </>
  );
}
function SearchActivity({ companyId }: { companyId: string | null }) {
  const searches = useQuery({
    queryKey: ["settings-search-activity", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("search_history")
        .select("id,query_text,result_count,created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Section title="Recent searches">
      <div className="divide-y divide-border">
        {searches.data?.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap justify-between gap-3 py-4 text-sm"
          >
            <p>{s.query_text}</p>
            <p className="text-muted-foreground">
              {s.result_count ?? 0} results ·{" "}
              {new Date(s.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
      {searches.isError ? (
        <p className="text-destructive">Could not load searches.</p>
      ) : (
        !searches.isLoading &&
        !searches.data?.length && (
          <p className="text-muted-foreground text-sm">No searches yet.</p>
        )
      )}
    </Section>
  );
}
