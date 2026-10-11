import { hash, verify } from "@node-rs/argon2";

/**
 * Password Hashing & Verification Module using Argon2id.
 *
 * Security Mandates:
 * 1. Argon2id is the primary algorithm recommended by OWASP for password hashing.
 * 2. Parameters follow OWASP/RFC 9106 standards:
 *    - Memory cost: 19456 KiB (~19 MiB)
 *    - Time cost: 2 iterations
 *    - Parallelism: 1 thread
 * 3. Dummy hash verification is used for unknown or inactive users to reduce obvious timing differences.
 *    (Note: This does not guarantee constant-time login due to database query latency and system variations).
 * 4. Passwords and hashes are never logged.
 */

// Pre-computed valid Argon2id hash for dummy verification to reduce timing discrepancies
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$YEJfqvc8L84ipwBJoHF1qw$rdO9K52EFz+BT7nBO4KIAUA7I5F3qjJwe7thUi/k5RU";

const ARGON2_OPTIONS = {
  algorithm: 2, // Argon2id (Algorithm.Argon2id = 2)
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hashes a plaintext password using Argon2id.
 * Never trims or transforms the password input.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string.");
  }
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a candidate password against an Argon2 hash.
 * Returns false on malformed hashes or verification errors without leaking details.
 */
export async function verifyPassword(
  password: string,
  hashString: string
): Promise<boolean> {
  if (!password || !hashString || typeof password !== "string" || typeof hashString !== "string") {
    return false;
  }
  try {
    return await verify(hashString, password);
  } catch {
    return false;
  }
}

/**
 * Performs a dummy Argon2id verification against a constant pre-computed hash.
 * Called when an account does not exist or is inactive to reduce obvious timing differences.
 * Note: While this runs an identical Argon2id computation to prevent instant rejection,
 * it does not guarantee perfectly constant-time login across all network and database layers.
 */
export async function verifyDummyPassword(password: string): Promise<void> {
  try {
    await verify(DUMMY_ARGON2_HASH, password || "dummy-timing-mitigation");
  } catch {
    // Ignore dummy verification failure
  }
}
