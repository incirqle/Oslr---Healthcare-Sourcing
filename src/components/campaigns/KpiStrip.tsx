import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCard {
  label: string;
  value: number | string;
  delta?: number; // signed percent change vs prior period
}

export function KpiStrip({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => {
        const hasDelta = typeof c.delta === "number";
        const up = (c.delta ?? 0) >= 0;
        return (
          <Card key={c.label} className="relative">
            <CardContent className="p-3">
              {hasDelta && (
                <span
                  className={cn(
                    "absolute top-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-medium",
                    up ? "text-success" : "text-destructive"
                  )}
                >
                  {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(c.delta!).toFixed(1)}%
                </span>
              )}
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
                {c.label}
              </p>
              <p className="text-xl font-bold font-display mt-1 text-foreground">
                {typeof c.value === "number" ? c.value.toLocaleString() : c.value}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
