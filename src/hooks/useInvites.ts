import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";

export interface CompanyInvite {
  id: string;
  company_id: string;
  email: string;
  role: "admin" | "recruiter" | "viewer";
  token: string;
  accepted_at: string | null;
  created_at: string;
}

export function useInvites() {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery<CompanyInvite[]>({
    queryKey: ["company_invites", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_invites")
        .select("*")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompanyInvite[];
    },
  });

  const create = useMutation({
    mutationFn: async (input: { email: string; role: "admin" | "recruiter" | "viewer" }) => {
      if (!companyId || !user) throw new Error("Not ready");
      // Insert the invite row first so an admin can copy the link even if email send fails.
      const { data: invite, error } = await supabase
        .from("company_invites")
        .insert({
          company_id: companyId,
          email: input.email.toLowerCase().trim(),
          role: input.role,
          invited_by: user.id,
        })
        .select("*")
        .single();
      if (error) throw error;
      // Fire-and-forget the email send; surface failure but don't block.
      try {
        await supabase.functions.invoke("send-invite", {
          body: { invite_id: invite.id },
        });
      } catch (e) {
        // Swallow: invite still exists; admin can resend.
      }
      return invite as CompanyInvite;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_invites", companyId] });
    },
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_invites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_invites", companyId] });
    },
  });

  return { list, create, revoke };
}
