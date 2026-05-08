import { AlertTriangle } from "lucide-react";

export function PreviewBanner() {
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold">Preview</div>
        <div className="text-amber-200/80">Campaigns ships at launch.</div>
      </div>
    </div>
  );
}
