import { describe, expect, it } from "vitest";
import { describeAuthError } from "./auth-errors";

describe("describeAuthError", () => {
  it("does not call a strong 10-character password too short", () => {
    const advice = describeAuthError(
      "Password is too common: it has appeared in known public data breaches. Please choose a more unique password.",
      10,
    );
    expect(advice.message).not.toMatch(/at least 6 characters/i);
    expect(advice.message).toMatch(/data breach/i);
  });

  it("only warns about length when the password really is short", () => {
    expect(
      describeAuthError("Password should be at least 6 characters.", 4).message,
    ).toBe("Please use a password with at least 6 characters.");
  });

  it("passes an unrelated backend error through unchanged", () => {
    expect(
      describeAuthError("A network problem stopped the request.", 12).message,
    ).toBe("A network problem stopped the request.");
  });

  it("keeps the sign-in hint for wrong credentials", () => {
    const advice = describeAuthError("Invalid login credentials", 8);
    expect(advice.message).toMatch(/Email or password doesn't match/);
    expect(advice.showSignIn).toBe(false);
  });

  it("switches to sign-in when the email is already registered", () => {
    const advice = describeAuthError("User already registered", 9);
    expect(advice.showSignIn).toBe(true);
    expect(advice.message).toMatch(/already have an account/);
  });
});
