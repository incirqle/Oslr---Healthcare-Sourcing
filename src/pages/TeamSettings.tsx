import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  UserPlus,
  Mail,
  Settings2,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Key,
  Gauge,
  Shield,
} from "lucide-react";
import { useCompanyEmailSettings, useUpdateCompanyEmailSettings, useDailySendUsage } from "@/hooks/useCampaigns";
import { toast } from "sonner";

export default function TeamSettings() {
  const { data: emailSettings, isLoading: settingsLoading } = useCompanyEmailSettings();
  const { data: sentToday = 0 } = useDailySendUsage();
  const updateSettings = useUpdateCompanyEmailSettings();

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [dailyLimit, setDailyLimit] = useState(200);
  const [dirty, setDirty] = useState(false);

  // Populate form when settings load
  useEffect(() => {
    if (emailSettings) {
      setFromName(emailSettings.from_name || "");
      setFromEmail(emailSettings.from_email || "");
      setReplyTo(emailSettings.reply_to_email || "");
      setDailyLimit(emailSettings.daily_email_limit ?? 200);
      setDirty(false);
    }
  }, [emailSettings]);

  const handleChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      setDailyLimit(val);
      setDirty(true);
    }
  };

  const handleSaveEmailSettings = async () => {
    if (!fromName.trim() || !fromEmail.trim()) {
      toast.error("From Name and From Email are required");
      return;
    }
    try {
      await updateSettings.mutateAsync({
        from_name: fromName.trim(),
        from_email: fromEmail.trim(),
        reply_to_email: replyTo.trim() || undefined,
        daily_email_limit: dailyLimit,
      });
      toast.success("Email settings saved");
      setDirty(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const usagePercent = dailyLimit > 0 ? Math.min((sentToday / dailyLimit) * 100, 100) : 0;
  const remaining = Math.max(0, dailyLimit - sentToday);

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your team, email sender identity, and integrations
            </p>
          </div>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Team Members</CardTitle>
            <CardDescription className="text-xs">
              Manage who has access to your recruiting workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-24 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
              Set up your company to manage team members.
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Email Sender Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0 mt-0.5">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-display">Email Sender Identity</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configure how your outreach emails appear to candidates. These settings apply to all campaigns.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {settingsLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">From Name <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. Sarah Jones, Acme Recruiting"
                      value={fromName}
                      onChange={handleChange(setFromName)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      The name candidates will see as the sender
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">From Email <span className="text-destructive">*</span></Label>
                    <Input
                      type="email"
                      placeholder="e.g. outreach@yourcompany.com"
                      value={fromEmail}
                      onChange={handleChange(setFromEmail)}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Must be on your verified sending domain
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Reply-To Email <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input
                    type="email"
                    placeholder="e.g. sarah@yourcompany.com"
                    value={replyTo}
                    onChange={handleChange(setReplyTo)}
                    className="max-w-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Where candidate replies will go. Defaults to the From Email if left blank.
                  </p>
                </div>

                {/* Preview */}
                {(fromName || fromEmail) && (
                  <div className="rounded-lg bg-secondary/50 border border-border p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">Email Preview</p>
                    <div className="text-sm space-y-0.5">
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-16 flex-shrink-0 text-xs">From:</span>
                        <span className="font-medium">{fromName || "—"} &lt;{fromEmail || "…"}&gt;</span>
                      </div>
                      {replyTo && (
                        <div className="flex gap-2">
                          <span className="text-muted-foreground w-16 flex-shrink-0 text-xs">Reply-To:</span>
                          <span>{replyTo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {emailSettings?.from_email ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        Sender identity configured
                      </>
                    ) : (
                      <>
                        <Settings2 className="h-3.5 w-3.5" />
                        Not configured — emails will use a fallback sender
                      </>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveEmailSettings}
                    disabled={!dirty || updateSettings.isPending}
                    size="sm"
                  >
                    {updateSettings.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily Sending Limits */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 flex-shrink-0 mt-0.5">
                <Shield className="h-4 w-4 text-success" />
              </div>
              <div>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  Deliverability Controls
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Protect your sender reputation with daily sending limits
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {settingsLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Usage Meter */}
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Today's Usage</span>
                    </div>
                    <Badge
                      variant={usagePercent >= 90 ? "destructive" : usagePercent >= 70 ? "secondary" : "outline"}
                      className="text-[10px]"
                    >
                      {sentToday.toLocaleString()} / {dailyLimit.toLocaleString()}
                    </Badge>
                  </div>
                  <Progress
                    value={usagePercent}
                    className={`h-2 ${usagePercent >= 90 ? "[&>div]:bg-destructive" : usagePercent >= 70 ? "[&>div]:bg-warning" : ""}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    {remaining.toLocaleString()} emails remaining today. Resets at midnight UTC.
                  </p>
                </div>

                {/* Daily Limit Config */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Daily Email Limit</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      max={10000}
                      value={dailyLimit}
                      onChange={handleLimitChange}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">emails per day</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Campaigns that exceed this limit will be partially sent. Lower limits improve deliverability for new domains.
                  </p>
                </div>

                {/* Recommendations */}
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs space-y-1.5">
                  <p className="font-medium text-foreground">Deliverability tips:</p>
                  <ul className="text-muted-foreground space-y-1 ml-3 list-disc">
                    <li>New domains: Start with 50-100 emails/day, increase by 50 each week</li>
                    <li>Established domains: 200-500 emails/day is typically safe</li>
                    <li>Keep bounce rate below 2% and spam complaints below 0.1%</li>
                  </ul>
                </div>

                {dirty && (
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveEmailSettings}
                      disabled={updateSettings.isPending}
                      size="sm"
                    >
                      {updateSettings.isPending ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* API Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary flex-shrink-0 mt-0.5">
                <Key className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  Resend API Integration
                  <Badge variant="secondary" className="text-[10px]">Pending Setup</Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Connect your Resend account to enable live email delivery and tracking
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                <div className="space-y-1.5 text-sm">
                  <p className="font-medium text-foreground">Email API key required to go live</p>
                  <p className="text-xs text-muted-foreground">
                    Campaigns currently run in simulation mode. To send real emails and receive open/click
                    tracking data, add your Resend API key to the project secrets.
                  </p>
                </div>
              </div>
              <div className="pl-6.5 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">1</span>
                  Sign up at <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">resend.com</a> and get your API key
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">2</span>
                  Add and verify your sending domain in Resend
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">3</span>
                  Add <code className="bg-secondary rounded px-1">RESEND_API_KEY</code> to your project secrets
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold">4</span>
                  Set up the Resend webhook pointing to your <code className="bg-secondary rounded px-1">/resend-webhook</code> endpoint for tracking
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
