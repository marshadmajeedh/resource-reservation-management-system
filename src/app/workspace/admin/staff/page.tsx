import Link from "next/link";
import { requireAdmin } from "@/features/auth/dal";
import { listStaff } from "@/features/staff/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { StaffCreateForm } from "./staff-create-form";
import { StaffStatusButton } from "./staff-status-button";
import { StaffEditNameModal } from "./staff-edit-name-modal";
import type { StaffStatusFilter } from "@/features/staff/types";

export const instant = false;

export const metadata = {
  title: "Staff Account Management - Reserve",
  description: "Administrative console for managing staff accounts, names, active states, and reservation ownership.",
};

interface AdminStaffPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminStaffPage({
  searchParams,
}: AdminStaffPageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const searchQuery = (sp.q || "").trim();
  const rawStatus = sp.status as StaffStatusFilter;
  const statusFilter: StaffStatusFilter =
    rawStatus === "active" || rawStatus === "inactive" ? rawStatus : "all";

  const currentPage = Math.max(1, Number(sp.page) || 1);

  const data = await listStaff(
    {
      search: searchQuery || undefined,
      status: statusFilter,
      page: currentPage,
      pageSize: 10,
    },
    admin
  );

  const buildFilterUrl = (
    newPage: number,
    overrides?: { status?: string; q?: string }
  ) => {
    const params = new URLSearchParams();
    const effectiveSearch =
      overrides?.q !== undefined ? overrides.q : searchQuery;
    if (effectiveSearch) params.set("q", effectiveSearch);

    const effectiveStatus =
      overrides?.status !== undefined ? overrides.status : statusFilter;
    if (effectiveStatus !== "all") params.set("status", effectiveStatus);

    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return `/workspace/admin/staff${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={admin} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Top Header & Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Admin Console
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <Link
                href="/workspace/admin"
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                ← Back to Console Overview
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Staff Account Management
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Provision and manage staff accounts, adjust display names, and control active or inactive access.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/workspace/admin/reservations"
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm transition-all"
            >
              All Reservations
            </Link>
          </div>
        </div>

        {/* Account Creation Form Component */}
        <StaffCreateForm />

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <form method="GET" action="/workspace/admin/staff" className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                name="q"
                id="staff-search-input"
                defaultValue={searchQuery}
                placeholder="Search staff by name or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-900 dark:text-slate-100"
              />
              <svg
                className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* Retain Status Filter in Search Form */}
            {statusFilter !== "all" && (
              <input type="hidden" name="status" value={statusFilter} />
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                id="search-staff-button"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-sm cursor-pointer whitespace-nowrap"
              >
                Search
              </button>

              {searchQuery && (
                <Link
                  id="clear-staff-search-button"
                  href={buildFilterUrl(1, { q: "" })}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">
              Filter Status:
            </span>
            {(
              [
                { id: "all", label: "All Accounts" },
                { id: "active", label: "Active" },
                { id: "inactive", label: "Inactive" },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <Link
                  key={tab.id}
                  id={`staff-filter-tab-${tab.id}`}
                  href={buildFilterUrl(1, { status: tab.id })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Staff Table / Empty State */}
        {data.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm space-y-3">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No staff members found
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all"
                ? "No staff accounts matched your active filters or search term."
                : "No staff accounts have been provisioned yet. Use the 'Add Staff Member' button above to create one."}
            </p>
            {(searchQuery || statusFilter !== "all") && (
              <div className="pt-2">
                <Link
                  id="reset-all-staff-filters-button"
                  href="/workspace/admin/staff"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  Reset All Filters
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse" id="staff-members-table">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 font-semibold bg-slate-50/50 dark:bg-slate-950/50">
                    <th scope="col" className="px-6 py-4">Staff Member</th>
                    <th scope="col" className="px-6 py-4">Role</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4">Active Bookings</th>
                    <th scope="col" className="px-6 py-4">Registered</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal">
                  {data.items.map((staff) => (
                    <tr
                      key={staff.id}
                      id={`staff-row-${staff.id}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Name & Email */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white" id={`staff-name-${staff.id}`}>
                          {staff.name}
                        </div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          {staff.email}
                        </div>
                      </td>

                      {/* Role (Staff only) */}
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {staff.role}
                        </span>
                      </td>

                      {/* Active Status */}
                      <td className="px-6 py-4">
                        {staff.isActive ? (
                          <span
                            id={`staff-status-active-${staff.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span
                            id={`staff-status-inactive-${staff.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Active Bookings Count */}
                      <td className="px-6 py-4">
                        {staff.activeBookingsCount > 0 ? (
                          <Link
                            href={`/workspace/admin/reservations?userId=${staff.id}`}
                            id={`staff-bookings-link-${staff.id}`}
                            title="View member reservations in Admin view"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors"
                          >
                            <span>{staff.activeBookingsCount} active</span>
                            <span className="text-[10px]">↗</span>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">0 active</span>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(staff.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <StaffEditNameModal
                            staffId={staff.id}
                            staffName={staff.name}
                            staffEmail={staff.email}
                          />

                          <StaffStatusButton
                            staffId={staff.id}
                            staffName={staff.name}
                            staffEmail={staff.email}
                            isActive={staff.isActive}
                            activeBookingsCount={staff.activeBookingsCount}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                Showing page <strong className="text-slate-800 dark:text-slate-200">{data.page}</strong> of{" "}
                <strong className="text-slate-800 dark:text-slate-200">{data.totalPages}</strong> ({data.total} total staff)
              </div>

              <div className="flex items-center gap-2">
                {data.page > 1 ? (
                  <Link
                    id="prev-staff-page-button"
                    href={buildFilterUrl(data.page - 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60 text-slate-300 dark:text-slate-700 font-semibold cursor-not-allowed">
                    Previous
                  </span>
                )}

                {data.page < data.totalPages ? (
                  <Link
                    id="next-staff-page-button"
                    href={buildFilterUrl(data.page + 1)}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60 text-slate-300 dark:text-slate-700 font-semibold cursor-not-allowed">
                    Next
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
