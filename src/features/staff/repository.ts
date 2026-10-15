import "server-only";
import db from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  StaffUser,
  StaffFilterParams,
  PaginatedStaff,
} from "./types";

/**
 * Custom Error Classes for Staff Domain Operations
 */
export class StaffNotFoundError extends Error {
  constructor(message = "Staff member not found.") {
    super(message);
    this.name = "StaffNotFoundError";
  }
}

export class DuplicateStaffEmailError extends Error {
  constructor(message = "An account with this email address already exists.") {
    super(message);
    this.name = "DuplicateStaffEmailError";
  }
}

export class AdminAccountModificationError extends Error {
  constructor(
    message = "Cannot modify administrative accounts through staff management."
  ) {
    super(message);
    this.name = "AdminAccountModificationError";
  }
}

/**
 * Explicit selection fields for Staff queries.
 * Strictly excludes passwordHash to guarantee zero credential leakage.
 */
function getStaffSelect(now: Date) {
  return {
    id: true,
    name: true,
    email: true,
    role: true,
    isActive: true,
    createdAt: true,
    _count: {
      select: {
        reservations: {
          where: {
            status: "CONFIRMED" as const,
            endAt: { gt: now },
          },
        },
      },
    },
  };
}

/**
 * Lists staff users with search, status filtering, bounded pagination, and deterministic ordering.
 * Strictly queries accounts with role = 'STAFF' only.
 */
export async function listStaffUsersRecord(
  params: StaffFilterParams,
  now: Date = new Date()
): Promise<PaginatedStaff> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize || 10));
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {
    role: "STAFF",
  };

  if (params.search && params.search.trim() !== "") {
    const searchTrimmed = params.search.trim();
    where.OR = [
      { name: { contains: searchTrimmed, mode: "insensitive" } },
      { email: { contains: searchTrimmed, mode: "insensitive" } },
    ];
  }

  if (params.status === "active") {
    where.isActive = true;
  } else if (params.status === "inactive") {
    where.isActive = false;
  }

  const [items, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: getStaffSelect(now),
    }),
    db.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  const mappedItems: StaffUser[] = items.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: "STAFF",
    isActive: u.isActive,
    createdAt: u.createdAt,
    activeBookingsCount: u._count.reservations,
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
 * Finds a safe staff user by ID.
 * Returns null if the user does not exist or has the ADMIN role.
 */
export async function findStaffUserByIdRecord(
  id: string,
  now: Date = new Date()
): Promise<StaffUser | null> {
  const user = await db.user.findFirst({
    where: {
      id,
      role: "STAFF",
    },
    select: getStaffSelect(now),
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: "STAFF",
    isActive: user.isActive,
    createdAt: user.createdAt,
    activeBookingsCount: user._count.reservations,
  };
}

/**
 * Creates a new STAFF user record with a pre-computed password hash.
 * Role is strictly locked to STAFF and isActive is set to true.
 * Handles duplicate normalized email errors gracefully.
 */
export async function createStaffUserRecord(
  params: { name: string; email: string; passwordHash: string }
): Promise<StaffUser> {
  try {
    const user = await db.user.create({
      data: {
        name: params.name,
        email: params.email,
        passwordHash: params.passwordHash,
        role: "STAFF",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "STAFF",
      isActive: user.isActive,
      createdAt: user.createdAt,
      activeBookingsCount: 0,
    };
  } catch (err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new DuplicateStaffEmailError();
    }
    throw err;
  }
}

/**
 * Updates a staff member's name.
 * Strictly verifies that the target account is a STAFF account.
 * Rejects any attempts to modify ADMIN accounts.
 */
export async function updateStaffNameRecord(
  id: string,
  name: string,
  now: Date = new Date()
): Promise<StaffUser> {
  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!existing) {
    throw new StaffNotFoundError();
  }

  if (existing.role === "ADMIN") {
    throw new AdminAccountModificationError();
  }

  const updated = await db.user.update({
    where: { id },
    data: { name },
    select: getStaffSelect(now),
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: "STAFF",
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    activeBookingsCount: updated._count.reservations,
  };
}

/**
 * Sets explicit active status for a staff account.
 * Strictly rejects modification of ADMIN accounts.
 * Preserves all account history and reservation associations without modification.
 */
export async function setStaffActiveStatusRecord(
  id: string,
  isActive: boolean,
  now: Date = new Date()
): Promise<StaffUser> {
  const existing = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!existing) {
    throw new StaffNotFoundError();
  }

  if (existing.role === "ADMIN") {
    throw new AdminAccountModificationError();
  }

  const updated = await db.user.update({
    where: { id },
    data: { isActive },
    select: getStaffSelect(now),
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: "STAFF",
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    activeBookingsCount: updated._count.reservations,
  };
}

/**
 * Counts upcoming and ongoing confirmed reservations owned by a specific user.
 */
export async function countActiveBookingsForUser(
  userId: string,
  now: Date = new Date()
): Promise<number> {
  return await db.reservation.count({
    where: {
      userId,
      status: "CONFIRMED",
      endAt: { gt: now },
    },
  });
}
