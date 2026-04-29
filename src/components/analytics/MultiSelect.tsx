import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: Option[];
  value: string[];
  onChange: (v: string[]) => void;
  allLabel?: string;
  width?: string;
}

export function MultiSelect({
  label,
  options,
  value,
  onChange,
  allLabel,
  width = "w-[180px]",
}: Props) {
  const [open, setOpen] = useState(false);
  const isAll = value.length === 0;
  const display = isAll
    ? allLabel ?? `All ${label.toLowerCase()}`
    : value.length === 1
    ? options.find((o) => o.value === value[0])?.label ?? value[0]
    : `${value.length} selected`;

  const toggle = (v: string) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-muted-foreground font-medium">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9 justify-between font-normal", width)}
          >
            <span className="truncate">{display}</span>
            <ChevronDown className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-1 w-[240px]" align="start">
          <button
            className={cn(
              "flex items-center w-full text-sm px-2 py-1.5 rounded-sm hover:bg-accent",
              isAll && "font-medium"
            )}
            onClick={() => onChange([])}
          >
            <span className="w-4 mr-2">{isAll && <Check className="h-3.5 w-3.5" />}</span>
            {allLabel ?? `All ${label.toLowerCase()}`}
          </button>
          <div className="h-px bg-border my-1" />
          <div className="max-h-64 overflow-y-auto">
            {options.map((o) => {
              const checked = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  className="flex items-center w-full text-sm px-2 py-1.5 rounded-sm hover:bg-accent text-left"
                  onClick={() => toggle(o.value)}
                >
                  <span className="w-4 mr-2">
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
