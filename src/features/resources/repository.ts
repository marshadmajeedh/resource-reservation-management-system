import "server-only";
import db from "@/lib/db";
import type {
  Resource,
  ResourceCategory,
  ResourceFilterParams,
  PaginatedResources,
} from "./types";

/**
 * Resource & Category Repository
 * Pure database layer interacting with Prisma.
 *
 * Mandates:
 * 1. Explicit writable fields: never pass raw user-supplied objects to Prisma.
 * 2. Deterministic ordering and bounded pagination.
 * 3. Row-level locking on deactivation to prevent concurrency races.
 * 4. Preservation of IDs, creation timestamps, and reservation relations on edit.
 */

export async function listCategoriesRecord(): Promise<ResourceCategory[]> {
  const categories = await db.resourceCategory.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      _count: {
        select: { resources: true },
      },
    },
  });

  return categories as ResourceCategory[];
}

export async function findCategoryByIdRecord(
  id: string
): Promise<ResourceCategory | null> {
  const category = await db.resourceCategory.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: { resources: true },
      },
    },
  });

  return (category as ResourceCategory) || null;
}

export async function findCategoryByNameRecord(
  name: string
): Promise<ResourceCategory | null> {
  const category = await db.resourceCategory.findUnique({
    where: { name },
    select: {
      id: true,
      name: true,
    },
  });

  return (category as ResourceCategory) || null;
}

export async function createCategoryRecord(
  name: string
): Promise<ResourceCategory> {
  const category = await db.resourceCategory.create({
    data: { name },
    select: {
      id: true,
      name: true,
    },
  });

  return category as ResourceCategory;
}

export async function renameCategoryRecord(
  id: string,
  name: string
): Promise<ResourceCategory> {
  const category = await db.resourceCategory.update({
    where: { id },
    data: { name },
    select: {
      id: true,
      name: true,
      _count: {
        select: { resources: true },
      },
    },
  });

  return category as ResourceCategory;
}

export async function listResourcesRecord(
  params: ResourceFilterParams
): Promise<PaginatedResources> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(50, Math.max(1, params.pageSize || 12));
  const skip = (page - 1) * pageSize;

  const where: {
    isActive?: boolean;
    categoryId?: string;
    OR?: Array<{
      name?: { contains: string; mode: "insensitive" };
      location?: { contains: string; mode: "insensitive" };
    }>;
  } = {};

  if (params.status === "active") {
    where.isActive = true;
  } else if (params.status === "inactive") {
    where.isActive = false;
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (params.search && params.search.trim() !== "") {
    const term = params.search.trim();
    where.OR = [
      { name: { contains: term, mode: "insensitive" } },
      { location: { contains: term, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    db.resource.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        location: true,
        capacity: true,
        isActive: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.resource.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    items: items as Resource[],
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function findResourceByIdRecord(
  id: string
): Promise<Resource | null> {
  const resource = await db.resource.findUnique({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      location: true,
      capacity: true,
      isActive: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return (resource as Resource) || null;
}

export async function createResourceRecord(data: {
  categoryId: string;
  name: string;
  description: string | null;
  location: string;
  capacity: number | null;
  isActive: boolean;
}): Promise<Resource> {
  const resource = await db.resource.create({
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      location: data.location,
      capacity: data.capacity,
      isActive: data.isActive,
    },
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      location: true,
      capacity: true,
      isActive: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return resource as Resource;
}

export async function updateResourceRecord(
  id: string,
  data: {
    categoryId: string;
    name: string;
    description: string | null;
    location: string;
    capacity: number | null;
  }
): Promise<Resource> {
  const resource = await db.resource.update({
    where: { id },
    data: {
      categoryId: data.categoryId,
      name: data.name,
      description: data.description,
      location: data.location,
      capacity: data.capacity,
    },
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      location: true,
      capacity: true,
      isActive: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return resource as Resource;
}

export interface SetStatusResult {
  resource: Resource;
  deactivationBlockedReason?: string;
}

/**
 * Sets resource active status atomically.
 *
 * Concurrency & Locking Architecture:
 * 1. Takes an exclusive row lock (`FOR UPDATE`) on the resource row inside an interactive transaction.
 * 2. When deactivating (`desiredActiveState === false`):
 *    Queries reservations for any CONFIRMED reservations where endAt > now().
 *    If any ongoing or future confirmed reservations exist, deactivation is refused with a detailed message.
 *    Past and cancelled reservations do not block deactivation.
 * 3. Crucial Concurrency Rule:
 *    The future booking-creation transaction MUST take the exact same row lock (`SELECT ... FOR UPDATE`
 *    on the target resource row) before checking `is_active` and inserting a new reservation.
 *    Without this symmetric row lock on the booking side, a concurrent booking could insert between
 *    the reservation check and the status update. Holding the row lock here guarantees serialization.
 */
export async function setResourceActiveStatusRecord(
  resourceId: string,
  desiredActiveState: boolean
): Promise<SetStatusResult> {
  return await db.$transaction(async (tx) => {
    // 1. Parameterized row lock
    const lockedRows = await tx.$queryRaw<Array<{ id: string; is_active: boolean }>>`
      SELECT id, is_active FROM resources WHERE id = ${resourceId}::uuid FOR UPDATE
    `;

    if (!lockedRows || lockedRows.length === 0) {
      throw new Error("Resource not found.");
    }

    // 2. Reservation check on deactivation
    if (!desiredActiveState) {
      const now = new Date();

      const blockingReservations = await tx.reservation.findMany({
        where: {
          resourceId,
          status: "CONFIRMED",
          endAt: {
            gt: now,
          },
        },
        select: {
          id: true,
          purpose: true,
          startAt: true,
          endAt: true,
        },
        orderBy: {
          startAt: "asc",
        },
        take: 3,
      });

      if (blockingReservations.length > 0) {
        const totalBlocking = await tx.reservation.count({
          where: {
            resourceId,
            status: "CONFIRMED",
            endAt: {
              gt: now,
            },
          },
        });

        const currentResource = await tx.resource.findUniqueOrThrow({
          where: { id: resourceId },
          select: {
            id: true,
            categoryId: true,
            name: true,
            description: true,
            location: true,
            capacity: true,
            isActive: true,
            createdAt: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        const earliest = blockingReservations[0];
        const dateStr = earliest.startAt.toISOString().slice(0, 10);
        return {
          resource: currentResource as Resource,
          deactivationBlockedReason: `Cannot deactivate resource: there are ${totalBlocking} ongoing or upcoming confirmed reservation(s) (earliest: ${dateStr} - "${earliest.purpose}"). Please cancel or complete them first.`,
        };
      }
    }

    // 3. Update status explicitly
    const updated = await tx.resource.update({
      where: { id: resourceId },
      data: { isActive: desiredActiveState },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        location: true,
        capacity: true,
        isActive: true,
        createdAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return { resource: updated as Resource };
  });
}
