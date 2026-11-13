import { describe, expect, it } from "vitest";
import { redeemPaidInviteCode } from "../../supabase/functions/_shared/invite-policy";
import { companyForNudge, shouldSendOwnerNudge } from "../../supabase/functions/stripe-webhook/nudge-rules";
import { hasCompanyBaseEvidence } from "../../supabase/functions/company-enrichment/cache-quality";

 describe("signup owner alerts", () => {
  it.each(["owner_unpaid", "owner_unpaid_day"])("cancels %s after payment", (kind) => {
    expect(shouldSendOwnerNudge(kind, { paid: true, trial: false, exempt: false })).toBe(false);
  });

  it("cancels unpaid alerts for a free pass or workspace exemption", () => {
    expect(shouldSendOwnerNudge("owner_unpaid", { paid: false, trial: true, exempt: false })).toBe(false);
    expect(shouldSendOwnerNudge("owner_unpaid_day", { paid: false, trial: false, exempt: true })).toBe(false);
  });

  it("recovers a missing workspace from the signup email", async () => {
    await expect(companyForNudge({ company_id: null, email: "person@example.com" }, async (email) => {
      expect(email).toBe("person@example.com");
      return "workspace-123";
    })).resolves.toBe("workspace-123");
  });
});

describe("company cache quality", () => {
  it("rejects the UCHealth blank shell instead of serving it for 90 days", () => {
    expect(hasCompanyBaseEvidence({
      display_name: "UCHealth",
      year_founded: null,
      headcount: { total: 10001, yoy_percent: null, yoy_absolute: null, timeseries: [], by_region: null },
      sites: [],
    })).toBe(false);
  });

  it("keeps populated company facts and verified partial records", () => {
    expect(hasCompanyBaseEvidence({ year_founded: 1921, headcount: { timeseries: [] }, sites: [] })).toBe(true);
    expect(hasCompanyBaseEvidence({ source_complete: true, headcount: { total: 8 }, sites: [] })).toBe(true);
  });
});

describe("invite-only code redemption", () => {
  it("accepts OSLR BETA with flexible case and spacing for an invited email", () => {
    expect(redeemPaidInviteCode(" oslr_beta ", true)).toEqual({ ok: true });
  });

  it("does not let an uninvited email grant itself the paid offer", () => {
    expect(redeemPaidInviteCode("OSLR BETA", false)).toEqual({ ok: false, reason: "invite_required" });
  });
});
