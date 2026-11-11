/**
 * Turns a raw backend auth error into a message the user can act on.
 *
 * Rules:
 * - Only mention password length when the typed password really is too short.
 * - Never rewrite an unrelated error into a password-length warning.
 * - Let the real backend message through when nothing special applies.
 */
export type AuthErrorAdvice = {
  message: string;
  /** True when the form should switch the user over to the sign-in tab. */
  showSignIn: boolean;
};

const MIN_PASSWORD_LENGTH = 6;

export function describeAuthError(
  rawMessage: string,
  passwordLength: number,
): AuthErrorAdvice {
  const msg = String(rawMessage ?? "");

  if (/invalid login credentials/i.test(msg)) {
    return {
      message:
        "Email or password doesn't match. New here? Choose \"Create account\" at the top.",
      showSignIn: false,
    };
  }

  if (/already registered|already exists/i.test(msg)) {
    return {
      message:
        "You already have an account with this email. Choose \"Sign in\" at the top.",
      showSignIn: true,
    };
  }

  if (/email not confirmed/i.test(msg)) {
    return {
      message: "Please open the confirmation email we sent you, then sign in.",
      showSignIn: false,
    };
  }

  // Length is only reported when the typed password actually is short.
  if (passwordLength > 0 && passwordLength < MIN_PASSWORD_LENGTH) {
    return {
      message: "Please use a password with at least 6 characters.",
      showSignIn: false,
    };
  }

  if (/leaked|breach|pwned/i.test(msg)) {
    return {
      message:
        "That password has appeared in a known data breach. Please choose a different one.",
      showSignIn: false,
    };
  }

  return { message: msg || "Something went wrong. Please try again.", showSignIn: false };
}
