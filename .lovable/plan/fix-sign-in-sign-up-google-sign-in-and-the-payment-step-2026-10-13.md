# Fix sign-in, sign-up, Google sign-in and the payment step

## What is going wrong

What I checked:
- No account exists for sflutied@gmail.com. I deleted it at your request, and no new account has been created since. The only accounts are steven@pitchsink.com and test@medsource.ai.
- The payment check ran several times at 8:19 PM, which is when your screenshot was taken.

What I think is happening (not yet proven):
1. **The app believes a login it never checks.** Your incognito window still held the sflutied login from your 8:13 PM test, and I deleted that account at 8:16. The app only reads that saved login from the browser. It never asks the server whether the account still exists. So it treats you as signed in, sends you straight past the sign-in page to the dashboard, and the payment check fails because the account is gone. That gives the "Checkout is unavailable right now" screen with no way back to sign in. The same thing happens to anyone whose login expired or was removed.
2. **The payment screen hides the real problem.** When the payment check rejects a login, the screen shows a generic "unavailable" message instead of sending you to sign in again.
3. **Email sign-up dead-ends.** After someone clicks the confirm link in their email, they land on the homepage instead of going into the app and on to payment.
4. **Google sign-up was blocked earlier.** Sign-ups were switched off for the whole app, so Google turned new people away (the records show this at 8:08–8:09 PM). That setting is now on, so step 1 below re-tests it.

## The fix

1. **Check the login with the server every time the app opens.** If the account is gone or the login has expired, sign the person out quietly and show the normal sign-in page. Nobody gets past sign-in on a login that isn't real.
2. **Payment step:**
   - If the payment check rejects the login: sign out and go to the sign-in page, with no error screen.
   - If payment really is unavailable: show the actual reason, plus "Try again" and "Sign out".
   - Approved free workspaces (yours, Jonathan's, MedSource) skip payment as they do now.
3. **Email sign-up:** the confirm link brings people back to the sign-in page, which moves them into the app and then to payment.
4. **Google:** both sign-up and sign-in return to the sign-in page, then move into the app. New accounts start at 0 credits and go to Stripe checkout.
5. **Homepage buttons:** "Log In" and "Get Started" open the sign-in page when you're signed out, and go into the app when you're signed in.

## How I will prove it before telling you it works

I'll run each of these myself in a fresh, empty browser on the preview, and take screenshots:
- Signed out: "Get Started" shows the sign-in form, and the dashboard redirects to sign-in.
- A browser holding a login for a deleted account (your exact case) lands on the sign-in page, not the error screen.
- A brand-new email account, once confirmed, goes into the app and then to the Stripe payment page, with 0 credits.
- An approved account (steven@pitchsink.com) goes straight into the dashboard with no payment step.
- Google: I can't click through Google's own sign-in screen from my test browser. I'll check that the button reaches Google, and that the return trip with a Google login lands correctly.

After that, you publish and try once in a fresh incognito window. Close the old incognito window first, because it still holds the deleted login.

## Technical details

- `useAuth`: after reading the saved session, call `supabase.auth.getUser()`. On failure, call `signOut()` and clear the session state. `loading` stays true until this check finishes.
- `ProtectedRoute`: treat a 401 or missing-user reply from the billing function as signed out (sign out, redirect to `/auth`). Show the function's error text for other failures.
- `Auth.tsx`: `emailRedirectTo: ${origin}/auth`. Keep the Google `redirect_uri` as `${origin}/auth`. Redirect only after `getUser()` succeeds.
- No database changes. No changes to the search functions.
