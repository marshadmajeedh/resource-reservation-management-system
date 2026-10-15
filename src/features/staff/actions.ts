"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateMutationOrigin } from "@/features/auth/csrf";
import { getCurrentUser } from "@/features/auth/dal";
import {
  createStaff,
  updateStaffName,
  setStaffActiveStatus,
} from "./service";
import type { StaffActionResult } from "./types";

/**
 * Server Actions for Staff Account Management.
 *
 * Security Mandates:
 * 1. Checks Origin/Referer header to defend against CSRF attacks.
 * 2. Authenticates and verifies administrator privileges in real-time on every mutation.
 * 3. Never trusts roles, user IDs, or permissions submitted by the client.
 * 4. Passwords and hashes are never returned, persisted in form state, or logged.
 * 5. Revalidates paths on successful mutations to keep administrative views updated.
 */

async function verifyMutationPreconditions(): Promise<{
  error?: string;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}> {
  const reqHeaders = await headers();
  if (!validateMutationOrigin(reqHeaders)) {
    return { error: "Cross-origin request rejected.", user: null };
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return {
      error: "Unauthorized: Administrator privileges are required.",
      user: null,
    };
  }

  return { user };
}

/**
 * Server Action for creating a new STAFF account.
 */
export async function createStaffAction(
  _prevState: StaffActionResult | null,
  formData: FormData
): Promise<StaffActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const name = formData.get("name");
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  const result = await createStaff(
    {
      name: typeof name === "string" ? name : "",
      email: typeof email === "string" ? email : "",
      password: typeof password === "string" ? password : "",
      confirmPassword: typeof confirmPassword === "string" ? confirmPassword : "",
    },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/staff");
  }

  return result;
}

/**
 * Server Action for updating a staff member's name.
 */
export async function updateStaffNameAction(
  _prevState: StaffActionResult | null,
  formData: FormData
): Promise<StaffActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const id = formData.get("id");
  const name = formData.get("name");

  const result = await updateStaffName(
    {
      id: typeof id === "string" ? id : "",
      name: typeof name === "string" ? name : "",
    },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/staff");
  }

  return result;
}

/**
 * Server Action for setting a staff member's explicit active status.
 */
export async function setStaffStatusAction(
  _prevState: StaffActionResult | null,
  formData: FormData
): Promise<StaffActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const id = formData.get("id");
  const isActiveRaw = formData.get("isActive");

  const result = await setStaffActiveStatus(
    {
      id: typeof id === "string" ? id : "",
      isActive: isActiveRaw === "true",
    },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/staff");
    revalidatePath("/workspace/admin/reservations");
  }

  return result;
}
