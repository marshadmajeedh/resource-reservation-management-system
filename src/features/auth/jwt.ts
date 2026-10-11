import { SignJWT, jwtVerify } from "jose";

/**
 * JWT Token Utilities using `jose`.
 *
 * Security Mandates:
 * 1. Strict JWT_SECRET validation: missing or known placeholder secrets fail clearly and immediately.
 * 2. No insecure fallback secrets.
 * 3. Algorithm: HS256 (HMAC SHA-256).
 * 4. Claims validated on every verification: algorithm, signature, expiry, issuer, audience.
 * 5. Minimal payload: Subject (`sub`) holds user ID.
 *    No confidential data or roles in token; user's role and isActive status are read fresh
 *    from the database on protected requests to guarantee real-time deactivation/promotion.
 * 6. Session lifetime: 8 hours (28,800 seconds) - standard working shift window.
 */

export const JWT_ISSUER = "rrs-auth";
export const JWT_AUDIENCE = "rrs-app";
export const JWT_ALGORITHM = "HS256";
export const SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8 hours

const KNOWN_PLACEHOLDERS = new Set([
  "your-secure-random-jwt-secret-placeholder",
  "changeme",
  "secret",
  "jwt_secret",
  "placeholder",
  "12345678901234567890123456789012",
  "default_secret_please_change",
]);

/**
 * Validates and returns the encoded JWT secret.
 * Throws a descriptive error if the secret is absent, too short, or a placeholder.
 */
export function getJwtSecretKey(customSecret?: string): Uint8Array {
  const secret = customSecret ?? process.env.JWT_SECRET;

  if (!secret || secret.trim() === "") {
    throw new Error(
      "Missing JWT_SECRET environment variable. A secure 32+ character random secret is required. No insecure fallback secret is permitted."
    );
  }

  const trimmed = secret.trim();

  if (KNOWN_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    throw new Error(
      "Insecure JWT_SECRET detected. The provided secret matches a known placeholder. Please generate a strong random 32+ character secret."
    );
  }

  if (trimmed.length < 32) {
    throw new Error(
      `JWT_SECRET is insufficiently secure (${trimmed.length} characters). It must be at least 32 characters long to ensure cryptographic integrity.`
    );
  }

  return new TextEncoder().encode(trimmed);
}

export interface SessionTokenPayload {
  userId: string;
}

/**
 * Signs a session JWT for a user ID.
 * Returns the signed compact JWT string.
 */
export async function signSessionToken(
  userId: string,
  options?: { secret?: string; expiresInSeconds?: number }
): Promise<string> {
  if (!userId || typeof userId !== "string") {
    throw new Error("Cannot sign session token without a valid userId string.");
  }

  const secretKey = getJwtSecretKey(options?.secret);
  const duration = options?.expiresInSeconds ?? SESSION_DURATION_SECONDS;

  return await new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + duration)
    .sign(secretKey);
}

/**
 * Verifies a session JWT and extracts the user ID subject.
 * Validates algorithm, signature, expiry, issuer, and audience.
 * Returns { userId } on success, or null on any verification failure.
 */
export async function verifySessionToken(
  token: string | null | undefined,
  options?: { secret?: string }
): Promise<SessionTokenPayload | null> {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null;
  }

  try {
    const secretKey = getJwtSecretKey(options?.secret);

    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [JWT_ALGORITHM],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (!payload.sub || typeof payload.sub !== "string" || payload.sub.trim() === "") {
      return null;
    }

    if (typeof payload.exp !== "number" || typeof payload.iat !== "number") {
      return null;
    }

    return { userId: payload.sub.trim() };
  } catch {
    // Malformed, tampered, expired, or wrong-issuer/audience tokens fail cleanly
    return null;
  }
}
