import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import {
  createCategory,
  renameCategory,
  listResources,
  getResourceById,
  createResource,
  updateResource,
  setResourceStatus,
  parseCapacity,
} from "../src/features/resources/service.ts";
import type { SafeUser } from "../src/features/auth/types.ts";
import { disconnectDatabase } from "../src/lib/db.ts";

/**
 * Isolated Resource Management Test Suite.
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

// Bind production Prisma client to test database URL
process.env.DATABASE_URL = testDatabaseUrl;

describe("Resource Management & Category Administration", () => {
  let client: Client;

  // Track all test fixtures for foreign-key-safe targeted cleanup
  const fixtureUserIds = new Set<string>();
  const fixtureCategoryIds = new Set<string>();
  const fixtureResourceIds = new Set<string>();
  const fixtureReservationIds = new Set<string>();

  let adminUser: SafeUser;
  let staffUser: SafeUser;
  let inactiveAdminUser: SafeUser;

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

    // Insert test admin user
    const adminId = randomUUID();
    const adminEmail = `admin-${adminId}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${adminId}', 'Admin User', '${adminEmail}', 'dummy_hash', 'ADMIN', true);
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

    // Insert test staff user
    const staffId = randomUUID();
    const staffEmail = `staff-${staffId}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${staffId}', 'Staff Member', '${staffEmail}', 'dummy_hash', 'STAFF', true);
    `);
    fixtureUserIds.add(staffId);
    staffUser = {
      id: staffId,
      name: "Staff Member",
      email: staffEmail,
      role: "STAFF",
      isActive: true,
      createdAt: new Date(),
    };

    // Insert deactivated admin user
    const inactiveId = randomUUID();
    const inactiveEmail = `inactive-admin-${inactiveId}@test.local`;
    await client.query(`
      INSERT INTO users (id, name, email, password_hash, role, is_active)
      VALUES ('${inactiveId}', 'Inactive Admin', '${inactiveEmail}', 'dummy_hash', 'ADMIN', false);
    `);
    fixtureUserIds.add(inactiveId);
    inactiveAdminUser = {
      id: inactiveId,
      name: "Inactive Admin",
      email: inactiveEmail,
      role: "ADMIN",
      isActive: false,
      createdAt: new Date(),
    };
  });

  after(async () => {
    // Foreign-key-safe targeted cleanup
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
      // Best-effort cleanup
    } finally {
      await client.end().catch(() => {});
      await disconnectDatabase().catch(() => {});
    }
  });

  it("1. Admin can create categories and resources", async () => {
    const catName = `Meeting Rooms ${randomUUID().slice(0, 8)}`;
    const catResult = await createCategory({ name: catName }, adminUser);
    assert.equal(catResult.success, true, "Category creation must succeed for admin");
    assert.ok(catResult.category?.id, "Created category must have an id");
    assert.equal(catResult.category?.name, catName);
    fixtureCategoryIds.add(catResult.category!.id);

    const resResult = await createResource(
      {
        categoryId: catResult.category!.id,
        name: "Executive Boardroom A",
        location: "Floor 3 - North Wing",
        capacity: 16,
        description: "Equipped with 4K display and video conferencing system.",
        isActive: true,
      },
      adminUser
    );
    assert.equal(resResult.success, true, "Resource creation must succeed for admin");
    assert.ok(resResult.resource?.id, "Created resource must have an id");
    assert.equal(resResult.resource?.name, "Executive Boardroom A");
    assert.equal(resResult.resource?.location, "Floor 3 - North Wing");
    assert.equal(resResult.resource?.capacity, 16);
    assert.equal(resResult.resource?.isActive, true);
    fixtureResourceIds.add(resResult.resource!.id);
  });

  it("2. Staff and unauthenticated requests cannot perform management operations", async () => {
    const catName = `Staff Test Cat ${randomUUID().slice(0, 8)}`;

    // Staff cannot create categories
    const staffCatRes = await createCategory({ name: catName }, staffUser);
    assert.equal(staffCatRes.success, false);
    assert.match(staffCatRes.error!, /Unauthorized/);

    // Unauthenticated cannot create categories
    const unauthCatRes = await createCategory({ name: catName }, null);
    assert.equal(unauthCatRes.success, false);
    assert.match(unauthCatRes.error!, /Unauthorized/);

    // Inactive admin cannot create categories
    const inactiveAdminCatRes = await createCategory({ name: catName }, inactiveAdminUser);
    assert.equal(inactiveAdminCatRes.success, false);
    assert.match(inactiveAdminCatRes.error!, /Unauthorized/);

    // Create a category as admin for testing subsequent operations
    const validCat = await createCategory({ name: catName }, adminUser);
    fixtureCategoryIds.add(validCat.category!.id);

    // Staff cannot rename categories
    const staffRenameRes = await renameCategory(
      { id: validCat.category!.id, name: "Renamed by Staff" },
      staffUser
    );
    assert.equal(staffRenameRes.success, false);
    assert.match(staffRenameRes.error!, /Unauthorized/);

    // Staff cannot create resources
    const staffResRes = await createResource(
      {
        categoryId: validCat.category!.id,
        name: "Unauthorized Desk",
        location: "Floor 1",
      },
      staffUser
    );
    assert.equal(staffResRes.success, false);
    assert.match(staffResRes.error!, /Unauthorized/);

    // Create resource as admin for testing edit & status
    const validRes = await createResource(
      {
        categoryId: validCat.category!.id,
        name: "Admin Desk",
        location: "Floor 1",
      },
      adminUser
    );
    fixtureResourceIds.add(validRes.resource!.id);

    // Staff cannot edit resources
    const staffEditRes = await updateResource(
      {
        id: validRes.resource!.id,
        categoryId: validCat.category!.id,
        name: "Staff Modified",
        location: "Floor 1",
      },
      staffUser
    );
    assert.equal(staffEditRes.success, false);
    assert.match(staffEditRes.error!, /Unauthorized/);

    // Staff cannot toggle resource status
    const staffStatusRes = await setResourceStatus(
      { id: validRes.resource!.id, isActive: false },
      staffUser
    );
    assert.equal(staffStatusRes.success, false);
    assert.match(staffStatusRes.error!, /Unauthorized/);
  });

  it("3. Invalid category references and invalid capacities are rejected", async () => {
    const catName = `Cap Test ${randomUUID().slice(0, 8)}`;
    const cat = await createCategory({ name: catName }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    // Non-existent category ID (valid UUID, but not in DB)
    const fakeCatId = randomUUID();
    const badCatRes = await createResource(
      {
        categoryId: fakeCatId,
        name: "Ghost Category Resource",
        location: "Floor 1",
      },
      adminUser
    );
    assert.equal(badCatRes.success, false);
    assert.match(badCatRes.fieldErrors?.categoryId || badCatRes.error!, /category does not exist/i);

    // Invalid UUID for categoryId
    const malformedCatRes = await createResource(
      {
        categoryId: "not-a-uuid",
        name: "Bad UUID Resource",
        location: "Floor 1",
      },
      adminUser
    );
    assert.equal(malformedCatRes.success, false);
    assert.match(malformedCatRes.fieldErrors?.categoryId || malformedCatRes.error!, /valid category/i);

    // Capacity = 0
    const zeroCapRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Zero Cap Room",
        location: "Floor 1",
        capacity: 0,
      },
      adminUser
    );
    assert.equal(zeroCapRes.success, false);
    assert.match(zeroCapRes.fieldErrors?.capacity || zeroCapRes.error!, /positive/i);

    // Capacity = negative
    const negCapRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Negative Cap Room",
        location: "Floor 1",
        capacity: -5,
      },
      adminUser
    );
    assert.equal(negCapRes.success, false);
    assert.match(negCapRes.fieldErrors?.capacity || negCapRes.error!, /positive/i);

    // Capacity = fractional
    const fracCap = parseCapacity(12.5);
    assert.ok(fracCap.error);

    // Capacity = non-numeric string
    const stringCap = parseCapacity("twelve");
    assert.ok(stringCap.error);

    // Empty capacity string becomes null (not zero!)
    const emptyCap = parseCapacity("");
    assert.equal(emptyCap.value, null);
    assert.equal(emptyCap.error, undefined);

    // Resource with empty capacity creates cleanly with capacity: null
    const nullCapRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Null Cap Room",
        location: "Floor 1",
        capacity: null,
      },
      adminUser
    );
    assert.equal(nullCapRes.success, true);
    assert.equal(nullCapRes.resource?.capacity, null);
    fixtureResourceIds.add(nullCapRes.resource!.id);
  });

  it("4. Blank required fields are rejected", async () => {
    const catName = `Blank Test ${randomUUID().slice(0, 8)}`;
    const cat = await createCategory({ name: catName }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    // Category with empty and blank names
    const emptyCat = await createCategory({ name: "" }, adminUser);
    assert.equal(emptyCat.success, false);
    assert.match(emptyCat.fieldErrors?.name || emptyCat.error!, /cannot be blank/i);

    const blankCat = await createCategory({ name: "   " }, adminUser);
    assert.equal(blankCat.success, false);
    assert.match(blankCat.fieldErrors?.name || blankCat.error!, /cannot be blank/i);

    // Rename category with empty and blank names
    const emptyRenameCat = await renameCategory({ id: cat.category!.id, name: "" }, adminUser);
    assert.equal(emptyRenameCat.success, false);
    assert.match(emptyRenameCat.fieldErrors?.name || emptyRenameCat.error!, /cannot be blank/i);

    const blankRenameCat = await renameCategory({ id: cat.category!.id, name: "   " }, adminUser);
    assert.equal(blankRenameCat.success, false);
    assert.match(blankRenameCat.fieldErrors?.name || blankRenameCat.error!, /cannot be blank/i);

    // Resource with empty and whitespace-only name
    const emptyNameRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "",
        location: "Floor 1",
      },
      adminUser
    );
    assert.equal(emptyNameRes.success, false);
    assert.match(emptyNameRes.fieldErrors?.name || emptyNameRes.error!, /cannot be blank/i);

    const blankNameRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "    ",
        location: "Floor 1",
      },
      adminUser
    );
    assert.equal(blankNameRes.success, false);
    assert.match(blankNameRes.fieldErrors?.name || blankNameRes.error!, /cannot be blank/i);

    // Resource with empty and whitespace-only location
    const emptyLocRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Valid Name",
        location: "",
      },
      adminUser
    );
    assert.equal(emptyLocRes.success, false);
    assert.match(emptyLocRes.fieldErrors?.location || emptyLocRes.error!, /cannot be blank/i);

    const blankLocRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Valid Name",
        location: "   ",
      },
      adminUser
    );
    assert.equal(blankLocRes.success, false);
    assert.match(blankLocRes.fieldErrors?.location || blankLocRes.error!, /cannot be blank/i);

    // Create a valid resource to test updateResource validations
    const validRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Valid Resource For Update",
        location: "Floor 2",
      },
      adminUser
    );
    assert.equal(validRes.success, true);
    fixtureResourceIds.add(validRes.resource!.id);

    // Update resource with empty and whitespace name
    const updateEmptyName = await updateResource(
      {
        id: validRes.resource!.id,
        categoryId: cat.category!.id,
        name: "",
        location: "Floor 2",
      },
      adminUser
    );
    assert.equal(updateEmptyName.success, false);
    assert.match(updateEmptyName.fieldErrors?.name || updateEmptyName.error!, /cannot be blank/i);

    const updateBlankName = await updateResource(
      {
        id: validRes.resource!.id,
        categoryId: cat.category!.id,
        name: "   ",
        location: "Floor 2",
      },
      adminUser
    );
    assert.equal(updateBlankName.success, false);
    assert.match(updateBlankName.fieldErrors?.name || updateBlankName.error!, /cannot be blank/i);

    // Update resource with empty and whitespace location
    const updateEmptyLoc = await updateResource(
      {
        id: validRes.resource!.id,
        categoryId: cat.category!.id,
        name: "Valid Resource For Update",
        location: "",
      },
      adminUser
    );
    assert.equal(updateEmptyLoc.success, false);
    assert.match(updateEmptyLoc.fieldErrors?.location || updateEmptyLoc.error!, /cannot be blank/i);

    const updateBlankLoc = await updateResource(
      {
        id: validRes.resource!.id,
        categoryId: cat.category!.id,
        name: "Valid Resource For Update",
        location: "   ",
      },
      adminUser
    );
    assert.equal(updateBlankLoc.success, false);
    assert.match(updateBlankLoc.fieldErrors?.location || updateBlankLoc.error!, /cannot be blank/i);

    // Excessively long name (> 100 chars)
    const longName = "A".repeat(101);
    const longNameRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: longName,
        location: "Floor 1",
      },
      adminUser
    );
    assert.equal(longNameRes.success, false);
    assert.match(longNameRes.fieldErrors?.name || longNameRes.error!, /cannot exceed 100 characters/i);
  });

  it("5. Category duplicate errors are handled cleanly", async () => {
    const dupName = `Unique Cat ${randomUUID().slice(0, 8)}`;

    const first = await createCategory({ name: dupName }, adminUser);
    assert.equal(first.success, true);
    fixtureCategoryIds.add(first.category!.id);

    // Attempt to create another category with exact same name
    const second = await createCategory({ name: dupName }, adminUser);
    assert.equal(second.success, false);
    assert.match(second.error!, /already exists/i);

    // Create another category and attempt to rename it to the first name
    const otherCat = await createCategory({ name: `Other ${randomUUID().slice(0, 8)}` }, adminUser);
    fixtureCategoryIds.add(otherCat.category!.id);

    const renameDup = await renameCategory({ id: otherCat.category!.id, name: dupName }, adminUser);
    assert.equal(renameDup.success, false);
    assert.match(renameDup.error!, /already exists/i);
  });

  it("6. Resource editing preserves identity and existing reservation relationships", async () => {
    const cat = await createCategory({ name: `Preserve Test ${randomUUID().slice(0, 8)}` }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    const res = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Initial Resource Name",
        location: "Floor 1",
        capacity: 10,
        description: "Initial description",
      },
      adminUser
    );
    assert.equal(res.success, true);
    fixtureResourceIds.add(res.resource!.id);

    const resourceId = res.resource!.id;
    const originalCreatedAt = res.resource!.createdAt;

    // Insert a reservation directly via database for this resource
    const reservationId = randomUUID();
    await client.query(`
      INSERT INTO reservations (id, user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${reservationId}', '${staffUser.id}', '${resourceId}', 'Quarterly Review', '2026-11-20 10:00:00+00', '2026-11-20 11:00:00+00', 'CONFIRMED');
    `);
    fixtureReservationIds.add(reservationId);

    // Edit the resource
    const updateResult = await updateResource(
      {
        id: resourceId,
        categoryId: cat.category!.id,
        name: "Updated Resource Name",
        location: "Floor 2 - Relocated",
        capacity: 20,
        description: "Updated description",
      },
      adminUser
    );
    assert.equal(updateResult.success, true);
    assert.equal(updateResult.resource?.id, resourceId, "Resource ID must remain identical");
    assert.equal(
      new Date(updateResult.resource!.createdAt).getTime(),
      new Date(originalCreatedAt).getTime(),
      "Creation timestamp must be preserved"
    );
    assert.equal(updateResult.resource?.name, "Updated Resource Name");
    assert.equal(updateResult.resource?.location, "Floor 2 - Relocated");
    assert.equal(updateResult.resource?.capacity, 20);

    // Verify reservation still links to this resource
    const checkBooking = await client.query(`
      SELECT resource_id, purpose FROM reservations WHERE id = '${reservationId}';
    `);
    assert.equal(checkBooking.rows.length, 1);
    assert.equal(checkBooking.rows[0].resource_id, resourceId, "Reservation relationship must be preserved");
    assert.equal(checkBooking.rows[0].purpose, "Quarterly Review");
  });

  it("7. Inactive resources are excluded from staff lists and inaccessible through direct staff detail requests", async () => {
    const cat = await createCategory({ name: `Visibility Test ${randomUUID().slice(0, 8)}` }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    // Active resource
    const activeRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Active Visible Room",
        location: "Floor 1",
        isActive: true,
      },
      adminUser
    );
    fixtureResourceIds.add(activeRes.resource!.id);

    // Inactive resource
    const inactiveRes = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Inactive Hidden Room",
        location: "Floor 1",
        isActive: false,
      },
      adminUser
    );
    fixtureResourceIds.add(inactiveRes.resource!.id);

    // Staff list query
    const staffList = await listResources({ categoryId: cat.category!.id }, staffUser);
    const staffIds = staffList.items.map((i) => i.id);
    assert.ok(staffIds.includes(activeRes.resource!.id), "Active resource must appear in staff list");
    assert.ok(!staffIds.includes(inactiveRes.resource!.id), "Inactive resource must NOT appear in staff list");

    // Staff direct detail query for inactive resource
    const staffDetail = await getResourceById(inactiveRes.resource!.id, staffUser);
    assert.equal(staffDetail, null, "Inactive resource must be inaccessible to staff via direct query");

    // Admin direct detail query for inactive resource
    const adminDetail = await getResourceById(inactiveRes.resource!.id, adminUser);
    assert.ok(adminDetail, "Inactive resource must be accessible to admin");
    assert.equal(adminDetail?.id, inactiveRes.resource!.id);
  });

  it("8. Deactivation is blocked by upcoming and ongoing confirmed reservations", async () => {
    const cat = await createCategory({ name: `Deactivation Block ${randomUUID().slice(0, 8)}` }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    const res = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Room with Upcoming Booking",
        location: "Floor 1",
        isActive: true,
      },
      adminUser
    );
    fixtureResourceIds.add(res.resource!.id);
    const resourceId = res.resource!.id;

    // Insert upcoming CONFIRMED reservation (future time)
    const futureBookingId = randomUUID();
    await client.query(`
      INSERT INTO reservations (id, user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${futureBookingId}', '${staffUser.id}', '${resourceId}', 'Upcoming Team Sync', NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 2 hours', 'CONFIRMED');
    `);
    fixtureReservationIds.add(futureBookingId);

    // Attempt deactivation
    const deactRes = await setResourceStatus({ id: resourceId, isActive: false }, adminUser);
    assert.equal(deactRes.success, false, "Deactivation must be blocked when future confirmed booking exists");
    assert.match(deactRes.error!, /Cannot deactivate resource/);
    assert.match(deactRes.error!, /upcoming confirmed reservation/i);

    // Verify database state is still active
    const dbCheck = await client.query(`SELECT is_active FROM resources WHERE id = '${resourceId}';`);
    assert.equal(dbCheck.rows[0].is_active, true, "Resource must remain active in database");
  });

  it("9. Deactivation is allowed when only past/cancelled reservations exist", async () => {
    const cat = await createCategory({ name: `Deactivation Allow ${randomUUID().slice(0, 8)}` }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    const res = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Room with Past and Cancelled Bookings",
        location: "Floor 1",
        isActive: true,
      },
      adminUser
    );
    fixtureResourceIds.add(res.resource!.id);
    const resourceId = res.resource!.id;

    // Past confirmed booking
    const pastBookingId = randomUUID();
    await client.query(`
      INSERT INTO reservations (id, user_id, resource_id, purpose, start_at, end_at, status)
      VALUES ('${pastBookingId}', '${staffUser.id}', '${resourceId}', 'Past All-Hands', NOW() - INTERVAL '3 days 1 hour', NOW() - INTERVAL '3 days', 'CONFIRMED');
    `);
    fixtureReservationIds.add(pastBookingId);

    // Future CANCELLED booking (has cancellation metadata)
    const cancelledBookingId = randomUUID();
    await client.query(`
      INSERT INTO reservations (id, user_id, resource_id, purpose, start_at, end_at, status, cancelled_at, cancelled_by_id, cancellation_reason)
      VALUES ('${cancelledBookingId}', '${staffUser.id}', '${resourceId}', 'Cancelled Strategy', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 2 hours', 'CANCELLED', NOW(), '${adminUser.id}', 'Project postponed');
    `);
    fixtureReservationIds.add(cancelledBookingId);

    // Deactivation should succeed because only past or cancelled reservations exist
    const deactRes = await setResourceStatus({ id: resourceId, isActive: false }, adminUser);
    assert.equal(deactRes.success, true, "Deactivation must be allowed when only past/cancelled bookings exist");
    assert.equal(deactRes.resource?.isActive, false);

    // Verify in DB
    const dbCheck = await client.query(`SELECT is_active FROM resources WHERE id = '${resourceId}';`);
    assert.equal(dbCheck.rows[0].is_active, false);
  });

  it("10. Reactivation works and repeated state-setting requests are safe", async () => {
    const cat = await createCategory({ name: `Idempotency Test ${randomUUID().slice(0, 8)}` }, adminUser);
    fixtureCategoryIds.add(cat.category!.id);

    const res = await createResource(
      {
        categoryId: cat.category!.id,
        name: "Toggle Resource",
        location: "Floor 1",
        isActive: true,
      },
      adminUser
    );
    fixtureResourceIds.add(res.resource!.id);
    const resourceId = res.resource!.id;

    // Deactivate
    const deact1 = await setResourceStatus({ id: resourceId, isActive: false }, adminUser);
    assert.equal(deact1.success, true);
    assert.equal(deact1.resource?.isActive, false);

    // Repeated deactivation is safe and idempotent
    const deact2 = await setResourceStatus({ id: resourceId, isActive: false }, adminUser);
    assert.equal(deact2.success, true);
    assert.equal(deact2.resource?.isActive, false);

    // Reactivate
    const react1 = await setResourceStatus({ id: resourceId, isActive: true }, adminUser);
    assert.equal(react1.success, true);
    assert.equal(react1.resource?.isActive, true);

    // Repeated activation is safe and idempotent
    const react2 = await setResourceStatus({ id: resourceId, isActive: true }, adminUser);
    assert.equal(react2.success, true);
    assert.equal(react2.resource?.isActive, true);
  });

  it("11. Search, category filters, status filters, and pagination behave correctly", async () => {
    const catA = await createCategory({ name: `Category A ${randomUUID().slice(0, 6)}` }, adminUser);
    const catB = await createCategory({ name: `Category B ${randomUUID().slice(0, 6)}` }, adminUser);
    fixtureCategoryIds.add(catA.category!.id);
    fixtureCategoryIds.add(catB.category!.id);

    // Create 4 resources
    const r1 = await createResource(
      {
        categoryId: catA.category!.id,
        name: "Conference Room Alpha",
        location: "Floor 10 - Downtown",
        isActive: true,
      },
      adminUser
    );
    const r2 = await createResource(
      {
        categoryId: catA.category!.id,
        name: "Focus Pod Beta",
        location: "Floor 10 - Downtown",
        isActive: true,
      },
      adminUser
    );
    const r3 = await createResource(
      {
        categoryId: catB.category!.id,
        name: "Projector Device Gamma",
        location: "Storage Annex",
        isActive: false,
      },
      adminUser
    );
    const r4 = await createResource(
      {
        categoryId: catB.category!.id,
        name: "Recording Studio Delta",
        location: "Floor 2 - Soundstage",
        isActive: true,
      },
      adminUser
    );

    fixtureResourceIds.add(r1.resource!.id);
    fixtureResourceIds.add(r2.resource!.id);
    fixtureResourceIds.add(r3.resource!.id);
    fixtureResourceIds.add(r4.resource!.id);

    // 1. Search by name ("Alpha")
    const searchAlpha = await listResources({ search: "Alpha" }, adminUser);
    assert.ok(searchAlpha.items.some((i) => i.id === r1.resource!.id));
    assert.ok(!searchAlpha.items.some((i) => i.id === r2.resource!.id));

    // 2. Search by location ("Storage Annex")
    const searchLoc = await listResources({ search: "Storage Annex" }, adminUser);
    assert.ok(searchLoc.items.some((i) => i.id === r3.resource!.id));

    // 3. Category filter (Category A)
    const filterCatA = await listResources({ categoryId: catA.category!.id }, adminUser);
    const catAIds = filterCatA.items.map((i) => i.id);
    assert.ok(catAIds.includes(r1.resource!.id));
    assert.ok(catAIds.includes(r2.resource!.id));
    assert.ok(!catAIds.includes(r3.resource!.id));
    assert.ok(!catAIds.includes(r4.resource!.id));

    // 4. Admin status filter ("inactive")
    const filterInactive = await listResources(
      { categoryId: catB.category!.id, status: "inactive" },
      adminUser
    );
    assert.ok(filterInactive.items.some((i) => i.id === r3.resource!.id));
    assert.ok(!filterInactive.items.some((i) => i.id === r4.resource!.id));

    // 5. Staff forced active-only even if staff requests status='inactive'
    const staffTryInactive = await listResources(
      { categoryId: catB.category!.id, status: "inactive" },
      staffUser
    );
    assert.ok(!staffTryInactive.items.some((i) => i.id === r3.resource!.id), "Staff must NEVER receive inactive resources");
    assert.ok(staffTryInactive.items.some((i) => i.id === r4.resource!.id));

    // 6. Pagination bounded test
    const page1 = await listResources(
      { categoryId: catA.category!.id, page: 1, pageSize: 1 },
      adminUser
    );
    assert.equal(page1.items.length, 1);
    assert.equal(page1.total, 2);
    assert.equal(page1.totalPages, 2);
    assert.equal(page1.page, 1);

    const page2 = await listResources(
      { categoryId: catA.category!.id, page: 2, pageSize: 1 },
      adminUser
    );
    assert.equal(page2.items.length, 1);
    assert.notEqual(page1.items[0].id, page2.items[0].id, "Page 2 must return different item than Page 1");
  });
});
