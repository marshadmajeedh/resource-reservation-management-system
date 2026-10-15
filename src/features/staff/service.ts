import "server-only";
import type { SafeUser } from "@/features/auth/types";
import { normalizeEmail } from "@/features/auth/types";
import { hashPassword } from "@/features/auth/password";
import { isValidUuid, validateRequiredText } from "@/features/resources/service";
import {
  listStaffUsersRecord,
  findStaffUserByIdRecord,
  createStaffUserRecord,
  updateStaffNameRecord,
  setStaffActiveStatusRecord,
  DuplicateStaffEmailError,
  StaffNotFoundError,
  AdminAccountModificationError,
} from "./repository";
import type {
  StaffUser,
  StaffFilterParams,
  PaginatedStaff,
  CreateStaffInput,
  UpdateStaffNameInput,
  SetStaffStatusInput,
  StaffActionResult,
} from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isActiveAdmin(user: SafeUser | null): boolean {
  return Boolean(user && user.role === "ADMIN" && user.isActive);
}

/**
 * Lists staff users for administrator management.
 * Enforces server-side administrator authorization.
 */
export async function listStaff(
  params: StaffFilterParams,
  currentUser: SafeUser | null
): Promise<PaginatedStaff> {
  if (!isActiveAdmin(currentUser)) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: params.pageSize || 10,
      totalPages: 1,
    };
  }

  const sanitizedParams: StaffFilterParams = {
    search: typeof params.search === "string" ? params.search.trim().slice(0, 100) : undefined,
    status:
      params.status === "active" || params.status === "inactive"
        ? params.status
        : "all",
    page: Math.max(1, Number(params.page) || 1),
    pageSize: Math.min(50, Math.max(1, Number(params.pageSize) || 10)),
  };

  return await listStaffUsersRecord(sanitizedParams);
}

/**
 * Creates a new STAFF account.
 *
 * Security Mandates:
 * 1. Requires active administrator authorization.
 * 2. Normalizes email (lowercase, trimmed) and validates bounds.
 * 3. Enforces password policy (8-128 chars) and confirmation match.
 * 4. Hashes password using Argon2id.
 * 5. Strictly sets role=STAFF and isActive=true on the server.
 *    Any client-supplied role or permission parameter is rejected/ignored.
 * 6. Handles duplicate emails gracefully without leaking system internals.
 * 7. Never returns, logs, or persists plaintext passwords or hashes.
 */
export async function createStaff(
  input: CreateStaffInput,
  currentUser: SafeUser | null
): Promise<StaffActionResult> {
  if (!isActiveAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required.",
    };
  }

  const fieldErrors: Record<string, string> = {};

  // 1. Validate Name
  const nameCheck = validateRequiredText(input.name, "Name", 100);
  if (nameCheck.error) {
    fieldErrors.name = nameCheck.error;
  }

  // 2. Validate Email
  if (!input.email || typeof input.email !== "string") {
    fieldErrors.email = "Email address is required.";
  } else {
    const rawEmail = input.email.trim();
    if (rawEmail.length === 0) {
      fieldErrors.email = "Email address is required.";
    } else if (rawEmail.length > 255) {
      fieldErrors.email = "Email address cannot exceed 255 characters.";
    } else if (!EMAIL_REGEX.test(rawEmail)) {
      fieldErrors.email = "Please enter a valid email address.";
    }
  }

  // 3. Validate Password & Confirmation
  const rawPassword = input.password;
  const rawConfirm = input.confirmPassword;

  if (typeof rawPassword !== "string" || rawPassword.length === 0) {
    fieldErrors.password = "Initial password is required.";
  } else if (rawPassword.length < 8) {
    fieldErrors.password = "Password must be at least 8 characters long.";
  } else if (rawPassword.length > 128) {
    fieldErrors.password = "Password cannot exceed 128 characters.";
  }

  if (typeof rawConfirm !== "string" || rawConfirm.length === 0) {
    fieldErrors.confirmPassword = "Password confirmation is required.";
  } else if (rawPassword !== rawConfirm) {
    fieldErrors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      success: false,
      error: "Please correct the highlighted errors.",
      fieldErrors,
    };
  }

  const normalizedEmail = normalizeEmail(input.email);

  try {
    // 4. Hash password with existing Argon2id helper
    const passwordHash = await hashPassword(rawPassword);

    // 5. Create STAFF account in database (role hardcoded to STAFF)
    const staff = await createStaffUserRecord({
      name: nameCheck.value,
      email: normalizedEmail,
      passwordHash,
    });

    return {
      success: true,
      staff,
    };
  } catch (err: unknown) {
    if (err instanceof DuplicateStaffEmailError) {
      return {
        success: false,
        error: "An account with this email address already exists.",
        fieldErrors: {
          email: "An account with this email address already exists.",
        },
      };
    }

    const message = err instanceof Error ? err.message : "Failed to create staff account.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Updates a staff member's name.
 * Strictly forbids modifying ADMIN accounts or altering emails.
 */
export async function updateStaffName(
  input: UpdateStaffNameInput,
  currentUser: SafeUser | null
): Promise<StaffActionResult> {
  if (!isActiveAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required.",
    };
  }

  if (!isValidUuid(input.id)) {
    return {
      success: false,
      error: "Invalid staff member ID.",
      fieldErrors: { id: "Invalid ID." },
    };
  }

  const nameCheck = validateRequiredText(input.name, "Name", 100);
  if (nameCheck.error) {
    return {
      success: false,
      error: nameCheck.error,
      fieldErrors: { name: nameCheck.error },
    };
  }

  try {
    const updated = await updateStaffNameRecord(input.id, nameCheck.value);
    return {
      success: true,
      staff: updated,
    };
  } catch (err: unknown) {
    if (err instanceof AdminAccountModificationError) {
      return {
        success: false,
        error: "Cannot modify administrative accounts through staff management.",
      };
    }
    if (err instanceof StaffNotFoundError) {
      return {
        success: false,
        error: "Staff member not found.",
      };
    }
    const message = err instanceof Error ? err.message : "Failed to update staff name.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Sets explicit active status for a staff account.
 * Deactivation blocks future authenticated requests through existing isActive checks.
 * Reservations remain untouched and preserved.
 * Strictly forbids modifying ADMIN accounts.
 */
export async function setStaffActiveStatus(
  input: SetStaffStatusInput,
  currentUser: SafeUser | null
): Promise<StaffActionResult> {
  if (!isActiveAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required.",
    };
  }

  if (!isValidUuid(input.id)) {
    return {
      success: false,
      error: "Invalid staff member ID.",
      fieldErrors: { id: "Invalid ID." },
    };
  }

  if (typeof input.isActive !== "boolean") {
    return {
      success: false,
      error: "Active status must be a boolean value.",
    };
  }

  try {
    const updated = await setStaffActiveStatusRecord(input.id, input.isActive);
    return {
      success: true,
      staff: updated,
    };
  } catch (err: unknown) {
    if (err instanceof AdminAccountModificationError) {
      return {
        success: false,
        error: "Cannot modify administrative accounts through staff management.",
      };
    }
    if (err instanceof StaffNotFoundError) {
      return {
        success: false,
        error: "Staff member not found.",
      };
    }
    const message = err instanceof Error ? err.message : "Failed to update staff status.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Retrieves a staff member by ID.
 * Returns null if the target account is an ADMIN or does not exist.
 */
export async function getStaffById(
  id: string,
  currentUser: SafeUser | null
): Promise<StaffUser | null> {
  if (!isActiveAdmin(currentUser)) {
    return null;
  }

  if (!isValidUuid(id)) {
    return null;
  }

  return await findStaffUserByIdRecord(id);
}
