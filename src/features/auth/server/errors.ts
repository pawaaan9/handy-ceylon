import "server-only";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 | 409,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
