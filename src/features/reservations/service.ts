import "server-only";
import type { SafeUser } from "@/features/auth/types";
import { isValidUuid, validateRequiredText } from "@/features/resources/service";
import {
  parseDateTimeInOfficeTz,
  OFFICE_TIMEZONE_LABEL,
} from "@/lib/timezone";
import {
  createReservationRecord,
  cancelReservationRecord,
  findReservationByIdRecord,
  listReservationsRecord,
  findOverlappingResourceIdsRecord,
  isExclusionConstraintViolation,
  OverlappingReservationError,
  ResourceDeactivatedError,
  ResourceNotFoundError,
  InvalidReservationTimeError,
  ReservationNotFoundError,
  ReservationFinishedError,
  CancellationReasonRequiredError,
} from "./repository";
import type {
  Reservation,
  CreateReservationInput,
  CancelReservationInput,
  ReservationFilterParams,
  PaginatedReservations,
  ReservationActionResult,
  AvailabilityCheckResult,
} from "./types";

function isActiveUser(user: SafeUser | null): boolean {
  return Boolean(user && user.isActive);
}

function isAdmin(user: SafeUser | null): boolean {
  return Boolean(user && user.role === "ADMIN" && user.isActive);
}

/**
 * Creates a reservation for the authenticated session user.
 *
 * Mandates:
 * 1. User ID is strictly derived from currentUser session.
 * 2. Resource must exist and be active.
 * 3. Purpose is required, trimmed, max 500 characters.
 * 4. Timestamps are parsed as Sri Lanka time into explicit UTC instants.
 * 5. Start must be in the future.
 * 6. End must be strictly greater than start.
 * 7. Row locking prevents concurrent deactivations or booking collisions.
 */
export async function createReservation(
  input: CreateReservationInput,
  currentUser: SafeUser | null
): Promise<ReservationActionResult> {
  if (!isActiveUser(currentUser) || !currentUser) {
    return {
      success: false,
      error: "Authentication required: Please sign in to create a reservation.",
    };
  }

  const fieldErrors: Record<string, string> = {};

  if (!isValidUuid(input.resourceId)) {
    fieldErrors.resourceId = "A valid resource must be selected.";
  }

  const purposeCheck = validateRequiredText(input.purpose, "Purpose", 500);
  if (purposeCheck.error) {
    fieldErrors.purpose = purposeCheck.error;
  }

  const startParsed = parseDateTimeInOfficeTz(input.startAtRaw);
  if (startParsed.error || !startParsed.date) {
    fieldErrors.startAt = startParsed.error || "Valid start date and time are required.";
  }

  const endParsed = parseDateTimeInOfficeTz(input.endAtRaw);
  if (endParsed.error || !endParsed.date) {
    fieldErrors.endAt = endParsed.error || "Valid end date and time are required.";
  }

  const now = new Date();

  if (startParsed.date && startParsed.date <= now) {
    fieldErrors.startAt = "Reservation start time must be in the future.";
  }

  if (startParsed.date && endParsed.date) {
    if (endParsed.date <= startParsed.date) {
      fieldErrors.endAt = "Reservation end time must be strictly later than start time.";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    const firstError = Object.values(fieldErrors)[0];
    return {
      success: false,
      error: firstError,
      fieldErrors,
    };
  }

  try {
    const reservation = await createReservationRecord({
      userId: currentUser.id,
      resourceId: input.resourceId,
      purpose: purposeCheck.value,
      startAt: startParsed.date!,
      endAt: endParsed.date!,
    });

    return {
      success: true,
      reservation,
    };
  } catch (err: unknown) {
    if (err instanceof OverlappingReservationError || isExclusionConstraintViolation(err)) {
      const conflictMsg =
        "This resource is already reserved for your selected time. Please choose another time or resource.";
      return {
        success: false,
        error: conflictMsg,
        conflictMessage: conflictMsg,
      };
    }

    if (err instanceof ResourceDeactivatedError) {
      return {
        success: false,
        error: err.message,
      };
    }

    if (err instanceof ResourceNotFoundError) {
      return {
        success: false,
        error: "Resource not found.",
      };
    }

    if (err instanceof InvalidReservationTimeError) {
      return {
        success: false,
        error: err.message,
      };
    }

    const message = err instanceof Error ? err.message : "Failed to create reservation.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Cancels a reservation by its owner or an administrator.
 */
export async function cancelReservation(
  input: CancelReservationInput,
  currentUser: SafeUser | null
): Promise<ReservationActionResult> {
  if (!isActiveUser(currentUser) || !currentUser) {
    return {
      success: false,
      error: "Authentication required: Please sign in to cancel reservations.",
    };
  }

  if (!isValidUuid(input.reservationId)) {
    return {
      success: false,
      error: "Invalid reservation ID.",
    };
  }

  try {
    const result = await cancelReservationRecord({
      reservationId: input.reservationId,
      cancellingUserId: currentUser.id,
      isAdmin: currentUser.role === "ADMIN",
      reason: input.reason || null,
    });

    return {
      success: true,
      reservation: result.reservation,
      alreadyCancelled: result.alreadyCancelled,
    };
  } catch (err: unknown) {
    if (err instanceof ReservationNotFoundError) {
      return {
        success: false,
        error: "Reservation not found.",
      };
    }

    if (err instanceof ReservationFinishedError) {
      return {
        success: false,
        error: "Finished reservations cannot be cancelled.",
      };
    }

    if (err instanceof CancellationReasonRequiredError) {
      return {
        success: false,
        error: err.message,
        fieldErrors: { reason: err.message },
      };
    }

    const message = err instanceof Error ? err.message : "Failed to cancel reservation.";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Retrieves a reservation by ID with strict ownership authorization checks.
 * Only the owner and administrators can view reservation details.
 */
export async function getReservationById(
  id: string,
  currentUser: SafeUser | null
): Promise<Reservation | null> {
  if (!isActiveUser(currentUser) || !currentUser) {
    return null;
  }

  if (!isValidUuid(id)) {
    return null;
  }

  const reservation = await findReservationByIdRecord(id);
  if (!reservation) {
    return null;
  }

  const isOwner = reservation.userId === currentUser.id;
  const userIsAdmin = currentUser.role === "ADMIN";

  if (!isOwner && !userIsAdmin) {
    // Defense-in-depth: do not leak existence of another user's reservation
    return null;
  }

  return reservation;
}

/**
 * Lists reservations owned by the current authenticated user.
 */
export async function listMyReservations(
  params: Omit<ReservationFilterParams, "userId">,
  currentUser: SafeUser | null
): Promise<PaginatedReservations> {
  if (!isActiveUser(currentUser) || !currentUser) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: params.pageSize || 10,
      totalPages: 1,
    };
  }

  return await listReservationsRecord({
    ...params,
    userId: currentUser.id,
  });
}

/**
 * Lists all reservations across the system (Administrator only).
 */
export async function listAllReservations(
  params: ReservationFilterParams,
  currentUser: SafeUser | null
): Promise<PaginatedReservations> {
  if (!isAdmin(currentUser)) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: params.pageSize || 10,
      totalPages: 1,
    };
  }

  return await listReservationsRecord(params);
}

/**
 * Validates a selected time range and returns availability for a list of resources.
 * Executes a single combined query to check overlaps across all requested resources.
 */
export async function checkResourcesAvailability(
  resourceIds: string[],
  startAtRaw: string,
  endAtRaw: string
): Promise<AvailabilityCheckResult> {
  if (!startAtRaw || !endAtRaw) {
    return {
      isValidRange: false,
      availabilityByResourceId: {},
    };
  }

  const startParsed = parseDateTimeInOfficeTz(startAtRaw);
  const endParsed = parseDateTimeInOfficeTz(endAtRaw);

  if (!startParsed.date || startParsed.error) {
    return {
      isValidRange: false,
      error: startParsed.error || `Invalid start date (${OFFICE_TIMEZONE_LABEL}).`,
      availabilityByResourceId: {},
    };
  }

  if (!endParsed.date || endParsed.error) {
    return {
      isValidRange: false,
      error: endParsed.error || `Invalid end date (${OFFICE_TIMEZONE_LABEL}).`,
      availabilityByResourceId: {},
    };
  }

  const now = new Date();
  if (startParsed.date <= now) {
    return {
      isValidRange: false,
      error: "Selected start time must be in the future.",
      availabilityByResourceId: {},
    };
  }

  if (endParsed.date <= startParsed.date) {
    return {
      isValidRange: false,
      error: "Selected end time must be strictly later than start time.",
      availabilityByResourceId: {},
    };
  }

  const overlappingSet = await findOverlappingResourceIdsRecord(
    resourceIds,
    startParsed.date,
    endParsed.date
  );

  const availabilityMap: Record<string, boolean> = {};
  for (const id of resourceIds) {
    availabilityMap[id] = !overlappingSet.has(id);
  }

  return {
    isValidRange: true,
    startAt: startParsed.date,
    endAt: endParsed.date,
    availabilityByResourceId: availabilityMap,
  };
}
