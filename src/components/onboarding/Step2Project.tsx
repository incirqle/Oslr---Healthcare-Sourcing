import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function Step2Project({ onComplete }: { onComplete: () => void }) {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const { completeStep } = useOnboarding();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 0 && roleTitle.trim().length > 0;

  const handleCreate = async () => {
    if (!companyId || !user || !canSubmit) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("projects").insert({
        company_id: companyId,
        created_by: user.id,
        name: name.trim(),
        role_title: roleTitle.trim(),
        location: location.trim() || null,
        target_start_date: startDate || null,
      });
      if (error) throw error;
      await completeStep.mutateAsync("project");
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project created");
      onComplete();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 pl-10">
      <div className="space-y-2">
        <Label htmlFor="proj-name" className="text-sm">Project name</Label>
        <Input
          id="proj-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cardiology Hospitalist — Boston"
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="proj-role" className="text-sm">Role / title</Label>
          <Input
            id="proj-role"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="e.g. Cardiologist"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proj-loc" className="text-sm">Location</Label>
          <Input
            id="proj-loc"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State or Remote"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="proj-date" className="text-sm">Target start date (optional)</Label>
        <Input
          id="proj-date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-fit"
        />
      </div>
      <Button onClick={handleCreate} disabled={!canSubmit || saving}>
        {saving ? "Creating…" : "Create project"}
      </Button>
    </div>
  );
}
