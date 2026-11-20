import { describe, expect, it } from "vitest";
import { canUpgradeToPro, workspaceCreditPool, type PlanOption } from "@/lib/settings-data";

const options: PlanOption[] = [
  { id: "starter", seats: 1, monthlyCredits: 150, prices: [], contact_costs: { work_email: 2, personal_email: 3, phone: 3 } },
  { id: "pro", seats: 5, monthlyCredits: 500, prices: [], contact_costs: { work_email: 1, personal_email: 2, phone: 3 } },
  { id: "beta", seats: 1, monthlyCredits: 150, prices: [], contact_costs: { work_email: 2, personal_email: 3, phone: 3 } },
];

describe("workspace plan presentation rules", () => {
  it("offers Pro upgrades to Starter and Early access, never Pro or Enterprise", () => {
    expect(canUpgradeToPro("starter")).toBe(true);
    expect(canUpgradeToPro("beta")).toBe(true);
    expect(canUpgradeToPro("pro")).toBe(false);
    expect(canUpgradeToPro("enterprise")).toBe(false);
  });

  it("shows Pro as one shared pool of 500 credits per active seat, up to five seats", () => {
    expect(workspaceCreditPool("pro", 1, options)).toBe(500);
    expect(workspaceCreditPool("pro", 3, options)).toBe(1500);
    expect(workspaceCreditPool("pro", 5, options)).toBe(2500);
    expect(workspaceCreditPool("pro", 9, options)).toBe(2500);
  });

  it("keeps Starter and Early access at one flat 150-credit pool", () => {
    expect(workspaceCreditPool("starter", 3, options)).toBe(150);
    expect(workspaceCreditPool("beta", 3, options)).toBe(150);
  });

  it("does not invent a credit allocation for Enterprise", () => {
    expect(workspaceCreditPool("enterprise", 3, options)).toBeNull();
  });
});
