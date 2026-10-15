import Link from "next/link";
import { requireAdmin } from "@/features/auth/dal";
import { listCategories, listResources } from "@/features/resources/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ResourceStatusButton } from "./resource-status-button";
import type { ResourceStatusFilter } from "@/features/resources/types";

export const instant = false;

export const metadata = {
  title: "Manage Resources - Reserve",
  description: "Administrative catalog for managing, configuring, and toggling office resources.",
};

interface AdminResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminResourcesPage({
  searchParams,
}: AdminResourcesPageProps) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const searchQuery = sp.q || "";
  const selectedCategory = sp.categoryId || "";
  const statusFilter: ResourceStatusFilter =
    sp.status === "active" || sp.status === "inactive" ? sp.status : "all";
  const currentPage = Math.max(1, Number(sp.page) || 1);

  const [categories, data] = await Promise.all([
    listCategories(),
    listResources(
      {
        search: searchQuery,
        categoryId: selectedCategory || undefined,
        status: statusFilter,
        page: currentPage,
        pageSize: 10,
      },
      admin
    ),
  ]);

  const buildFilterUrl = (newPage: number, overrides?: { status?: string }) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    const effectiveStatus = overrides?.status !== undefined ? overrides.status : statusFilter;
    if (effectiveStatus !== "all") params.set("status", effectiveStatus);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return `/workspace/admin/resources${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={admin} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header with Title and Add Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Administration
            </span>
            <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Resource Management
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Create, configure, and control availability status for office resources.
            </p>
          </div>

          <div>
            <Link
              id="new-resource-button"
              href="/workspace/admin/resources/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Resource</span>
            </Link>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <form method="GET" action="/workspace/admin/resources" className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search by resource name or location..."
                className="w-full pl-3.5 pr-4 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Category Dropdown */}
            <div className="w-full md:w-56">
              <select
                name="categoryId"
                defaultValue={selectedCategory}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div className="w-full md:w-44">
              <select
                name="status"
                defaultValue={statusFilter}
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
            >
              Filter
            </button>

            {(searchQuery || selectedCategory || statusFilter !== "all") && (
              <Link
                href="/workspace/admin/resources"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
              >
                Reset
              </Link>
            )}
          </form>

          {/* Quick status tabs */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Quick Status Filter:</span>
            <Link
              href={buildFilterUrl(1, { status: "all" })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                statusFilter === "all"
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              All
            </Link>
            <Link
              href={buildFilterUrl(1, { status: "active" })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                statusFilter === "active"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Active
            </Link>
            <Link
              href={buildFilterUrl(1, { status: "inactive" })}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                statusFilter === "inactive"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-200"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              Inactive
            </Link>
          </div>
        </div>

        {/* Resources Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
          {data.items.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No resources found
              </h3>
              <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
                No matching resources found for the selected filters.
              </p>
              <div className="mt-5">
                <Link
                  href="/workspace/admin/resources/new"
                  className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm"
                >
                  Create First Resource
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4">Resource</th>
                    <th scope="col" className="px-6 py-4">Category</th>
                    <th scope="col" className="px-6 py-4">Location</th>
                    <th scope="col" className="px-6 py-4">Capacity</th>
                    <th scope="col" className="px-6 py-4">Status</th>
                    <th scope="col" className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.items.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          <Link
                            href={`/workspace/resources/${r.id}`}
                            className="hover:underline hover:text-emerald-600 transition-colors"
                          >
                            {r.name}
                          </Link>
                        </div>
                        {r.description && (
                          <p className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                            {r.description}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          {r.category?.name ?? "Uncategorized"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {r.location}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {r.capacity !== null ? `${r.capacity} people` : "—"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            r.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              r.isActive ? "bg-emerald-500" : "bg-slate-400"
                            }`}
                          />
                          {r.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/workspace/admin/resources/${r.id}/edit`}
                            id={`edit-resource-${r.id}`}
                            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            Edit
                          </Link>
                          <ResourceStatusButton
                            resourceId={r.id}
                            resourceName={r.name}
                            isActive={r.isActive}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {data.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong> ({data.total} total resources)
              </span>
              <div className="flex items-center gap-2">
                {data.page > 1 ? (
                  <Link
                    href={buildFilterUrl(data.page - 1)}
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
                    href={buildFilterUrl(data.page + 1)}
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
      </main>
    </div>
  );
}
