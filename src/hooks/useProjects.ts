import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import type { CandidateStatus } from "@/types/project";

export function useProjects() {
  const { companyId } = useCompany();

  return useQuery({
    queryKey: ["projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

/** Fetch candidate counts per project for the current company */
export function useProjectCandidateCounts() {
  const { companyId } = useCompany();

  return useQuery({
    queryKey: ["project_candidate_counts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("project_id")
        .eq("company_id", companyId!);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.project_id] = (counts[row.project_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!companyId,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useProjectCandidates(projectId: string) {
  return useQuery({
    queryKey: ["candidates", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

/** Fetch campaigns linked to a specific project */
export function useProjectCampaigns(projectId: string) {
  return useQuery({
    queryKey: ["project_campaigns", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("id, name, status, recipient_count, sent_count, open_count, sent_at, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const { companyId } = useCompany();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!companyId || !user) throw new Error("Not ready – please wait a moment and try again");
      const { data, error } = await supabase
        .from("projects")
        .insert({ name, description: description || null, company_id: companyId, created_by: user.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description?: string | null }) => {
      const { error } = await supabase
        .from("projects")
        .update({ name, description: description || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useAddCandidates() {
  const qc = useQueryClient();
  const { companyId } = useCompany();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ projectId, candidates }: {
      projectId: string;
      candidates: {
        full_name: string;
        title?: string | null;
        current_employer?: string | null;
        location?: string | null;
        linkedin_url?: string | null;
        email?: string | null;
        phone?: string | null;
        skills?: string[];
        avg_tenure_months?: number | null;
        pdl_id?: string | null;
      }[];
    }) => {
      const rows = candidates.map((c) => ({
        project_id: projectId,
        company_id: companyId!,
        added_by: user!.id,
        full_name: c.full_name,
        title: c.title || null,
        current_employer: c.current_employer || null,
        location: c.location || null,
        linkedin_url: c.linkedin_url || null,
        email: c.email || null,
        phone: c.phone || null,
        skills: c.skills || [],
        avg_tenure_months: c.avg_tenure_months || null,
        pdl_id: c.pdl_id || null,
        status: "new",
      }));

      const { data, error } = await supabase.from("candidates").insert(rows).select("id");
      if (error) throw error;
      return data.length;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["candidates", vars.projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_candidate_counts"] });
    },
  });
}

export function useUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, projectId }: { id: string; status: CandidateStatus; projectId: string }) => {
      const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["candidates", projectId] });
    },
  });
}

/** Bulk update status for multiple candidates */
export function useBulkUpdateCandidateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status, projectId }: { ids: string[]; status: CandidateStatus; projectId: string }) => {
      const { error } = await supabase
        .from("candidates")
        .update({ status })
        .in("id", ids);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["candidates", projectId] });
    },
  });
}

/** Bulk remove multiple candidates */
export function useBulkRemoveCandidates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, projectId }: { ids: string[]; projectId: string }) => {
      const { error } = await supabase.from("candidates").delete().in("id", ids);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["candidates", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_candidate_counts"] });
    },
  });
}

export function useUpdateCandidateNotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes, projectId }: { id: string; notes: string; projectId: string }) => {
      const { error } = await supabase.from("candidates").update({ notes }).eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["candidates", projectId] });
    },
  });
}

export function useRemoveCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from("candidates").delete().eq("id", id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      qc.invalidateQueries({ queryKey: ["candidates", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["project_candidate_counts"] });
    },
  });
}
