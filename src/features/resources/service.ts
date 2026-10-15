import "server-only";
import type { SafeUser } from "@/features/auth/types";
import {
  listCategoriesRecord,
  findCategoryByIdRecord,
  createCategoryRecord,
  renameCategoryRecord,
  listResourcesRecord,
  findResourceByIdRecord,
  createResourceRecord,
  updateResourceRecord,
  setResourceActiveStatusRecord,
} from "./repository";
import type {
  Resource,
  ResourceCategory,
  CreateCategoryInput,
  RenameCategoryInput,
  CreateResourceInput,
  UpdateResourceInput,
  SetResourceStatusInput,
  ResourceFilterParams,
  PaginatedResources,
  ResourceActionResult,
} from "./types";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

export function parseCapacity(raw: unknown): {
  value: number | null;
  error?: string;
} {
  if (raw === undefined || raw === null || raw === "") {
    return { value: null };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return { value: null };
    }
    // Prevent non-numeric characters, signs, decimals, or exponent notations
    if (!/^\d+$/.test(trimmed)) {
      return {
        value: null,
        error: "Capacity must be a positive whole number greater than zero.",
      };
    }
    const num = Number(trimmed);
    if (!Number.isSafeInteger(num) || num <= 0) {
      return {
        value: null,
        error: "Capacity must be a positive integer greater than zero.",
      };
    }
    if (num > 100000) {
      return {
        value: null,
        error: "Capacity cannot exceed 100,000.",
      };
    }
    return { value: num };
  }

  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw) || raw <= 0) {
      return {
        value: null,
        error: "Capacity must be a positive integer greater than zero.",
      };
    }
    if (raw > 100000) {
      return {
        value: null,
        error: "Capacity cannot exceed 100,000.",
      };
    }
    return { value: raw };
  }

  return {
    value: null,
    error: "Capacity must be a valid number.",
  };
}

export function validateRequiredText(
  raw: unknown,
  fieldName: string,
  maxLength: number
): { value: string; error?: string } {
  if (typeof raw !== "string") {
    return { value: "", error: `${fieldName} is required.` };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { value: "", error: `${fieldName} cannot be blank.` };
  }
  if (trimmed.length > maxLength) {
    return {
      value: trimmed,
      error: `${fieldName} cannot exceed ${maxLength} characters.`,
    };
  }
  return { value: trimmed };
}

export function validateOptionalText(
  raw: unknown,
  fieldName: string,
  maxLength: number
): { value: string | null; error?: string } {
  if (raw === undefined || raw === null) {
    return { value: null };
  }
  if (typeof raw !== "string") {
    return { value: null, error: `${fieldName} must be text.` };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { value: null };
  }
  if (trimmed.length > maxLength) {
    return {
      value: trimmed,
      error: `${fieldName} cannot exceed ${maxLength} characters.`,
    };
  }
  return { value: trimmed };
}

interface PrismaErrorWithCode extends Error {
  code?: string;
}

function isAdmin(user: SafeUser | null): boolean {
  return Boolean(user && user.role === "ADMIN" && user.isActive);
}

// -------------------------------------------------------------
// Category Service
// -------------------------------------------------------------

export async function listCategories(): Promise<ResourceCategory[]> {
  return await listCategoriesRecord();
}

export async function createCategory(
  input: CreateCategoryInput,
  currentUser: SafeUser | null
): Promise<ResourceActionResult> {
  if (!isAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required to create categories.",
    };
  }

  const nameCheck = validateRequiredText(input.name, "Category name", 100);
  if (nameCheck.error) {
    return {
      success: false,
      error: nameCheck.error,
      fieldErrors: { name: nameCheck.error },
    };
  }

  try {
    const category = await createCategoryRecord(nameCheck.value);
    return { success: true, category };
  } catch (err: unknown) {
    const error = err as PrismaErrorWithCode;
    if (error.code === "P2002") {
      return {
        success: false,
        error: "A category with this name already exists.",
        fieldErrors: { name: "A category with this name already exists." },
      };
    }
    return {
      success: false,
      error: "Failed to create category. Please try again.",
    };
  }
}

export async function renameCategory(
  input: RenameCategoryInput,
  currentUser: SafeUser | null
): Promise<ResourceActionResult> {
  if (!isAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required to rename categories.",
    };
  }

  if (!isValidUuid(input.id)) {
    return {
      success: false,
      error: "Invalid category ID.",
    };
  }

  const nameCheck = validateRequiredText(input.name, "Category name", 100);
  if (nameCheck.error) {
    return {
      success: false,
      error: nameCheck.error,
      fieldErrors: { name: nameCheck.error },
    };
  }

  const existing = await findCategoryByIdRecord(input.id);
  if (!existing) {
    return {
      success: false,
      error: "Category not found.",
    };
  }

  try {
    const category = await renameCategoryRecord(input.id, nameCheck.value);
    return { success: true, category };
  } catch (err: unknown) {
    const error = err as PrismaErrorWithCode;
    if (error.code === "P2002") {
      return {
        success: false,
        error: "A category with this name already exists.",
        fieldErrors: { name: "A category with this name already exists." },
      };
    }
    return {
      success: false,
      error: "Failed to rename category. Please try again.",
    };
  }
}

// -------------------------------------------------------------
// Resource Service
// -------------------------------------------------------------

export async function listResources(
  params: ResourceFilterParams,
  currentUser: SafeUser | null
): Promise<PaginatedResources> {
  const isStaff = !isAdmin(currentUser);

  const effectiveParams: ResourceFilterParams = {
    ...params,
    // Staff queries MUST enforce active-only filtering on the server
    status: isStaff ? "active" : params.status || "all",
  };

  return await listResourcesRecord(effectiveParams);
}

export async function getResourceById(
  id: string,
  currentUser: SafeUser | null
): Promise<Resource | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  const resource = await findResourceByIdRecord(id);
  if (!resource) {
    return null;
  }

  // Inactive resources are excluded from staff and unauthenticated detail access
  const isStaff = !isAdmin(currentUser);
  if (isStaff && !resource.isActive) {
    return null;
  }

  return resource;
}

export async function createResource(
  input: CreateResourceInput,
  currentUser: SafeUser | null
): Promise<ResourceActionResult> {
  if (!isAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required to create resources.",
    };
  }

  const fieldErrors: Record<string, string> = {};

  const nameCheck = validateRequiredText(input.name, "Resource name", 100);
  if (nameCheck.error) {
    fieldErrors.name = nameCheck.error;
  }

  const locationCheck = validateRequiredText(input.location, "Location", 150);
  if (locationCheck.error) {
    fieldErrors.location = locationCheck.error;
  }

  const descCheck = validateOptionalText(input.description, "Description", 2000);
  if (descCheck.error) {
    fieldErrors.description = descCheck.error;
  }

  const capacityCheck = parseCapacity(input.capacity);
  if (capacityCheck.error) {
    fieldErrors.capacity = capacityCheck.error;
  }

  if (!isValidUuid(input.categoryId)) {
    fieldErrors.categoryId = "A valid category must be selected.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstErrorMessage = Object.values(fieldErrors)[0];
    return {
      success: false,
      error: firstErrorMessage,
      fieldErrors,
    };
  }

  const categoryExists = await findCategoryByIdRecord(input.categoryId);
  if (!categoryExists) {
    return {
      success: false,
      error: "The selected category does not exist.",
      fieldErrors: { categoryId: "The selected category does not exist." },
    };
  }

  try {
    const resource = await createResourceRecord({
      categoryId: input.categoryId,
      name: nameCheck.value,
      description: descCheck.value,
      location: locationCheck.value,
      capacity: capacityCheck.value,
      isActive: input.isActive ?? true,
    });

    return { success: true, resource };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create resource.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function updateResource(
  input: UpdateResourceInput,
  currentUser: SafeUser | null
): Promise<ResourceActionResult> {
  if (!isAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required to edit resources.",
    };
  }

  if (!isValidUuid(input.id)) {
    return {
      success: false,
      error: "Invalid resource ID.",
    };
  }

  const fieldErrors: Record<string, string> = {};

  const nameCheck = validateRequiredText(input.name, "Resource name", 100);
  if (nameCheck.error) {
    fieldErrors.name = nameCheck.error;
  }

  const locationCheck = validateRequiredText(input.location, "Location", 150);
  if (locationCheck.error) {
    fieldErrors.location = locationCheck.error;
  }

  const descCheck = validateOptionalText(input.description, "Description", 2000);
  if (descCheck.error) {
    fieldErrors.description = descCheck.error;
  }

  const capacityCheck = parseCapacity(input.capacity);
  if (capacityCheck.error) {
    fieldErrors.capacity = capacityCheck.error;
  }

  if (!isValidUuid(input.categoryId)) {
    fieldErrors.categoryId = "A valid category must be selected.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstErrorMessage = Object.values(fieldErrors)[0];
    return {
      success: false,
      error: firstErrorMessage,
      fieldErrors,
    };
  }

  const existing = await findResourceByIdRecord(input.id);
  if (!existing) {
    return {
      success: false,
      error: "Resource not found.",
    };
  }

  const categoryExists = await findCategoryByIdRecord(input.categoryId);
  if (!categoryExists) {
    return {
      success: false,
      error: "The selected category does not exist.",
      fieldErrors: { categoryId: "The selected category does not exist." },
    };
  }

  try {
    const resource = await updateResourceRecord(input.id, {
      categoryId: input.categoryId,
      name: nameCheck.value,
      description: descCheck.value,
      location: locationCheck.value,
      capacity: capacityCheck.value,
    });

    return { success: true, resource };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update resource.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function setResourceStatus(
  input: SetResourceStatusInput,
  currentUser: SafeUser | null
): Promise<ResourceActionResult> {
  if (!isAdmin(currentUser)) {
    return {
      success: false,
      error: "Unauthorized: Administrator privileges are required to change resource status.",
    };
  }

  if (!isValidUuid(input.id)) {
    return {
      success: false,
      error: "Invalid resource ID.",
    };
  }

  try {
    const result = await setResourceActiveStatusRecord(input.id, input.isActive);

    if (result.deactivationBlockedReason) {
      return {
        success: false,
        error: result.deactivationBlockedReason,
        deactivationBlockedReason: result.deactivationBlockedReason,
        resource: result.resource,
      };
    }

    return {
      success: true,
      resource: result.resource,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update resource status.";
    return {
      success: false,
      error: message,
    };
  }
}
