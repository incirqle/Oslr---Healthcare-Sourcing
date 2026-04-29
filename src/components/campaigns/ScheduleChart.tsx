import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateSchedule, type MockCampaign } from "@/data/mock-campaigns";

export function ScheduleChart({ scoped }: { scoped?: MockCampaign }) {
  const [period, setPeriod] = useState<"7" | "14" | "30">("7");
  const data = generateSchedule(parseInt(period, 10), scoped);
  const max = Math.max(1, ...data.map((d) => d.sent + d.scheduled));

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">Schedule</h3>
            <Select value={period} onValueChange={(v) => setPeriod(v as "7" | "14" | "30")}>
              <SelectTrigger className="h-7 text-xs w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 day period</SelectItem>
                <SelectItem value="14">14 day period</SelectItem>
                <SelectItem value="30">30 day period</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> sent
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary/30" /> scheduled
            </span>
          </div>
        </div>

        <div className="relative h-44 flex items-end gap-1">
          {data.map((d, i) => {
            const sentH = (d.sent / max) * 100;
            const schedH = (d.scheduled / max) * 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center justify-end h-full relative group"
              >
                {d.isToday && (
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px border-l border-dashed border-foreground/40" />
                )}
                <div className="w-full max-w-[36px] flex flex-col-reverse h-full justify-start">
                  {d.sent > 0 && (
                    <div
                      className="w-full bg-primary rounded-sm transition-all"
                      style={{ height: `${sentH}%` }}
                      title={`${d.sent} sent`}
                    />
                  )}
                  {d.scheduled > 0 && (
                    <div
                      className="w-full bg-primary/30 rounded-sm transition-all"
                      style={{ height: `${schedH}%` }}
                      title={`${d.scheduled} scheduled`}
                    />
                  )}
                </div>
                {d.isToday && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-4 text-[9px] font-semibold text-foreground bg-background px-1 rounded">
                    TODAY
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-2">
          {data.map((d, i) => (
            <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground">
              {d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
