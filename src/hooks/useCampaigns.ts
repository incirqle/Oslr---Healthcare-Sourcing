import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";

// ─── Extended type for campaigns with analytics columns ──────────────────────
export type CampaignRow = {
  id: string;
  name: string;
  status: string;
  company_id: string;
  project_id: string | null;
  template_id: string | null;
  recipient_count: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  email_templates: { name: string; subject: string } | null;
  projects: { name: string } | null;
};

export type EmailEvent = {
  id: string;
  campaign_id: string;
  candidate_id: string;
  company_id: string;
  event_type: "sent" | "delivered" | "opened" | "clicked" | "bounced" | "complained";
  event_data: Record<string, unknown> | null;
  created_at: string;
};

// ─── Templates ───────────────────────────────────────────────────────────────

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

// ─── Campaigns ───────────────────────────────────────────────────────────────

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
      return data as unknown as CampaignRow[];
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

// ─── Send campaign via edge function ─────────────────────────────────────────

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-campaign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ campaign_id: campaignId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send campaign");
      return json as { success: boolean; sent: number; total: number; mock?: boolean; errors?: string[] };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email_campaigns"] }),
  });
}

// ─── Campaign events (analytics) ─────────────────────────────────────────────

export function useCampaignEvents(campaignId: string | null) {
  return useQuery({
    queryKey: ["email_events", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_events")
        .select("*, candidates(full_name, email, title)")
        .eq("campaign_id", campaignId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (EmailEvent & { candidates: { full_name: string; email: string | null; title: string | null } | null })[];
    },
    enabled: !!campaignId,
  });
}

// ─── Company email sender config ──────────────────────────────────────────────

export function useCompanyEmailSettings() {
  const { companyId } = useCompany();
  return useQuery({
    queryKey: ["company_email_settings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, from_name, from_email, reply_to_email")
        .eq("id", companyId!)
        .single();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        from_name: string | null;
        from_email: string | null;
        reply_to_email: string | null;
      };
    },
    enabled: !!companyId,
  });
}

export function useUpdateCompanyEmailSettings() {
  const qc = useQueryClient();
  const { companyId } = useCompany();
  return useMutation({
    mutationFn: async ({ from_name, from_email, reply_to_email }: {
      from_name: string;
      from_email: string;
      reply_to_email?: string;
    }) => {
      const { error } = await supabase
        .from("companies")
        .update({ from_name, from_email, reply_to_email: reply_to_email || null })
        .eq("id", companyId!);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company_email_settings"] }),
  });
}
