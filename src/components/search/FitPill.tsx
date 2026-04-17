import { Check, ChevronDown, CircleDashed, HelpCircle, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { FitStatus } from "@/hooks/useCandidateFit";

interface Props {
  status: FitStatus;
  onChange: (next: FitStatus) => void;
  size?: "sm" | "md";
  /** Stop propagation to the parent row's click handler (results card). */
  stopPropagation?: boolean;
}

const STATUS_META: Record<FitStatus, { label: string; classes: string; Icon: typeof Check }> = {
  unreviewed: {
    label: "Unreviewed",
    classes: "border-border bg-muted/40 text-muted-foreground hover:bg-muted/60",
    Icon: CircleDashed,
  },
  good: {
    label: "Good fit",
    classes: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15",
    Icon: Check,
  },
  maybe: {
    label: "Maybe",
    classes: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15",
    Icon: HelpCircle,
  },
  not: {
    label: "Not a fit",
    classes: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15",
    Icon: X,
  },
};

const ALL_STATUSES: FitStatus[] = ["unreviewed", "good", "maybe", "not"];

/**
 * Click-to-change fit pill. Used on result cards and (later) in the drawer.
 * Color + label + icon — never color alone, per accessibility requirements.
 */
export function FitPill({ status, onChange, size = "sm", stopPropagation = true }: Props) {
  const meta = STATUS_META[status];
  const Icon = meta.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => stopPropagation && e.stopPropagation()}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            size === "sm" ? "px-2 py-0.5 text-[12px]" : "px-3 py-1 text-sm",
            meta.classes,
          )}
          aria-label={`Fit status: ${meta.label}. Click to change.`}
        >
          <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
          {meta.label}
          <ChevronDown className={size === "sm" ? "h-3 w-3 opacity-60" : "h-3.5 w-3.5 opacity-60"} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => stopPropagation && e.stopPropagation()}
      >
        {ALL_STATUSES.map((s) => {
          const m = STATUS_META[s];
          const SIcon = m.Icon;
          return (
            <DropdownMenuItem
              key={s}
              onClick={() => onChange(s)}
              className="flex items-center gap-2 text-sm"
            >
              <SIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {m.label}
              {s === status && <Check className="ml-auto h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
