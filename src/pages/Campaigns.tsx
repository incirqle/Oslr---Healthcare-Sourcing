import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { useCampaigns, useTemplates, useDeleteTemplate, useDeleteCampaign } from "@/hooks/useCampaigns";
import { TemplateEditor } from "@/components/TemplateEditor";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { toast } from "sonner";

export default function Campaigns() {
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const { data: templates = [], isLoading: templatesLoading } = useTemplates();
  const deleteTemplate = useDeleteTemplate();
  const deleteCampaign = useDeleteCampaign();

  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [campaignBuilderOpen, setCampaignBuilderOpen] = useState(false);

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

  const isLoading = campaignsLoading || templatesLoading;

  const statusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary" className="text-[10px]">Draft</Badge>;
      case "sent":
        return <Badge className="text-[10px] bg-success/10 text-success border-0">Sent</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Campaigns</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Email outreach campaigns for your candidates
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
                          <TableHead className="font-medium">Recipients</TableHead>
                          <TableHead className="font-medium">Status</TableHead>
                          <TableHead className="font-medium">Created</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaigns.map((c) => (
                          <TableRow key={c.id} className="group">
                            <TableCell className="font-medium text-sm">{c.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(c as any).email_templates?.name || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {(c as any).projects?.name || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-sm">
                                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                {c.recipient_count}
                              </div>
                            </TableCell>
                            <TableCell>{statusBadge(c.status)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={(e) => handleDeleteCampaign(e, c.id)}
                                className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

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
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <FileText className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <h3 className="text-sm font-semibold font-display">{t.name}</h3>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </AppLayout>
  );
}
