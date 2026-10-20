import { describe, expect, it } from "vitest";
import { canLookupContact, contactCharge } from "../../supabase/functions/search-people/contact-policy";

describe("permanent unlimited contact pass", () => {
  it("allows all contact types with zero balance", () => {
    expect(canLookupContact(true, 0, 10)).toBe(true);
  });
  it("never charges unlimited workspaces", () => {
    expect(contactCharge(true, [2, 3, 5])).toBe(0);
  });
  it("keeps ordinary workspace credit limits", () => {
    expect(canLookupContact(false, 0, 10)).toBe(false);
    expect(contactCharge(false, [2, 3, 5])).toBe(10);
  });
});