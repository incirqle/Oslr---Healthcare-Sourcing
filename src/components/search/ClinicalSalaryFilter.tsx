import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PHYSICIAN_PRESETS,
  NURSING_PRESETS,
  type SalaryPreset,
  type RoleGroup,
  findPresetById,
} from "@/constants/clinicalSalaryPresets";

export interface SalaryPresetSelection {
  id: string;
  salaryBuckets: string[];
  jobTitleClasses: string[];
  experienceHint?: { gte?: number; lte?: number };
  /** Whether the user opted into making the experience range a hard filter */
  requireExperience?: boolean;
}

interface ClinicalSalaryFilterProps {
  value: SalaryPresetSelection | null;
  onChange: (value: SalaryPresetSelection | null) => void;
  defaultRoleGroup?: RoleGroup;
}

function PresetList({
  presets,
  selectedId,
  onSelect,
}: {
  presets: SalaryPreset[];
  selectedId: string | null;
  onSelect: (preset: SalaryPreset) => void;
}) {
  return (
    <RadioGroup
      value={selectedId ?? ""}
      onValueChange={(v) => {
        const preset = presets.find((p) => p.id === v);
        if (preset) onSelect(preset);
      }}
      className="space-y-2"
    >
      {presets.map((preset) => {
        const isSelected = preset.id === selectedId;
        return (
          <Label
            key={preset.id}
            htmlFor={`preset-${preset.id}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-secondary/40",
            )}
          >
            <RadioGroupItem id={`preset-${preset.id}`} value={preset.id} className="mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{preset.label}</span>
                <span className="text-xs font-medium text-primary shrink-0">{preset.rangeLabel}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{preset.sublabel}</p>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

export function ClinicalSalaryFilter({
  value,
  onChange,
  defaultRoleGroup = "physician",
}: ClinicalSalaryFilterProps) {
  // Determine starting tab based on existing value
  const initialGroup: RoleGroup = (() => {
    if (value) {
      if (PHYSICIAN_PRESETS.some((p) => p.id === value.id)) return "physician";
      if (NURSING_PRESETS.some((p) => p.id === value.id)) return "nursing";
    }
    return defaultRoleGroup;
  })();
  const [group, setGroup] = useState<RoleGroup>(initialGroup);

  const selectedId = value?.id ?? null;
  const requireExperience = value?.requireExperience ?? false;

  const handleSelect = (preset: SalaryPreset) => {
    onChange({
      id: preset.id,
      salaryBuckets: preset.salaryBuckets,
      jobTitleClasses: preset.jobTitleClasses,
      experienceHint: preset.experienceHint,
      // Force-disable experience filter when switching to nursing presets
      requireExperience: group === "nursing" ? false : requireExperience,
    });
  };

  const handleClear = () => onChange(null);

  const handleTabChange = (next: string) => {
    const nextGroup = next as RoleGroup;
    setGroup(nextGroup);
    // Clear selection when switching role group — physician/nursing presets aren't interchangeable
    if (value) {
      const stillValid =
        nextGroup === "physician"
          ? PHYSICIAN_PRESETS.some((p) => p.id === value.id)
          : NURSING_PRESETS.some((p) => p.id === value.id);
      if (!stillValid) onChange(null);
    }
  };

  const isNursing = group === "nursing";
  const selectedPreset = findPresetById(selectedId);

  return (
    <div className="space-y-3">
      <Tabs value={group} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="physician">Physicians</TabsTrigger>
          <TabsTrigger value="nursing">Nurses & APPs</TabsTrigger>
        </TabsList>
        <TabsContent value="physician" className="mt-3">
          <PresetList presets={PHYSICIAN_PRESETS} selectedId={selectedId} onSelect={handleSelect} />
        </TabsContent>
        <TabsContent value="nursing" className="mt-3">
          <PresetList presets={NURSING_PRESETS} selectedId={selectedId} onSelect={handleSelect} />
        </TabsContent>
      </Tabs>

      {selectedPreset?.experienceHint && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/20 p-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="require-exp" className="text-sm font-medium cursor-pointer">
                Require experience data
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[260px] text-xs">
                    PDL's <code>inferred_years_experience</code> has lower fill rate on nursing
                    profiles. Enabling this hard-filters out candidates without that data and can
                    significantly reduce results.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hint:{" "}
              {selectedPreset.experienceHint.gte != null && selectedPreset.experienceHint.lte != null
                ? `${selectedPreset.experienceHint.gte}–${selectedPreset.experienceHint.lte} yrs`
                : selectedPreset.experienceHint.gte != null
                  ? `${selectedPreset.experienceHint.gte}+ yrs`
                  : `≤ ${selectedPreset.experienceHint.lte} yrs`}
              {isNursing && " · disabled for nursing roles"}
            </p>
          </div>
          <Switch
            id="require-exp"
            checked={!isNursing && requireExperience}
            disabled={isNursing}
            onCheckedChange={(checked) => {
              if (!value) return;
              onChange({ ...value, requireExperience: checked });
            }}
          />
        </div>
      )}

      {selectedId && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Clear salary preset
        </button>
      )}
    </div>
  );
}
