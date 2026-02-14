import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export default function CompanyDirectory() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Company Directory</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse hospitals and healthcare organizations
          </p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No companies enriched yet</p>
              <p className="text-xs mt-1 opacity-60">
                Company data will appear as you search and save candidates
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
