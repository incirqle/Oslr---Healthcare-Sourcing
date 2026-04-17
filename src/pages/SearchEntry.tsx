import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useProjects } from "@/hooks/useProjects";
import { toast } from "sonner";

/**
 * Standalone /search entry. Sourcing is strictly project-centric, so this
 * route auto-routes the user into a project search context:
 *   - If they have projects → jump into the most recently created project's search.
 *   - If they have none → bounce to /projects so they can create one first.
 */
export default function SearchEntry() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();

  useEffect(() => {
    if (isLoading) return;
    if (!projects) return;
    if (projects.length === 0) {
      toast.info("Create a project first to start searching.");
      navigate("/projects", { replace: true });
      return;
    }
    navigate(`/projects/${projects[0].id}/search`, { replace: true });
  }, [projects, isLoading, navigate]);

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium">Opening search…</p>
      </div>
    </AppLayout>
  );
}
