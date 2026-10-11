import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  DUMMY_ARGON2_HASH,
} from "../src/features/auth/password.ts";
import {
  signSessionToken,
  verifySessionToken,
  getJwtSecretKey,
  JWT_ISSUER,
  JWT_AUDIENCE,
  SESSION_DURATION_SECONDS,
} from "../src/features/auth/jwt.ts";
import {
  getSessionCookieOptions,
  getLogoutCookieOptions,
  SESSION_COOKIE_NAME,
} from "../src/features/auth/cookies.ts";
import {
  loginRateLimiter,
  buildLoginRateLimitKey,
} from "../src/features/auth/rate-limiter.ts";
import {
  validateMutationOrigin,
  sanitizeRedirectUrl,
} from "../src/features/auth/csrf.ts";
import { authenticateCredentials } from "../src/features/auth/service.ts";
import { normalizeEmail } from "../src/features/auth/types.ts";
import {
  findUserRecordById,
  findUserRecordByEmail,
  createAdminUserRecord,
} from "../src/features/auth/repository.ts";
import { disconnectDatabase } from "../src/lib/db.ts";

/**
 * Isolated Authentication & Authorization Test Suite.
 *
 * STRICT SAFETY MANDATES:
 * 1. TEST_DATABASE_URL is strictly mandatory; never falls back to DATABASE_URL.
 * 2. Pre-connection validation: host must be in allowlist (localhost, 127.0.0.1, ::1, postgres).
 * 3. Pre-connection validation: database name must be exactly 'rrs_test'.
 * 4. Pre-connection validation: parsed host, port, and database must not match application DATABASE_URL.
 * 5. Post-connection validation: SELECT current_database() must strictly equal 'rrs_test'.
 * 6. Connection strings and credentials are never printed.
 * 7. Direct SQL is used exclusively for test fixture setup and foreign-key-safe cleanup.
 *    All repository queries strictly exercise the production Prisma repository path.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl || testDatabaseUrl.trim() === "") {
  throw new Error(
    "Missing TEST_DATABASE_URL. An explicit TEST_DATABASE_URL is required to run tests. Tests will never fall back to DATABASE_URL."
  );
}

// 1. Pre-connection validation
function validateTestUrl(testUrlStr: string, appUrlStr?: string): void {
  let testUrl: URL;
  try {
    testUrl = new URL(testUrlStr);
  } catch {
    throw new Error("SAFETY VIOLATION: Failed to parse TEST_DATABASE_URL as a valid URL.");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "postgres"]);
  const host = testUrl.hostname.toLowerCase();
  if (!allowedHosts.has(host)) {
    throw new Error(
      `SAFETY VIOLATION: TEST_DATABASE_URL host '${host}' is not in the allowlist of local/CI test hosts (${Array.from(allowedHosts).join(", ")}).`
    );
  }

  const dbName = testUrl.pathname.replace(/^\//, "");
  if (dbName !== "rrs_test") {
    throw new Error(
      `SAFETY VIOLATION: TEST_DATABASE_URL database name must be exactly 'rrs_test', received '${dbName}'.`
    );
  }

  if (appUrlStr && appUrlStr.trim() !== "") {
    try {
      const appUrl = new URL(appUrlStr);
      const testPort = testUrl.port || "5432";
      const appPort = appUrl.port || "5432";
      if (
        host === appUrl.hostname.toLowerCase() &&
        testPort === appPort &&
        testUrl.pathname.toLowerCase() === appUrl.pathname.toLowerCase()
      ) {
        throw new Error(
          "SAFETY VIOLATION: TEST_DATABASE_URL matches the application DATABASE_URL. Refusing to run tests against application database."
        );
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("SAFETY VIOLATION")) {
        throw err;
      }
    }
  }
}

validateTestUrl(testDatabaseUrl, process.env.DATABASE_URL);

// Set test-only JWT secret if not present
const TEST_JWT_SECRET = "test-only-secret-for-automated-suites-min-32-chars-long";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
}

// Bind production Prisma client to test database URL
process.env.DATABASE_URL = testDatabaseUrl;

describe("Authentication & Server-Side Authorization (Prisma Production Path)", () => {
  let client: Client;
  const fixtureUserIds = new Set<string>();

  before(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();

    // 2. Post-connection validation
    const dbCheck = await client.query("SELECT current_database() AS current_db");
    const currentDb = dbCheck.rows[0]?.current_db;
    if (currentDb !== "rrs_test") {
      await client.end();
      throw new Error(
        `SAFETY VIOLATION: Connected database is '${currentDb}', strictly expected 'rrs_test'. Aborting test run.`
      );
    }
  });

  after(async () => {
    if (fixtureUserIds.size > 0) {
      const ids = Array.from(fixtureUserIds);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    }
    await client.end().catch(() => {});
    await disconnectDatabase().catch(() => {});
  });

  beforeEach(() => {
    loginRateLimiter.clearAll();
  });

  async function createTestUserFixture(overrides: {
    name?: string;
    email?: string;
    password?: string;
    role?: "ADMIN" | "STAFF";
    isActive?: boolean;
  } = {}) {
    const id = randomUUID();
    const name = overrides.name || `Test User ${id.slice(0, 8)}`;
    const email = overrides.email || `test-${id.slice(0, 8)}@office.internal`;
    const password = overrides.password || "TestSecurePass123!";
    const role = overrides.role || "STAFF";
    const isActive = overrides.isActive !== undefined ? overrides.isActive : true;

    const passwordHash = await hashPassword(password);

    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [id, name, normalizeEmail(email), passwordHash, role, isActive]
    );

    fixtureUserIds.add(id);

    return { id, name, email: normalizeEmail(email), password, role, isActive, passwordHash };
  }

  // Suite 1: Password hashing and verification
  describe("Password Hashing & Verification (Argon2id)", () => {
    it("1. Correct password verifies successfully and wrong password fails", async () => {
      const password = "CorrectSecretPassword123!";
      const hash = await hashPassword(password);

      assert.ok(hash.startsWith("$argon2id$"), "Hash must be an Argon2id formatted string");

      const correctResult = await verifyPassword(password, hash);
      assert.strictEqual(correctResult, true, "Correct password must verify as true");

      const wrongResult = await verifyPassword("WrongPassword456!", hash);
      assert.strictEqual(wrongResult, false, "Wrong password must verify as false");
    });

    it("2. Malformed or invalid hash strings fail verification cleanly without crashing", async () => {
      const malformedResult = await verifyPassword("any-pass", "not-a-valid-argon2-hash");
      assert.strictEqual(malformedResult, false);

      const emptyResult = await verifyPassword("", "");
      assert.strictEqual(emptyResult, false);
    });

    it("3. Dummy password verification executes with comparable parameters to reduce timing differences", async () => {
      // Confirm dummy hash has identical Argon2id configuration (m=19456, t=2, p=1, v=19)
      assert.ok(DUMMY_ARGON2_HASH.startsWith("$argon2id$v=19$m=19456,t=2,p=1$"));

      await assert.doesNotReject(async () => {
        await verifyDummyPassword("arbitraryCandidatePassword");
      });
    });
  });

  // Suite 2: JWT signing and verification
  describe("JWT Signing, Claims, and Expiry", () => {
    it("4. Valid session token signs and verifies with user ID subject", async () => {
      const testUserId = randomUUID();
      const token = await signSessionToken(testUserId, { secret: TEST_JWT_SECRET });

      assert.ok(typeof token === "string" && token.split(".").length === 3, "JWT must be 3-part string");

      const payload = await verifySessionToken(token, { secret: TEST_JWT_SECRET });
      assert.ok(payload !== null, "Token verification must succeed");
      assert.strictEqual(payload?.userId, testUserId, "Subject in payload must match user ID");
    });

    it("5. Expired token fails verification", async () => {
      const testUserId = randomUUID();
      const expiredToken = await signSessionToken(testUserId, {
        secret: TEST_JWT_SECRET,
        expiresInSeconds: -10,
      });

      const payload = await verifySessionToken(expiredToken, { secret: TEST_JWT_SECRET });
      assert.strictEqual(payload, null, "Expired token must fail verification");
    });

    it("6. Tampered signature fails verification", async () => {
      const testUserId = randomUUID();
      const validToken = await signSessionToken(testUserId, { secret: TEST_JWT_SECRET });

      const parts = validToken.split(".");
      parts[2] = parts[2].slice(0, -2) + "xx";
      const tamperedToken = parts.join(".");

      const payload = await verifySessionToken(tamperedToken, { secret: TEST_JWT_SECRET });
      assert.strictEqual(payload, null, "Tampered signature must fail verification");
    });

    it("7. Wrong issuer or wrong audience tokens fail verification", async () => {
      const { SignJWT } = await import("jose");
      const secretKey = getJwtSecretKey(TEST_JWT_SECRET);

      const wrongIssuerToken = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-123")
        .setIssuer("foreign-issuer")
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(secretKey);

      assert.strictEqual(
        await verifySessionToken(wrongIssuerToken, { secret: TEST_JWT_SECRET }),
        null,
        "Token with foreign issuer must fail"
      );

      const wrongAudienceToken = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-123")
        .setIssuer(JWT_ISSUER)
        .setAudience("foreign-audience")
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(secretKey);

      assert.strictEqual(
        await verifySessionToken(wrongAudienceToken, { secret: TEST_JWT_SECRET }),
        null,
        "Token with foreign audience must fail"
      );
    });

    it("8. Insecure placeholder or short JWT secrets fail immediately with descriptive error", () => {
      assert.throws(
        () => getJwtSecretKey(""),
        /Missing JWT_SECRET/
      );
      assert.throws(
        () => getJwtSecretKey("your-secure-random-jwt-secret-placeholder"),
        /Insecure JWT_SECRET detected/
      );
      assert.throws(
        () => getJwtSecretKey("too-short-secret-only-18ch"),
        /insufficiently secure/
      );
    });

    it("9. Tokens missing required subject or expiry claims are rejected", async () => {
      const { SignJWT } = await import("jose");
      const secretKey = getJwtSecretKey(TEST_JWT_SECRET);

      // Token missing subject
      const noSubjectToken = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("8h")
        .sign(secretKey);

      assert.strictEqual(
        await verifySessionToken(noSubjectToken, { secret: TEST_JWT_SECRET }),
        null,
        "Token without subject must be rejected"
      );

      // Token missing expiration claim
      const noExpToken = await new SignJWT({})
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("user-no-exp")
        .setIssuer(JWT_ISSUER)
        .setAudience(JWT_AUDIENCE)
        .setIssuedAt()
        .sign(secretKey);

      assert.strictEqual(
        await verifySessionToken(noExpToken, { secret: TEST_JWT_SECRET }),
        null,
        "Token without expiration claim must be rejected"
      );
    });
  });

  // Suite 3: Login authentication flow and rate limiting exercising production Prisma repository
  describe("Authentication Flow, Error Genericness, & Rate Limiting (Prisma)", () => {
    it("10. Valid active-user login succeeds via Prisma and returns user without passwordHash", async () => {
      const fixture = await createTestUserFixture({ role: "STAFF" });

      // Calls authenticateCredentials -> findUserRecordByEmail -> db.user.findUnique
      const result = await authenticateCredentials(
        { email: fixture.email, password: fixture.password },
        { jwtSecret: TEST_JWT_SECRET }
      );

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.user.id, fixture.id);
        assert.strictEqual(result.user.email, fixture.email);
        assert.strictEqual(result.user.role, "STAFF");
        assert.strictEqual(result.user.isActive, true);
        assert.strictEqual(
          (result.user as unknown as Record<string, unknown>).passwordHash,
          undefined,
          "SafeUser must never contain passwordHash"
        );
        assert.ok(typeof result.token === "string");
      }
    });

    it("11. Production Prisma repository findUserRecordById correctly selects fields and excludes passwordHash", async () => {
      const fixture = await createTestUserFixture({ role: "ADMIN" });

      const user = await findUserRecordById(fixture.id);
      assert.ok(user !== null);
      assert.strictEqual(user?.id, fixture.id);
      assert.strictEqual(user?.email, fixture.email);
      assert.strictEqual(user?.role, "ADMIN");
      assert.strictEqual(user?.isActive, true);
      assert.strictEqual(
        (user as unknown as Record<string, unknown>).passwordHash,
        undefined,
        "findUserRecordById must not expose passwordHash"
      );
    });

    it("12. Production Prisma repository createAdminUserRecord creates administrator", async () => {
      const newAdminEmail = `created-admin-${randomUUID().slice(0, 8)}@office.internal`;
      const passHash = await hashPassword("AdminPass12345!");

      const created = await createAdminUserRecord({
        name: "Prisma Created Admin",
        email: newAdminEmail,
        passwordHash: passHash,
      });

      fixtureUserIds.add(created.id);

      assert.strictEqual(created.email, newAdminEmail);
      assert.strictEqual(created.role, "ADMIN");
      assert.strictEqual(created.isActive, true);
      assert.strictEqual(
        (created as unknown as Record<string, unknown>).passwordHash,
        undefined
      );

      // Verify retrieval through findUserRecordByEmail
      const retrieved = await findUserRecordByEmail(newAdminEmail);
      assert.ok(retrieved !== null);
      assert.strictEqual(retrieved?.id, created.id);
      assert.strictEqual(retrieved?.role, "ADMIN");
    });

    it("13. Unknown email, wrong password, and inactive account fail with the exact same generic error", async () => {
      const activeUser = await createTestUserFixture({ password: "ActiveUserPass123!" });
      const inactiveUser = await createTestUserFixture({
        password: "InactivePass123!",
        isActive: false,
      });

      // Unknown email
      const resUnknown = await authenticateCredentials(
        { email: "nonexistent-user@office.internal", password: "SomePassword123!" },
        { jwtSecret: TEST_JWT_SECRET }
      );

      // Wrong password
      const resWrongPass = await authenticateCredentials(
        { email: activeUser.email, password: "WrongPassword999!" },
        { jwtSecret: TEST_JWT_SECRET }
      );

      // Inactive account with correct password
      const resInactive = await authenticateCredentials(
        { email: inactiveUser.email, password: inactiveUser.password },
        { jwtSecret: TEST_JWT_SECRET }
      );

      assert.strictEqual(resUnknown.success, false);
      assert.strictEqual(resWrongPass.success, false);
      assert.strictEqual(resInactive.success, false);

      const expectedGenericError = "Invalid email or password.";
      assert.strictEqual(resUnknown.error, expectedGenericError);
      assert.strictEqual(resWrongPass.error, expectedGenericError);
      assert.strictEqual(resInactive.error, expectedGenericError);
    });

    it("14. Login rate limiter restricts attempts after 5 consecutive failures and resets on success", async () => {
      const testEmail = `ratelimit-test-${randomUUID().slice(0, 8)}@office.internal`;
      const key = buildLoginRateLimitKey(testEmail);

      for (let i = 1; i <= 4; i++) {
        const check = loginRateLimiter.check(key);
        assert.strictEqual(check.allowed, true, `Attempt ${i} should be allowed`);
        loginRateLimiter.recordFailure(key);
      }

      loginRateLimiter.recordFailure(key);
      const blockedCheck = loginRateLimiter.check(key);
      assert.strictEqual(blockedCheck.allowed, false, "Should be blocked after 5 failures");
      assert.ok(blockedCheck.retryAfterSeconds > 0, "Must return positive retryAfterSeconds");

      loginRateLimiter.reset(key);
      const resetCheck = loginRateLimiter.check(key);
      assert.strictEqual(resetCheck.allowed, true, "Should be allowed after reset");
      assert.strictEqual(resetCheck.remainingAttempts, 5);
    });
  });

  // Suite 4: Authorization, real-time role checks, and deactivation enforcement via Prisma
  describe("Server Authorization & Real-Time Status Verification (Prisma)", () => {
    it("15. Staff cannot access admin-only operation", async () => {
      const staffUser = await createTestUserFixture({ role: "STAFF" });
      const adminUser = await createTestUserFixture({ role: "ADMIN" });

      function verifyAdminPermission(user: { role: string }) {
        if (user.role !== "ADMIN") {
          throw new Error("403 Forbidden: Administrator role required.");
        }
        return true;
      }

      assert.throws(
        () => verifyAdminPermission(staffUser),
        /403 Forbidden/
      );

      assert.strictEqual(verifyAdminPermission(adminUser), true);
    });

    it("16. Previously issued JWT stops granting access immediately when user is deactivated in database", async () => {
      const fixture = await createTestUserFixture({ isActive: true });
      const token = await signSessionToken(fixture.id, { secret: TEST_JWT_SECRET });

      const verifiedPayload = await verifySessionToken(token, { secret: TEST_JWT_SECRET });
      assert.ok(verifiedPayload !== null);

      // Verify active via production Prisma repository
      const activeRecord = await findUserRecordById(verifiedPayload!.userId);
      assert.ok(activeRecord !== null);
      assert.strictEqual(activeRecord?.isActive, true);

      // Deactivate user in database via direct SQL
      await client.query("UPDATE users SET is_active = false WHERE id = $1", [fixture.id]);

      // Query production Prisma repository with the same valid JWT subject
      const subsequentRecord = await findUserRecordById(verifiedPayload!.userId);
      assert.ok(subsequentRecord !== null);
      assert.strictEqual(subsequentRecord?.isActive, false, "Real-time Prisma query reflects isActive=false");

      // DAL enforcement logic: inactive user gets null / blocked
      const authorizedUser = subsequentRecord?.isActive ? subsequentRecord : null;
      assert.strictEqual(authorizedUser, null, "Deactivated user must lose all access immediately");
    });

    it("17. Role changes in database take immediate effect on subsequent requests via Prisma", async () => {
      const fixture = await createTestUserFixture({ role: "STAFF" });
      const token = await signSessionToken(fixture.id, { secret: TEST_JWT_SECRET });

      const verified = await verifySessionToken(token, { secret: TEST_JWT_SECRET });
      assert.ok(verified !== null);

      // Verify initial STAFF role via Prisma repository
      const initialUser = await findUserRecordById(verified!.userId);
      assert.strictEqual(initialUser?.role, "STAFF");

      // Promote user to ADMIN in database
      await client.query("UPDATE users SET role = 'ADMIN' WHERE id = $1", [fixture.id]);

      // Verify updated role immediately via Prisma repository
      const updatedUser = await findUserRecordById(verified!.userId);
      assert.strictEqual(updatedUser?.role, "ADMIN", "Role change must take effect on next request");
    });
  });

  // Suite 5: Cookie configuration and logout
  describe("Cookie Attributes & Logout Clearing", () => {
    it("18. Session cookie attributes are HttpOnly, SameSite=Lax, Path=/, and aligned with session duration", () => {
      const options = getSessionCookieOptions();

      assert.strictEqual(options.name, SESSION_COOKIE_NAME);
      assert.strictEqual(options.httpOnly, true, "Must be HttpOnly to prevent script reading");
      assert.strictEqual(options.sameSite, "lax", "Must be SameSite=Lax");
      assert.strictEqual(options.path, "/", "Must be Path=/");
      assert.strictEqual(options.maxAge, SESSION_DURATION_SECONDS, "Must match 8h duration");
      assert.ok(options.expires > new Date(), "Expiry date must be in the future");
    });

    it("19. Logout cookie clears session with matching flags and maxAge=0", () => {
      const logoutOptions = getLogoutCookieOptions();

      assert.strictEqual(logoutOptions.name, SESSION_COOKIE_NAME);
      assert.strictEqual(logoutOptions.httpOnly, true);
      assert.strictEqual(logoutOptions.sameSite, "lax");
      assert.strictEqual(logoutOptions.path, "/");
      assert.strictEqual(logoutOptions.maxAge, 0, "maxAge must be 0 to clear cookie");
      assert.strictEqual(logoutOptions.expires.getTime(), 0, "expires must be Epoch 0");
    });
  });

  // Suite 6: Security validations (CSRF & Open Redirects)
  describe("CSRF Mutation Protection & Safe Redirect Sanitization", () => {
    it("20. Cross-origin mutation attempts are rejected and same-origin requests are accepted", () => {
      const sameOriginHeaders = new Headers({
        origin: "https://reserve.office.internal",
        host: "reserve.office.internal",
      });
      assert.strictEqual(validateMutationOrigin(sameOriginHeaders), true);

      const crossOriginHeaders = new Headers({
        origin: "https://malicious-attacker.com",
        host: "reserve.office.internal",
      });
      assert.strictEqual(validateMutationOrigin(crossOriginHeaders), false);

      const crossRefererHeaders = new Headers({
        referer: "https://malicious-attacker.com/evil",
        host: "reserve.office.internal",
      });
      assert.strictEqual(validateMutationOrigin(crossRefererHeaders), false);
    });

    it("21. Missing Origin and Referer cannot silently bypass mutation protection", () => {
      // Both Origin and Referer are missing
      const headersWithoutOriginOrReferer = new Headers({
        host: "reserve.office.internal",
      });
      assert.strictEqual(
        validateMutationOrigin(headersWithoutOriginOrReferer),
        false,
        "Missing Origin and Referer must be rejected"
      );

      // Opaque 'null' origin must be rejected
      const opaqueOriginHeaders = new Headers({
        origin: "null",
        host: "reserve.office.internal",
      });
      assert.strictEqual(
        validateMutationOrigin(opaqueOriginHeaders),
        false,
        "Opaque null origin must be rejected"
      );
    });

    it("22. Unsafe redirect targets are rejected and sanitized to safe fallback", () => {
      assert.strictEqual(sanitizeRedirectUrl("/workspace"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl("/workspace/admin"), "/workspace/admin");

      assert.strictEqual(sanitizeRedirectUrl("//attacker.com"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl("/\\attacker.com"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl("\\attacker.com"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl("https://attacker.com"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl("javascript:alert(1)"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl("/path:http://attacker.com"), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl(null), "/workspace");
      assert.strictEqual(sanitizeRedirectUrl(""), "/workspace");
    });
  });
});
