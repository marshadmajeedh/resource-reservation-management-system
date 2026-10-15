import Link from "next/link";
import { requireUser } from "@/features/auth/dal";
import { listMyReservations } from "@/features/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import {
  OFFICE_TIMEZONE_LABEL,
  formatDateTimeInOfficeTz,
} from "@/lib/timezone";
import type { ReservationStatusFilter } from "@/features/reservations/types";

export const instant = false;

export const metadata = {
  title: "My Reservations - Reserve Resource Management",
  description: "View and manage your active and past resource reservations.",
};

interface MyReservationsPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function MyReservationsPage({
  searchParams,
}: MyReservationsPageProps) {
  const user = await requireUser();
  const sp = await searchParams;

  const validFilters: ReservationStatusFilter[] = [
    "all",
    "upcoming",
    "in_progress",
    "finished",
    "cancelled",
  ];
  const rawFilter = sp.status as ReservationStatusFilter;
  const currentFilter: ReservationStatusFilter = validFilters.includes(rawFilter)
    ? rawFilter
    : "all";

  const currentPage = Math.max(1, Number(sp.page) || 1);

  const data = await listMyReservations(
    {
      statusFilter: currentFilter,
      page: currentPage,
      pageSize: 10,
    },
    user
  );

  const buildFilterUrl = (filter: ReservationStatusFilter) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const qs = params.toString();
    return `/workspace/reservations${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (currentFilter !== "all") params.set("status", currentFilter);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return `/workspace/reservations${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={user} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              My Reservations
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Manage your personal resource bookings. All times are displayed in <strong>{OFFICE_TIMEZONE_LABEL}</strong>.
            </p>
          </div>

          <Link
            href="/workspace/resources"
            id="book-new-resource-link"
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition-all self-start sm:self-auto cursor-pointer"
          >
            + Book a Resource
          </Link>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto shadow-sm">
          {[
            { id: "all", label: "All Bookings" },
            { id: "upcoming", label: "Upcoming" },
            { id: "in_progress", label: "In Progress" },
            { id: "finished", label: "Finished" },
            { id: "cancelled", label: "Cancelled" },
          ].map((tab) => {
            const isActive = currentFilter === tab.id;
            return (
              <Link
                key={tab.id}
                href={buildFilterUrl(tab.id as ReservationStatusFilter)}
                id={`filter-tab-${tab.id}`}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Reservations List */}
        {data.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No reservations found
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {currentFilter === "all"
                ? "You haven't made any resource reservations yet."
                : `You don't have any ${currentFilter.replace("_", " ")} reservations.`}
            </p>
            <div className="pt-2">
              <Link
                href="/workspace/resources"
                className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-500"
              >
                Browse available resources to make a booking →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {data.items.map((item) => {
              const isCancelled = item.status === "CANCELLED";
              const temporal = item.temporalStatus;

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
                <div
                  key={item.id}
                  id={`reservation-card-${item.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
                        {badgeText}
                      </span>
                      <span className="text-xs text-slate-500">
                        {item.resource?.category?.name ?? "Resource"}
                      </span>
                      {item.resource && !item.resource.isActive && (
                        <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                          Resource Deactivated
                        </span>
                      )}
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                        <Link
                          href={`/workspace/reservations/${item.id}`}
                          className="hover:text-emerald-600 transition-colors"
                        >
                          {item.resource?.name ?? "Unknown Resource"}
                        </Link>
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{item.resource?.location ?? "Office"}</span>
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                      <p className="font-semibold text-slate-900 dark:text-white mb-0.5">
                        Purpose:
                      </p>
                      <p className="line-clamp-2 leading-relaxed">
                        {item.purpose}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>
                        <strong>{formatDateTimeInOfficeTz(item.startAt)}</strong> – <strong>{formatDateTimeInOfficeTz(item.endAt)}</strong>
                      </span>
                    </div>

                    {isCancelled && item.cancellationReason && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 italic">
                        Cancellation note: &ldquo;{item.cancellationReason}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3 shrink-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    <Link
                      href={`/workspace/reservations/${item.id}`}
                      id={`view-reservation-${item.id}`}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors"
                    >
                      View Details →
                    </Link>

                    {item.resource && (
                      <Link
                        href={`/workspace/resources/${item.resource.id}`}
                        className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      >
                        Resource info
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {data.totalPages > 1 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl px-6 py-4 flex items-center justify-between text-xs text-slate-500 shadow-sm">
            <span>
              Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong> ({data.total} total bookings)
            </span>
            <div className="flex items-center gap-2">
              {data.page > 1 ? (
                <Link
                  href={buildPageUrl(data.page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed">
                  Previous
                </span>
              )}

              {data.page < data.totalPages ? (
                <Link
                  href={buildPageUrl(data.page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Next
                </Link>
              ) : (
                <span className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed">
                  Next
                </span>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
