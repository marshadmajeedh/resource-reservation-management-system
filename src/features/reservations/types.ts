/**
 * Reservation Domain Types
 * Defines data contracts for booking resources, status handling, and overlap prevention.
 */

export type ReservationStatus = "confirmed" | "cancelled";

export interface Reservation {
  id: string;
  resourceId: string;
  userId: string;
  title?: string;
  notes?: string;
  startTime: string; // ISO 8601 timestamp
  endTime: string;   // ISO 8601 timestamp
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationInput {
  resourceId: string;
  title?: string;
  notes?: string;
  startTime: string;
  endTime: string;
}

export interface ReservationConflictCheck {
  resourceId: string;
  startTime: string;
  endTime: string;
  excludeReservationId?: string;
}
