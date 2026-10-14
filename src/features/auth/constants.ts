/** `__session` is the only cookie Firebase Hosting / App Hosting forwards. */
export const SESSION_COOKIE_NAME = "__session";

/** Firebase session cookies may last between 5 minutes and 14 days. */
export const REMEMBER_ME_DURATION_MS = 14 * 24 * 60 * 60 * 1000;
export const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** A session may only be created from a recent sign-in (Firebase recommendation). */
export const MAX_SIGN_IN_AGE_SECONDS = 5 * 60;

export const PASSWORD_MIN_LENGTH = 8;
