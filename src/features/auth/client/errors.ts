/** Maps Firebase Auth error codes to messages that don't leak account existence. */
const messages: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/user-disabled": "This account has been disabled. Please contact support.",
  "auth/too-many-requests":
    "Too many attempts. Please wait a few minutes and try again, or reset your password.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/expired-action-code": "This link has expired. Please request a new one.",
  "auth/invalid-action-code": "This link is invalid or has already been used.",
  "auth/weak-password": "Choose a stronger password.",
  "auth/requires-recent-login": "Please log in again to continue.",
  "auth/operation-not-allowed":
    "Email sign-in is not enabled for this project yet. Please contact support.",
  "auth/popup-closed-by-user": "The Google window was closed before signing in.",
  "auth/cancelled-popup-request": "The Google window was closed before signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "This email is already registered with a password. Log in with your email and password instead.",
  "auth/credential-already-in-use": "This email is already linked to another account.",
  "auth/email-already-in-use": "This email is already linked to another account.",
  "auth/provider-already-linked": "An email is already linked to this account.",
  "auth/invalid-phone-number": "Enter a valid Sri Lankan mobile number.",
  "auth/missing-phone-number": "Enter your mobile number.",
  "auth/invalid-verification-code": "That code is incorrect. Check the SMS and try again.",
  "auth/code-expired": "That code has expired. Request a new one.",
  "auth/captcha-check-failed": "We couldn't verify this request. Refresh the page and try again.",
  "auth/quota-exceeded": "We can't send more codes right now. Please try again later.",
  "auth/unauthorized-domain": "Sign-in isn't enabled for this website address yet.",
  "auth/configuration-not-found":
    "Authentication is not configured for this project yet. Please contact support.",
};

export function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string } | null)?.code;
  if (code && messages[code]) return messages[code];
  if (process.env.NODE_ENV !== "production") console.error(error);
  return "Something went wrong. Please try again.";
}

export function authErrorCode(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}
