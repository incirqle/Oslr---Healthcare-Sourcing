import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FitStatus = "unreviewed" | "good" | "maybe" | "not";

/**
 * Fetch the current user's fit ratings for a list of PDL candidate ids.
 * Returns a Map<pdl_id, status> for fast lookup at render time.
 */
export function useCandidateFits(pdlIds: string[]) {
  const { user } = useAuth();
  const ids = [...new Set(pdlIds.filter(Boolean))].sort();
  const cacheKey = ids.join(",");

  return useQuery({
    queryKey: ["candidate-fit", user?.id, cacheKey],
    enabled: !!user?.id && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_fit")
        .select("pdl_id, status")
        .eq("user_id", user!.id)
        .in("pdl_id", ids);
      if (error) throw error;
      const map = new Map<string, FitStatus>();
      for (const row of data ?? []) {
        map.set(row.pdl_id, row.status as FitStatus);
      }
      return map;
    },
  });
}

export function useSetCandidateFit() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pdlId, status }: { pdlId: string; status: FitStatus }) => {
      if (!user?.id) throw new Error("Not signed in");
      const { error } = await supabase
        .from("candidate_fit")
        .upsert(
          { user_id: user.id, pdl_id: pdlId, status },
          { onConflict: "user_id,pdl_id" },
        );
      if (error) throw error;
      return { pdlId, status };
    },
    // Optimistic update — flip the pill immediately.
    onMutate: async ({ pdlId, status }) => {
      await qc.cancelQueries({ queryKey: ["candidate-fit", user?.id] });
      const previous = qc.getQueriesData<Map<string, FitStatus>>({
        queryKey: ["candidate-fit", user?.id],
      });
      previous.forEach(([key, value]) => {
        if (!value) return;
        const next = new Map(value);
        next.set(pdlId, status);
        qc.setQueryData(key, next);
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["candidate-fit", user?.id] });
    },
  });
}
