import Link from "next/link";
import { requireAdmin } from "@/features/auth/dal";
import { listAllReservations } from "@/features/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import {
  OFFICE_TIMEZONE_LABEL,
  formatDateTimeInOfficeTz,
} from "@/lib/timezone";
import type { ReservationStatusFilter } from "@/features/reservations/types";

export const instant = false;

export const metadata = {
  title: "All Reservations - Admin Console - Reserve",
  description: "Comprehensive administrator oversight of all organizational resource reservations.",
};

interface AdminReservationsPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
  }>;
}

export default async function AdminReservationsPage({
  searchParams,
}: AdminReservationsPageProps) {
  const admin = await requireAdmin();
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

  const data = await listAllReservations(
    {
      statusFilter: currentFilter,
      page: currentPage,
      pageSize: 15,
    },
    admin
  );

  const buildFilterUrl = (filter: ReservationStatusFilter) => {
    const params = new URLSearchParams();
    if (filter !== "all") params.set("status", filter);
    const qs = params.toString();
    return `/workspace/admin/reservations${qs ? `?${qs}` : ""}`;
  };

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (currentFilter !== "all") params.set("status", currentFilter);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return `/workspace/admin/reservations${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={admin} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Admin Console
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              All Organizational Reservations
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Complete oversight across all facilities, rooms, and staff bookings. Times rendered in <strong>{OFFICE_TIMEZONE_LABEL}</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/workspace/admin/resources"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
            >
              Manage Resources
            </Link>
            <Link
              href="/workspace/resources"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 shadow-sm shadow-purple-600/20 transition-all"
            >
              Browse Catalog
            </Link>
          </div>
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
                id={`admin-filter-tab-${tab.id}`}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Reservations Table / Cards */}
        {data.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No reservations found
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              There are no {currentFilter === "all" ? "" : currentFilter.replace("_", " ")} reservations recorded in the system.
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                    <th scope="col" className="px-6 py-3.5">
                      Resource & Location
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Reserved By
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Time Interval (Sri Lanka)
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Purpose
                    </th>
                    <th scope="col" className="px-6 py-3.5">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3.5 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
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
                      <tr
                        key={item.id}
                        id={`admin-reservation-row-${item.id}`}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/workspace/reservations/${item.id}`}
                            className="font-bold text-slate-900 dark:text-white hover:text-purple-600 transition-colors"
                          >
                            {item.resource?.name ?? "Resource"}
                          </Link>
                          <div className="text-[11px] text-slate-500">
                            {item.resource?.location} • {item.resource?.category?.name}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.user?.name ?? "Unknown"}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs">
                            {item.user?.email}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {formatDateTimeInOfficeTz(item.startAt)}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            to {formatDateTimeInOfficeTz(item.endAt)}
                          </div>
                        </td>

                        <td className="px-6 py-4 max-w-xs">
                          <p className="line-clamp-2 text-slate-600 dark:text-slate-300">
                            {item.purpose}
                          </p>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeStyle}`}>
                            {badgeText}
                          </span>
                          {isCancelled && item.cancelledBy && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                              by {item.cancelledBy.name}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/workspace/reservations/${item.id}`}
                            id={`admin-manage-reservation-${item.id}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 transition-colors"
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {data.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
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
          </div>
        )}
      </main>
    </div>
  );
}
