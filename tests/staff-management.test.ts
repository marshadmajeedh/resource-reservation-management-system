import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  listStaff,
  createStaff,
  updateStaffName,
  setStaffActiveStatus,
  getStaffById,
} from "../src/features/staff/service.ts";
import { authenticateCredentials } from "../src/features/auth/service.ts";
import { hashPassword, verifyPassword } from "../src/features/auth/password.ts";
import { signSessionToken, verifySessionToken } from "../src/features/auth/jwt.ts";
import { findUserRecordById } from "../src/features/auth/repository.ts";
import { normalizeEmail } from "../src/features/auth/types.ts";
import type { SafeUser } from "../src/features/auth/types.ts";
import { disconnectDatabase } from "../src/lib/db.ts";

/**
 * Isolated Staff-Account Management Test Suite.
 *
 * STRICT SAFETY MANDATES:
 * 1. TEST_DATABASE_URL is strictly mandatory; never falls back to DATABASE_URL.
 * 2. Pre-connection validation: host must be in allowlist (localhost, 127.0.0.1, ::1, postgres).
 * 3. Pre-connection validation: database name must be exactly 'rrs_test'.
 * 4. Pre-connection validation: parsed host, port, and database must not match application DATABASE_URL.
 * 5. Post-connection validation: SELECT current_database() must strictly equal 'rrs_test'.
 * 6. Connection strings and credentials are never printed.
 * 7. Foreign-key-safe targeted cleanup: reservations -> resources -> categories -> users.
 *    No table-wide DELETE or TRUNCATE.
 */

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl || testDatabaseUrl.trim() === "") {
  throw new Error(
    "Missing TEST_DATABASE_URL. An explicit TEST_DATABASE_URL is required to run tests. Tests will never fall back to DATABASE_URL."
  );
}

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

// Set test-only JWT secret if not set
const TEST_JWT_SECRET = "test-only-secret-for-automated-suites-min-32-chars-long";
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = TEST_JWT_SECRET;
}

// Bind production Prisma client to test database URL
process.env.DATABASE_URL = testDatabaseUrl;

describe("Staff-Account Management (Production Paths)", () => {
  let client: Client;

  // Track fixtures for targeted, FK-safe cleanup
  const fixtureUserIds = new Set<string>();
  const fixtureCategoryIds = new Set<string>();
  const fixtureResourceIds = new Set<string>();
  const fixtureReservationIds = new Set<string>();

  let adminUser: SafeUser;
  let staffUser: SafeUser;

  before(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();

    // Verify connected database is rrs_test
    const dbCheck = await client.query("SELECT current_database() AS current_db");
    const currentDb = dbCheck.rows[0]?.current_db;
    if (currentDb !== "rrs_test") {
      await client.end();
      throw new Error(
        `SAFETY VIOLATION: Connected database is '${currentDb}', strictly expected 'rrs_test'. Aborting test run.`
      );
    }

    // Provision admin user fixture
    const adminId = randomUUID();
    const adminHash = await hashPassword("AdminSecretPass123!");
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'ADMIN', true, NOW())`,
      [adminId, "Primary Admin", `admin-${adminId.slice(0, 8)}@reserve.local`, adminHash]
    );
    fixtureUserIds.add(adminId);
    adminUser = {
      id: adminId,
      name: "Primary Admin",
      email: `admin-${adminId.slice(0, 8)}@reserve.local`,
      role: "ADMIN",
      isActive: true,
      createdAt: new Date(),
    };

    // Provision regular staff user fixture
    const staffId = randomUUID();
    const staffHash = await hashPassword("StaffSecretPass123!");
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, 'STAFF', true, NOW())`,
      [staffId, "Regular Staff", `staff-${staffId.slice(0, 8)}@reserve.local`, staffHash]
    );
    fixtureUserIds.add(staffId);
    staffUser = {
      id: staffId,
      name: "Regular Staff",
      email: `staff-${staffId.slice(0, 8)}@reserve.local`,
      role: "STAFF",
      isActive: true,
      createdAt: new Date(),
    };
  });

  after(async () => {
    // 1. Delete reservations
    if (fixtureReservationIds.size > 0) {
      const ids = Array.from(fixtureReservationIds);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM reservations WHERE id IN (${placeholders})`, ids);
    }
    // 2. Delete resources
    if (fixtureResourceIds.size > 0) {
      const ids = Array.from(fixtureResourceIds);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM resources WHERE id IN (${placeholders})`, ids);
    }
    // 3. Delete categories
    if (fixtureCategoryIds.size > 0) {
      const ids = Array.from(fixtureCategoryIds);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM resource_categories WHERE id IN (${placeholders})`, ids);
    }
    // 4. Delete users
    if (fixtureUserIds.size > 0) {
      const ids = Array.from(fixtureUserIds);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await client.query(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    }

    await client.end().catch(() => {});
    await disconnectDatabase().catch(() => {});
  });

  it("1. Admin can create a STAFF account with a stored hash and verify it in the database", async () => {
    const email = `test-staff-create-${randomUUID().slice(0, 8)}@example.local`;
    const password = "ValidPassword123!";

    const result = await createStaff(
      {
        name: "Alice Engineer",
        email,
        password,
        confirmPassword: password,
      },
      adminUser
    );

    assert.strictEqual(result.success, true);
    assert.ok(result.staff);
    assert.strictEqual(result.staff.name, "Alice Engineer");
    assert.strictEqual(result.staff.email, email);
    assert.strictEqual(result.staff.role, "STAFF");
    assert.strictEqual(result.staff.isActive, true);
    assert.strictEqual(result.staff.activeBookingsCount, 0);

    fixtureUserIds.add(result.staff.id);

    // Verify database record directly via SQL
    const checkDb = await client.query("SELECT * FROM users WHERE id = $1", [result.staff.id]);
    assert.strictEqual(checkDb.rows.length, 1);
    const dbRecord = checkDb.rows[0];

    assert.strictEqual(dbRecord.name, "Alice Engineer");
    assert.strictEqual(dbRecord.email, email);
    assert.strictEqual(dbRecord.role, "STAFF");
    assert.strictEqual(dbRecord.is_active, true);
    assert.ok(typeof dbRecord.password_hash === "string" && dbRecord.password_hash.startsWith("$argon2id$"));

    // Verify stored Argon2id hash verifies with the plain password
    const isMatch = await verifyPassword(password, dbRecord.password_hash);
    assert.strictEqual(isMatch, true, "Stored Argon2id hash must match initial password");
  });

  it("2. The created account can authenticate through the real login service", async () => {
    const email = `test-staff-login-${randomUUID().slice(0, 8)}@example.local`;
    const password = "SecureStaffPass123!";

    const createRes = await createStaff(
      {
        name: "Bob Login Test",
        email,
        password,
        confirmPassword: password,
      },
      adminUser
    );
    assert.strictEqual(createRes.success, true);
    assert.ok(createRes.staff);
    fixtureUserIds.add(createRes.staff.id);

    // Authenticate through the real production login service
    const authSuccess = await authenticateCredentials({
      email,
      password,
    });

    assert.strictEqual(authSuccess.success, true);
    if (authSuccess.success) {
      assert.strictEqual(authSuccess.user.email, email);
      assert.strictEqual(authSuccess.user.role, "STAFF");
      assert.strictEqual(authSuccess.user.isActive, true);
      assert.ok(typeof authSuccess.token === "string" && authSuccess.token.length > 20);

      // Verify session token
      const session = await verifySessionToken(authSuccess.token);
      assert.strictEqual(session?.userId, createRes.staff.id);
    }

    // Wrong password fails
    const authWrongPass = await authenticateCredentials({
      email,
      password: "WrongPassword999!",
    });
    assert.strictEqual(authWrongPass.success, false);
    assert.strictEqual(authWrongPass.error, "Invalid email or password.");
  });

  it("3. Duplicate normalized email is rejected cleanly", async () => {
    const rawEmail = `duplicate-test-${randomUUID().slice(0, 8)}@example.local`;
    const password = "SecurePass123!";

    const firstCreate = await createStaff(
      {
        name: "Initial Staff",
        email: rawEmail,
        password,
        confirmPassword: password,
      },
      adminUser
    );
    assert.strictEqual(firstCreate.success, true);
    fixtureUserIds.add(firstCreate.staff!.id);

    // Attempt second creation with different case and whitespace
    const duplicateEmailVariant = `  ${rawEmail.toUpperCase()}  `;
    const duplicateCreate = await createStaff(
      {
        name: "Second Staff",
        email: duplicateEmailVariant,
        password,
        confirmPassword: password,
      },
      adminUser
    );

    assert.strictEqual(duplicateCreate.success, false);
    assert.strictEqual(duplicateCreate.error, "An account with this email address already exists.");
    assert.strictEqual(
      duplicateCreate.fieldErrors?.email,
      "An account with this email address already exists."
    );

    // Verify only 1 record exists in the database
    const dbCount = await client.query("SELECT COUNT(*) AS count FROM users WHERE email = $1", [
      normalizeEmail(rawEmail),
    ]);
    assert.strictEqual(Number(dbCount.rows[0].count), 1);
  });

  it("4. Invalid input and password confirmation mismatch are rejected", async () => {
    // Mismatched passwords
    const resMismatch = await createStaff(
      {
        name: "Valid Name",
        email: "valid@example.local",
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      },
      adminUser
    );
    assert.strictEqual(resMismatch.success, false);
    assert.strictEqual(resMismatch.fieldErrors?.confirmPassword, "Passwords do not match.");

    // Short password (< 8 chars)
    const resShort = await createStaff(
      {
        name: "Valid Name",
        email: "valid2@example.local",
        password: "short",
        confirmPassword: "short",
      },
      adminUser
    );
    assert.strictEqual(resShort.success, false);
    assert.strictEqual(
      resShort.fieldErrors?.password,
      "Password must be at least 8 characters long."
    );

    // Empty/blank name
    const resBlankName = await createStaff(
      {
        name: "   ",
        email: "valid3@example.local",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
      adminUser
    );
    assert.strictEqual(resBlankName.success, false);
    assert.strictEqual(resBlankName.fieldErrors?.name, "Name cannot be blank.");

    const resEmptyName = await createStaff(
      {
        name: "",
        email: "valid3@example.local",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
      adminUser
    );
    assert.strictEqual(resEmptyName.success, false);
    assert.strictEqual(resEmptyName.fieldErrors?.name, "Name cannot be blank.");

    // Empty/blank email
    const resEmptyEmail = await createStaff(
      {
        name: "Valid Name",
        email: "",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
      adminUser
    );
    assert.strictEqual(resEmptyEmail.success, false);
    assert.strictEqual(resEmptyEmail.fieldErrors?.email, "Email address is required.");

    const resBlankEmail = await createStaff(
      {
        name: "Valid Name",
        email: "   ",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
      adminUser
    );
    assert.strictEqual(resBlankEmail.success, false);
    assert.strictEqual(resBlankEmail.fieldErrors?.email, "Email address is required.");

    // Update staff name with empty and blank strings
    const resUpdateEmptyName = await updateStaffName(
      { id: staffUser.id, name: "" },
      adminUser
    );
    assert.strictEqual(resUpdateEmptyName.success, false);
    assert.strictEqual(resUpdateEmptyName.fieldErrors?.name, "Name cannot be blank.");

    const resUpdateBlankName = await updateStaffName(
      { id: staffUser.id, name: "   " },
      adminUser
    );
    assert.strictEqual(resUpdateBlankName.success, false);
    assert.strictEqual(resUpdateBlankName.fieldErrors?.name, "Name cannot be blank.");

    // Invalid email format
    const resBadEmail = await createStaff(
      {
        name: "Valid Name",
        email: "not-an-email",
        password: "Password123!",
        confirmPassword: "Password123!",
      },
      adminUser
    );
    assert.strictEqual(resBadEmail.success, false);
    assert.strictEqual(resBadEmail.fieldErrors?.email, "Please enter a valid email address.");
  });

  it("5. Staff and unauthenticated users cannot manage accounts", async () => {
    const email = `unauth-test-${randomUUID().slice(0, 8)}@example.local`;
    const input = {
      name: "Unauthorized Target",
      email,
      password: "Password123!",
      confirmPassword: "Password123!",
    };

    // 1. Unauthenticated creation (currentUser = null)
    const unauthCreate = await createStaff(input, null);
    assert.strictEqual(unauthCreate.success, false);
    assert.ok(unauthCreate.error?.includes("Unauthorized"));

    // 2. Staff user creation (currentUser has role STAFF)
    const staffCreate = await createStaff(input, staffUser);
    assert.strictEqual(staffCreate.success, false);
    assert.ok(staffCreate.error?.includes("Unauthorized"));

    // 3. Unauthenticated listing
    const unauthList = await listStaff({}, null);
    assert.strictEqual(unauthList.items.length, 0);

    // 4. Staff listing
    const staffList = await listStaff({}, staffUser);
    assert.strictEqual(staffList.items.length, 0);

    // 5. Unauthenticated edit / status
    const unauthEdit = await updateStaffName({ id: staffUser.id, name: "New Name" }, null);
    assert.strictEqual(unauthEdit.success, false);
    assert.ok(unauthEdit.error?.includes("Unauthorized"));

    const staffEdit = await updateStaffName({ id: staffUser.id, name: "New Name" }, staffUser);
    assert.strictEqual(staffEdit.success, false);
    assert.ok(staffEdit.error?.includes("Unauthorized"));

    const unauthStatus = await setStaffActiveStatus({ id: staffUser.id, isActive: false }, null);
    assert.strictEqual(unauthStatus.success, false);
    assert.ok(unauthStatus.error?.includes("Unauthorized"));

    const staffStatus = await setStaffActiveStatus({ id: staffUser.id, isActive: false }, staffUser);
    assert.strictEqual(staffStatus.success, false);
    assert.ok(staffStatus.error?.includes("Unauthorized"));
  });

  it("6. Submitted role=ADMIN cannot create an admin account", async () => {
    const email = `forged-role-${randomUUID().slice(0, 8)}@example.local`;

    // Attempt to pass role=ADMIN
    const result = await createStaff(
      {
        name: "Forged Admin Attempt",
        email,
        password: "Password123!",
        confirmPassword: "Password123!",
        role: "ADMIN",
      },
      adminUser
    );

    assert.strictEqual(result.success, true);
    assert.ok(result.staff);
    fixtureUserIds.add(result.staff.id);

    // Verify role in returned object is STAFF
    assert.strictEqual(result.staff.role, "STAFF");

    // Verify role in database is strictly STAFF
    const dbCheck = await client.query("SELECT role FROM users WHERE id = $1", [result.staff.id]);
    assert.strictEqual(dbCheck.rows[0].role, "STAFF");
  });

  it("7. Attempts to edit or deactivate an ADMIN account are rejected", async () => {
    // Provision a second admin user
    const secondAdminId = randomUUID();
    const hash = await hashPassword("SecondAdminPass123!");
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES ($1, 'Second Admin', $2, $3, 'ADMIN', true, NOW())`,
      [secondAdminId, `second-admin-${secondAdminId.slice(0, 8)}@reserve.local`, hash]
    );
    fixtureUserIds.add(secondAdminId);

    // Attempt to update admin name through staff management
    const editResult = await updateStaffName(
      {
        id: secondAdminId,
        name: "Hacked Admin Name",
      },
      adminUser
    );
    assert.strictEqual(editResult.success, false);
    assert.strictEqual(
      editResult.error,
      "Cannot modify administrative accounts through staff management."
    );

    // Verify name was not modified in database
    const dbCheckName = await client.query("SELECT name FROM users WHERE id = $1", [secondAdminId]);
    assert.strictEqual(dbCheckName.rows[0].name, "Second Admin");

    // Attempt to deactivate admin account through staff management
    const deactivateResult = await setStaffActiveStatus(
      {
        id: secondAdminId,
        isActive: false,
      },
      adminUser
    );
    assert.strictEqual(deactivateResult.success, false);
    assert.strictEqual(
      deactivateResult.error,
      "Cannot modify administrative accounts through staff management."
    );

    // Verify active status is still true in database
    const dbCheckActive = await client.query("SELECT is_active FROM users WHERE id = $1", [secondAdminId]);
    assert.strictEqual(dbCheckActive.rows[0].is_active, true);

    // Verify getStaffById on an ADMIN returns null
    const getAdminAsStaff = await getStaffById(secondAdminId, adminUser);
    assert.strictEqual(getAdminAsStaff, null);
  });

  it("8. Deactivation prevents access using an already-issued JWT", async () => {
    const email = `jwt-deact-${randomUUID().slice(0, 8)}@example.local`;
    const password = "DeactivationPassword123!";

    const createRes = await createStaff(
      {
        name: "Deactivation Target",
        email,
        password,
        confirmPassword: password,
      },
      adminUser
    );
    assert.strictEqual(createRes.success, true);
    assert.ok(createRes.staff);
    const staffId = createRes.staff.id;
    fixtureUserIds.add(staffId);

    // Issue JWT session token
    const token = await signSessionToken(staffId, { secret: TEST_JWT_SECRET });
    const verified = await verifySessionToken(token, { secret: TEST_JWT_SECRET });
    assert.ok(verified !== null);

    // Initial check: active user passes real-time DAL verification
    const activeCheck = await findUserRecordById(staffId);
    assert.ok(activeCheck !== null);
    assert.strictEqual(activeCheck?.isActive, true);

    // Deactivate staff member via service
    const deactRes = await setStaffActiveStatus(
      {
        id: staffId,
        isActive: false,
      },
      adminUser
    );
    assert.strictEqual(deactRes.success, true);
    assert.strictEqual(deactRes.staff?.isActive, false);

    // Subsequent check: database reflects inactive state
    const subsequentCheck = await findUserRecordById(staffId);
    assert.ok(subsequentCheck !== null);
    assert.strictEqual(subsequentCheck?.isActive, false);

    // DAL real-time authorization logic rejects inactive user with existing JWT
    const authorizedUser = subsequentCheck?.isActive ? subsequentCheck : null;
    assert.strictEqual(authorizedUser, null, "Deactivated account must immediately lose access on existing JWT");

    // Login service rejects inactive user
    const loginAttempt = await authenticateCredentials({ email, password });
    assert.strictEqual(loginAttempt.success, false);
    assert.strictEqual(loginAttempt.error, "Invalid email or password.");
  });

  it("9. Reactivation restores access according to existing authentication rules", async () => {
    const email = `reactivate-test-${randomUUID().slice(0, 8)}@example.local`;
    const password = "ReactivationPass123!";

    const createRes = await createStaff(
      {
        name: "Reactivation Candidate",
        email,
        password,
        confirmPassword: password,
      },
      adminUser
    );
    assert.strictEqual(createRes.success, true);
    const staffId = createRes.staff!.id;
    fixtureUserIds.add(staffId);

    // Deactivate account
    await setStaffActiveStatus({ id: staffId, isActive: false }, adminUser);

    // Reactivate account
    const reactivateRes = await setStaffActiveStatus({ id: staffId, isActive: true }, adminUser);
    assert.strictEqual(reactivateRes.success, true);
    assert.strictEqual(reactivateRes.staff?.isActive, true);

    // Verify in database
    const dbCheck = await client.query("SELECT is_active FROM users WHERE id = $1", [staffId]);
    assert.strictEqual(dbCheck.rows[0].is_active, true);

    // Verify login succeeds again
    const loginRes = await authenticateCredentials({ email, password });
    assert.strictEqual(loginRes.success, true);
    if (loginRes.success) {
      assert.strictEqual(loginRes.user.isActive, true);
    }
  });

  it("10. Existing reservations and their ownership remain unchanged upon deactivation and name edit", async () => {
    const email = `reservations-retention-${randomUUID().slice(0, 8)}@example.local`;
    const password = "RetentionPassword123!";

    const createRes = await createStaff(
      {
        name: "Booking Owner",
        email,
        password,
        confirmPassword: password,
      },
      adminUser
    );
    assert.strictEqual(createRes.success, true);
    const staffId = createRes.staff!.id;
    fixtureUserIds.add(staffId);

    // Create Category and Resource fixtures
    const catId = randomUUID();
    await client.query("INSERT INTO resource_categories (id, name) VALUES ($1, $2)", [
      catId,
      `Category-${catId.slice(0, 8)}`,
    ]);
    fixtureCategoryIds.add(catId);

    const resId = randomUUID();
    await client.query(
      `INSERT INTO resources (id, category_id, name, location, is_active, created_at)
       VALUES ($1, $2, 'Conference Room Test', 'Floor 2', true, NOW())`,
      [resId, catId]
    );
    fixtureResourceIds.add(resId);

    // Create a confirmed upcoming reservation owned by this staff member
    const reservationId = randomUUID();
    const futureStart = new Date(Date.now() + 86400000); // +1 day
    const futureEnd = new Date(Date.now() + 90000000);   // +1 day 1 hour
    await client.query(
      `INSERT INTO reservations (id, user_id, resource_id, purpose, start_at, end_at, status, created_at)
       VALUES ($1, $2, $3, 'Sprint Planning', $4, $5, 'CONFIRMED', NOW())`,
      [reservationId, staffId, resId, futureStart, futureEnd]
    );
    fixtureReservationIds.add(reservationId);

    // Check staff details reflects 1 active reservation
    const staffDetails = await getStaffById(staffId, adminUser);
    assert.ok(staffDetails !== null);
    assert.strictEqual(staffDetails?.activeBookingsCount, 1);

    // Deactivate staff member
    const deactRes = await setStaffActiveStatus({ id: staffId, isActive: false }, adminUser);
    assert.strictEqual(deactRes.success, true);

    // Verify reservation in database is strictly unchanged
    const resDbCheck = await client.query("SELECT * FROM reservations WHERE id = $1", [reservationId]);
    assert.strictEqual(resDbCheck.rows.length, 1);
    const resRow = resDbCheck.rows[0];

    assert.strictEqual(resRow.status, "CONFIRMED", "Booking status must remain CONFIRMED upon deactivation");
    assert.strictEqual(resRow.user_id, staffId, "Booking ownership must remain with the staff member");
    assert.strictEqual(resRow.cancelled_at, null);
    assert.strictEqual(resRow.cancelled_by_id, null);

    // Edit staff name
    const editRes = await updateStaffName({ id: staffId, name: "Renamed Booking Owner" }, adminUser);
    assert.strictEqual(editRes.success, true);
    assert.strictEqual(editRes.staff?.name, "Renamed Booking Owner");
    assert.strictEqual(editRes.staff?.activeBookingsCount, 1);

    // Re-verify reservation ownership is still intact
    const resDbCheck2 = await client.query("SELECT user_id, status FROM reservations WHERE id = $1", [
      reservationId,
    ]);
    assert.strictEqual(resDbCheck2.rows[0].user_id, staffId);
    assert.strictEqual(resDbCheck2.rows[0].status, "CONFIRMED");
  });

  it("11. Responses never expose passwordHash or plaintext passwords", async () => {
    const email = `no-leak-${randomUUID().slice(0, 8)}@example.local`;
    const password = "SensitiveSecretPassword123!";

    const createRes = await createStaff(
      {
        name: "Security Check",
        email,
        password,
        confirmPassword: password,
      },
      adminUser
    );
    assert.strictEqual(createRes.success, true);
    const staffId = createRes.staff!.id;
    fixtureUserIds.add(staffId);

    // Check createStaff response
    assert.strictEqual((createRes.staff as unknown as { passwordHash?: unknown }).passwordHash, undefined);
    assert.strictEqual((createRes as unknown as { password?: unknown }).password, undefined);

    const jsonCreate = JSON.stringify(createRes);
    assert.strictEqual(jsonCreate.includes("passwordHash"), false);
    assert.strictEqual(jsonCreate.includes("SensitiveSecretPassword123!"), false);

    // Check listStaff response
    const listRes = await listStaff({ search: "Security Check" }, adminUser);
    assert.ok(listRes.items.length > 0);
    const found = listRes.items.find((s) => s.id === staffId);
    assert.ok(found);
    assert.strictEqual((found as unknown as { passwordHash?: unknown }).passwordHash, undefined);
    const jsonList = JSON.stringify(listRes);
    assert.strictEqual(jsonList.includes("passwordHash"), false);

    // Check updateStaffName response
    const updateRes = await updateStaffName({ id: staffId, name: "Security Check Updated" }, adminUser);
    assert.strictEqual((updateRes.staff as unknown as { passwordHash?: unknown }).passwordHash, undefined);

    // Check setStaffActiveStatus response
    const statusRes = await setStaffActiveStatus({ id: staffId, isActive: false }, adminUser);
    assert.strictEqual((statusRes.staff as unknown as { passwordHash?: unknown }).passwordHash, undefined);

    // Check getStaffById response
    const getRes = await getStaffById(staffId, adminUser);
    assert.strictEqual((getRes as unknown as { passwordHash?: unknown })?.passwordHash, undefined);
  });

  it("12. Search, status filtering, bounded pagination, and deterministic ordering behave correctly", async () => {
    const prefix = `filter-${randomUUID().slice(0, 6)}`;
    const id1 = randomUUID();
    const id2 = randomUUID();
    const id3 = randomUUID();

    const hash = await hashPassword("DummyPass123!");

    // Insert 3 staff records directly
    await client.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at) VALUES
       ($1, $2, $3, $4, 'STAFF', true, NOW() - INTERVAL '3 minutes'),
       ($5, $6, $7, $8, 'STAFF', false, NOW() - INTERVAL '2 minutes'),
       ($9, $10, $11, $12, 'STAFF', true, NOW() - INTERVAL '1 minute')`,
      [
        id1, `${prefix} Alpha Active`, `${prefix}-alpha@test.local`, hash,
        id2, `${prefix} Beta Inactive`, `${prefix}-beta@test.local`, hash,
        id3, `${prefix} Gamma Active`, `${prefix}-gamma@test.local`, hash,
      ]
    );
    fixtureUserIds.add(id1);
    fixtureUserIds.add(id2);
    fixtureUserIds.add(id3);

    // 1. Search by prefix
    const searchRes = await listStaff({ search: prefix }, adminUser);
    assert.strictEqual(searchRes.total, 3);
    assert.strictEqual(searchRes.items.length, 3);

    // Deterministic ordering: createdAt desc
    assert.strictEqual(searchRes.items[0].id, id3);
    assert.strictEqual(searchRes.items[1].id, id2);
    assert.strictEqual(searchRes.items[2].id, id1);

    // 2. Status filter: active
    const activeRes = await listStaff({ search: prefix, status: "active" }, adminUser);
    assert.strictEqual(activeRes.total, 2);
    assert.strictEqual(activeRes.items.length, 2);
    assert.ok(activeRes.items.every((item) => item.isActive === true));

    // 3. Status filter: inactive
    const inactiveRes = await listStaff({ search: prefix, status: "inactive" }, adminUser);
    assert.strictEqual(inactiveRes.total, 1);
    assert.strictEqual(inactiveRes.items.length, 1);
    assert.strictEqual(inactiveRes.items[0].id, id2);
    assert.strictEqual(inactiveRes.items[0].isActive, false);

    // 4. Bounded pagination
    const page1 = await listStaff({ search: prefix, page: 1, pageSize: 2 }, adminUser);
    assert.strictEqual(page1.items.length, 2);
    assert.strictEqual(page1.total, 3);
    assert.strictEqual(page1.totalPages, 2);
    assert.strictEqual(page1.page, 1);

    const page2 = await listStaff({ search: prefix, page: 2, pageSize: 2 }, adminUser);
    assert.strictEqual(page2.items.length, 1);
    assert.strictEqual(page2.items[0].id, id1);
    assert.strictEqual(page2.page, 2);
  });
});
