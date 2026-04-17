import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CandidateNote {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch the current user's private notes for a candidate (by PDL id).
 * Notes are scoped per-user and ordered most-recent-first.
 */
export function useCandidateNotes(pdlId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["candidate-notes", user?.id, pdlId],
    enabled: !!user?.id && !!pdlId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_notes")
        .select("id, body, created_at, updated_at")
        .eq("user_id", user!.id)
        .eq("pdl_id", pdlId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CandidateNote[];
    },
  });
}

export function useAddCandidateNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ pdlId, body }: { pdlId: string; body: string }) => {
      if (!user?.id) throw new Error("Not signed in");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Note cannot be empty");
      const { data, error } = await supabase
        .from("candidate_notes")
        .insert({ user_id: user.id, pdl_id: pdlId, body: trimmed })
        .select("id, body, created_at, updated_at")
        .single();
      if (error) throw error;
      return { pdlId, note: data as CandidateNote };
    },
    onSuccess: ({ pdlId }) => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", user?.id, pdlId] });
    },
  });
}

export function useUpdateCandidateNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body, pdlId }: { id: string; body: string; pdlId: string }) => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Note cannot be empty");
      const { error } = await supabase
        .from("candidate_notes")
        .update({ body: trimmed })
        .eq("id", id);
      if (error) throw error;
      return { id, pdlId };
    },
    onSuccess: ({ pdlId }) => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", user?.id, pdlId] });
    },
  });
}

export function useDeleteCandidateNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pdlId }: { id: string; pdlId: string }) => {
      const { error } = await supabase.from("candidate_notes").delete().eq("id", id);
      if (error) throw error;
      return { id, pdlId };
    },
    onSuccess: ({ pdlId }) => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", user?.id, pdlId] });
    },
  });
}
