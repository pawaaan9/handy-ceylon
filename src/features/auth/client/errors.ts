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
