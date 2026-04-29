import { Card, CardContent } from "@/components/ui/card";

export interface RateCard {
  label: string;
  /** Pre-formatted big value, e.g. "61.1 %" or "604" */
  value: string;
  /** Optional raw subtitle like "(369/604)" */
  raw?: string;
}

export function RateKpiStrip({ cards }: { cards: RateCard[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="rounded-xl shadow-sm">
          <CardContent className="p-4">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">
              {c.label}
            </p>
            <p className="text-2xl font-bold font-display mt-1.5 text-foreground">
              {c.value}
            </p>
            {c.raw && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{c.raw}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function fmtRate(num: number, den: number): RateCard["value"] {
  if (!den) return "0.0 %";
  return `${((num / den) * 100).toFixed(1)} %`;
}
