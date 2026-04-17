import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";

interface DashboardStats {
  candidates: { total: number; thisWeek: number };
  projects: { total: number; activeRecent: number };
  searches: { total: number; today: number };
  responseRate: { rate: number | null; sent: number };
}

export function useDashboardStats() {
  const { companyId } = useCompany();
  const { user } = useAuth();

  return useQuery<DashboardStats>({
    queryKey: ["dashboard_stats", companyId, user?.id],
    enabled: !!companyId && !!user,
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [candTotal, candWeek, projTotal, projRecent, searchTotal, searchToday, campaigns] =
        await Promise.all([
          supabase
            .from("candidates")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId!),
          supabase
            .from("candidates")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId!)
            .gte("created_at", weekAgo),
          supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId!),
          supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId!)
            .gte("updated_at", weekAgo),
          supabase
            .from("search_history")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id),
          supabase
            .from("search_history")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id)
            .gte("created_at", todayStart.toISOString()),
          supabase
            .from("email_campaigns")
            .select("sent_count, open_count")
            .eq("company_id", companyId!),
        ]);

      const sent = (campaigns.data ?? []).reduce(
        (acc, c) => acc + (c.sent_count ?? 0),
        0,
      );
      const opened = (campaigns.data ?? []).reduce(
        (acc, c) => acc + (c.open_count ?? 0),
        0,
      );

      return {
        candidates: { total: candTotal.count ?? 0, thisWeek: candWeek.count ?? 0 },
        projects: { total: projTotal.count ?? 0, activeRecent: projRecent.count ?? 0 },
        searches: { total: searchTotal.count ?? 0, today: searchToday.count ?? 0 },
        responseRate: {
          rate: sent > 0 ? Math.round((opened / sent) * 100) : null,
          sent,
        },
      };
    },
  });
}
