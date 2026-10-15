"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createReservationAction } from "@/features/reservations/actions";
import type { ReservationActionResult } from "@/features/reservations/types";
import { OFFICE_TIMEZONE_LABEL, formatDateTimeInOfficeTz } from "@/lib/timezone";

interface BookingFormProps {
  resourceId: string;
  resourceName: string;
  resourceLocation: string;
  resourceCapacity: number | null;
  isActive: boolean;
  initialStart?: string;
  initialEnd?: string;
}

export function BookingForm({
  resourceId,
  resourceName,
  resourceLocation,
  resourceCapacity,
  isActive,
  initialStart = "",
  initialEnd = "",
}: BookingFormProps) {
  const [purpose, setPurpose] = useState("");
  const [startAt, setStartAt] = useState(initialStart);
  const [endAt, setEndAt] = useState(initialEnd);

  const [state, formAction, isPending] = useActionState<ReservationActionResult | null, FormData>(
    createReservationAction,
    null
  );

  if (!isActive) {
    return (
      <div className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          Resource Unavailable for Reservation
        </h3>
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          This resource is currently deactivated. It cannot be booked until reactivated by an administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Reserve {resourceName}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Location: <strong>{resourceLocation}</strong>
          {resourceCapacity ? ` • Capacity: up to ${resourceCapacity} people` : ""} • Evaluated in <strong>{OFFICE_TIMEZONE_LABEL}</strong>.
        </p>
      </div>

      {/* Success Banner */}
      {state?.success && state.reservation && (
        <div
          role="status"
          id="booking-success-banner"
          className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              ✓
            </div>
            <h3 className="font-bold text-sm">
              Reservation Confirmed!
            </h3>
          </div>

          <div className="text-xs space-y-1 text-emerald-800 dark:text-emerald-300 pl-8">
            <p>
              <strong>Resource:</strong> {resourceName} ({resourceLocation})
            </p>
            <p>
              <strong>Time (Sri Lanka):</strong> {formatDateTimeInOfficeTz(state.reservation.startAt)} – {formatDateTimeInOfficeTz(state.reservation.endAt)}
            </p>
            <p>
              <strong>Purpose:</strong> {state.reservation.purpose}
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2 pl-8">
            <Link
              href={`/workspace/reservations/${state.reservation.id}`}
              id="view-created-booking-link"
              className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20"
            >
              View Booking Details →
            </Link>
            <Link
              href="/workspace/reservations"
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              Go to My Reservations
            </Link>
          </div>
        </div>
      )}

      {/* Conflict / Overlap Banner */}
      {state?.conflictMessage && (
        <div
          role="alert"
          id="booking-conflict-banner"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3"
        >
          <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-1">
            <p className="font-bold">Reservation Conflict</p>
            <p className="leading-relaxed">{state.conflictMessage}</p>
          </div>
        </div>
      )}

      {/* General Error Banner */}
      {state && !state.success && !state.conflictMessage && state.error && (
        <div
          role="alert"
          id="booking-error-banner"
          className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3"
        >
          <svg className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="space-y-1">
            <p className="font-bold">Booking Request Failed</p>
            <p className="leading-relaxed">{state.error}</p>
          </div>
        </div>
      )}

      {/* Booking Form */}
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="resourceId" value={resourceId} />

        {/* Start and End Times */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="booking-start"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Start Time (Sri Lanka Time) *
            </label>
            <input
              id="booking-start"
              type="datetime-local"
              name="startAt"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
              aria-describedby="timezone-note start-error"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {state?.fieldErrors?.startAt && (
              <p id="start-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {state.fieldErrors.startAt}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="booking-end"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              End Time (Sri Lanka Time) *
            </label>
            <input
              id="booking-end"
              type="datetime-local"
              name="endAt"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
              aria-describedby="timezone-note end-error"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {state?.fieldErrors?.endAt && (
              <p id="end-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
                {state.fieldErrors.endAt}
              </p>
            )}
          </div>
        </div>

        <p id="timezone-note" className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Times are strictly parsed in <strong>{OFFICE_TIMEZONE_LABEL}</strong>. Any duration and overnight bookings are supported.</span>
        </p>

        {/* Purpose */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="booking-purpose"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Reservation Purpose *
            </label>
            <span className="text-[11px] text-slate-400">
              {purpose.length}/500 chars
            </span>
          </div>
          <textarea
            id="booking-purpose"
            name="purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            maxLength={500}
            rows={3}
            placeholder="Describe the meeting, project activity, or event (e.g. Q4 Strategy Review with Engineering leads)..."
            aria-describedby="purpose-error"
            className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          {state?.fieldErrors?.purpose && (
            <p id="purpose-error" className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {state.fieldErrors.purpose}
            </p>
          )}
        </div>

        {/* Submit Button & Notice */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <p className="text-[11px] text-slate-500 max-w-sm">
            Availability is re-checked with row-level transaction locks upon submission to guarantee conflict-free booking.
          </p>

          <button
            type="submit"
            id="submit-booking-button"
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            {isPending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Processing Reservation...</span>
              </>
            ) : (
              <span>Confirm & Reserve Resource</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
