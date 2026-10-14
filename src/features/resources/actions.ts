"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateMutationOrigin } from "@/features/auth/csrf";
import { getCurrentUser } from "@/features/auth/dal";
import {
  createCategory,
  renameCategory,
  createResource,
  updateResource,
  setResourceStatus,
} from "./service";
import type { ResourceActionResult } from "./types";

/**
 * Server Actions for Resource & Category Mutations.
 *
 * Security & Integrity Mandates:
 * 1. Checks Origin/Referer header to defend against CSRF attacks.
 * 2. Authenticates and verifies the caller's role against the database in real-time.
 * 3. Never trusts roles, user IDs, or permissions submitted by the client.
 * 4. Revalidates paths on successful mutations to keep lists and details synchronized.
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

export async function createCategoryAction(
  _prevState: ResourceActionResult | null,
  formData: FormData
): Promise<ResourceActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const name = formData.get("name");
  const result = await createCategory(
    { name: typeof name === "string" ? name : "" },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/categories");
    revalidatePath("/workspace/admin/resources");
    revalidatePath("/workspace/resources");
  }

  return result;
}

export async function renameCategoryAction(
  _prevState: ResourceActionResult | null,
  formData: FormData
): Promise<ResourceActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const id = formData.get("id");
  const name = formData.get("name");

  const result = await renameCategory(
    {
      id: typeof id === "string" ? id : "",
      name: typeof name === "string" ? name : "",
    },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/categories");
    revalidatePath("/workspace/admin/resources");
    revalidatePath("/workspace/resources");
  }

  return result;
}

export async function createResourceAction(
  _prevState: ResourceActionResult | null,
  formData: FormData
): Promise<ResourceActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const description = formData.get("description");
  const location = formData.get("location");
  const capacity = formData.get("capacity");
  const isActiveRaw = formData.get("isActive");

  const isActive =
    isActiveRaw === null ? true : isActiveRaw === "true" || isActiveRaw === "on";

  const result = await createResource(
    {
      categoryId: typeof categoryId === "string" ? categoryId : "",
      name: typeof name === "string" ? name : "",
      description: typeof description === "string" ? description : null,
      location: typeof location === "string" ? location : "",
      capacity: typeof capacity === "string" ? capacity : null,
      isActive,
    },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/resources");
    revalidatePath("/workspace/resources");
  }

  return result;
}

export async function updateResourceAction(
  _prevState: ResourceActionResult | null,
  formData: FormData
): Promise<ResourceActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const id = formData.get("id");
  const categoryId = formData.get("categoryId");
  const name = formData.get("name");
  const description = formData.get("description");
  const location = formData.get("location");
  const capacity = formData.get("capacity");

  const result = await updateResource(
    {
      id: typeof id === "string" ? id : "",
      categoryId: typeof categoryId === "string" ? categoryId : "",
      name: typeof name === "string" ? name : "",
      description: typeof description === "string" ? description : null,
      location: typeof location === "string" ? location : "",
      capacity: typeof capacity === "string" ? capacity : null,
    },
    user
  );

  if (result.success && result.resource) {
    revalidatePath("/workspace/admin/resources");
    revalidatePath("/workspace/resources");
    revalidatePath(`/workspace/resources/${result.resource.id}`);
  }

  return result;
}

export async function setResourceStatusAction(
  _prevState: ResourceActionResult | null,
  formData: FormData
): Promise<ResourceActionResult> {
  const { error, user } = await verifyMutationPreconditions();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const id = formData.get("id");
  const isActiveRaw = formData.get("isActive");

  if (typeof id !== "string") {
    return { success: false, error: "Missing resource ID." };
  }

  const isActive = isActiveRaw === "true";

  const result = await setResourceStatus(
    {
      id,
      isActive,
    },
    user
  );

  if (result.success) {
    revalidatePath("/workspace/admin/resources");
    revalidatePath("/workspace/resources");
    revalidatePath(`/workspace/resources/${id}`);
  }

  return result;
}
