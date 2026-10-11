/**
 * CSRF Protection, Request Origin Validation, and Safe Redirect Utilities.
 *
 * Security Mandates:
 * 1. For state-changing mutations (POST/PUT/DELETE), the incoming `Origin` or `Referer`
 *    header must match the application host, protecting against cross-site request forgery.
 * 2. Login and logout must strictly reject GET requests.
 * 3. Open Redirect Prevention: Redirect destinations must strictly be safe internal paths
 *    starting with a single `/`. Protocol-relative URLs (`//evil.com`), backslashes (`/\`),
 *    control characters, or external URI schemes are rejected and replaced with the fallback.
 */

/**
 * Validates that a mutation request's Origin or Referer matches the server Host.
 * Returns true if valid, false if a cross-origin attack is detected.
 */
export function validateMutationOrigin(headers: Headers): boolean {
  const host = headers.get("x-forwarded-host") || headers.get("host");

  if (!host) {
    return false;
  }

  const expectedHost = host.toLowerCase();

  const origin = headers.get("origin");
  if (origin) {
    if (origin === "null") {
      return false; // Reject opaque origins (sandboxed iframes, data URLs)
    }
    try {
      const originUrl = new URL(origin);
      return originUrl.host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }

  const referer = headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.host.toLowerCase() === expectedHost;
    } catch {
      return false;
    }
  }

  // Missing both Origin and Referer:
  // Cannot verify request origin; reject to prevent CSRF via header stripping
  return false;
}

/**
 * Sanitizes a redirect destination to ensure it stays within the application.
 * Rejects external URLs, protocol-relative paths (`//`), backslashes (`/\`), and non-HTTP schemes.
 */
export function sanitizeRedirectUrl(
  target: string | null | undefined,
  fallback = "/workspace"
): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();

  // Must begin with a single slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Reject protocol-relative URLs (e.g., //evil.com)
  if (trimmed.startsWith("//")) {
    return fallback;
  }

  // Reject backslash variations (e.g., /\evil.com or /\\evil.com)
  if (trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return fallback;
  }

  // Reject any embedded URL schemes (e.g., /test:http://evil.com) before query string
  const pathPart = trimmed.split("?")[0];
  if (pathPart.includes(":")) {
    return fallback;
  }

  // Reject CR/LF control characters that could cause HTTP response splitting
  if (/[\r\n\t]/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
