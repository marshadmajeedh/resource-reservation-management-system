"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { validateMutationOrigin } from "@/features/auth/csrf";
import { getCurrentUser } from "@/features/auth/dal";
import { createReservation, cancelReservation } from "./service";
import type { ReservationActionResult } from "./types";

/**
 * Validates CSRF origin and authenticated session caller.
 */
async function verifyMutationCaller(): Promise<{
  error?: string;
  user: Awaited<ReturnType<typeof getCurrentUser>>;
}> {
  const reqHeaders = await headers();
  if (!validateMutationOrigin(reqHeaders)) {
    return { error: "Cross-origin request rejected.", user: null };
  }

  const user = await getCurrentUser();
  if (!user || !user.isActive) {
    return {
      error: "Authentication required: Please sign in to perform this operation.",
      user: null,
    };
  }

  return { user };
}

/**
 * Server action to create a reservation.
 */
export async function createReservationAction(
  _prevState: ReservationActionResult | null,
  formData: FormData
): Promise<ReservationActionResult> {
  const { error, user } = await verifyMutationCaller();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const resourceId = formData.get("resourceId");
  const purpose = formData.get("purpose");
  const startAtRaw = formData.get("startAt");
  const endAtRaw = formData.get("endAt");

  const result = await createReservation(
    {
      resourceId: typeof resourceId === "string" ? resourceId : "",
      purpose: typeof purpose === "string" ? purpose : "",
      startAtRaw: typeof startAtRaw === "string" ? startAtRaw : "",
      endAtRaw: typeof endAtRaw === "string" ? endAtRaw : "",
    },
    user
  );

  if (result.success && result.reservation) {
    revalidatePath("/workspace/reservations");
    revalidatePath("/workspace/resources");
    revalidatePath(`/workspace/resources/${result.reservation.resourceId}`);
    revalidatePath("/workspace/admin/reservations");
  }

  return result;
}

/**
 * Server action to cancel a reservation.
 */
export async function cancelReservationAction(
  _prevState: ReservationActionResult | null,
  formData: FormData
): Promise<ReservationActionResult> {
  const { error, user } = await verifyMutationCaller();
  if (error || !user) {
    return { success: false, error: error || "Unauthorized." };
  }

  const reservationId = formData.get("reservationId");
  const reason = formData.get("reason");

  const result = await cancelReservation(
    {
      reservationId: typeof reservationId === "string" ? reservationId : "",
      reason: typeof reason === "string" ? reason : undefined,
    },
    user
  );

  if (result.success && result.reservation) {
    revalidatePath("/workspace/reservations");
    revalidatePath(`/workspace/reservations/${result.reservation.id}`);
    revalidatePath("/workspace/admin/reservations");
    revalidatePath(`/workspace/resources/${result.reservation.resourceId}`);
    revalidatePath("/workspace/resources");
  }

  return result;
}
