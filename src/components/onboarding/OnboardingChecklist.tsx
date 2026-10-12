import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useOnboarding, type OnboardingStepKey } from "@/hooks/useOnboarding";
import { StepRow } from "./StepRow";
import { Step1Team } from "./Step1Team";
import { Step2Project } from "./Step2Project";
import { Step5Search } from "./Step5Search";

const STEPS: {
  key: OnboardingStepKey;
  index: number;
  title: string;
  description: string;
}[] = [
  { key: "team", index: 1, title: "Set your clinical focus", description: "Tell us which clinicians and specialty you recruit for." },
  { key: "project", index: 2, title: "Create your first project", description: "A project holds the clinicians you save for one role." },
  { key: "search", index: 3, title: "Run your first search", description: "Describe who you need in plain words, then save the people you like." },
];

export function OnboardingChecklist() {
  const { state, completedCount, totalSteps, currentStep } = useOnboarding();
  const [expanded, setExpanded] = useState<OnboardingStepKey | null>(null);

  // Auto-expand the first incomplete step on load / when currentStep changes.
  useEffect(() => {
    if (currentStep && expanded === null) {
      setExpanded(currentStep);
    }
  }, [currentStep, expanded]);

  const toggle = (key: OnboardingStepKey) =>
    setExpanded((cur) => (cur === key ? null : key));

  const advance = () => {
    // Move expansion to the next incomplete step.
    setExpanded(null);
  };

  const pct = Math.round((completedCount / totalSteps) * 100);

  return (
    <Card className="rounded-xl shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold font-display text-foreground">
              Get started with Oslr
            </h2>
            <p className="text-base text-muted-foreground mt-1">
              Three quick steps and you're sourcing clinicians.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-medium text-foreground/80">
              {completedCount}/{totalSteps} complete
            </p>
            <div className="mt-2 h-1 w-32 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="divide-y divide-border/60">
          {STEPS.map((s) => {
            const done = state?.[`step_${s.key}_complete`] ?? false;
            const isCurrent = !done && s.key === currentStep;
            const status: "complete" | "current" | "pending" = done
              ? "complete"
              : isCurrent
                ? "current"
                : "pending";
            return (
              <StepRow
                key={s.key}
                index={s.index}
                title={s.title}
                description={s.description}
                status={status}
                isExpanded={expanded === s.key}
                onToggle={() => toggle(s.key)}
              >
                {s.key === "team" && <Step1Team onComplete={advance} />}
                {s.key === "project" && <Step2Project onComplete={advance} />}
                {s.key === "search" && <Step5Search onComplete={advance} />}
              </StepRow>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
