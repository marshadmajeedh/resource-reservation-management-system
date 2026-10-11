/**
 * In-Memory Login Rate Limiter for Single-Instance Assessment App.
 *
 * ARCHITECTURAL NOTES & LIMITATIONS:
 * 1. Single-Instance / In-Memory Scope:
 *    This rate limiter stores failed login attempts in application memory.
 *    - All rate limits automatically reset upon application or server restart.
 *    - In a horizontally scaled cluster, state is not shared between nodes.
 *      (For multi-instance production deployments, a centralized store like Redis would be required).
 * 2. Spoofing Defense:
 *    Arbitrary client-supplied forwarding headers (such as `X-Forwarded-For` or `Client-IP`)
 *    must NOT be trusted as an IP identity because an attacker can easily forge them
 *    to bypass IP-based rate limiting or cause denial-of-service against other users.
 *    Therefore, this rate limiter keys attempts primarily by normalized account email
 *    (combined with remote connection identity when reliably available), ensuring account
 *    brute-force protection regardless of client IP spoofing.
 * 3. Bounded Memory:
 *    The in-memory cache enforces a strict maximum entry size (5,000 keys) and periodically
 *    purges expired entries to prevent memory exhaustion attacks.
 * 4. Legitimate User Temporary Lockout Limitation:
 *    Because rate limiting is keyed on normalized account email to effectively thwart credential-stuffing
 *    without relying on untrusted/spoofable client IP headers, a malicious actor deliberately submitting
 *    5 invalid password guesses for a specific target email will trigger the 15-minute block.
 *    During this lockout window, the legitimate account owner will also be temporarily prevented from
 *    logging in until the lockout duration expires.
 */

interface RateLimitRecord {
  failedAttempts: number;
  firstFailedAt: number;
  blockedUntil: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout after max attempts
const MAX_MAP_ENTRIES = 5000;

class InMemoryRateLimiter {
  private attempts = new Map<string, RateLimitRecord>();

  private purgeExpired(now: number): void {
    for (const [key, record] of this.attempts.entries()) {
      if (now > record.blockedUntil && now - record.firstFailedAt > WINDOW_DURATION_MS) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Checks whether login attempts are currently allowed for the given key.
   */
  public check(key: string): RateLimitCheckResult {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record) {
      return {
        allowed: true,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
        retryAfterSeconds: 0,
      };
    }

    // Check if lockout has expired
    if (record.blockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    // Check if the rate-limit window has expired
    if (now - record.firstFailedAt > WINDOW_DURATION_MS) {
      this.attempts.delete(key);
      return {
        allowed: true,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
        retryAfterSeconds: 0,
      };
    }

    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts);
    return {
      allowed: record.failedAttempts < MAX_FAILED_ATTEMPTS,
      remainingAttempts,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Records a failed login attempt for the key.
   */
  public recordFailure(key: string): RateLimitCheckResult {
    const now = Date.now();

    // Prevent unbounded memory growth
    if (this.attempts.size >= MAX_MAP_ENTRIES) {
      this.purgeExpired(now);
      if (this.attempts.size >= MAX_MAP_ENTRIES) {
        // Evict oldest entry if still full
        const oldestKey = this.attempts.keys().next().value;
        if (oldestKey) this.attempts.delete(oldestKey);
      }
    }

    let record = this.attempts.get(key);

    if (!record || now - record.firstFailedAt > WINDOW_DURATION_MS) {
      record = {
        failedAttempts: 1,
        firstFailedAt: now,
        blockedUntil: 0,
      };
      this.attempts.set(key, record);
    } else {
      record.failedAttempts += 1;
      if (record.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        record.blockedUntil = now + BLOCK_DURATION_MS;
      }
    }

    const retryAfterSeconds =
      record.blockedUntil > now ? Math.ceil((record.blockedUntil - now) / 1000) : 0;
    const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - record.failedAttempts);

    return {
      allowed: record.failedAttempts < MAX_FAILED_ATTEMPTS,
      remainingAttempts,
      retryAfterSeconds,
    };
  }

  /**
   * Resets rate-limiting state upon successful authentication.
   */
  public reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Clears all in-memory rate limit records (used in automated testing).
   */
  public clearAll(): void {
    this.attempts.clear();
  }
}

export const loginRateLimiter = new InMemoryRateLimiter();

/**
 * Builds a secure rate-limiting key for login attempts.
 * Uses normalized email to protect user accounts from brute-force password guessing
 * without trusting spoofable client forwarding headers.
 */
export function buildLoginRateLimitKey(normalizedEmail: string): string {
  return `login:account:${normalizedEmail.trim().toLowerCase()}`;
}
