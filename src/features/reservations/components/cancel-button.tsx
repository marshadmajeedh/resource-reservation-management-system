"use client";

import { useActionState, useState } from "react";
import { cancelReservationAction } from "@/features/reservations/actions";
import type { ReservationActionResult } from "@/features/reservations/types";

interface CancelButtonProps {
  reservationId: string;
  isOwner: boolean;
  isAdmin: boolean;
  resourceName: string;
}

export function CancelButton({
  reservationId,
  isOwner,
  isAdmin,
  resourceName,
}: CancelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");

  const [state, formAction, isPending] = useActionState<ReservationActionResult | null, FormData>(
    cancelReservationAction,
    null
  );

  const isCancellingOther = isAdmin && !isOwner;

  return (
    <div>
      {!isOpen ? (
        <button
          type="button"
          id={`open-cancel-dialog-${reservationId}`}
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Cancel Reservation</span>
        </button>
      ) : (
        <div
          role="region"
          aria-label="Confirm cancellation"
          className="p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-4"
        >
          <div>
            <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
              Confirm Cancellation
            </h4>
            <p className="mt-1 text-xs text-rose-800 dark:text-rose-300">
              Are you sure you want to cancel the reservation for <strong>{resourceName}</strong>?
              This action is permanent and will immediately release the reserved time slot for other staff.
            </p>
          </div>

          {state && !state.success && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/80 border border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100 text-xs"
            >
              {state.error}
            </div>
          )}

          {state?.success && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100 text-xs font-medium"
            >
              {state.alreadyCancelled
                ? "This reservation was already cancelled."
                : "Reservation successfully cancelled."}
            </div>
          )}

          {!state?.success && (
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="reservationId" value={reservationId} />

              <div>
                <label
                  htmlFor={`cancel-reason-${reservationId}`}
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {isCancellingOther
                    ? "Cancellation Reason (Required for Admin Cancellations) *"
                    : "Cancellation Reason (Optional)"}
                </label>
                <textarea
                  id={`cancel-reason-${reservationId}`}
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required={isCancellingOther}
                  rows={2}
                  maxLength={500}
                  placeholder={
                    isCancellingOther
                      ? "Specify the reason for administrative cancellation..."
                      : "Optional note explaining the cancellation..."
                  }
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
                {state?.fieldErrors?.reason && (
                  <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    {state.fieldErrors.reason}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  id={`confirm-cancel-button-${reservationId}`}
                  disabled={isPending || (isCancellingOther && reason.trim() === "")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                >
                  {isPending ? "Cancelling..." : "Yes, Cancel Reservation"}
                </button>
                <button
                  type="button"
                  id={`abort-cancel-button-${reservationId}`}
                  disabled={isPending}
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  Keep Reservation
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
