import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "@/hooks/useCompany";
import { useCreditBalance } from "@/hooks/useContactEnrich";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FolderKanban, Search, Zap, ArrowRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { SuccessBanner } from "@/components/onboarding/SuccessBanner";
import { supabase } from "@/integrations/supabase/client";
import { fetchSearchUsage } from "@/lib/search-meter";

function metric(value: number) {
  return value === 0 ? "—" : value.toLocaleString();
}

function timeAgo(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function Dashboard() {
  const { companyId } = useCompany();
  const credits = useCreditBalance(companyId);
  const { user } = useAuth();
  const rawName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "there") as string;
  const firstName = rawName.split(/[ .]/)[0].replace(/^./, (c) => c.toUpperCase());
  const { isFullyComplete, state, isLoading } = useOnboarding();
  const { data: stats } = useDashboardStats();
  // Same counter the search limit uses, so both pages always agree.
  const { data: usage } = useQuery({ queryKey: ["search_usage", user?.id], enabled: !!user, queryFn: fetchSearchUsage });
  const showBanner = isFullyComplete && !state?.success_banner_dismissed;

  const { data: recent } = useQuery({
    queryKey: ["dashboard_recent", companyId, user?.id],
    enabled: !!companyId && !!user,
    queryFn: async () => {
      const [searches, projects] = await Promise.all([
        supabase
          .from("search_history")
          .select("id, query_text, result_count, created_at, search_params")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(6),
        supabase
          .from("projects")
          .select("id, name, role_title, location, updated_at")
          .eq("company_id", companyId!)
          .order("updated_at", { ascending: false })
          .limit(5),
      ]);
      return { searches: searches.data ?? [], projects: projects.data ?? [] };
    },
  });

  const kpis = [
    { title: "Saved Clinicians", value: metric(stats?.candidates.total ?? 0), sub: `+${stats?.candidates.thisWeek ?? 0} this week`, icon: Users, to: "/contacts" },
    { title: "Active Projects", value: metric(stats?.projects.total ?? 0), sub: `${stats?.projects.activeRecent ?? 0} active this week`, icon: FolderKanban, to: "/projects" },
    { title: "Searches Today", value: metric(stats?.searches.today ?? 0), sub: "of 150 daily", icon: Search, to: "/settings?tab=monitoring" },
    { title: "Available Credits", value: credits === null ? "—" : credits.toLocaleString(), sub: "Starter · 150 a month", icon: Zap, to: "/settings?tab=billing" },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-display text-foreground">Welcome back, {firstName}</h1>
            <p className="text-base text-foreground/80 mt-1">Your clinical sourcing at a glance</p>
          </div>
          <Button asChild>
            <Link to="/projects">
              <Search className="h-4 w-4 mr-2" /> Find clinicians
            </Link>
          </Button>
        </div>

        {!isLoading && !isFullyComplete && <OnboardingChecklist />}
        {showBanner && <SuccessBanner />}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k) => (
            <Link key={k.title} to={k.to}>
              <Card className="h-full hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-foreground/80">{k.title}</CardTitle>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <k.icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-semibold font-display text-foreground">{k.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{k.sub}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold font-display text-foreground">Recent Searches</CardTitle>
            </CardHeader>
            <CardContent>
              {!recent?.searches.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No searches yet. Open a project and describe who you need.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recent.searches.map((s) => {
                    const pid = (s.search_params as Record<string, unknown> | null)?.project_id as string | undefined;
                    const href = pid ? `/projects/${pid}/search?q=${encodeURIComponent(s.query_text)}` : "/projects";
                    return (
                      <li key={s.id}>
                        <Link to={href} className="flex items-center justify-between gap-3 py-2.5 group">
                          <span className="truncate text-sm text-foreground group-hover:text-primary">{s.query_text}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {s.result_count ?? 0} results · {timeAgo(s.created_at)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold font-display text-foreground">Your Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {!recent?.projects.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No projects yet. Create one to start saving clinicians.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recent.projects.map((p) => (
                    <li key={p.id}>
                      <Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-3 py-2.5 group">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{p.name}</p>
                          {(p.role_title || p.location) && (
                            <p className="truncate text-xs text-muted-foreground">{[p.role_title, p.location].filter(Boolean).join(" · ")}</p>
                          )}
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
