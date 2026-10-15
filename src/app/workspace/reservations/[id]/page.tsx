import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/dal";
import { getReservationById } from "@/features/reservations/service";
import { CancelButton } from "@/features/reservations/components/cancel-button";
import { WorkspaceNav } from "@/components/workspace-nav";
import {
  OFFICE_TIMEZONE_LABEL,
  formatDateTimeInOfficeTz,
} from "@/lib/timezone";

export const instant = false;

interface ReservationDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: ReservationDetailPageProps) {
  await params;
  return {
    title: "Booking Details - Reserve",
    description: "Detailed view of reservation intervals, resource allocations, and cancellation status.",
  };
}

export default async function ReservationDetailPage({
  params,
}: ReservationDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;

  // Enforces ownership or admin role on the server; returns null if unauthorized or nonexistent
  const reservation = await getReservationById(id, user);

  if (!reservation) {
    notFound();
  }

  const isAdmin = user.role === "ADMIN";
  const isOwner = reservation.userId === user.id;
  const isCancelled = reservation.status === "CANCELLED";
  const temporal = reservation.temporalStatus;
  const isFinished = temporal === "FINISHED";
  const canCancel = !isCancelled && !isFinished && (isOwner || isAdmin);

  let badgeStyle = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
  let badgeText = "Finished";

  if (isCancelled) {
    badgeStyle = "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    badgeText = "Cancelled";
  } else if (temporal === "UPCOMING") {
    badgeStyle = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    badgeText = "Upcoming";
  } else if (temporal === "IN_PROGRESS") {
    badgeStyle = "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800 animate-pulse";
    badgeText = "In Progress";
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            href="/workspace/reservations"
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            My Bookings
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-medium truncate">
            {reservation.resource?.name ?? "Booking"}
          </span>
        </nav>

        {/* Resource Inactive Notice (History remains readable) */}
        {reservation.resource && !reservation.resource.isActive && (
          <div
            role="status"
            className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>
                <strong>Facility Inactive:</strong> The resource &ldquo;{reservation.resource.name}&rdquo; is currently deactivated, but your reservation history remains accessible.
              </span>
            </div>
            {isAdmin && (
              <Link
                href={`/workspace/admin/resources/${reservation.resource.id}/edit`}
                className="font-semibold underline shrink-0 hover:text-amber-700"
              >
                Configure
              </Link>
            )}
          </div>
        )}

        {/* Header Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
                  {badgeText}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {reservation.resource?.category?.name ?? "General"}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {reservation.resource?.name ?? "Resource Booking"}
              </h1>

              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{reservation.resource?.location ?? "Office Facility"}</span>
                {reservation.resource?.capacity && (
                  <span>• Capacity: {reservation.resource.capacity} people</span>
                )}
              </p>
            </div>

            {canCancel && (
              <div className="shrink-0">
                <CancelButton
                  reservationId={reservation.id}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  resourceName={reservation.resource?.name ?? "Resource"}
                />
              </div>
            )}
          </div>

          {/* Time Interval & Booking Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Start Time ({OFFICE_TIMEZONE_LABEL})
              </span>
              <p id="reservation-start-time" className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                {formatDateTimeInOfficeTz(reservation.startAt)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                End Time ({OFFICE_TIMEZONE_LABEL})
              </span>
              <p id="reservation-end-time" className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                {formatDateTimeInOfficeTz(reservation.endAt)}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Booked On
              </span>
              <p className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                {formatDateTimeInOfficeTz(reservation.createdAt)}
              </p>
            </div>
          </div>
        </section>

        {/* Purpose Section */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Booking Purpose
          </h2>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800 text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
            {reservation.purpose}
          </div>
        </section>

        {/* Cancellation Details Section (If Cancelled) */}
        {isCancelled && (
          <section
            role="region"
            aria-label="Cancellation metadata"
            className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4"
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold">
                ✕
              </div>
              <h2 className="text-base font-bold text-rose-900 dark:text-rose-200">
                Cancellation Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-900/50">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
                  Cancelled At (Sri Lanka)
                </span>
                <span id="cancellation-timestamp" className="mt-1 font-semibold text-rose-900 dark:text-rose-100 block">
                  {reservation.cancelledAt ? formatDateTimeInOfficeTz(reservation.cancelledAt) : "N/A"}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-900/50">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block">
                  Cancelled By
                </span>
                <span id="cancellation-actor" className="mt-1 font-semibold text-rose-900 dark:text-rose-100 block">
                  {reservation.cancelledBy
                    ? `${reservation.cancelledBy.name} (${reservation.cancelledBy.email})`
                    : "System / User"}
                </span>
              </div>
            </div>

            {reservation.cancellationReason && (
              <div className="p-4 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-900/50 text-xs">
                <span className="text-slate-400 font-semibold uppercase text-[10px] tracking-wider block mb-1">
                  Cancellation Reason
                </span>
                <p id="cancellation-reason-text" className="text-rose-900 dark:text-rose-100 italic leading-relaxed">
                  &ldquo;{reservation.cancellationReason}&rdquo;
                </p>
              </div>
            )}
          </section>
        )}

        {/* Ownership Information (Visible to Admins) */}
        {isAdmin && (
          <section className="bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <h2 className="text-xs uppercase font-bold tracking-wider text-purple-700 dark:text-purple-300">
                Admin Metadata
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                <span className="text-slate-400 block mb-0.5">Booked By</span>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {reservation.user?.name ?? "Unknown User"}
                </span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {reservation.user?.email}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                <span className="text-slate-400 block mb-0.5">User ID</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate block">
                  {reservation.userId}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40">
                <span className="text-slate-400 block mb-0.5">Reservation ID</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate block">
                  {reservation.id}
                </span>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
