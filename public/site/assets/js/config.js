/* =====================================================================
   OSLR SITE CONFIG
   Everything you are likely to change lives here. Pages read it at load.
   Prices are written into the HTML as well, so the page is correct even
   before this script runs; keep both in sync by re-running the build
   (src/build.py) or edit here and the pricing page updates itself.
   ===================================================================== */
window.OSLR = {
  links: {
    signup: "/auth?mode=signup",
    login: "/auth",
    demo: "mailto:hello@oslr.health?subject=Oslr%20demo",
    email: "hello@oslr.health"
  },

  pricing: {
    annualDiscount: 0.15,          // 15% off when billed annually
    roundMonthly: true,            // show annual monthly price rounded to the dollar
    plans: {
      starter: { monthly: 129, credits: 150 },
      pro:     { monthly: 229, credits: 500 }
    },
    // What one reveal costs, in credits
    creditCost: { workEmail: 1, personalEmail: 2, phone: 3 }
  }
};
