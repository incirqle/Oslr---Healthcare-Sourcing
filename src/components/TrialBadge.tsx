import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Trial = { active: boolean; expires_at: string; searches_used: number; search_limit: number };

/** Shows days and searches left on an invite pass, with a one-click upgrade. Hidden for everyone else. */
export function TrialBadge() {
  const { data } = useQuery({
    queryKey: ["trial_status"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("beta_status");
      return (Array.isArray(data) ? data[0] : null) as Trial | null;
    },
  });
  if (!data?.active) return null;
  const days = Math.max(0, Math.ceil((new Date(data.expires_at).getTime() - Date.now()) / 86_400_000));
  const searches = Math.max(0, data.search_limit - data.searches_used);
  return (
    <div className="flex items-center gap-2">
      <Link to="/settings?tab=billing" className="hidden items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground sm:inline-flex">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Trial: {days} {days === 1 ? "day" : "days"} · {searches} {searches === 1 ? "search" : "searches"} left
      </Link>
      <Button asChild size="sm" className="h-8">
        <Link to="/settings?tab=billing">Upgrade</Link>
      </Button>
    </div>
  );
}
