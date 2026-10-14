/**
 * Resource & Category Domain Types
 * Defines data contracts for categories and office resources.
 */

export interface ResourceCategory {
  id: string;
  name: string;
  _count?: {
    resources: number;
  };
}

export interface Resource {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  location: string;
  capacity: number | null;
  isActive: boolean;
  createdAt: Date;
  category?: {
    id: string;
    name: string;
  };
}

export interface CreateCategoryInput {
  name: string;
}

export interface RenameCategoryInput {
  id: string;
  name: string;
}

export interface CreateResourceInput {
  categoryId: string;
  name: string;
  description?: string | null;
  location: string;
  capacity?: number | string | null;
  isActive?: boolean;
}

export interface UpdateResourceInput {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  location: string;
  capacity?: number | string | null;
}

export interface SetResourceStatusInput {
  id: string;
  isActive: boolean;
}

export type ResourceStatusFilter = "all" | "active" | "inactive";

export interface ResourceFilterParams {
  search?: string;
  categoryId?: string;
  status?: ResourceStatusFilter;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResources {
  items: Resource[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ResourceActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  resource?: Resource;
  category?: ResourceCategory;
  deactivationBlockedReason?: string;
}
