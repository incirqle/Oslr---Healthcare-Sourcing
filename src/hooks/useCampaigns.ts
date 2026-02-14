import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";

export function useTemplates() {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["email_templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: ["email_template", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  const { companyId } = useCompany();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, subject, body }: { name: string; subject: string; body: string }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .insert({ name, subject, body, company_id: companyId!, created_by: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useUpdateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, subject, body }: { id: string; name: string; subject: string; body: string }) => {
      const { error } = await supabase
        .from("email_templates")
        .update({ name, subject, body })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_templates"] });
      qc.invalidateQueries({ queryKey: ["email_template"] });
    },
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_templates"] }),
  });
}

export function useCampaigns() {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["email_campaigns", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*, email_templates(name, subject), projects(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const { companyId } = useCompany();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, templateId, projectId, recipientCount }: {
      name: string;
      templateId: string;
      projectId: string;
      recipientCount: number;
    }) => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .insert({
          name,
          template_id: templateId,
          project_id: projectId,
          recipient_count: recipientCount,
          company_id: companyId!,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_campaigns"] }),
  });
}
