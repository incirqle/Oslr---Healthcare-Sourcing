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
 * Fetch the current user's private notes for a candidate (by provider id).
 * Notes are scoped per-user and ordered most-recent-first.
 */
export function useCandidateNotes(personId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["candidate-notes", user?.id, personId],
    enabled: !!user?.id && !!personId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_notes")
        .select("id, body, created_at, updated_at")
        .eq("user_id", user!.id)
        .eq("person_id", personId!)
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
    mutationFn: async ({ personId, body }: { personId: string; body: string }) => {
      if (!user?.id) throw new Error("Not signed in");
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Note cannot be empty");
      const { data, error } = await supabase
        .from("candidate_notes")
        .insert({ user_id: user.id, person_id: personId, body: trimmed })
        .select("id, body, created_at, updated_at")
        .single();
      if (error) throw error;
      return { personId, note: data as CandidateNote };
    },
    onSuccess: ({ personId }) => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", user?.id, personId] });
    },
  });
}

export function useUpdateCandidateNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body, personId }: { id: string; body: string; personId: string }) => {
      const trimmed = body.trim();
      if (!trimmed) throw new Error("Note cannot be empty");
      const { error } = await supabase
        .from("candidate_notes")
        .update({ body: trimmed })
        .eq("id", id);
      if (error) throw error;
      return { id, personId };
    },
    onSuccess: ({ personId }) => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", user?.id, personId] });
    },
  });
}

export function useDeleteCandidateNote() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, personId }: { id: string; personId: string }) => {
      const { error } = await supabase.from("candidate_notes").delete().eq("id", id);
      if (error) throw error;
      return { id, personId };
    },
    onSuccess: ({ personId }) => {
      qc.invalidateQueries({ queryKey: ["candidate-notes", user?.id, personId] });
    },
  });
}
