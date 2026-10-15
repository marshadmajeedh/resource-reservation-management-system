import "server-only";
import db from "@/lib/db";
import { deriveReservationTemporalStatus } from "@/lib/timezone";
import type {
  Reservation,
  ReservationFilterParams,
  PaginatedReservations,
} from "./types";

/**
 * Custom Error Classes for Reservation Domain Operations
 */
export class ResourceNotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "ResourceNotFoundError";
  }
}

export class ResourceDeactivatedError extends Error {
  constructor(message = "Cannot reserve this resource because it has been deactivated.") {
    super(message);
    this.name = "ResourceDeactivatedError";
  }
}

export class InvalidReservationTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidReservationTimeError";
  }
}

export class OverlappingReservationError extends Error {
  constructor(
    message = "This resource is already reserved for your selected time. Please choose another time or resource."
  ) {
    super(message);
    this.name = "OverlappingReservationError";
  }
}

export class ReservationNotFoundError extends Error {
  constructor(message = "Reservation not found.") {
    super(message);
    this.name = "ReservationNotFoundError";
  }
}

export class ReservationFinishedError extends Error {
  constructor(message = "Finished reservations cannot be cancelled.") {
    super(message);
    this.name = "ReservationFinishedError";
  }
}

export class CancellationReasonRequiredError extends Error {
  constructor(
    message = "A cancellation reason is required when cancelling another user's reservation."
  ) {
    super(message);
    this.name = "CancellationReasonRequiredError";
  }
}

const EXCLUSION_CONSTRAINT_NAME = "reservations_no_overlapping_confirmed";
const PG_EXCLUSION_SQLSTATE = "23P01";

/**
 * Detects PostgreSQL GiST exclusion constraint (23P01) violations specifically for
 * the overlapping confirmed reservations constraint ('reservations_no_overlapping_confirmed').
 *
 * Rules:
 * 1. Requires PostgreSQL SQLSTATE 23P01. Unrelated database errors (e.g., 23503 foreign key,
 *    23505 unique, 23514 check constraints) strictly return false.
 * 2. Matches the exact constraint name 'reservations_no_overlapping_confirmed' via structured
 *    driver properties (e.g. raw pg `err.constraint`) or driver message inspection.
 * 3. Driver adapter fallback: In Prisma 7 with @prisma/adapter-pg, the driver adapter translates
 *    the postgres error into PrismaClientKnownRequestError (code P2039) where cause.code is '23P01'.
 *    If a driver omits the constraint name property, we support a narrowly scoped fallback:
 *    SQLSTATE 23P01 scoped to modelName === 'Reservation' at the reservation insert boundary,
 *    where 'reservations_no_overlapping_confirmed' is the only exclusion constraint in the schema.
 * 4. Generic string matching on "exclusion constraint" is prohibited.
 */
export function isExclusionConstraintViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const errorObj = err as {
    code?: string;
    message?: string;
    constraint?: string;
    meta?: {
      code?: string;
      modelName?: string;
      target?: string[];
      driverAdapterError?: {
        cause?: {
          code?: string;
          originalCode?: string;
          message?: string;
          originalMessage?: string;
          constraint?: string | { name?: string; index?: string };
        };
      };
    };
  };

  const cause = errorObj.meta?.driverAdapterError?.cause;

  // 1. Verify PostgreSQL SQLSTATE is 23P01 (exclusion_violation)
  const is23P01 =
    errorObj.code === PG_EXCLUSION_SQLSTATE ||
    cause?.code === PG_EXCLUSION_SQLSTATE ||
    cause?.originalCode === PG_EXCLUSION_SQLSTATE ||
    errorObj.meta?.code === PG_EXCLUSION_SQLSTATE ||
    (typeof errorObj.message === "string" &&
      errorObj.message.includes(`Code: \`${PG_EXCLUSION_SQLSTATE}\``));

  if (!is23P01) {
    return false;
  }

  // 2. Check for exact constraint name in structured fields
  const structuredConstraint =
    errorObj.constraint ||
    (typeof cause?.constraint === "string"
      ? cause.constraint
      : cause?.constraint?.name || cause?.constraint?.index);

  if (structuredConstraint === EXCLUSION_CONSTRAINT_NAME) {
    return true;
  }

  // Check exact constraint name in driver cause message or Prisma formatted message
  const causeMsg = cause?.originalMessage || cause?.message || "";
  const mainMsg = errorObj.message || "";
  if (
    causeMsg.includes(EXCLUSION_CONSTRAINT_NAME) ||
    mainMsg.includes(EXCLUSION_CONSTRAINT_NAME)
  ) {
    return true;
  }

  // 3. Narrowly scoped fallback at reservation insert boundary:
  // If the driver adapter omits the constraint name entirely, accept SQLSTATE 23P01
  // if and only if the error originates from the 'Reservation' model.
  if (errorObj.meta?.modelName === "Reservation") {
    return true;
  }

  return false;
}

const reservationSelectFields = {
  id: true,
  userId: true,
  resourceId: true,
  purpose: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
  cancelledAt: true,
  cancelledById: true,
  cancellationReason: true,
  resource: {
    select: {
      id: true,
      name: true,
      location: true,
      capacity: true,
      isActive: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  cancelledBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

/**
 * Creates a reservation inside a short database transaction with row-level locking.
 *
 * Sequence:
 * 1. Acquire the exact same FOR UPDATE lock on the resource row as used in resource deactivation.
 * 2. Verify resource exists and is active.
 * 3. Verify startAt is still in the future.
 * 4. Check for overlapping CONFIRMED reservations on the same resource.
 * 5. Insert reservation as CONFIRMED with empty cancellation metadata.
 * 6. Commit before reporting success.
 */
export async function createReservationRecord(params: {
  userId: string;
  resourceId: string;
  purpose: string;
  startAt: Date;
  endAt: Date;
}): Promise<Reservation> {
  return await db.$transaction(async (tx) => {
    // 1. Parameterized row lock on target resource
    const lockedRows = await tx.$queryRaw<Array<{ id: string; is_active: boolean }>>`
      SELECT id, is_active FROM resources WHERE id = ${params.resourceId}::uuid FOR UPDATE
    `;

    if (!lockedRows || lockedRows.length === 0) {
      throw new ResourceNotFoundError("Resource not found.");
    }

    // 2. Resource must be active
    if (!lockedRows[0].is_active) {
      throw new ResourceDeactivatedError("Cannot reserve this resource because it has been deactivated.");
    }

    // 3. Revalidate timestamps
    const now = new Date();
    if (params.startAt <= now) {
      throw new InvalidReservationTimeError("Reservation start time must be in the future.");
    }
    if (params.endAt <= params.startAt) {
      throw new InvalidReservationTimeError("Reservation end time must be strictly later than start time.");
    }

    // 4. Overlap pre-check for friendly conflict message
    const overlap = await tx.reservation.findFirst({
      where: {
        resourceId: params.resourceId,
        status: "CONFIRMED",
        startAt: { lt: params.endAt },
        endAt: { gt: params.startAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new OverlappingReservationError(
        "This resource is already reserved for your selected time. Please choose another time or resource."
      );
    }

    // 5. Insert CONFIRMED reservation with null cancellation metadata
    const created = await tx.reservation.create({
      data: {
        userId: params.userId,
        resourceId: params.resourceId,
        purpose: params.purpose,
        startAt: params.startAt,
        endAt: params.endAt,
        status: "CONFIRMED",
        cancelledAt: null,
        cancelledById: null,
        cancellationReason: null,
      },
      select: reservationSelectFields,
    });

    const reservation = created as unknown as Reservation;
    reservation.temporalStatus = deriveReservationTemporalStatus(
      reservation.status,
      reservation.startAt,
      reservation.endAt,
      now
    );

    return reservation;
  });
}

export interface CancellationResult {
  reservation: Reservation;
  alreadyCancelled: boolean;
}

/**
 * Atomically cancels a reservation with consistent locking order.
 *
 * Sequence:
 * 1. Find reservation target and check caller authorization.
 * 2. Lock the resource row FIRST, then the reservation row SECOND (consistent lock ordering reduces deadlock risk).
 * 3. If already cancelled, return existing cancellation metadata without overwriting.
 * 4. If finished, refuse cancellation.
 * 5. If admin cancelling another user's reservation, require non-empty reason.
 * 6. Atomically update status, cancelledAt, cancelledById, cancellationReason.
 */
export async function cancelReservationRecord(params: {
  reservationId: string;
  cancellingUserId: string;
  isAdmin: boolean;
  reason: string | null;
}): Promise<CancellationResult> {
  return await db.$transaction(async (tx) => {
    // Check existence and ownership before acquiring row locks
    const target = await tx.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, resourceId: true, userId: true },
    });

    if (!target) {
      throw new ReservationNotFoundError("Reservation not found.");
    }

    // Defense-in-depth: non-admins cannot cancel someone else's reservation
    if (target.userId !== params.cancellingUserId && !params.isAdmin) {
      throw new ReservationNotFoundError("Reservation not found.");
    }

    // 1. Lock resource row FIRST
    await tx.$queryRaw`
      SELECT id FROM resources WHERE id = ${target.resourceId}::uuid FOR UPDATE
    `;

    // 2. Lock reservation row SECOND
    const lockedReservationRows = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        user_id: string;
        start_at: Date;
        end_at: Date;
        cancelled_at: Date | null;
        cancelled_by_id: string | null;
        cancellation_reason: string | null;
      }>
    >`
      SELECT id, status, user_id, start_at, end_at, cancelled_at, cancelled_by_id, cancellation_reason
      FROM reservations
      WHERE id = ${params.reservationId}::uuid FOR UPDATE
    `;

    if (!lockedReservationRows || lockedReservationRows.length === 0) {
      throw new ReservationNotFoundError("Reservation not found.");
    }

    const current = lockedReservationRows[0];

    // Repeated/concurrent cancellations: return original cancellation state without overwriting
    if (current.status === "CANCELLED") {
      const existing = await tx.reservation.findUniqueOrThrow({
        where: { id: params.reservationId },
        select: reservationSelectFields,
      });
      const res = existing as unknown as Reservation;
      res.temporalStatus = "CANCELLED";
      return { reservation: res, alreadyCancelled: true };
    }

    const now = new Date();

    // Finished reservations cannot be cancelled retroactively
    if (new Date(current.end_at) <= now) {
      throw new ReservationFinishedError("Finished reservations cannot be cancelled.");
    }

    // Reason requirement for admin cancelling another user's reservation
    const isOwner = current.user_id === params.cancellingUserId;
    if (!isOwner && (!params.reason || params.reason.trim() === "")) {
      throw new CancellationReasonRequiredError(
        "A cancellation reason is required when cancelling another user's reservation."
      );
    }

    // Atomic update preserving original start/end times
    const updated = await tx.reservation.update({
      where: { id: params.reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        cancelledById: params.cancellingUserId,
        cancellationReason: params.reason ? params.reason.trim() : null,
      },
      select: reservationSelectFields,
    });

    const reservation = updated as unknown as Reservation;
    reservation.temporalStatus = "CANCELLED";

    return { reservation, alreadyCancelled: false };
  });
}

/**
 * Retrieves a single reservation by ID.
 */
export async function findReservationByIdRecord(id: string): Promise<Reservation | null> {
  const reservation = await db.reservation.findUnique({
    where: { id },
    select: reservationSelectFields,
  });

  if (!reservation) return null;

  const res = reservation as unknown as Reservation;
  res.temporalStatus = deriveReservationTemporalStatus(res.status, res.startAt, res.endAt);
  return res;
}

/**
 * Lists reservations with bounded pagination and deterministic ordering.
 */
export async function listReservationsRecord(
  params: ReservationFilterParams,
  now: Date = new Date()
): Promise<PaginatedReservations> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize || 10));
  const skip = (page - 1) * pageSize;

  const where: {
    userId?: string;
    resourceId?: string;
    status?: "CONFIRMED" | "CANCELLED";
    startAt?: { gt?: Date; lte?: Date };
    endAt?: { gt?: Date; lte?: Date };
  } = {};

  if (params.userId) {
    where.userId = params.userId;
  }
  if (params.resourceId) {
    where.resourceId = params.resourceId;
  }

  let orderBy: Array<Record<string, "asc" | "desc">> = [{ startAt: "desc" }, { id: "desc" }];

  if (params.statusFilter === "upcoming") {
    where.status = "CONFIRMED";
    where.startAt = { gt: now };
    orderBy = [{ startAt: "asc" }, { id: "asc" }];
  } else if (params.statusFilter === "in_progress") {
    where.status = "CONFIRMED";
    where.startAt = { lte: now };
    where.endAt = { gt: now };
    orderBy = [{ startAt: "asc" }, { id: "asc" }];
  } else if (params.statusFilter === "finished") {
    where.status = "CONFIRMED";
    where.endAt = { lte: now };
    orderBy = [{ startAt: "desc" }, { id: "desc" }];
  } else if (params.statusFilter === "cancelled") {
    where.status = "CANCELLED";
    orderBy = [{ cancelledAt: "desc" }, { id: "desc" }];
  }

  const [items, total] = await Promise.all([
    db.reservation.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      select: reservationSelectFields,
    }),
    db.reservation.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const mappedItems = (items as unknown as Reservation[]).map((item) => ({
    ...item,
    temporalStatus: deriveReservationTemporalStatus(item.status, item.startAt, item.endAt, now),
  }));

  return {
    items: mappedItems,
    total,
    page,
    pageSize,
    totalPages,
  };
}

/**
 * Checks which of the provided resource IDs have overlapping CONFIRMED reservations.
 * Executes a single bounded query rather than 1 query per resource.
 */
export async function findOverlappingResourceIdsRecord(
  resourceIds: string[],
  startAt: Date,
  endAt: Date
): Promise<Set<string>> {
  if (resourceIds.length === 0) {
    return new Set();
  }

  const overlapping = await db.reservation.findMany({
    where: {
      resourceId: { in: resourceIds },
      status: "CONFIRMED",
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { resourceId: true },
    distinct: ["resourceId"],
  });

  return new Set(overlapping.map((r) => r.resourceId));
}
