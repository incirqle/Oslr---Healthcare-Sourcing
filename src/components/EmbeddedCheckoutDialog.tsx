import { useCallback, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { stripePromise } from "@/lib/stripe";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: "starter" | "pro" | "beta";
  interval?: "month" | "year";
}

/** On-site Stripe checkout: the payment form lives inside Oslr, no redirect. */
export function EmbeddedCheckoutDialog({ open, onOpenChange, plan = "starter", interval = "month" }: Props) {
  const [error, setError] = useState<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("billing", {
      body: { action: "checkout", embedded: true, origin: window.location.origin, plan, interval },
    });
    if (invokeError || !data?.client_secret) {
      const message = data?.error || "Checkout is unavailable right now. Try again shortly.";
      setError(message);
      throw new Error(message);
    }
    return data.client_secret as string;
  }, [plan, interval]);

  if (!stripePromise) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Complete your subscription</DialogTitle>
        </DialogHeader>
        <div className="max-h-[80vh] overflow-y-auto bg-background">
          {error ? (
            <p className="p-6 text-sm text-muted-foreground">{error}</p>
          ) : (
            open && (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
