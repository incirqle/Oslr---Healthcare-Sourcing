import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderKanban, Plus } from "lucide-react";

export default function Projects() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground">Projects</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage your hiring projects and candidate lists
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FolderKanban className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm">No projects yet</p>
              <p className="text-xs mt-1 opacity-60">
                Create a project to start organizing candidates
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
