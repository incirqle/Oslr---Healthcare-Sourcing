import { loadStripe } from "@stripe/stripe-js";

// Publishable key is safe to ship to the browser. Until it is set, checkout
// falls back to the hosted Stripe page.
export const STRIPE_PUBLISHABLE_KEY = "";

export const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;
