import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Plus } from "lucide-react";

export default function Campaigns() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Campaigns</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Email outreach campaigns for your candidates
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No campaigns yet</p>
              <p className="text-xs mt-1 opacity-60">
                Create a campaign to start reaching out to candidates
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
