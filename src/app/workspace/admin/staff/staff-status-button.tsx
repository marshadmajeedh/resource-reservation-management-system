"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { setStaffStatusAction } from "@/features/staff/actions";
import type { StaffActionResult } from "@/features/staff/types";

interface StaffStatusButtonProps {
  staffId: string;
  staffName: string;
  staffEmail: string;
  isActive: boolean;
  activeBookingsCount: number;
}

export function StaffStatusButton({
  staffId,
  staffName,
  staffEmail,
  isActive,
  activeBookingsCount,
}: StaffStatusButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const [state, formAction, isPending] = useActionState<
    StaffActionResult,
    FormData
  >(async (prev, formData) => {
    const res = await setStaffStatusAction(prev, formData);
    if (res.success) {
      setShowConfirm(false);
    }
    return res;
  }, { success: false });

  if (isActive) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          id={`deactivate-staff-button-${staffId}`}
          onClick={() => setShowConfirm(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
        >
          Deactivate
        </button>

        {showConfirm && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`deactivate-modal-title-${staffId}`}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          >
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-left">
              {/* Header */}
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3
                    id={`deactivate-modal-title-${staffId}`}
                    className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
                  >
                    Confirm Staff Deactivation
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Target Member: <strong className="text-slate-800 dark:text-slate-200">{staffName}</strong> ({staffEmail})
                  </p>
                </div>
              </div>

              {/* Informational Alerts */}
              <div className="space-y-3 text-xs leading-relaxed">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                  <p>
                    <strong>Access Termination:</strong> Deactivation immediately revokes this account’s ability to sign in and invalidates active session tokens.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>
                      Active Reservations: {activeBookingsCount} upcoming/ongoing confirmed booking{activeBookingsCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p>
                    Deactivating this staff account will <strong>NOT</strong> silently cancel their bookings.
                    All reserved slots remain actively booked and reserved for their intended times until an administrator explicitly cancels them.
                  </p>
                  <div className="pt-1">
                    <Link
                      id={`view-staff-reservations-link-${staffId}`}
                      href={`/workspace/admin/reservations?userId=${staffId}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300 underline hover:text-amber-950 dark:hover:text-white"
                    >
                      <span>Review member’s bookings in Admin Reservations</span>
                      <span>↗</span>
                    </Link>
                  </div>
                </div>
              </div>

              {state?.error && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-red-700 dark:text-red-300 text-xs font-medium"
                >
                  {state.error}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  id={`cancel-deactivate-${staffId}`}
                  onClick={() => setShowConfirm(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <form action={formAction}>
                  <input type="hidden" name="id" value={staffId} />
                  <input type="hidden" name="isActive" value="false" />
                  <button
                    type="submit"
                    id={`confirm-deactivate-${staffId}`}
                    disabled={isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 transition-all shadow-sm cursor-pointer flex items-center gap-2"
                  >
                    {isPending && (
                      <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span>{isPending ? "Deactivating..." : "Yes, Deactivate Account"}</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="inline-block">
      <form action={formAction}>
        <input type="hidden" name="id" value={staffId} />
        <input type="hidden" name="isActive" value="true" />
        <button
          type="submit"
          id={`activate-staff-button-${staffId}`}
          disabled={isPending}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          {isPending && (
            <svg className="animate-spin h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          <span>{isPending ? "Activating..." : "Activate"}</span>
        </button>
      </form>
      {state?.error && (
        <span role="alert" className="block text-[11px] text-red-500 mt-1">
          {state.error}
        </span>
      )}
    </div>
  );
}
