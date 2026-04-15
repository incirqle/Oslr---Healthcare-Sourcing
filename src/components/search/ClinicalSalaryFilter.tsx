import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, AlertTriangle } from "lucide-react";
import {
  type RoleGroup,
  type SalaryPreset,
  PHYSICIAN_PRESETS,
  NURSING_PRESETS,
  presetSalaryRange,
} from "@/constants/clinicalSalaryPresets";
import { buildClinicalSearchQuery, type PDLSearchQuery } from "@/lib/pdlQueryBuilder";

interface ClinicalSalaryFilterProps {
  onQueryChange: (query: PDLSearchQuery | null, preset: SalaryPreset | null) => void;
  defaultRoleGroup?: RoleGroup;
  defaultPresetId?: string;
  disabled?: boolean;
}

export function ClinicalSalaryFilter({
  onQueryChange,
  defaultRoleGroup = "physician",
  defaultPresetId,
  disabled = false,
}: ClinicalSalaryFilterProps) {
  const [roleGroup, setRoleGroup] = useState<RoleGroup>(defaultRoleGroup);
  const [selectedId, setSelectedId] = useState<string | null>(defaultPresetId ?? null);
  const [requireExperience, setRequireExperience] = useState(false);
  const [expandedTargeting, setExpandedTargeting] = useState<string | null>(null);

  const presets = roleGroup === "physician" ? PHYSICIAN_PRESETS : NURSING_PRESETS;
  const isNursing = roleGroup === "nursing";

  const emitChange = useCallback(
    (preset: SalaryPreset | null, expReq: boolean) => {
      if (!preset) {
        onQueryChange(null, null);
        return;
      }
      const query = buildClinicalSearchQuery(preset, { requireExperience: expReq });
      onQueryChange(query, preset);
    },
    [onQueryChange]
  );

  const handleRoleGroupChange = (value: string) => {
    const rg = value as RoleGroup;
    setRoleGroup(rg);
    setSelectedId(null);
    setRequireExperience(false);
    setExpandedTargeting(null);
    onQueryChange(null, null);
  };

  const handleSelectPreset = (preset: SalaryPreset) => {
    if (disabled) return;
    const nextId = selectedId === preset.id ? null : preset.id;
    setSelectedId(nextId);
    emitChange(nextId ? preset : null, requireExperience);
  };

  const handleExperienceToggle = (checked: boolean) => {
    setRequireExperience(checked);
    const preset = presets.find((p) => p.id === selectedId) ?? null;
    emitChange(preset, checked);
  };

  return (
    <div className={cn("rounded-xl border border-ui-border-light bg-card", disabled && "pointer-events-none opacity-50")}>
      {/* Role group tabs */}
      <div className="border-b border-ui-border-light px-4 pt-4 pb-3">
        <Tabs value={roleGroup} onValueChange={handleRoleGroupChange}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="physician" className="flex-1 sm:flex-initial">Physicians</TabsTrigger>
            <TabsTrigger value="nursing" className="flex-1 sm:flex-initial">Nurses & APPs</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Presets */}
      <div className="divide-y divide-ui-border-light" role="radiogroup" aria-label="Salary preset">
        {presets.map((preset) => {
          const isSelected = selectedId === preset.id;
          const range = presetSalaryRange(preset);
          const isTargetingOpen = expandedTargeting === preset.id;

          return (
            <div key={preset.id}>
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelectPreset(preset)}
                className={cn(
                  "w-full px-5 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isSelected ? "bg-primary/[0.06]" : "hover:bg-ui-surface-hover"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* Radio dot */}
                    <span
                      className={cn(
                        "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        isSelected ? "border-primary" : "border-ui-border-medium"
                      )}
                    >
                      {isSelected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </span>

                    <div>
                      <span className="text-[15px] font-medium text-ui-text-primary">{preset.label}</span>
                      <p className="mt-0.5 text-[13px] text-ui-text-tertiary">{preset.sublabel}</p>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-md bg-salary/60 px-2.5 py-1 text-[13px] font-medium text-salary-foreground">
                    {range}
                  </span>
                </div>
              </button>

              {/* Targeting detail (power user) */}
              {isSelected && (
                <div className="border-t border-ui-border-light bg-ui-surface-subtle px-5 py-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedTargeting(isTargetingOpen ? null : preset.id);
                    }}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-ui-text-muted hover:text-ui-text-secondary"
                  >
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isTargetingOpen && "rotate-180")} />
                    PDL targeting
                  </button>

                  {isTargetingOpen && (
                    <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                      {preset.jobTitleClasses.map((cls) => (
                        <span
                          key={cls}
                          className="rounded-[4px] bg-tag px-2 py-0.5 text-[11px] text-tag-foreground"
                        >
                          {cls}
                        </span>
                      ))}
                      {preset.salaryBuckets.map((b) => (
                        <span
                          key={b}
                          className="rounded-[4px] bg-salary/40 px-2 py-0.5 text-[11px] text-salary-foreground"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Experience toggle */}
      <div className="border-t border-ui-border-light px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[14px] font-medium text-ui-text-primary">Require experience data</span>
            {isNursing && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-warning">
                <AlertTriangle className="h-3 w-3" />
                Reduces results for nursing roles
              </p>
            )}
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Switch
                    checked={requireExperience}
                    onCheckedChange={handleExperienceToggle}
                    disabled={disabled}
                    aria-label="Require experience data"
                  />
                </div>
              </TooltipTrigger>
              {isNursing && (
                <TooltipContent side="left" className="max-w-[220px] text-[12px]">
                  PDL has lower experience fill rates for nursing profiles. Enabling this will significantly reduce results.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
