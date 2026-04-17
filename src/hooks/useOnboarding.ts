import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";

export type OnboardingStepKey =
  | "team"
  | "project"
  | "invites"
  | "connectors"
  | "search";

export interface OnboardingState {
  company_id: string;
  step_team_complete: boolean;
  step_project_complete: boolean;
  step_invites_complete: boolean;
  step_connectors_complete: boolean;
  step_search_complete: boolean;
  success_banner_dismissed: boolean;
}

const STEP_ORDER: OnboardingStepKey[] = [
  "team",
  "project",
  "invites",
  "connectors",
  "search",
];

function stepKeyToColumn(key: OnboardingStepKey) {
  return `step_${key}_complete` as const;
}

export function useOnboarding() {
  const { companyId } = useCompany();
  const qc = useQueryClient();

  const query = useQuery<OnboardingState | null>({
    queryKey: ["company_onboarding", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_onboarding")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      // Self-heal: ensure a row exists for this company
      if (!data) {
        const { data: created, error: insErr } = await supabase
          .from("company_onboarding")
          .insert({ company_id: companyId! })
          .select("*")
          .single();
        if (insErr) throw insErr;
        return created as OnboardingState;
      }
      return data as OnboardingState;
    },
  });

  const completedCount = query.data
    ? STEP_ORDER.filter((k) => query.data![stepKeyToColumn(k)]).length
    : 0;
  const isFullyComplete = completedCount === STEP_ORDER.length;
  const currentStep: OnboardingStepKey | null = isFullyComplete
    ? null
    : STEP_ORDER.find((k) => !query.data?.[stepKeyToColumn(k)]) ?? null;

  const completeStep = useMutation({
    mutationFn: async (key: OnboardingStepKey) => {
      if (!companyId) throw new Error("No company");
      const col = stepKeyToColumn(key);
      const { error } = await supabase
        .from("company_onboarding")
        .update({ [col]: true })
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_onboarding", companyId] });
    },
  });

  const dismissBanner = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase
        .from("company_onboarding")
        .update({ success_banner_dismissed: true })
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company_onboarding", companyId] });
    },
  });

  return {
    state: query.data ?? null,
    isLoading: query.isLoading,
    completedCount,
    totalSteps: STEP_ORDER.length,
    isFullyComplete,
    currentStep,
    completeStep,
    dismissBanner,
  };
}
