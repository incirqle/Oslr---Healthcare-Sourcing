import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Search, Bell, Command } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/search": "Search",
  "/projects": "Projects",
  "/campaigns": "Campaigns",
  "/companies": "Companies",
  "/settings": "Team Settings",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const currentPage = pageTitles[pathname] ?? (pathname.startsWith("/projects/") ? "Project" : "Page");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-1" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-sm font-medium">{currentPage}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors">
                <Search className="h-3.5 w-3.5" />
                <span>Search…</span>
                <kbd className="inline-flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-mono">
                  <Command className="h-2.5 w-2.5" />K
                </kbd>
              </button>
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative">
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </header>
          <div className="flex-1 p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
