import { Link, useParams } from "react-router-dom";
import { Plug } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { AgentConnections, SheetsLogo, SlackLogo, ExcelLogo } from "@/components/agents/AgentConnections";
import { Button } from "@/components/ui/button";
import { SendToSystem } from "@/components/SendToSystem";
import { useProject } from "@/hooks/useProjects";

export default function ProjectConnections() {
  const { id } = useParams();
  const { data: project, isLoading } = useProject(id ?? "");
  return <AppLayout>
    {isLoading ? <p className="py-12 text-muted-foreground">Loading connections…</p> : !project || !id ? <p className="py-12 text-muted-foreground">Project not found.</p> : <div className="max-w-5xl space-y-8">
      <header><h1 className="font-display text-2xl font-semibold">Connections & Sync</h1><p className="mt-2 text-sm text-muted-foreground">Destination project: <span className="font-medium text-foreground">{project.name}</span></p></header>
      <div className="flex flex-wrap gap-6 text-sm font-medium">
        <span className="flex items-center gap-2"><SheetsLogo />Google Sheets</span>
        <span className="flex items-center gap-2"><SlackLogo />Slack</span>
        <span className="flex items-center gap-2"><ExcelLogo />Microsoft Excel</span>
      </div>
      <AgentConnections projectId={id} />
      <section className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
        <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Plug className="h-5 w-5 text-primary" />ATS & CRM</h2><p className="mt-1 text-sm text-muted-foreground">Send candidates from {project.name}.</p></div>
        <div className="flex flex-wrap gap-2"><SendToSystem projectId={id} /><Button asChild variant="outline"><Link to={`/integrations?project=${id}`}>Manage connections</Link></Button></div>
      </section>
    </div>}
  </AppLayout>;
}