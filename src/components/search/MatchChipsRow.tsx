import { Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { MatchChip } from "@/components/search/match-chips";

interface Props {
  chips: MatchChip[];
}

/**
 * Renders the brand-green tinted "what matched the query" chips on a result card.
 * Returns null when there are no chips — never pads with filler.
 */
export function MatchChipsRow({ chips }: Props) {
  if (!chips.length) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <Tooltip key={chip.id}>
            <TooltipTrigger asChild>
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[13px] font-medium text-foreground/85"
                aria-label={chip.reason}
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {chip.label}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {chip.reason}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
