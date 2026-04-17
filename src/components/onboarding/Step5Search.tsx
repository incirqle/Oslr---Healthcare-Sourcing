import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Sparkles } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useOnboarding } from "@/hooks/useOnboarding";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const PLACEHOLDERS = [
  "cardiologists in Boston open to relocation",
  "ICU nurses with BSN within 50 miles of Chicago",
  "hospitalist attendings, 5+ years, Pacific Northwest",
];

export function Step5Search({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { completeStep } = useOnboarding();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setPlaceholderIdx((i) => (i + 1) % PLACEHOLDERS.length), 3000);
    return () => clearInterval(id);
  }, []);

  const handleRunSearch = async () => {
    if (!query.trim() || !projects || projects.length === 0) {
      toast.error("Create a project first.");
      return;
    }
    await completeStep.mutateAsync("search");
    onComplete();
    navigate(`/projects/${projects[0].id}/search?q=${encodeURIComponent(query.trim())}`);
  };

  const handleSandbox = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-data", {});
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        data?.already_seeded
          ? "Sandbox data was already loaded — open Projects to explore."
          : `Sandbox data loaded: ${data?.projects_created ?? 0} projects, ${data?.candidates_inserted ?? 0} candidates.`,
      );
      await completeStep.mutateAsync("search");
      qc.invalidateQueries();
      onComplete();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load sandbox data");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-4 pl-10">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleRunSearch()}
        placeholder={PLACEHOLDERS[placeholderIdx]}
        className="text-base py-3 h-12"
      />
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleRunSearch} disabled={!query.trim()}>
          Run search
        </Button>
        <Button variant="outline" onClick={handleSandbox} disabled={seeding}>
          {seeding ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
          )}
          Load sandbox data instead
        </Button>
      </div>
    </div>
  );
}
