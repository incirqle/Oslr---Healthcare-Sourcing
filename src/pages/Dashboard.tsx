import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderKanban, Search, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { SuccessBanner } from "@/components/onboarding/SuccessBanner";

function metric(value: number, format?: (n: number) => string) {
  if (value === 0) return "—";
  return format ? format(value) : value.toLocaleString();
}

function deltaText(value: number, suffix: string) {
  if (value === 0) return "No change";
  return `+${value} ${suffix}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";
  const { isFullyComplete, state, isLoading } = useOnboarding();
  const { data: stats } = useDashboardStats();
  const showBanner = isFullyComplete && !state?.success_banner_dismissed;
  const showDashboard = isFullyComplete;

  const responseRate = stats?.responseRate.rate;
  const responseLabel =
    responseRate === null || responseRate === undefined
      ? "—"
      : `${responseRate}%`;

  const kpis = [
    {
      title: "Candidates Sourced",
      value: metric(stats?.candidates.total ?? 0),
      change: deltaText(stats?.candidates.thisWeek ?? 0, "this week"),
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Active Projects",
      value: metric(stats?.projects.total ?? 0),
      change: deltaText(stats?.projects.activeRecent ?? 0, "active this week"),
      icon: FolderKanban,
      color: "bg-accent/10 text-accent",
    },
    {
      title: "Searches Run",
      value: metric(stats?.searches.total ?? 0),
      change: deltaText(stats?.searches.today ?? 0, "today"),
      icon: Search,
      color: "bg-warning/10 text-warning",
    },
    {
      title: "Response Rate",
      value: responseLabel,
      change:
        stats?.responseRate.sent && stats.responseRate.sent > 0
          ? `${stats.responseRate.sent} emails sent`
          : "No outreach yet",
      icon: TrendingUp,
      color: "bg-success/10 text-success",
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome banner */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-5">
          <h1 className="text-3xl font-bold font-display text-foreground">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-base text-foreground/80 mt-1">
            Here's an overview of your healthcare recruiting pipeline
          </p>
        </div>

        {isLoading ? null : !showDashboard ? (
          <OnboardingChecklist />
        ) : (
          <>
            {showBanner && <SuccessBanner />}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {kpis.map((stat) => (
                <Card
                  key={stat.title}
                  className="group hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-foreground/80">
                      {stat.title}
                    </CardTitle>
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.color}`}
                    >
                      <stat.icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-semibold font-display text-foreground">
                      {stat.value}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {stat.change}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold font-display text-foreground">
                    Recent Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-32 text-base text-muted-foreground">
                    No searches yet. Start by searching for candidates.
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl font-semibold font-display text-foreground">
                    Team Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center h-32 text-base text-muted-foreground">
                    No activity yet. Invite team members to get started.
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
