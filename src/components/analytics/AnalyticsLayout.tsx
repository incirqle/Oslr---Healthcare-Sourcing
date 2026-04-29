import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TABS = [
  { to: "/analytics/outreach", label: "Outreach" },
  { to: "/analytics/usage", label: "Usage" },
  { to: "/analytics/projects", label: "Projects" },
];

interface Props {
  title: string;
  crumb: string;
  children: ReactNode;
  onRefresh?: () => void;
}

export function AnalyticsLayout({ title, crumb, children, onRefresh }: Props) {
  const { pathname } = useLocation();

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    toast.success("Refreshing analytics…", {
      description: "rpc: refresh_mv_sequence_stats (stubbed)",
    });
  };

  return (
    <AppLayout>
      <div className="flex flex-col">
        {/* Sticky sub-nav */}
        <div className="sticky top-0 z-20 -mt-6 -mx-6 mb-6 bg-background border-b border-border px-6">
          <nav className="flex items-center gap-1">
            {TABS.map((t) => {
              const active = pathname === t.to;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  className={cn(
                    "relative px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.label}
                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 bg-primary rounded-full" />
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">
              Analytics <span className="mx-1">›</span> {crumb}
            </p>
            <h1 className="text-2xl font-bold font-display">{title}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
            Refresh
          </Button>
        </div>

        {children}
      </div>
    </AppLayout>
  );
}
