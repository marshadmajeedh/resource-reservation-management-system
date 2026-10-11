import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SafeUser } from "./types.ts";
import { SESSION_COOKIE_NAME } from "./cookies.ts";
import { verifySessionToken } from "./jwt.ts";
import { findUserRecordById } from "./repository.ts";

/**
 * Server-Side Data Access Layer (DAL) & Authorization Helpers.
 *
 * Security Mandates:
 * 1. Safe explicit user-field selection: passwordHash is strictly excluded.
 * 2. Real-Time Status Checks: On every protected request, user role and isActive status
 *    are verified against the database. Stale token roles are never trusted.
 * 3. Deactivated accounts immediately lose access on their very next request.
 * 4. Role changes take immediate effect.
 * 5. React `cache()` provides per-request deduplication during component rendering,
 *    preventing duplicate database queries without globally caching across requests or users.
 */

/**
 * Retrieves the currently authenticated user from the request session cookie and database.
 * Returns null if unauthenticated, token is invalid, or the user is inactive/not found.
 */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifySessionToken(token);
    if (!payload?.userId) {
      return null;
    }

    // Query database directly to verify real-time role and active status
    const user = await findUserRecordById(payload.userId);
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
});

/**
 * Enforces that a user is authenticated.
 * If unauthenticated or inactive, redirects to /login (or specified internal path).
 */
export async function requireUser(redirectTo = "/login"): Promise<SafeUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(redirectTo);
  }

  return user;
}

/**
 * Enforces that an authenticated user has the ADMIN role.
 * If not authenticated, redirects to /login.
 * If authenticated as STAFF, redirects to /workspace.
 */
export async function requireAdmin(
  forbiddenRedirect = "/workspace"
): Promise<SafeUser> {
  const user = await requireUser("/login");

  if (user.role !== "ADMIN") {
    redirect(forbiddenRedirect);
  }

  return user;
}
