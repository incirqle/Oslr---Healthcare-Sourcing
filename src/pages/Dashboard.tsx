import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderKanban, Search, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";

const stats = [
  { title: "Candidates Sourced", value: "0", icon: Users, change: "+0 this week", color: "bg-primary/10 text-primary" },
  { title: "Active Projects", value: "0", icon: FolderKanban, change: "0 in progress", color: "bg-accent/10 text-accent" },
  { title: "Searches Run", value: "0", icon: Search, change: "0 today", color: "bg-warning/10 text-warning" },
  { title: "Response Rate", value: "0%", icon: TrendingUp, change: "No data yet", color: "bg-success/10 text-success" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "there";

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome banner */}
        <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-5">
          <h1 className="text-2xl font-bold font-display text-foreground">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's an overview of your healthcare recruiting pipeline
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="group hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-display">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Recent Searches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No searches yet. Start by searching for candidates.
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Team Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                No activity yet. Invite team members to get started.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
