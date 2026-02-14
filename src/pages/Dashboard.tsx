import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FolderKanban, Search, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const stats = [
  { title: "Candidates Sourced", value: "0", icon: Users, change: "+0 this week" },
  { title: "Active Projects", value: "0", icon: FolderKanban, change: "0 in progress" },
  { title: "Searches Run", value: "0", icon: Search, change: "0 today" },
  { title: "Response Rate", value: "0%", icon: TrendingUp, change: "No data yet" },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Overview of your healthcare recruiting pipeline
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
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
