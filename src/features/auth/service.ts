import type { AuthResult, LoginInput, SafeUser } from "./types.ts";
import { normalizeEmail } from "./types.ts";
import { verifyPassword, verifyDummyPassword } from "./password.ts";
import { signSessionToken } from "./jwt.ts";
import {
  loginRateLimiter,
  buildLoginRateLimitKey,
} from "./rate-limiter.ts";
import { findUserRecordByEmail } from "./repository.ts";

/**
 * Authentication Business Logic Service.
 *
 * Security Mandates:
 * 1. Passwords are never trimmed, transformed, or printed.
 * 2. Input sizes are bounded (email <= 255 characters, password 8..128 characters).
 * 3. Timing disparity reduction: Unknown email and inactive accounts trigger dummy hash verification
 *    to reduce obvious timing differences without guaranteeing strictly constant-time login.
 * 4. Generic error messages: Unknown email, bad password, and inactive accounts return the
 *    exact same message ("Invalid email or password.") to prevent account enumeration.
 * 5. Bounded rate limiting: Enforced on repeated failures to prevent automated brute-force attacks.
 * 6. Never returns passwordHash or logs sensitive credentials.
 */

const GENERIC_AUTH_ERROR = "Invalid email or password.";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthenticateOptions {
  clientKey?: string;
  jwtSecret?: string;
}

/**
 * Authenticates user credentials and produces a verified session token upon success.
 */
export async function authenticateCredentials(
  input: LoginInput,
  options?: AuthenticateOptions
): Promise<AuthResult> {
  // 1. Server-side input validation and size bounding
  if (
    !input ||
    typeof input.email !== "string" ||
    typeof input.password !== "string"
  ) {
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  const rawEmail = input.email;
  const rawPassword = input.password;

  // Bounded size validation
  if (
    rawEmail.length === 0 ||
    rawEmail.length > 255 ||
    !EMAIL_REGEX.test(rawEmail.trim()) ||
    rawPassword.length < 8 ||
    rawPassword.length > 128
  ) {
    // Perform dummy timing equalization on invalid format
    await verifyDummyPassword(rawPassword);
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  // 2. Consistent email normalization
  const normalizedEmail = normalizeEmail(rawEmail);
  const rateLimitKey = options?.clientKey || buildLoginRateLimitKey(normalizedEmail);

  // 3. Rate limit check
  const rateLimitCheck = loginRateLimiter.check(rateLimitKey);
  if (!rateLimitCheck.allowed) {
    return {
      success: false,
      error: `Too many failed attempts. Please try again in ${rateLimitCheck.retryAfterSeconds} seconds.`,
      retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
    };
  }

  // 4. Look up user by normalized email
  const user = await findUserRecordByEmail(normalizedEmail);

  // 5. Account not found: execute dummy verification to minimize timing discrepancy
  if (!user) {
    await verifyDummyPassword(rawPassword);
    loginRateLimiter.recordFailure(rateLimitKey);
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  // 6. Verify password hash using Argon2id
  const isPasswordValid = await verifyPassword(rawPassword, user.passwordHash);

  // 7. Wrong password: record failure and fail generically
  if (!isPasswordValid) {
    loginRateLimiter.recordFailure(rateLimitKey);
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  // 8. Account inactive: equalize timing and fail generically
  if (!user.isActive) {
    loginRateLimiter.recordFailure(rateLimitKey);
    return { success: false, error: GENERIC_AUTH_ERROR };
  }

  // 9. Success: reset rate limiter and generate session token
  loginRateLimiter.reset(rateLimitKey);

  const token = await signSessionToken(user.id, { secret: options?.jwtSecret });

  const safeUser: SafeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };

  return {
    success: true,
    user: safeUser,
    token,
  };
}
