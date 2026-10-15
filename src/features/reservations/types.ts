import type { ReservationTemporalStatus } from "@/lib/timezone";

/**
 * Reservation Domain Types
 * Contracts for reservations, availability checks, queries, and mutations.
 */

export type ReservationStatus = "CONFIRMED" | "CANCELLED";
export type { ReservationTemporalStatus };

export interface ReservationUserSummary {
  id: string;
  name: string;
  email: string;
}

export interface ReservationResourceSummary {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  isActive: boolean;
  category?: {
    id?: string;
    name: string;
  };
}

export interface Reservation {
  id: string;
  userId: string;
  resourceId: string;
  purpose: string;
  startAt: Date;
  endAt: Date;
  status: ReservationStatus;
  createdAt: Date;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancellationReason: string | null;
  resource?: ReservationResourceSummary;
  user?: ReservationUserSummary;
  cancelledBy?: ReservationUserSummary | null;
  temporalStatus?: ReservationTemporalStatus;
}

export interface CreateReservationInput {
  resourceId: string;
  purpose: string;
  startAtRaw: string; // Datetime string in Sri Lanka time (Asia/Colombo)
  endAtRaw: string;   // Datetime string in Sri Lanka time (Asia/Colombo)
}

export interface CancelReservationInput {
  reservationId: string;
  reason?: string;
}

export type ReservationStatusFilter = "all" | "upcoming" | "in_progress" | "finished" | "cancelled";

export interface ReservationFilterParams {
  userId?: string;
  resourceId?: string;
  statusFilter?: ReservationStatusFilter;
  page?: number;
  pageSize?: number;
}

export interface PaginatedReservations {
  items: Reservation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ReservationActionResult {
  success: boolean;
  error?: string;
  conflictMessage?: string;
  fieldErrors?: Record<string, string>;
  reservation?: Reservation;
  alreadyCancelled?: boolean;
}

export interface ResourceAvailabilityItem {
  resourceId: string;
  isAvailable: boolean;
}

export interface AvailabilityCheckResult {
  isValidRange: boolean;
  startAt?: Date;
  endAt?: Date;
  error?: string;
  availabilityByResourceId: Record<string, boolean>;
}
