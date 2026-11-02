import {
  LayoutDashboard,
  FolderKanban,
  Search,
  Mail,
  Settings,
  LogOut,
  Newspaper,
  Users,
  BarChart2,
  BookOpen,
  Zap,
  Bot,
  Plug,
} from "lucide-react";
import oslrWordmark from "@/assets/oslr-wordmark.svg";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link } from "react-router-dom";
import { projectPath } from "@/lib/project-navigation";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Talent Search", url: "/search", icon: Search },
  { title: "All agents", url: "/agents", icon: Bot },
  { title: "Contacts", url: "/contacts", icon: Users },
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "News", url: "/news", icon: Newspaper },
];

const settingsNav = [
  { title: "Resources", url: "/resources", icon: BookOpen },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar({ projectId, projectName }: { projectId?: string; projectName?: string }) {
  const { user, signOut } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "ME";

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <img src={oslrWordmark} alt="Oslr" className="h-5" />
          <span className="text-[13px] text-sidebar-foreground/55">Healthcare Recruiting</span>
        </div>
      </SidebarHeader>

      <SidebarSeparator />


      <SidebarContent>
        {projectId && <SidebarGroup>
          <SidebarGroupLabel>Current project</SidebarGroupLabel>
          <SidebarGroupContent>
            <Link to={projectPath(projectId)} className="mx-2 mb-2 block break-words rounded-md bg-sidebar-accent px-3 py-2 text-sm font-semibold text-sidebar-primary">{projectName ?? "Loading project…"}</Link>
            <SidebarMenu>
              {([{ key: "candidates", label: "Candidates", icon: Users }, { key: "search", label: "Talent Search", icon: Search }, { key: "agents", label: "Project agents", icon: Bot }, { key: "connections", label: "Connections & Sync", icon: Plug }] as const).map(({ key, label, icon: Icon }) => <SidebarMenuItem key={key}><SidebarMenuButton asChild><NavLink to={projectPath(projectId, key)} end className="text-sidebar-foreground/75" activeClassName="bg-sidebar-accent text-sidebar-primary"><Icon className="h-4 w-4" /><span>{label}</span></NavLink></SidebarMenuButton></SidebarMenuItem>)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[12px] uppercase tracking-wider font-medium">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[15px] font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[12px] uppercase tracking-wider font-medium">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className="relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[15px] font-medium text-sidebar-foreground/75 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-foreground font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-[3px] before:rounded-r-full before:bg-sidebar-primary"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <SidebarSeparator className="mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[120px]">
                {user?.email}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
