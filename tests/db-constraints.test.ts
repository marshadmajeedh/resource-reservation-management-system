import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";

/**
 * Isolated Database Constraint & Concurrency Tests.
 *
 * STRICT SAFETY MANDATES:
 * 1. TEST_DATABASE_URL is strictly mandatory; never falls back to DATABASE_URL.
 * 2. Pre-connection validation: host must be in allowlist (localhost, 127.0.0.1, ::1, postgres).
 * 3. Pre-connection validation: database name must be exactly 'rrs_test'.
 * 4. Pre-connection validation: parsed host, port, and database must not match application DATABASE_URL.
 * 5. Post-connection validation: SELECT current_database() must strictly equal 'rrs_test'.
 * 6. Connection strings and credentials are never printed.
 * 7. No table-wide DELETE/TRUNCATE. Each test run generates unique fixture IDs and cleans up
 *    only its own records in foreign-key-safe order.
 */

interface DatabaseError extends Error {
  code?: string;
}

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

describe("Database Constraints & Overlap Prevention", () => {
  let client: Client;
  let testUserId: string;
  let adminUserId: string;
  let categoryId: string;
  let resource1Id: string;
  let resource2Id: string;

  // Track fixture IDs created during the current test run for targeted, FK-safe cleanup
  const currentFixtures = {
    reservationIds: new Set<string>(),
    resourceIds: new Set<string>(),
    categoryIds: new Set<string>(),
    userIds: new Set<string>(),
  };

  async function cleanupCurrentFixtures(targetClient: Client): Promise<void> {
    const deleteByIds = async (tableName: string, idSet: Set<string>) => {
      if (idSet.size === 0) return;
      const ids = Array.from(idSet);
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
      await targetClient.query(`DELETE FROM ${tableName} WHERE id IN (${placeholders});`, ids);
      idSet.clear();
    };

    // Foreign-key-safe deletion order: child reservations -> resources -> categories -> users
    await deleteByIds("reservations", currentFixtures.reservationIds);
    await deleteByIds("resources", currentFixtures.resourceIds);
    await deleteByIds("resource_categories", currentFixtures.categoryIds);
    await deleteByIds("users", currentFixtures.userIds);
  }

  before(async () => {
    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();

    // 2. Post-connection validation: verify current_database() strictly equals 'rrs_test'
    const dbRes = await client.query("SELECT current_database();");
    const currentDb = dbRes.rows[0].current_database as string;
    if (currentDb !== "rrs_test") {
      throw new Error(
        `SAFETY VIOLATION: Connected database is '${currentDb}', expected exact match 'rrs_test'.`
      );
    }

    // Verify required btree_gist extension and tables exist
    const ext = await client.query(
      "SELECT extname FROM pg_extension WHERE extname = 'btree_gist';"
    );
    assert.equal(
      ext.rows.length,
      1,
      "btree_gist extension must be installed in test database"
    );
  });

  after(async () => {
    if (client) {
      await cleanupCurrentFixtures(client);
      await client.end();
    }
  });

  beforeEach(async () => {
    // Generate unique run token so entity names/emails never collide across test cases
    const runToken = randomUUID().slice(0, 8);

    // Seed baseline entities with unique identifiers
    const uRes = await client.query(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES 
        ('Staff User', 'staff-${runToken}@test.local', 'hash123', 'STAFF'),
        ('Admin User', 'admin-${runToken}@test.local', 'hash456', 'ADMIN')
      RETURNING id, role;
    `);
    const staffRow = uRes.rows.find((r: { role: string }) => r.role === "STAFF");
    const adminRow = uRes.rows.find((r: { role: string }) => r.role === "ADMIN");
    assert.ok(staffRow && adminRow);
    testUserId = staffRow.id;
    adminUserId = adminRow.id;
    currentFixtures.userIds.add(testUserId);
    currentFixtures.userIds.add(adminUserId);

    const catRes = await client.query(`
      INSERT INTO resource_categories (name)
      VALUES ('Conference Rooms ${runToken}')
      RETURNING id;
    `);
    categoryId = catRes.rows[0].id;
    currentFixtures.categoryIds.add(categoryId);

    const rRes = await client.query(`
      INSERT INTO resources (category_id, name, location, capacity)
      VALUES 
        ('${categoryId}', 'Room Alpha ${runToken}', 'Floor 2', 10),
        ('${categoryId}', 'Room Beta ${runToken}', 'Floor 3', 8)
      RETURNING id, name;
    `);
    const r1 = rRes.rows.find((r: { name: string }) => r.name.startsWith("Room Alpha"));
    const r2 = rRes.rows.find((r: { name: string }) => r.name.startsWith("Room Beta"));
    assert.ok(r1 && r2);
    resource1Id = r1.id;
    resource2Id = r2.id;
    currentFixtures.resourceIds.add(resource1Id);
    currentFixtures.resourceIds.add(resource2Id);
  });

  afterEach(async () => {
    // Clean up only the specific records inserted by this test run
    await cleanupCurrentFixtures(client);
  });

  it("1. Overlapping confirmed bookings for the same resource fail", async () => {
    // Initial booking: 10:00 to 12:00
    const res1 = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Sprint Planning', '2026-11-01 10:00:00+00', '2026-11-01 12:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(res1.rows[0].id);

    // Overlapping booking: 11:00 to 13:00 on same resource
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
          VALUES ('${testUserId}', '${resource1Id}', 'Design Review', '2026-11-01 11:00:00+00', '2026-11-01 13:00:00+00', 'CONFIRMED');
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23P01", "Expected exclusion constraint violation (23P01)");
        assert.match(dbErr.message, /reservations_no_overlapping_confirmed/);
        return true;
      }
    );
  });

  it("2. Back-to-back bookings succeed due to [start, end) range boundaries", async () => {
    // First booking: 10:00 to 11:00
    const res1 = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Morning Standup', '2026-11-01 10:00:00+00', '2026-11-01 11:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(res1.rows[0].id);

    // Second booking: exactly 11:00 to 12:00 on the same resource
    const res2 = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Client Call', '2026-11-01 11:00:00+00', '2026-11-01 12:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(res2.rows[0].id);

    // Verify both exist for this specific resource
    const count = await client.query(
      `SELECT COUNT(*)::int as count FROM reservations WHERE resource_id = '${resource1Id}';`
    );
    assert.equal(count.rows[0].count, 2);
  });

  it("3. The same time range on different resources succeeds", async () => {
    // Resource 1: 14:00 to 16:00
    const res1 = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Workshop A', '2026-11-01 14:00:00+00', '2026-11-01 16:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(res1.rows[0].id);

    // Resource 2: same time 14:00 to 16:00
    const res2 = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource2Id}', 'Workshop B', '2026-11-01 14:00:00+00', '2026-11-01 16:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(res2.rows[0].id);
  });

  it("4. Cancelling a booking releases its time slot for new confirmed bookings", async () => {
    // Create confirmed booking: 09:00 to 10:00
    const initial = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Tentative Meeting', '2026-11-02 09:00:00+00', '2026-11-02 10:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    const bookingId = initial.rows[0].id;
    currentFixtures.reservationIds.add(bookingId);

    // Cancel the booking (sets status = CANCELLED with required cancellation metadata)
    await client.query(`
      UPDATE reservations
      SET status = 'CANCELLED',
          cancelled_at = NOW(),
          cancelled_by_id = '${adminUserId}',
          cancellation_reason = 'User rescheduled'
      WHERE id = '${bookingId}';
    `);

    // Insert new confirmed booking for the exact same time slot
    const replacement = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Confirmed Meeting', '2026-11-02 09:00:00+00', '2026-11-02 10:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(replacement.rows[0].id);
  });

  it("5. Invalid time ranges and invalid constraints fail", async () => {
    // end_at before start_at
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
          VALUES ('${testUserId}', '${resource1Id}', 'Backwards Time', '2026-11-03 16:00:00+00', '2026-11-03 15:00:00+00', 'CONFIRMED');
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23514"); // check_violation
        assert.match(dbErr.message, /reservations_end_after_start/);
        return true;
      }
    );

    // end_at equal to start_at (zero duration)
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
          VALUES ('${testUserId}', '${resource1Id}', 'Zero Duration', '2026-11-03 15:00:00+00', '2026-11-03 15:00:00+00', 'CONFIRMED');
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23514");
        assert.match(dbErr.message, /reservations_end_after_start/);
        return true;
      }
    );

    // Resource with capacity = 0 (must be NULL or > 0)
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO resources (category_id, name, location, capacity)
          VALUES ('${categoryId}', 'Zero Cap Room', 'Floor 1', 0);
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23514");
        assert.match(dbErr.message, /resources_capacity_positive/);
        return true;
      }
    );

    // CONFIRMED reservation with non-null cancelled_at fails cancellation consistency
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status, cancelled_at)
          VALUES ('${testUserId}', '${resource1Id}', 'Bad Metadata', '2026-11-03 10:00:00+00', '2026-11-03 11:00:00+00', 'CONFIRMED', NOW());
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23514");
        assert.match(dbErr.message, /reservations_cancellation_consistency/);
        return true;
      }
    );

    // CANCELLED reservation without cancelled_by_id fails cancellation consistency
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status, cancelled_at)
          VALUES ('${testUserId}', '${resource1Id}', 'Missing Admin', '2026-11-03 10:00:00+00', '2026-11-03 11:00:00+00', 'CANCELLED', NOW());
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23514");
        assert.match(dbErr.message, /reservations_cancellation_consistency/);
        return true;
      }
    );
  });

  it("6. Invalid foreign keys and cascade deletions fail", async () => {
    // Non-existent resourceId
    await assert.rejects(
      async () => {
        await client.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
          VALUES ('${testUserId}', '00000000-0000-0000-0000-000000000000', 'Invalid FK', '2026-11-04 10:00:00+00', '2026-11-04 11:00:00+00', 'CONFIRMED');
        `);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23503"); // foreign_key_violation
        return true;
      }
    );

    // Insert valid reservation
    const res = await client.query(`
      INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${testUserId}', '${resource1Id}', 'Existing Booking', '2026-11-04 10:00:00+00', '2026-11-04 11:00:00+00', 'CONFIRMED')
      RETURNING id;
    `);
    currentFixtures.reservationIds.add(res.rows[0].id);

    // Attempt to delete user when reservations exist (Restrictive FK delete)
    await assert.rejects(
      async () => {
        await client.query(`DELETE FROM users WHERE id = '${testUserId}';`);
      },
      (err: unknown) => {
        const dbErr = err as DatabaseError;
        assert.equal(dbErr.code, "23503"); // foreign_key_violation
        assert.match(dbErr.message, /reservations_user_id_fkey/);
        return true;
      }
    );
  });

  it("7. Competing inserts through independent connections cannot both succeed", async () => {
    const conn1 = new Client({ connectionString: testDatabaseUrl });
    const conn2 = new Client({ connectionString: testDatabaseUrl });

    await conn1.connect();
    await conn2.connect();

    try {
      // Connection 1 begins transaction and inserts reservation (9:00 - 10:00)
      await conn1.query("BEGIN;");
      const c1Res = await conn1.query(`
        INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
        VALUES ('${testUserId}', '${resource1Id}', 'Conn 1 Lock', '2026-11-05 09:00:00+00', '2026-11-05 10:00:00+00', 'CONFIRMED')
        RETURNING id;
      `);
      currentFixtures.reservationIds.add(c1Res.rows[0].id);

      // Connection 2 begins transaction and attempts overlapping insert (9:30 - 10:30)
      // This query will BLOCK at the database level waiting for Connection 1's lock
      await conn2.query("BEGIN;");
      const conn2Promise = assert.rejects(
        conn2.query(`
          INSERT INTO reservations (user_id, resource_id, purpose, start_at, end_at, status)
          VALUES ('${testUserId}', '${resource1Id}', 'Conn 2 Conflicting', '2026-11-05 09:30:00+00', '2026-11-05 10:30:00+00', 'CONFIRMED');
        `),
        (err: unknown) => {
          const dbErr = err as DatabaseError;
          assert.equal(dbErr.code, "23P01", "Connection 2 must fail with exclusion violation");
          return true;
        }
      );

      // Give Connection 2 time to reach the database and enter the lock wait state
      await new Promise((resolve) => setTimeout(resolve, 80));

      // Connection 1 commits. This releases the row/exclusion lock.
      // Connection 2 immediately wakes up, evaluates the exclusion index, and fails.
      await conn1.query("COMMIT;");

      // Verify Connection 2 fails with exclusion violation (23P01)
      await conn2Promise;

      await conn2.query("ROLLBACK;");

      // Verify exactly 1 reservation was persisted for this resource
      const result = await client.query(
        `SELECT COUNT(*)::int as count FROM reservations WHERE id = '${c1Res.rows[0].id}';`
      );
      assert.equal(result.rows[0].count, 1, "Exactly one concurrent reservation must persist.");
    } finally {
      await conn1.end();
      await conn2.end();
    }
  });
});
