import type { SafeUser, UserDbRecord } from "./types.ts";
import { db } from "@/lib/db";

/**
 * User Database Repository.
 *
 * Production data layer using Prisma Client.
 *
 * Security Mandates:
 * 1. SafeUser queries explicitly omit passwordHash at the projection level.
 * 2. Raw password hashes are strictly confined to internal auth verification.
 */

/**
 * Finds an internal user record by email, including passwordHash for verification.
 */
export async function findUserRecordByEmail(
  email: string
): Promise<UserDbRecord | null> {
  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

/**
 * Finds a safe user representation by user ID.
 * Explicitly excludes passwordHash from selection.
 */
export async function findUserRecordById(
  id: string
): Promise<SafeUser | null> {
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

/**
 * Creates an administrative user record.
 */
export async function createAdminUserRecord(
  params: { name: string; email: string; passwordHash: string }
): Promise<SafeUser> {
  const user = await db.user.create({
    data: {
      name: params.name,
      email: params.email,
      passwordHash: params.passwordHash,
      role: "ADMIN",
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
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
