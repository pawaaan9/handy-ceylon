/**
 * An error whose message is safe and useful to show the user. Anything else
 * thrown from server code is logged and replaced with a generic message.
 */
export class UserFacingError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = "UserFacingError";
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 409,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
