import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Mail,
  Plus,
  FileText,
  Trash2,
  Pencil,
  Loader2,
  Send,
  Users,
  Calendar,
  Eye,
  MousePointerClick,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import {
  useCampaigns,
  useTemplates,
  useDeleteTemplate,
  useDeleteCampaign,
  useSendCampaign,
  type CampaignRow,
} from "@/hooks/useCampaigns";
import { TemplateEditor } from "@/components/TemplateEditor";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { CampaignAnalyticsDrawer } from "@/components/CampaignAnalyticsDrawer";
import { SendCampaignConfirmDialog } from "@/components/SendCampaignConfirmDialog";
import { toast } from "sonner";

function statusBadge(status: string) {
  switch (status) {
    case "draft":
      return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
    case "sent":
      return <Badge className="text-[10px] bg-success/10 text-success border-success/20">Sent</Badge>;
    case "sending":
      return <Badge className="text-[10px] bg-warning/10 text-warning border-warning/20">Sending…</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

function RatePill({ value, icon: Icon, colorClass }: { value: number; icon: React.FC<{ className?: string }>; colorClass: string }) {
  return (
    <span className={`flex items-center gap-1 text-[11px] font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {value.toFixed(1)}%
    </span>
  );
}

export default function Campaigns() {
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const deleteCampaign = useDeleteCampaign();
  const sendCampaign = useSendCampaign();

  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [campaignBuilderOpen, setCampaignBuilderOpen] = useState(false);
  const [analyticsDrawerOpen, setAnalyticsDrawerOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [campaignToSend, setCampaignToSend] = useState<CampaignRow | null>(null);

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateEditorOpen(true);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setTemplateEditorOpen(true);
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Template deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleDeleteCampaign = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteCampaign.mutateAsync(id);
      toast.success("Campaign deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleSendCampaign = async (e: React.MouseEvent, campaign: CampaignRow) => {
    e.stopPropagation();
    setSendingId(campaign.id);
    try {
      const result = await sendCampaign.mutateAsync(campaign.id);
      const skipped = result.skipped_due_to_limit || 0;
      if (result.mock) {
        toast.success(`Campaign queued (mock mode) — ${result.sent} emails simulated.${skipped > 0 ? ` ${skipped} skipped (daily limit).` : ""} Add your Resend API key to go live.`, {
          duration: 6000,
        });
      } else {
        toast.success(`Campaign sent to ${result.sent} of ${result.total} recipients!${skipped > 0 ? ` ${skipped} skipped due to daily limit.` : ""}`);
      }
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} failed: ${result.errors[0]}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send campaign");
    } finally {
      setSendingId(null);
    }
  };

  const handleOpenAnalytics = (campaign: CampaignRow) => {
    setSelectedCampaign(campaign);
    setAnalyticsDrawerOpen(true);
  };

  const isLoading = campaignsLoading || templatesLoading;

  // Summary stats across all campaigns
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0);
  const totalOpens = campaigns.reduce((sum, c) => sum + (c.open_count || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.click_count || 0), 0);
  const overallOpenRate = totalSent > 0 ? (totalOpens / totalSent) * 100 : 0;
  const overallClickRate = totalSent > 0 ? (totalClicks / totalSent) * 100 : 0;
  const sentCampaigns = campaigns.filter((c) => c.status === "sent");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Campaigns</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Email outreach campaigns with open &amp; click tracking
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNewTemplate}>
              <FileText className="h-4 w-4 mr-2" />
              New Template
            </Button>
            <Button onClick={() => setCampaignBuilderOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>

        {/* Overview stat cards — only when there's data */}
        {sentCampaigns.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Send, label: "Emails Sent", value: totalSent.toLocaleString(), colorClass: "text-foreground" },
              { icon: Eye, label: "Total Opens", value: totalOpens.toLocaleString(), colorClass: "text-primary" },
              { icon: MousePointerClick, label: "Total Clicks", value: totalClicks.toLocaleString(), colorClass: "text-warning" },
              {
                icon: BarChart3,
                label: "Avg Open Rate",
                value: `${overallOpenRate.toFixed(1)}%`,
                colorClass: "text-success",
              },
            ].map(({ icon: Icon, label, value, colorClass }) => (
              <Card key={label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </div>
                  <p className={`text-xl font-bold font-display ${colorClass}`}>{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="campaigns">
            <TabsList>
              <TabsTrigger value="campaigns" className="text-xs">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Campaigns ({campaigns.length})
              </TabsTrigger>
              <TabsTrigger value="templates" className="text-xs">
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Templates ({templates.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Campaigns Tab ─────────────────────────────────── */}
            <TabsContent value="campaigns" className="mt-4">
              {campaigns.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                        <Mail className="h-6 w-6 opacity-30" />
                      </div>
                      <p className="text-sm font-medium">No campaigns yet</p>
                      <p className="text-xs mt-1 opacity-60">Create a template first, then build a campaign</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/30">
                          <TableHead className="font-medium">Campaign</TableHead>
                          <TableHead className="font-medium">Template</TableHead>
                          <TableHead className="font-medium">Project</TableHead>
                          <TableHead className="font-medium text-center">Recipients</TableHead>
                          <TableHead className="font-medium text-center">Open Rate</TableHead>
                          <TableHead className="font-medium text-center">Click Rate</TableHead>
                          <TableHead className="font-medium">Status</TableHead>
                          <TableHead className="font-medium">Created</TableHead>
                          <TableHead className="w-[100px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((c) => {
                          const sent = c.sent_count || 0;
                          const opens = c.open_count || 0;
                          const clicks = c.click_count || 0;
                          const openRate = sent > 0 ? (opens / sent) * 100 : null;
                          const clickRate = sent > 0 ? (clicks / sent) * 100 : null;
                          const isSending = sendingId === c.id;

                          return (
                            <TableRow
                              key={c.id}
                              className="group cursor-pointer hover:bg-secondary/30 transition-colors"
                              onClick={() => handleOpenAnalytics(c)}
                            >
                              <TableCell className="font-medium text-sm">{c.name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {c.email_templates?.name || "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {c.projects?.name || "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1 text-sm">
                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                  {c.recipient_count}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {openRate !== null ? (
                                  <RatePill value={openRate} icon={Eye} colorClass="text-primary" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {clickRate !== null ? (
                                  <RatePill value={clickRate} icon={MousePointerClick} colorClass="text-warning" />
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell>{statusBadge(c.status)}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(c.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {c.status === "draft" && (
                                    <button
                                      onClick={(e) => handleSendCampaign(e, c)}
                                      disabled={isSending}
                                      title="Send campaign"
                                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    >
                                      {isSending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Send className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                  {c.status === "sent" && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleOpenAnalytics(c); }}
                                      title="View analytics"
                                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    >
                                      <BarChart3 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handleDeleteCampaign(e, c.id)}
                                    title="Delete campaign"
                                    className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Templates Tab ─────────────────────────────────── */}
            <TabsContent value="templates" className="mt-4">
              {templates.length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary mb-3">
                        <FileText className="h-6 w-6 opacity-30" />
                      </div>
                      <p className="text-sm font-medium">No templates yet</p>
                      <p className="text-xs mt-1 opacity-60">Create an email template with merge fields</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={handleNewTemplate}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t) => (
                    <Card
                      key={t.id}
                      className="group cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                      onClick={() => handleEditTemplate(t)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                              <FileText className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <h3 className="text-sm font-semibold font-display truncate">{t.name}</h3>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditTemplate(t); }}
                              className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteTemplate(e, t.id)}
                              className="p-1 rounded-md text-muted-foreground/50 hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{t.subject || "No subject"}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-1 line-clamp-2">{t.body || "Empty body"}</p>
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground/50">
                          <Calendar className="h-3 w-3" />
                          {new Date(t.created_at).toLocaleDateString()}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Resend API notice banner */}
        {!isLoading && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Email API not configured yet.</span>{" "}
              Campaigns will run in mock/simulation mode until you add your Resend API key in settings.
              Once configured, live emails will send and tracking data will populate automatically.
            </div>
          </div>
        )}
      </div>

      <TemplateEditor
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        template={editingTemplate}
      />

      <CampaignBuilder
        open={campaignBuilderOpen}
        onOpenChange={setCampaignBuilderOpen}
      />

      <CampaignAnalyticsDrawer
        campaign={selectedCampaign}
        open={analyticsDrawerOpen}
        onOpenChange={setAnalyticsDrawerOpen}
      />
    </AppLayout>
  );
}
