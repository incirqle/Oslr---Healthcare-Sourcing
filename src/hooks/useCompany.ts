import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

async function ensureCompany(userId: string, email: string | undefined) {
  // Check if user already has a company
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();

  if (profile?.company_id) return profile.company_id;

  // Create a new company
  const { data: company, error: companyErr } = await supabase
    .from("companies")
    .insert({ name: `${email?.split("@")[0] || "My"}'s Team` })
    .select("id")
    .single();

  if (companyErr) throw companyErr;

  // Update profile with company_id
  await supabase
    .from("profiles")
    .update({ company_id: company.id })
    .eq("user_id", userId);

  // Add admin role
  await supabase
    .from("user_roles")
    .insert({ user_id: userId, company_id: company.id, role: "admin" });

  return company.id as string;
}

export function useCompany() {
  const { user, loading: authLoading } = useAuth();

  const { data: companyId, isLoading: queryLoading } = useQuery({
    queryKey: ["company", user?.id],
    queryFn: () => ensureCompany(user!.id, user!.email),
    enabled: !!user,
    staleTime: Infinity,
    retry: 2,
  });

  // Consider loading if auth is still loading OR if we have a user but company hasn't resolved yet
  const isLoading = authLoading || (!!user && queryLoading);

  return { companyId: companyId ?? null, isLoading };
}
