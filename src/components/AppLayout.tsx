import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useProject } from "@/hooks/useProjects";
import { projectNavigation, projectPath } from "@/lib/project-navigation";
import { ProjectNavigation } from "@/components/projects/ProjectNavigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TrialBadge } from "@/components/TrialBadge";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/search": "Talent Search",
  "/projects": "Projects",
  "/agents": "Agents",
  "/contacts": "Contacts",
  "/integrations": "Integrations",
  "/campaigns": "Campaigns",
  "/resources": "Resources",
  "/settings": "Settings",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const context = projectNavigation(pathname, search);
  const { companyId } = useCompany();
  const { data: agent } = useQuery({
    queryKey: ["navigation-agent", companyId, context.agentId],
    enabled: !!context.agentId && !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clin_agents").select("name, project_id").eq("id", context.agentId ?? "").eq("company_id", companyId ?? "").maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
  const projectId = context.projectId ?? agent?.project_id ?? undefined;
  const { data: project } = useProject(projectId ?? "");
  const sectionName = { candidates: "Candidates", search: "Talent Search", agents: "Agents", connections: "Connections & Sync" }[context.section];
  const currentPage = pageTitles[pathname] ?? (pathname.startsWith("/projects/") ? "Project" : pathname.startsWith("/agents/") ? "Agent" : pathname.startsWith("/resources/") ? "Resources" : "Page");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar projectId={projectId} projectName={project?.name} />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-10">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="mr-1" />
              <Breadcrumb>
                <BreadcrumbList>
                  {projectId && <>
                    <BreadcrumbItem><BreadcrumbLink asChild><Link to="/projects">Projects</Link></BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem className="min-w-0"><BreadcrumbLink asChild><Link className="max-w-[180px] truncate sm:max-w-[320px]" to={projectPath(projectId)}>{project?.name ?? "Loading project…"}</Link></BreadcrumbLink></BreadcrumbItem>
                    <BreadcrumbSeparator />
                    {context.agentId && <><BreadcrumbItem><BreadcrumbLink asChild><Link to={projectPath(projectId, "agents")}>Agents</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator /></>}
                  </>}
                  <BreadcrumbItem>
                    <BreadcrumbPage className="max-w-[180px] truncate text-sm font-medium">{projectId ? agent?.name ?? sectionName : currentPage}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <TrialBadge />
          </header>
          {projectId && <ProjectNavigation projectId={projectId} name={project?.name} section={context.section} />}
          <div className="min-w-0 flex-1 p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
