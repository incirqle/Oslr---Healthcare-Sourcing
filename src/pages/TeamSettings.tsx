import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function TeamSettings() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Team Settings</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your team members and company settings
            </p>
          </div>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Member
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              Set up your company to manage team members.
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
