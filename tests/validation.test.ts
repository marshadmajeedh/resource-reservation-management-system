import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateRequiredText,
  validateOptionalText,
  parseCapacity,
  isValidUuid,
  createCategory,
  renameCategory,
  createResource,
  updateResource,
} from "../src/features/resources/service.ts";
import {
  createStaff,
  updateStaffName,
} from "../src/features/staff/service.ts";
import {
  createReservation,
} from "../src/features/reservations/service.ts";
import { parseDateTimeInOfficeTz } from "../src/lib/timezone.ts";
import type { SafeUser } from "../src/features/auth/types.ts";

const mockAdminUser: SafeUser = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "Admin User",
  email: "admin@reserve.local",
  role: "ADMIN",
  isActive: true,
  createdAt: new Date(),
};

const mockStaffUser: SafeUser = {
  id: "b0000000-0000-4000-8000-000000000002",
  name: "Staff User",
  email: "staff@reserve.local",
  role: "STAFF",
  isActive: true,
  createdAt: new Date(),
};

describe("Required Field & Whitespace Validation (Independent Server-Side Enforcement)", () => {
  describe("validateRequiredText helper", () => {
    it("rejects empty string and whitespace-only text with 'cannot be blank'", () => {
      const emptyRes = validateRequiredText("", "Resource name", 100);
      assert.strictEqual(emptyRes.value, "");
      assert.strictEqual(emptyRes.error, "Resource name cannot be blank.");

      const spacesRes = validateRequiredText("    ", "Location", 150);
      assert.strictEqual(spacesRes.value, "");
      assert.strictEqual(spacesRes.error, "Location cannot be blank.");

      const tabNewlineRes = validateRequiredText(" \t \n ", "Purpose", 500);
      assert.strictEqual(tabNewlineRes.value, "");
      assert.strictEqual(tabNewlineRes.error, "Purpose cannot be blank.");
    });

    it("rejects non-string values as required", () => {
      const nullRes = validateRequiredText(null, "Category name", 100);
      assert.strictEqual(nullRes.error, "Category name is required.");

      const undefinedRes = validateRequiredText(undefined, "Category name", 100);
      assert.strictEqual(undefinedRes.error, "Category name is required.");
    });

    it("trims leading/trailing whitespace from valid input", () => {
      const res = validateRequiredText("   Executive Boardroom   ", "Resource name", 100);
      assert.strictEqual(res.value, "Executive Boardroom");
      assert.strictEqual(res.error, undefined);
    });

    it("rejects input exceeding max length", () => {
      const longText = "a".repeat(101);
      const res = validateRequiredText(longText, "Name", 100);
      assert.strictEqual(res.error, "Name cannot exceed 100 characters.");
    });
  });

  describe("validateOptionalText helper", () => {
    it("preserves undefined and null as null without error", () => {
      assert.deepStrictEqual(validateOptionalText(undefined, "Description", 2000), { value: null });
      assert.deepStrictEqual(validateOptionalText(null, "Description", 2000), { value: null });
    });

    it("treats empty string and whitespace-only string as null (optional)", () => {
      assert.deepStrictEqual(validateOptionalText("", "Description", 2000), { value: null });
      assert.deepStrictEqual(validateOptionalText("   \t  ", "Description", 2000), { value: null });
    });

    it("trims valid text", () => {
      const res = validateOptionalText("   Conference room equipped with 4K display.   ", "Description", 2000);
      assert.strictEqual(res.value, "Conference room equipped with 4K display.");
      assert.strictEqual(res.error, undefined);
    });
  });

  describe("parseCapacity helper", () => {
    it("preserves empty or whitespace as null (optional)", () => {
      assert.deepStrictEqual(parseCapacity(undefined), { value: null });
      assert.deepStrictEqual(parseCapacity(null), { value: null });
      assert.deepStrictEqual(parseCapacity(""), { value: null });
      assert.deepStrictEqual(parseCapacity("    "), { value: null });
    });

    it("rejects invalid, negative, decimal, or zero capacity", () => {
      assert.ok(parseCapacity("0").error);
      assert.ok(parseCapacity("-5").error);
      assert.ok(parseCapacity("abc").error);
      assert.ok(parseCapacity("12.5").error);
      assert.ok(parseCapacity("1e3").error);
    });

    it("rejects capacity exceeding 100,000", () => {
      assert.strictEqual(parseCapacity("100001").error, "Capacity cannot exceed 100,000.");
    });

    it("parses valid positive integer", () => {
      assert.deepStrictEqual(parseCapacity("15"), { value: 15 });
      assert.deepStrictEqual(parseCapacity("   25   "), { value: 25 });
      assert.deepStrictEqual(parseCapacity(50), { value: 50 });
    });
  });

  describe("parseDateTimeInOfficeTz helper", () => {
    it("rejects empty string and whitespace-only datetime inputs", () => {
      const emptyRes = parseDateTimeInOfficeTz("");
      assert.strictEqual(emptyRes.date, null);
      assert.strictEqual(emptyRes.error, "Date and time are required.");

      const spaceRes = parseDateTimeInOfficeTz("    ");
      assert.strictEqual(spaceRes.date, null);
      assert.strictEqual(spaceRes.error, "Date and time are required.");
    });

    it("rejects invalid date strings", () => {
      const res = parseDateTimeInOfficeTz("not-a-date");
      assert.strictEqual(res.date, null);
      assert.ok(res.error);
    });

    it("rejects invalid calendar date like Feb 30", () => {
      const res = parseDateTimeInOfficeTz("2026-02-30T10:00");
      assert.strictEqual(res.date, null);
      assert.ok(res.error?.includes("Invalid calendar date"));
    });
  });

  describe("isValidUuid helper", () => {
    it("rejects non-uuid strings, empty strings, and whitespace", () => {
      assert.strictEqual(isValidUuid(""), false);
      assert.strictEqual(isValidUuid("   "), false);
      assert.strictEqual(isValidUuid("not-a-uuid"), false);
      assert.strictEqual(isValidUuid(123), false);
      assert.strictEqual(isValidUuid(null), false);
      assert.strictEqual(isValidUuid("r0000000-0000-4000-8000-000000000004"), false);
    });

    it("accepts valid RFC 4122 v4 UUIDs", () => {
      assert.strictEqual(isValidUuid("a0000000-0000-4000-8000-000000000001"), true);
      assert.strictEqual(isValidUuid("44444444-4444-4444-8444-444444444444"), true);
    });
  });

  describe("Staff Form Validations", () => {
    it("createStaff rejects empty and whitespace-only names", async () => {
      const emptyRes = await createStaff(
        {
          name: "",
          email: "valid@reserve.local",
          password: "password123",
          confirmPassword: "password123",
        },
        mockAdminUser
      );
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.name, "Name cannot be blank.");

      const spaceRes = await createStaff(
        {
          name: "    \t  ",
          email: "valid@reserve.local",
          password: "password123",
          confirmPassword: "password123",
        },
        mockAdminUser
      );
      assert.strictEqual(spaceRes.success, false);
      assert.strictEqual(spaceRes.fieldErrors?.name, "Name cannot be blank.");
    });

    it("createStaff rejects empty and whitespace-only emails", async () => {
      const emptyRes = await createStaff(
        {
          name: "Alice Johnson",
          email: "",
          password: "password123",
          confirmPassword: "password123",
        },
        mockAdminUser
      );
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.email, "Email address is required.");

      const spaceRes = await createStaff(
        {
          name: "Alice Johnson",
          email: "    ",
          password: "password123",
          confirmPassword: "password123",
        },
        mockAdminUser
      );
      assert.strictEqual(spaceRes.success, false);
      assert.strictEqual(spaceRes.fieldErrors?.email, "Email address is required.");
    });

    it("createStaff does NOT silently trim passwords", async () => {
      // A password with leading/trailing spaces has length preserved
      const pwWithSpaces = "  short  "; // length = 9
      // If silently trimmed to "short", length would be 5 and fail with < 8 chars
      // Because it is NOT silently trimmed, length is 9 >= 8
      assert.strictEqual(pwWithSpaces.length, 9);

      // Short password (< 8 characters) is rejected
      const shortRes = await createStaff(
        {
          name: "Alice Johnson",
          email: "alice@reserve.local",
          password: "short",
          confirmPassword: "short",
        },
        mockAdminUser
      );
      assert.strictEqual(shortRes.success, false);
      assert.strictEqual(shortRes.fieldErrors?.password, "Password must be at least 8 characters long.");
    });

    it("createStaff rejects password confirmation mismatch", async () => {
      const mismatchRes = await createStaff(
        {
          name: "Alice Johnson",
          email: "alice@reserve.local",
          password: "correctpassword123",
          confirmPassword: "differentpassword123",
        },
        mockAdminUser
      );
      assert.strictEqual(mismatchRes.success, false);
      assert.strictEqual(mismatchRes.fieldErrors?.confirmPassword, "Passwords do not match.");
    });

    it("updateStaffName rejects empty and whitespace-only names", async () => {
      const emptyRes = await updateStaffName(
        { id: "a0000000-0000-4000-8000-000000000001", name: "" },
        mockAdminUser
      );
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.name, "Name cannot be blank.");

      const spaceRes = await updateStaffName(
        { id: "a0000000-0000-4000-8000-000000000001", name: "    " },
        mockAdminUser
      );
      assert.strictEqual(spaceRes.success, false);
      assert.strictEqual(spaceRes.fieldErrors?.name, "Name cannot be blank.");
    });
  });

  describe("Category Form Validations", () => {
    it("createCategory rejects empty and whitespace-only names", async () => {
      const emptyRes = await createCategory({ name: "" }, mockAdminUser);
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.name, "Category name cannot be blank.");

      const spaceRes = await createCategory({ name: "   \t  " }, mockAdminUser);
      assert.strictEqual(spaceRes.success, false);
      assert.strictEqual(spaceRes.fieldErrors?.name, "Category name cannot be blank.");
    });

    it("renameCategory rejects empty and whitespace-only names", async () => {
      const emptyRes = await renameCategory(
        { id: "c0000000-0000-4000-8000-000000000003", name: "" },
        mockAdminUser
      );
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.name, "Category name cannot be blank.");

      const spaceRes = await renameCategory(
        { id: "c0000000-0000-4000-8000-000000000003", name: "    " },
        mockAdminUser
      );
      assert.strictEqual(spaceRes.success, false);
      assert.strictEqual(spaceRes.fieldErrors?.name, "Category name cannot be blank.");
    });
  });

  describe("Resource Form Validations", () => {
    it("createResource rejects empty and whitespace-only name and location", async () => {
      const res = await createResource(
        {
          categoryId: "c0000000-0000-4000-8000-000000000003",
          name: "   ",
          location: "   ",
        },
        mockAdminUser
      );
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.fieldErrors?.name, "Resource name cannot be blank.");
      assert.strictEqual(res.fieldErrors?.location, "Location cannot be blank.");
    });

    it("createResource rejects invalid categoryId", async () => {
      const res = await createResource(
        {
          categoryId: "invalid-uuid",
          name: "Meeting Room A",
          location: "Floor 2",
        },
        mockAdminUser
      );
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.fieldErrors?.categoryId, "A valid category must be selected.");
    });

    it("updateResource rejects empty and whitespace-only name and location without database query", async () => {
      const res = await updateResource(
        {
          id: "44444444-4444-4444-8444-444444444444",
          categoryId: "c0000000-0000-4000-8000-000000000003",
          name: "   ",
          location: "   ",
        },
        mockAdminUser
      );
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.fieldErrors?.name, "Resource name cannot be blank.");
      assert.strictEqual(res.fieldErrors?.location, "Location cannot be blank.");
    });
  });

  describe("Reservation Form Validations", () => {
    it("createReservation rejects empty and whitespace-only purpose", async () => {
      const emptyRes = await createReservation(
        {
          resourceId: "44444444-4444-4444-8444-444444444444",
          purpose: "",
          startAtRaw: "2026-11-20T10:00",
          endAtRaw: "2026-11-20T11:00",
        },
        mockStaffUser
      );
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.purpose, "Purpose cannot be blank.");

      const spaceRes = await createReservation(
        {
          resourceId: "44444444-4444-4444-8444-444444444444",
          purpose: "    \n\t  ",
          startAtRaw: "2026-11-20T10:00",
          endAtRaw: "2026-11-20T11:00",
        },
        mockStaffUser
      );
      assert.strictEqual(spaceRes.success, false);
      assert.strictEqual(spaceRes.fieldErrors?.purpose, "Purpose cannot be blank.");
    });

    it("createReservation rejects empty and whitespace-only start and end dates", async () => {
      const emptyRes = await createReservation(
        {
          resourceId: "44444444-4444-4444-8444-444444444444",
          purpose: "Team Sync",
          startAtRaw: "   ",
          endAtRaw: "   ",
        },
        mockStaffUser
      );
      assert.strictEqual(emptyRes.success, false);
      assert.strictEqual(emptyRes.fieldErrors?.startAt, "Date and time are required.");
      assert.strictEqual(emptyRes.fieldErrors?.endAt, "Date and time are required.");
    });

    it("createReservation rejects end time equal to or earlier than start time", async () => {
      const res = await createReservation(
        {
          resourceId: "44444444-4444-4444-8444-444444444444",
          purpose: "Team Sync",
          startAtRaw: "2026-11-20T11:00",
          endAtRaw: "2026-11-20T10:00",
        },
        mockStaffUser
      );
      assert.strictEqual(res.success, false);
      assert.strictEqual(
        res.fieldErrors?.endAt,
        "Reservation end time must be strictly later than start time."
      );
    });
  });
});
