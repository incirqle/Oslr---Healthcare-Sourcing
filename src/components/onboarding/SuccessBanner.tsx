import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";

export function SuccessBanner() {
  const { dismissBanner } = useOnboarding();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/10 px-5 py-4">
      <p className="text-base text-foreground">
        You're all set. Your dashboard is live below.
      </p>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => dismissBanner.mutate()}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
