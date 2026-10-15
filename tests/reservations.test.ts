import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  createReservation,
  cancelReservation,
  getReservationById,
  listMyReservations,
  listAllReservations,
  checkResourcesAvailability,
} from "../src/features/reservations/service.ts";
import { setResourceStatus } from "../src/features/resources/service.ts";
import {
  parseDateTimeInOfficeTz,
  formatDateTimeInOfficeTz,
} from "../src/lib/timezone.ts";
import type { SafeUser } from "../src/features/auth/types.ts";
import type { CreateReservationInput } from "../src/features/reservations/types.ts";
import { isExclusionConstraintViolation } from "../src/features/reservations/repository.ts";
import { getDatabaseClient, disconnectDatabase } from "../src/lib/db.ts";

/**
 * Isolated Reservation Management & Concurrency Test Suite.
 *
 * STRICT SAFETY MANDATES:
 * 1. TEST_DATABASE_URL is strictly mandatory; never falls back to DATABASE_URL.
 * 2. Pre-connection validation: host must be in allowlist (localhost, 127.0.0.1, ::1, postgres).
 * 3. Pre-connection validation: database name must be exactly 'rrs_test'.
 * 4. Pre-connection validation: parsed host, port, and database must not match application DATABASE_URL.
 * 5. Post-connection validation: SELECT current_database() must strictly equal 'rrs_test'.
 * 6. Connection strings and credentials are never printed.
 * 7. Foreign-key-safe cleanup: reservations -> resources -> categories -> users.
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

// Bind production Prisma client to test database URL
process.env.DATABASE_URL = testDatabaseUrl;

describe("Reservation Lifecycle & Concurrency (Production Paths)", () => {
  let client: Client;

  // Track fixtures for targeted, FK-safe cleanup
  const fixtureUserIds = new Set<string>();
  const fixtureCategoryIds = new Set<string>();
  const fixtureResourceIds = new Set<string>();
  const fixtureReservationIds = new Set<string>();

  let adminUser: SafeUser;
  let staffUserA: SafeUser;
  let staffUserB: SafeUser;
  let inactiveUser: SafeUser;
  let categoryId: string;
  let activeResourceId1: string;
  let activeResourceId2: string;
  let deactivatedResourceId: string;

  before(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();

    // Verify current_database() strictly equals 'rrs_test'
    const dbCheck = await client.query("SELECT current_database() AS current_db");
    const currentDb = dbCheck.rows[0]?.current_db;
    if (currentDb !== "rrs_test") {
      await client.end();
      throw new Error(
        `SAFETY VIOLATION: Connected database is '${currentDb}', strictly expected 'rrs_test'.`
      );
    }

    const runToken = randomUUID().slice(0, 8);

    // Create Admin User
    const adminId = randomUUID();
    const adminEmail = `admin-${runToken}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${adminId}', 'Admin User', '${adminEmail}', 'hash_val', 'ADMIN', true);
    `);
    fixtureUserIds.add(adminId);
    adminUser = {
      id: adminId,
      name: "Admin User",
      email: adminEmail,
      role: "ADMIN",
      isActive: true,
      createdAt: new Date(),
    };

    // Create Staff User A
    const staffAId = randomUUID();
    const staffAEmail = `staffA-${runToken}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${staffAId}', 'Staff Member A', '${staffAEmail}', 'hash_val', 'STAFF', true);
    `);
    fixtureUserIds.add(staffAId);
    staffUserA = {
      id: staffAId,
      name: "Staff Member A",
      email: staffAEmail,
      role: "STAFF",
      isActive: true,
      createdAt: new Date(),
    };

    // Create Staff User B
    const staffBId = randomUUID();
    const staffBEmail = `staffB-${runToken}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${staffBId}', 'Staff Member B', '${staffBEmail}', 'hash_val', 'STAFF', true);
    `);
    fixtureUserIds.add(staffBId);
    staffUserB = {
      id: staffBId,
      name: "Staff Member B",
      email: staffBEmail,
      role: "STAFF",
      isActive: true,
      createdAt: new Date(),
    };

    // Create Inactive User
    const inactiveId = randomUUID();
    const inactiveEmail = `inactive-${runToken}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${inactiveId}', 'Inactive User', '${inactiveEmail}', 'hash_val', 'STAFF', false);
    `);
    fixtureUserIds.add(inactiveId);
    inactiveUser = {
      id: inactiveId,
      name: "Inactive User",
      email: inactiveEmail,
      role: "STAFF",
      isActive: false,
      createdAt: new Date(),
    };

    // Create Category
    const catRes = await client.query(`
      INSERT INTO resource_categories (name)
      VALUES ('Suites ${runToken}')
      RETURNING id;
    `);
    categoryId = catRes.rows[0].id;
    fixtureCategoryIds.add(categoryId);

    // Create Resources
    const rRes = await client.query(`
      INSERT INTO resources (category_id, name, location, capacity, is_active)
      VALUES 
        ('${categoryId}', 'Boardroom Alpha ${runToken}', 'Floor 3', 12, true),
        ('${categoryId}', 'Focus Pod Beta ${runToken}', 'Floor 1', 2, true),
        ('${categoryId}', 'Decommissioned Lab ${runToken}', 'Basement', 4, false)
      RETURNING id, name, is_active;
    `);

    for (const row of rRes.rows) {
      fixtureResourceIds.add(row.id);
      if (row.name.startsWith("Boardroom Alpha")) {
        activeResourceId1 = row.id;
      } else if (row.name.startsWith("Focus Pod Beta")) {
        activeResourceId2 = row.id;
      } else if (row.name.startsWith("Decommissioned Lab")) {
        deactivatedResourceId = row.id;
      }
    }
  });

  after(async () => {
    // Foreign-key-safe targeted fixture deletion: reservations -> resources -> categories -> users
    try {
      if (fixtureReservationIds.size > 0) {
        const ids = Array.from(fixtureReservationIds);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`DELETE FROM reservations WHERE id IN (${placeholders})`, ids);
      }
      if (fixtureResourceIds.size > 0) {
        const ids = Array.from(fixtureResourceIds);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`DELETE FROM resources WHERE id IN (${placeholders})`, ids);
      }
      if (fixtureCategoryIds.size > 0) {
        const ids = Array.from(fixtureCategoryIds);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`DELETE FROM resource_categories WHERE id IN (${placeholders})`, ids);
      }
      if (fixtureUserIds.size > 0) {
        const ids = Array.from(fixtureUserIds);
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
        await client.query(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
      }
    } catch {
      // Best-effort teardown
    } finally {
      await client.end().catch(() => {});
      await disconnectDatabase().catch(() => {});
    }
  });

  it("1. Valid booking succeeds with session user identity and Sri Lanka timezone conversion", async () => {
    const result = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Quarterly Budget Planning",
        startAtRaw: "2026-11-10T09:00",
        endAtRaw: "2026-11-10T11:00",
      },
      staffUserA
    );

    assert.equal(result.success, true, `Expected success: ${result.error}`);
    assert.ok(result.reservation);
    fixtureReservationIds.add(result.reservation.id);

    // Verify session identity strictly assigned
    assert.equal(result.reservation.userId, staffUserA.id);
    assert.equal(result.reservation.status, "CONFIRMED");
    assert.equal(result.reservation.cancelledAt, null);
    assert.equal(result.reservation.cancelledById, null);
    assert.equal(result.reservation.cancellationReason, null);

    // Verify Sri Lanka timezone conversion: 2026-11-10T09:00 in Colombo (+05:30) is 2026-11-10T03:30:00.000Z
    assert.equal(result.reservation.startAt.toISOString(), "2026-11-10T03:30:00.000Z");
    assert.equal(result.reservation.endAt.toISOString(), "2026-11-10T05:30:00.000Z");
  });

  it("2. Unauthenticated and inactive users cannot book", async () => {
    // Unauthenticated caller
    const unauthResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Attempt unauth",
        startAtRaw: "2026-11-10T14:00",
        endAtRaw: "2026-11-10T15:00",
      },
      null
    );
    assert.equal(unauthResult.success, false);
    assert.match(unauthResult.error || "", /Authentication required/i);

    // Inactive caller
    const inactiveResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Attempt inactive",
        startAtRaw: "2026-11-10T14:00",
        endAtRaw: "2026-11-10T15:00",
      },
      inactiveUser
    );
    assert.equal(inactiveResult.success, false);
    assert.match(inactiveResult.error || "", /Authentication required/i);
  });

  it("3. Forged ownership, status, or cancellation fields are ignored", async () => {
    // Calling as staffUserB; even if malicious payload attempts to inject another user's ID
    const forgedInput = {
      resourceId: activeResourceId1,
      purpose: "Legitimate purpose",
      startAtRaw: "2026-11-11T10:00",
      endAtRaw: "2026-11-11T11:00",
      userId: adminUser.id, // Attacker tries to book on behalf of Admin
      status: "CANCELLED", // Attacker tries to insert pre-cancelled
      cancelledAt: new Date(),
    };

    const res = await createReservation(
      forgedInput as unknown as CreateReservationInput,
      staffUserB
    );
    assert.equal(res.success, true);
    assert.ok(res.reservation);
    fixtureReservationIds.add(res.reservation.id);

    // Derived strictly from session
    assert.equal(res.reservation.userId, staffUserB.id);
    assert.notEqual(res.reservation.userId, adminUser.id);
    assert.equal(res.reservation.status, "CONFIRMED");
    assert.equal(res.reservation.cancelledAt, null);
  });

  it("4. Invalid calendar dates, past starts, empty purposes, and invalid ranges fail", async () => {
    // Calendar date validation: Feb 30 does not exist
    const feb30Result = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Meeting",
        startAtRaw: "2026-02-30T10:00",
        endAtRaw: "2026-02-30T11:00",
      },
      staffUserA
    );
    assert.equal(feb30Result.success, false);
    assert.match(feb30Result.error || "", /Invalid calendar date/i);

    // Calendar date validation: April 31 does not exist
    const apr31Result = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Meeting",
        startAtRaw: "2026-04-31T10:00",
        endAtRaw: "2026-04-31T11:00",
      },
      staffUserA
    );
    assert.equal(apr31Result.success, false);
    assert.match(apr31Result.error || "", /Invalid calendar date/i);

    // Past start date
    const pastResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Past Meeting",
        startAtRaw: "2020-01-01T10:00",
        endAtRaw: "2020-01-01T11:00",
      },
      staffUserA
    );
    assert.equal(pastResult.success, false);
    assert.match(pastResult.error || "", /must be in the future/i);

    // End time earlier than start time
    const invertedResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Inverted Times",
        startAtRaw: "2026-11-12T15:00",
        endAtRaw: "2026-11-12T14:00",
      },
      staffUserA
    );
    assert.equal(invertedResult.success, false);
    assert.match(invertedResult.error || "", /strictly later than start/i);

    // Equal start and end time (zero duration)
    const zeroDurationResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Zero Duration",
        startAtRaw: "2026-11-12T15:00",
        endAtRaw: "2026-11-12T15:00",
      },
      staffUserA
    );
    assert.equal(zeroDurationResult.success, false);
    assert.match(zeroDurationResult.error || "", /strictly later than start/i);

    // Blank purpose
    const blankPurposeResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "   ",
        startAtRaw: "2026-11-12T15:00",
        endAtRaw: "2026-11-12T16:00",
      },
      staffUserA
    );
    assert.equal(blankPurposeResult.success, false);
    assert.match(blankPurposeResult.fieldErrors?.purpose || blankPurposeResult.error || "", /Purpose cannot be blank/i);

    // Empty purpose
    const emptyPurposeResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "",
        startAtRaw: "2026-11-12T15:00",
        endAtRaw: "2026-11-12T16:00",
      },
      staffUserA
    );
    assert.equal(emptyPurposeResult.success, false);
    assert.match(emptyPurposeResult.fieldErrors?.purpose || emptyPurposeResult.error || "", /Purpose cannot be blank/i);

    // Empty and blank start/end timestamps
    const emptyTimeResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Valid Purpose",
        startAtRaw: "",
        endAtRaw: "   ",
      },
      staffUserA
    );
    assert.equal(emptyTimeResult.success, false);
    assert.match(emptyTimeResult.fieldErrors?.startAt || "", /Date and time are required/i);
    assert.match(emptyTimeResult.fieldErrors?.endAt || "", /Date and time are required/i);
  });

  it("5. Inactive and nonexistent resources cannot be booked", async () => {
    // Deactivated resource
    const deactResult = await createReservation(
      {
        resourceId: deactivatedResourceId,
        purpose: "Booking Inactive",
        startAtRaw: "2026-11-15T10:00",
        endAtRaw: "2026-11-15T11:00",
      },
      staffUserA
    );
    assert.equal(deactResult.success, false);
    assert.match(deactResult.error || "", /deactivated/i);

    // Non-existent resource UUID
    const nonExistentResult = await createReservation(
      {
        resourceId: randomUUID(),
        purpose: "Booking Ghost Resource",
        startAtRaw: "2026-11-15T10:00",
        endAtRaw: "2026-11-15T11:00",
      },
      staffUserA
    );
    assert.equal(nonExistentResult.success, false);
    assert.match(nonExistentResult.error || "", /not found/i);
  });

  it("6. Overlapping reservations fail; back-to-back bookings succeed", async () => {
    // Initial booking: Nov 16, 10:00 to 12:00
    const b1 = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Architecture Sync",
        startAtRaw: "2026-11-16T10:00",
        endAtRaw: "2026-11-16T12:00",
      },
      staffUserA
    );
    assert.equal(b1.success, true);
    assert.ok(b1.reservation);
    fixtureReservationIds.add(b1.reservation.id);

    // Conflicting overlap: Nov 16, 11:00 to 13:00
    const overlapResult = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Conflicting Review",
        startAtRaw: "2026-11-16T11:00",
        endAtRaw: "2026-11-16T13:00",
      },
      staffUserB
    );
    assert.equal(overlapResult.success, false);
    assert.equal(
      overlapResult.conflictMessage,
      "This resource is already reserved for your selected time. Please choose another time or resource."
    );

    // Back-to-back immediately after: Nov 16, 12:00 to 14:00 (succeeds)
    const backToBackAfter = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Back to back after",
        startAtRaw: "2026-11-16T12:00",
        endAtRaw: "2026-11-16T14:00",
      },
      staffUserB
    );
    assert.equal(backToBackAfter.success, true);
    assert.ok(backToBackAfter.reservation);
    fixtureReservationIds.add(backToBackAfter.reservation.id);

    // Back-to-back immediately before: Nov 16, 08:00 to 10:00 (succeeds)
    const backToBackBefore = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Back to back before",
        startAtRaw: "2026-11-16T08:00",
        endAtRaw: "2026-11-16T10:00",
      },
      staffUserA
    );
    assert.equal(backToBackBefore.success, true);
    assert.ok(backToBackBefore.reservation);
    fixtureReservationIds.add(backToBackBefore.reservation.id);
  });

  it("7. Different resources can be booked simultaneously by the same user", async () => {
    // StaffUserA books Resource 1 from 15:00 to 17:00
    const resA = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Track 1 Event",
        startAtRaw: "2026-11-17T15:00",
        endAtRaw: "2026-11-17T17:00",
      },
      staffUserA
    );
    assert.equal(resA.success, true);
    assert.ok(resA.reservation);
    fixtureReservationIds.add(resA.reservation.id);

    // StaffUserA simultaneously books Resource 2 for the exact same interval
    const resB = await createReservation(
      {
        resourceId: activeResourceId2,
        purpose: "Track 2 Event",
        startAtRaw: "2026-11-17T15:00",
        endAtRaw: "2026-11-17T17:00",
      },
      staffUserA
    );
    assert.equal(resB.success, true);
    assert.ok(resB.reservation);
    fixtureReservationIds.add(resB.reservation.id);
  });

  it("8. Cancelled bookings release availability for new reservations", async () => {
    // Book slot: Nov 18, 09:00 to 11:00
    const initialBooking = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Initial Meeting to Cancel",
        startAtRaw: "2026-11-18T09:00",
        endAtRaw: "2026-11-18T11:00",
      },
      staffUserA
    );
    assert.equal(initialBooking.success, true);
    assert.ok(initialBooking.reservation);
    fixtureReservationIds.add(initialBooking.reservation.id);

    // Owner cancels the booking
    const cancelRes = await cancelReservation(
      {
        reservationId: initialBooking.reservation.id,
        reason: "Meeting postponed",
      },
      staffUserA
    );
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.reservation?.status, "CANCELLED");

    // Check availability helper
    const avail = await checkResourcesAvailability(
      [activeResourceId1],
      "2026-11-18T09:00",
      "2026-11-18T11:00"
    );
    assert.equal(avail.isValidRange, true);
    assert.equal(avail.availabilityByResourceId[activeResourceId1], true);

    // New booking for the exact same slot succeeds immediately
    const rebook = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "New Replacement Meeting",
        startAtRaw: "2026-11-18T09:00",
        endAtRaw: "2026-11-18T11:00",
      },
      staffUserB
    );
    assert.equal(rebook.success, true);
    assert.ok(rebook.reservation);
    fixtureReservationIds.add(rebook.reservation.id);
  });

  it("9. Two concurrent conflicting creation requests result in exactly one saved booking", async () => {
    // Run two simultaneous conflicting bookings through Promise.all
    const [req1, req2] = await Promise.all([
      createReservation(
        {
          resourceId: activeResourceId2,
          purpose: "Concurrent Candidate 1",
          startAtRaw: "2026-11-19T10:00",
          endAtRaw: "2026-11-19T12:00",
        },
        staffUserA
      ),
      createReservation(
        {
          resourceId: activeResourceId2,
          purpose: "Concurrent Candidate 2",
          startAtRaw: "2026-11-19T11:00",
          endAtRaw: "2026-11-19T13:00",
        },
        staffUserB
      ),
    ]);

    const successes = [req1, req2].filter((r) => r.success);
    const conflicts = [req1, req2].filter((r) => !r.success && r.conflictMessage);

    assert.equal(successes.length, 1, "Exactly one concurrent booking must succeed.");
    assert.equal(conflicts.length, 1, "Exactly one concurrent booking must report conflict.");
    if (successes[0].reservation) {
      fixtureReservationIds.add(successes[0].reservation.id);
    }
  });

  it("10. Booking versus deactivation is safe in BOTH orderings with coordinated overlapping transactions", async () => {
    // Open an independent pg.Client connection to hold locks and coordinate overlapping transactions
    const lockClient = new Client({ connectionString: testDatabaseUrl });
    await lockClient.connect();

    try {
      // ---------------------------------------------------------------------------------
      // ORDERING 1: Deactivation acquires lock FIRST -> Booking attempts lock & BLOCKS
      // ---------------------------------------------------------------------------------
      const resAQuery = await client.query(`
        INSERT INTO resources (category_id, name, location, capacity, is_active)
        VALUES ('${categoryId}', 'Deact Race Target A', 'Floor 4', 10, true)
        RETURNING id;
      `);
      const resAId = resAQuery.rows[0].id;
      fixtureResourceIds.add(resAId);

      // Lock client begins transaction and acquires exclusive FOR UPDATE row lock
      await lockClient.query("BEGIN;");
      await lockClient.query(`SELECT id, is_active FROM resources WHERE id = '${resAId}'::uuid FOR UPDATE;`);

      // Application booking initiates while lock is held -> MUST block waiting for the lock
      let bookingFinished = false;
      const bookingPromise = createReservation(
        {
          resourceId: resAId,
          purpose: "Concurrent Booking while Lock Held",
          startAtRaw: "2026-11-20T10:00",
          endAtRaw: "2026-11-20T12:00",
        },
        staffUserA
      ).then((res) => {
        bookingFinished = true;
        return res;
      });

      // Verify booking is actively blocked waiting for row lock
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(bookingFinished, false, "Booking transaction must block waiting for resource row lock");

      // While booking is blocked, the lockholder updates is_active = false and COMMITS
      await lockClient.query(`UPDATE resources SET is_active = false WHERE id = '${resAId}'::uuid;`);
      await lockClient.query("COMMIT;");

      // Booking unblocks, re-evaluates is_active, and must safely fail with deactivation error
      const bookA = await bookingPromise;
      assert.equal(bookA.success, false, "Booking must fail after deactivation committed");
      assert.match(bookA.error || "", /deactivated/i);

      // ---------------------------------------------------------------------------------
      // ORDERING 2: Booking acquires lock FIRST -> Deactivation attempts lock & BLOCKS
      // ---------------------------------------------------------------------------------
      const resBQuery = await client.query(`
        INSERT INTO resources (category_id, name, location, capacity, is_active)
        VALUES ('${categoryId}', 'Deact Race Target B', 'Floor 4', 10, true)
        RETURNING id;
      `);
      const resBId = resBQuery.rows[0].id;
      fixtureResourceIds.add(resBId);

      // Lock client begins transaction and acquires exclusive FOR UPDATE row lock (simulating booking holding lock)
      await lockClient.query("BEGIN;");
      await lockClient.query(`SELECT id, is_active FROM resources WHERE id = '${resBId}'::uuid FOR UPDATE;`);

      // Deactivation initiates while lock is held -> MUST block waiting for the lock
      let deactFinished = false;
      const deactPromise = setResourceStatus(
        { id: resBId, isActive: false },
        adminUser
      ).then((res) => {
        deactFinished = true;
        return res;
      });

      // Verify deactivation is actively blocked waiting for row lock
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(deactFinished, false, "Deactivation transaction must block waiting for resource row lock");

      // While deactivation is blocked, the lockholder inserts a confirmed future reservation and COMMITS
      const newBookingId = randomUUID();
      fixtureReservationIds.add(newBookingId);
      await lockClient.query(`
        INSERT INTO reservations (id, user_id, resource_id, purpose, start_at, end_at, status)
        VALUES ('${newBookingId}', '${staffUserA.id}', '${resBId}', 'Blocking Confirmed Booking',
                NOW() + interval '1 day', NOW() + interval '1 day 2 hours', 'CONFIRMED');
      `);
      await lockClient.query("COMMIT;");

      // Deactivation unblocks, checks confirmed reservations, finds the committed reservation, and must safely refuse deactivation
      const deactB = await deactPromise;
      assert.equal(deactB.success, false, "Deactivation must be refused due to concurrent confirmed booking");
      assert.ok(deactB.deactivationBlockedReason);
      assert.match(deactB.deactivationBlockedReason, /Cannot deactivate resource/i);
    } finally {
      await lockClient.end();
    }
  });

  it("11. Staff cannot read or cancel someone else's reservation", async () => {
    // Staff A creates a reservation
    const booking = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Confidential Strategy Session",
        startAtRaw: "2026-11-21T10:00",
        endAtRaw: "2026-11-21T12:00",
      },
      staffUserA
    );
    assert.equal(booking.success, true);
    assert.ok(booking.reservation);
    fixtureReservationIds.add(booking.reservation.id);

    // Staff B attempts to fetch details -> returns null
    const detailsForB = await getReservationById(booking.reservation.id, staffUserB);
    assert.equal(detailsForB, null, "Staff B must not be able to read Staff A's reservation.");

    // Staff B attempts to cancel -> returns not found
    const cancelByB = await cancelReservation(
      {
        reservationId: booking.reservation.id,
        reason: "Malicious cancellation attempt",
      },
      staffUserB
    );
    assert.equal(cancelByB.success, false);
    assert.match(cancelByB.error || "", /not found/i);

    // Verify reservation remains CONFIRMED in database
    const verify = await getReservationById(booking.reservation.id, staffUserA);
    assert.equal(verify?.status, "CONFIRMED");
  });

  it("12. Admin cancellation records correct actor and requires nonblank reason", async () => {
    // Staff A creates booking
    const booking = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Client Demo Meeting",
        startAtRaw: "2026-11-22T10:00",
        endAtRaw: "2026-11-22T12:00",
      },
      staffUserA
    );
    assert.equal(booking.success, true);
    assert.ok(booking.reservation);
    fixtureReservationIds.add(booking.reservation.id);

    // Admin tries to cancel without reason -> must fail
    const blankReasonCancel = await cancelReservation(
      {
        reservationId: booking.reservation.id,
        reason: "   ",
      },
      adminUser
    );
    assert.equal(blankReasonCancel.success, false);
    assert.match(blankReasonCancel.error || "", /cancellation reason is required/i);

    // Admin cancels with valid reason -> succeeds
    const adminCancel = await cancelReservation(
      {
        reservationId: booking.reservation.id,
        reason: "Emergency HVAC maintenance in Floor 3",
      },
      adminUser
    );
    assert.equal(adminCancel.success, true);
    assert.equal(adminCancel.reservation?.status, "CANCELLED");
    assert.equal(adminCancel.reservation?.cancelledById, adminUser.id);
    assert.equal(
      adminCancel.reservation?.cancellationReason,
      "Emergency HVAC maintenance in Floor 3"
    );
  });

  it("13. Repeat or concurrent cancellation preserves original cancellation metadata", async () => {
    // Staff A creates booking and cancels
    const booking = await createReservation(
      {
        resourceId: activeResourceId1,
        purpose: "Repeat Cancellation Test",
        startAtRaw: "2026-11-23T10:00",
        endAtRaw: "2026-11-23T12:00",
      },
      staffUserA
    );
    assert.equal(booking.success, true);
    assert.ok(booking.reservation);
    fixtureReservationIds.add(booking.reservation.id);

    const firstCancel = await cancelReservation(
      {
        reservationId: booking.reservation.id,
        reason: "Original Reason by Staff A",
      },
      staffUserA
    );
    assert.equal(firstCancel.success, true);
    assert.equal(firstCancel.alreadyCancelled, false);
    const originalCancelledAt = firstCancel.reservation?.cancelledAt;
    const originalActor = firstCancel.reservation?.cancelledById;
    const originalReason = firstCancel.reservation?.cancellationReason;

    // Second cancellation call (e.g. by Admin with different reason)
    const secondCancel = await cancelReservation(
      {
        reservationId: booking.reservation.id,
        reason: "Overwriting attempt by Admin",
      },
      adminUser
    );

    assert.equal(secondCancel.success, true);
    assert.equal(secondCancel.alreadyCancelled, true);
    // Preserves original metadata
    assert.equal(secondCancel.reservation?.cancelledById, originalActor);
    assert.equal(secondCancel.reservation?.cancellationReason, originalReason);
    assert.equal(
      secondCancel.reservation?.cancelledAt?.toISOString(),
      originalCancelledAt?.toISOString()
    );
  });

  it("14. Finished reservations cannot be cancelled retroactively", async () => {
    // Insert a past/finished reservation directly into the database
    const pastRes = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES (
        '${staffUserA.id}',
        '${activeResourceId1}',
        'Completed Past Seminar',
        '2026-01-10 10:00:00+05:30',
        '2026-01-10 12:00:00+05:30',
        'CONFIRMED'
      )
      RETURNING id;
    `);
    const pastId = pastRes.rows[0].id;
    fixtureReservationIds.add(pastId);

    // Attempting to cancel finished reservation must be rejected
    const cancelAttempt = await cancelReservation(
      {
        reservationId: pastId,
        reason: "Trying to cancel retroactively",
      },
      staffUserA
    );

    assert.equal(cancelAttempt.success, false);
    assert.match(cancelAttempt.error || "", /Finished reservations cannot be cancelled/i);
  });

  it("15. History remains readable even if resource is inactive", async () => {
    // Insert reservation for deactivated resource
    const histRes = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES (
        '${staffUserA.id}',
        '${deactivatedResourceId}',
        'Historical Lab Usage',
        '2026-02-10 10:00:00+05:30',
        '2026-02-10 12:00:00+05:30',
        'CONFIRMED'
      )
      RETURNING id;
    `);
    const histId = histRes.rows[0].id;
    fixtureReservationIds.add(histId);

    // Staff User A can read details
    const details = await getReservationById(histId, staffUserA);
    assert.ok(details);
    assert.equal(details.id, histId);
    assert.equal(details.resource?.isActive, false);

    // Shows up in My Reservations
    const myHistory = await listMyReservations(
      { statusFilter: "all", pageSize: 50 },
      staffUserA
    );
    const found = myHistory.items.find((item) => item.id === histId);
    assert.ok(found, "History on inactive resource must remain in user bookings list.");

    // Admin can view all reservations
    const adminList = await listAllReservations(
      { statusFilter: "all", pageSize: 50 },
      adminUser
    );
    const adminFound = adminList.items.find((item) => item.id === histId);
    assert.ok(adminFound, "Admin must be able to list reservations across inactive resources.");

    // Staff cannot list all reservations
    const unauthorizedList = await listAllReservations({ statusFilter: "all" }, staffUserA);
    assert.equal(unauthorizedList.items.length, 0, "Non-admin must not receive all reservations.");
  });

  it("16. Timezone conversion works independently of server host timezone", () => {
    // Test that the same wall-clock time in Colombo produces the exact same UTC instant
    const parsed = parseDateTimeInOfficeTz("2026-11-25T14:30");
    assert.ok(parsed.date);

    // Colombo is UTC+05:30. 14:30 in Colombo = 09:00 UTC
    assert.equal(parsed.date.toISOString(), "2026-11-25T09:00:00.000Z");

    // Display formatted in Colombo must match 2:30 PM
    const formatted = formatDateTimeInOfficeTz(parsed.date);
    assert.match(formatted, /Nov 25, 2026/);
    assert.match(formatted, /2:30 PM/);

    // Leap year handling: 2028 is leap year, 2026 is not
    const leap2028 = parseDateTimeInOfficeTz("2028-02-29T10:00");
    assert.ok(leap2028.date, "Leap year Feb 29 must be valid");

    const nonLeap2026 = parseDateTimeInOfficeTz("2026-02-29T10:00");
    assert.equal(nonLeap2026.date, null);
    assert.match(nonLeap2026.error || "", /Invalid calendar date/);
  });

  it("17. Exclusion constraint violation through Prisma is mapped to booking conflict, while unrelated errors return false", async () => {
    const prisma = getDatabaseClient();

    // 1. Create a confirmed base reservation for activeResourceId1 directly via prisma
    const baseStart = new Date("2027-01-10T09:00:00.000Z");
    const baseEnd = new Date("2027-01-10T11:00:00.000Z");

    const baseRes = await prisma.reservation.create({
      data: {
        userId: staffUserA.id,
        resourceId: activeResourceId1,
        purpose: "Exclusion Mapping Base",
        startAt: baseStart,
        endAt: baseEnd,
        status: "CONFIRMED",
      },
      select: { id: true },
    });
    fixtureReservationIds.add(baseRes.id);

    // 2. Exercise exclusion violation through Prisma directly (bypassing service pre-check)
    let caughtExclusionErr: unknown = null;
    try {
      await prisma.reservation.create({
        data: {
          userId: staffUserB.id,
          resourceId: activeResourceId1,
          purpose: "Direct Prisma Overlap Violation",
          startAt: new Date("2027-01-10T09:30:00.000Z"),
          endAt: new Date("2027-01-10T10:30:00.000Z"),
          status: "CONFIRMED",
        },
      });
    } catch (err: unknown) {
      caughtExclusionErr = err;
    }

    assert.ok(caughtExclusionErr, "Direct overlapping create must throw database error");
    const isExclusion = isExclusionConstraintViolation(caughtExclusionErr);
    assert.equal(isExclusion, true, "Exclusion error must be recognized by production mapper");

    // 3. Verify that an unrelated database error (e.g. invalid foreign key) is NOT classified as a booking conflict
    let caughtUnrelatedErr: unknown = null;
    try {
      await prisma.reservation.create({
        data: {
          userId: "00000000-0000-0000-0000-000000000000",
          resourceId: activeResourceId1,
          purpose: "Invalid Foreign Key",
          startAt: new Date("2027-02-10T09:00:00.000Z"),
          endAt: new Date("2027-02-10T10:00:00.000Z"),
          status: "CONFIRMED",
        },
      });
    } catch (err: unknown) {
      caughtUnrelatedErr = err;
    }

    assert.ok(caughtUnrelatedErr, "Foreign key violation must throw database error");
    const isUnrelatedConflict = isExclusionConstraintViolation(caughtUnrelatedErr);
    assert.equal(isUnrelatedConflict, false, "Unrelated database error must NOT be classified as booking conflict");

    // 4. Verify synthetic unrelated errors (e.g., generic 'exclusion constraint' string without SQLSTATE 23P01)
    assert.equal(
      isExclusionConstraintViolation(new Error("Generic error mentioning exclusion constraint")),
      false,
      "Generic error message without 23P01 must NOT be classified as exclusion violation"
    );
    assert.equal(
      isExclusionConstraintViolation({ code: "23505", message: "unique constraint" }),
      false,
      "Unique constraint violation (23505) must return false"
    );
    assert.equal(
      isExclusionConstraintViolation({ code: "23514", message: "check constraint" }),
      false,
      "Check constraint violation (23514) must return false"
    );
  });
});
