export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

/**
 * HttpOnly Cookie Management for JWT Session Tokens.
 *
 * Security Mandates:
 * 1. HttpOnly: Prevents client-side scripts from directly reading or copying the cookie value.
 *    (Note: HttpOnly does not eliminate XSS or prevent malicious injected scripts from issuing
 *    authenticated requests on the user's behalf).
 * 2. Secure: Mandatory in production to ensure transmission over HTTPS only.
 * 3. SameSite=Lax: Prevents CSRF on cross-site requests while preserving top-level navigation.
 * 4. Path=/: Applies cookie across the entire origin.
 * 5. Expiry aligned with JWT expiration (8 hours).
 * 6. Logout cookie clears session using identical name, path, and security flags with maxAge 0.
 */

export const SESSION_COOKIE_NAME = "rrs_session";

export interface SessionCookieOptions {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  expires: Date;
}

export function getSessionCookieOptions(
  durationSeconds: number = SESSION_DURATION_SECONDS
): SessionCookieOptions {
  const expiresAt = new Date(Date.now() + durationSeconds * 1000);
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: durationSeconds,
    expires: expiresAt,
  };
}

export function getLogoutCookieOptions(): SessionCookieOptions {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };
}
