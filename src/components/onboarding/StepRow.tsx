import { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepRowProps {
  index: number;
  title: string;
  description: string;
  status: "complete" | "current" | "pending";
  isExpanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}

export function StepRow({
  index,
  title,
  description,
  status,
  isExpanded,
  onToggle,
  children,
}: StepRowProps) {
  const ariaLabel =
    status === "complete"
      ? `Step ${index}, complete`
      : status === "current"
        ? `Step ${index}, in progress`
        : `Step ${index}, not started`;

  return (
    <div className="border-t border-border/60 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-2 py-4 min-h-[64px] text-left hover:bg-muted/30 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isExpanded}
      >
        <div
          aria-label={ariaLabel}
          className={cn(
            "shrink-0 h-6 w-6 rounded-full flex items-center justify-center border-2 transition-colors",
            status === "complete" && "bg-primary border-primary",
            status === "current" && "border-primary",
            status === "pending" && "border-muted-foreground/40",
          )}
        >
          {status === "complete" && (
            <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
          )}
          {status === "current" && (
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-lg font-medium text-foreground font-display">
            {index}. {title}
          </p>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>

        <div className="shrink-0 text-muted-foreground">
          {status === "complete" ? (
            <span className="text-sm font-medium text-primary">Edit</span>
          ) : (
            <ChevronDown
              className={cn(
                "h-5 w-5 transition-transform duration-200",
                isExpanded && "rotate-180",
              )}
            />
          )}
        </div>
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-in-out",
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {isExpanded && <div className="px-2 pb-5 pt-1">{children}</div>}
        </div>
      </div>
    </div>
  );
}
