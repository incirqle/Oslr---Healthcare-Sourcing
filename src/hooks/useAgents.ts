import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useAgents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["agents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sourcing_agents")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAgent(id: string) {
  return useQuery({
    queryKey: ["agent", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sourcing_agents")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (agentData: {
      name: string;
      role_description: string;
      parsed_payload?: Record<string, unknown>;
      pdl_query?: Record<string, unknown>;
      criteria_pinned?: string[];
      sequence_mode?: string;
      sequence_id?: string;
      daily_lead_quota?: number;
    }) => {
      const { data, error } = await supabase
        .from("sourcing_agents")
        .insert({
          user_id: user!.id,
          name: agentData.name,
          role_description: agentData.role_description,
          parsed_payload: agentData.parsed_payload as any,
          pdl_query: agentData.pdl_query as any,
          criteria_pinned: agentData.criteria_pinned || [],
          sequence_mode: agentData.sequence_mode || "shortlist",
          sequence_id: agentData.sequence_id || null,
          daily_lead_quota: agentData.daily_lead_quota || 5,
          status: "configuring",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: any }) => {
      const { error } = await supabase
        .from("sourcing_agents")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["agent", vars.id] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sourcing_agents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useAgentLeads(agentId: string, status?: string) {
  return useQuery({
    queryKey: ["agent_leads", agentId, status],
    queryFn: async () => {
      let query = supabase
        .from("agent_leads")
        .select("*")
        .eq("agent_id", agentId)
        .order("match_score", { ascending: false, nullsFirst: false });
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });
}

export function useAgentCalibration(agentId: string) {
  const qc = useQueryClient();

  const pendingLeads = useQuery({
    queryKey: ["agent_leads", agentId, "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_leads")
        .select("*")
        .eq("agent_id", agentId)
        .eq("status", "pending")
        .order("match_score", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const approveLead = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke("agent-calibrate", {
        body: { agent_id: agentId, lead_id: leadId, action: "approve" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent_leads", agentId] });
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
    },
  });

  const rejectLead = useMutation({
    mutationFn: async ({ leadId, feedback }: { leadId: string; feedback: string }) => {
      const { data, error } = await supabase.functions.invoke("agent-calibrate", {
        body: { agent_id: agentId, lead_id: leadId, action: "reject", feedback },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agent_leads", agentId] });
      qc.invalidateQueries({ queryKey: ["agent", agentId] });
    },
  });

  return { pendingLeads, approveLead, rejectLead };
}

export function useAgentMetrics(agentId: string) {
  return useQuery({
    queryKey: ["agent_metrics", agentId],
    queryFn: async () => {
      const { data: leads, error } = await supabase
        .from("agent_leads")
        .select("status, email_opens")
        .eq("agent_id", agentId);
      if (error) throw error;

      const total = leads?.length || 0;
      const pending = leads?.filter((l) => l.status === "pending").length || 0;
      const approved = leads?.filter((l) =>
        ["approved", "contacted", "shortlisted"].includes(l.status)
      ).length || 0;
      const contacted = leads?.filter((l) => l.status === "contacted").length || 0;
      const withOpens = leads?.filter((l) => l.status === "contacted" && l.email_opens > 0).length || 0;
      const openRate = contacted > 0 ? ((withOpens / contacted) * 100) : 0;

      return { total, pending, approved, contacted, openRate };
    },
    enabled: !!agentId,
    refetchInterval: 60000,
  });
}

export function useSequences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["sequences", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_sequences")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useSequence(id: string) {
  return useQuery({
    queryKey: ["sequence", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_sequences")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSequence() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (seq: { name: string; steps: any[]; from_name?: string; reply_to_email?: string }) => {
      const { data, error } = await supabase
        .from("agent_sequences")
        .insert({ ...seq, user_id: user!.id, steps: seq.steps as any })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; steps?: any[] }) => {
      const { error } = await supabase
        .from("agent_sequences")
        .update({ ...updates, steps: updates.steps as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sequences"] });
      qc.invalidateQueries({ queryKey: ["sequence", vars.id] });
    },
  });
}

export function useDeleteSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agent_sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequences"] }),
  });
}

export function useSendingDomain() {
  const { user } = useAuth();

  const domain = useQuery({
    queryKey: ["sending_domain", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sending_domains")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const registerDomain = useMutation({
    mutationFn: async (body: { domain: string; from_name: string; from_email: string }) => {
      const { data, error } = await supabase.functions.invoke("register-sending-domain", { body });
      if (error) throw error;
      return data;
    },
    onSuccess: () => domain.refetch(),
  });

  const verifyDomain = useMutation({
    mutationFn: async (domainId: string) => {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { domain_id: domainId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => domain.refetch(),
  });

  const deleteDomain = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("delete-domain", {});
      if (error) throw error;
      return data;
    },
    onSuccess: () => domain.refetch(),
  });

  return {
    domain: domain.data,
    isLoading: domain.isLoading,
    isVerified: domain.data?.is_verified ?? false,
    registerDomain,
    verifyDomain,
    deleteDomain,
  };
}

export function useAgentOutreachMetrics(agentId: string) {
  return useQuery({
    queryKey: ["agent_outreach_metrics", agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_outreach_log")
        .select("step, opened_at, bounced")
        .eq("agent_id", agentId);
      if (error) throw error;

      const totalSent = data?.length || 0;
      const totalOpened = data?.filter((d) => d.opened_at).length || 0;
      const totalBounced = data?.filter((d) => d.bounced).length || 0;
      const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
      const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;

      // Per-step metrics
      const stepMap = new Map<number, { sent: number; opened: number; bounced: number }>();
      for (const d of data || []) {
        const s = stepMap.get(d.step) || { sent: 0, opened: 0, bounced: 0 };
        s.sent++;
        if (d.opened_at) s.opened++;
        if (d.bounced) s.bounced++;
        stepMap.set(d.step, s);
      }

      return {
        totalSent,
        totalOpened,
        totalBounced,
        openRate,
        bounceRate,
        perStep: Array.from(stepMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([step, stats]) => ({
            step,
            ...stats,
            openRate: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
            bounceRate: stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0,
          })),
      };
    },
    enabled: !!agentId,
    refetchInterval: 60000,
  });
}
