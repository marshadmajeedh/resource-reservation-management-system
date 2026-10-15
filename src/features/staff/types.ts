/**
 * Staff Management Domain Types.
 *
 * Security Mandates:
 * 1. Safe StaffUser representation strictly omits `passwordHash` and plaintext credentials.
 * 2. Role is strictly immutable and locked to "STAFF".
 * 3. Active bookings count reflects upcoming and ongoing confirmed reservations owned by the staff member.
 */

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "STAFF";
  isActive: boolean;
  createdAt: Date | string;
  activeBookingsCount: number;
}

export type StaffStatusFilter = "all" | "active" | "inactive";

export interface StaffFilterParams {
  search?: string;
  status?: StaffStatusFilter;
  page?: number;
  pageSize?: number;
}

export interface PaginatedStaff {
  items: StaffUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  // Any role passed by client must be ignored / forbidden
  role?: string;
}

export interface UpdateStaffNameInput {
  id: string;
  name: string;
}

export interface SetStaffStatusInput {
  id: string;
  isActive: boolean;
}

export interface StaffActionResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  staff?: StaffUser;
}
