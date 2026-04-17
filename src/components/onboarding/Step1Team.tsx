import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS = [
  "Physicians",
  "Nurses",
  "Allied Health",
  "Residents/Fellows",
  "Executives",
  "Other",
];

const TEAM_SIZES = ["Just me", "2–5", "6–20", "20+"];

export function Step1Team({ onComplete }: { onComplete: () => void }) {
  const { companyId } = useCompany();
  const { completeStep } = useOnboarding();
  const qc = useQueryClient();
  const [roles, setRoles] = useState<string[]>([]);
  const [teamSize, setTeamSize] = useState<string>("");
  const [specialty, setSpecialty] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleRole = (r: string) =>
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  const canSubmit = roles.length > 0 && teamSize.length > 0;

  const handleSave = async () => {
    if (!companyId || !canSubmit) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({
          recruiting_roles: roles,
          team_size: teamSize,
          primary_specialty: specialty || null,
        })
        .eq("id", companyId);
      if (error) throw error;
      await completeStep.mutateAsync("team");
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      toast.success("Saved");
      onComplete();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pl-10">
      <div className="space-y-2">
        <Label className="text-sm">What healthcare roles do you recruit for?</Label>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((r) => {
            const active = roles.includes(r);
            return (
              <button
                key={r}
                type="button"
                onClick={() => toggleRole(r)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground hover:border-primary/50",
                )}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Team size</Label>
        <RadioGroup value={teamSize} onValueChange={setTeamSize} className="flex flex-wrap gap-4">
          {TEAM_SIZES.map((s) => (
            <div key={s} className="flex items-center gap-2">
              <RadioGroupItem value={s} id={`team-size-${s}`} />
              <Label htmlFor={`team-size-${s}`} className="text-sm font-normal cursor-pointer">
                {s}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="specialty" className="text-sm">
          Primary specialty focus (optional)
        </Label>
        <Input
          id="specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="e.g. Cardiology, Oncology, Orthopedics"
        />
      </div>

      <Button onClick={handleSave} disabled={!canSubmit || saving}>
        {saving ? "Saving…" : "Save and continue"}
      </Button>
    </div>
  );
}
