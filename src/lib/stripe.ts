import { loadStripe } from "@stripe/stripe-js";

// Publishable key is safe to ship to the browser. Until it is set, checkout
// falls back to the hosted Stripe page.
export const STRIPE_PUBLISHABLE_KEY = "pk_live_51UWdhtInIoJSr7wvXWtGTxofTVVst5GpyJoPIxMuu9DcR8UgDc0B3VNh2BvCKpZ1H0gfr5YXt3ET1QB6icKOiahX000hulIz6W"; // Oslr account

export const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;
