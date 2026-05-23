import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserMailbox {
  id: string;
  user_id: string;
  company_id: string;
  provider: "google" | "microsoft" | string;
  email: string;
  display_name: string | null;
  nylas_grant_id: string;
  scopes: string[] | null;
  status: "active" | "invalid" | "revoked" | string;
  last_error: string | null;
  connected_at: string;
  updated_at: string;
}

/** Mailboxes connected by the current user. */
export function useMyMailboxes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-mailboxes", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UserMailbox[]> => {
      const { data, error } = await supabase
        .from("user_mailboxes")
        .select("*")
        .eq("user_id", user!.id)
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserMailbox[];
    },
  });
}

/** All mailboxes connected by any member of the current company. */
export function useCompanyMailboxes(companyId: string | undefined | null) {
  return useQuery({
    queryKey: ["company-mailboxes", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<UserMailbox[]> => {
      const { data, error } = await supabase
        .from("user_mailboxes")
        .select("*")
        .eq("company_id", companyId!)
        .order("connected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserMailbox[];
    },
  });
}

/** Kicks off Nylas hosted OAuth in the same window. */
export function useConnectMailbox() {
  return useMutation({
    mutationFn: async (provider: "google" | "microsoft") => {
      const { data, error } = await supabase.functions.invoke("nylas-auth-start", {
        body: { provider },
      });
      if (error) throw error;
      const url = (data as any)?.auth_url;
      if (!url) throw new Error("No auth URL returned");
      // Break out of the Lovable preview iframe so Nylas hosted auth loads at top-level.
      try {
        if (window.top && window.top !== window.self) {
          window.top.location.href = url;
          return;
        }
      } catch {
        // Cross-origin frame access — fall through to opening in a new tab.
      }
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = url;
    },
  });
}

export function useDisconnectMailbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mailbox_id: string) => {
      const { error } = await supabase.functions.invoke("nylas-disconnect", {
        body: { mailbox_id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-mailboxes"] });
      qc.invalidateQueries({ queryKey: ["company-mailboxes"] });
    },
  });
}
