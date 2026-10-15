import Link from "next/link";
import { requireUser } from "@/features/auth/dal";
import { listCategories, listResources } from "@/features/resources/service";
import { checkResourcesAvailability } from "@/features/reservations/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { OFFICE_TIMEZONE_LABEL } from "@/lib/timezone";

export const instant = false;

export const metadata = {
  title: "Browse Resources - Reserve Resource Management",
  description: "Explore, check live availability, and reserve active office facilities, rooms, and equipment.",
};

interface ResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    page?: string;
    start?: string;
    end?: string;
  }>;
}

export default async function ResourcesPage({
  searchParams,
}: ResourcesPageProps) {
  const user = await requireUser();
  const sp = await searchParams;

  const searchQuery = sp.q || "";
  const selectedCategory = sp.categoryId || "";
  const currentPage = Math.max(1, Number(sp.page) || 1);
  const startAt = sp.start || "";
  const endAt = sp.end || "";

  // Server-side enforcement: non-admins only see active resources
  const [categories, data] = await Promise.all([
    listCategories(),
    listResources(
      {
        search: searchQuery,
        categoryId: selectedCategory || undefined,
        status: "active",
        page: currentPage,
        pageSize: 9,
      },
      user
    ),
  ]);

  // Combined single bounded availability query for all resources displayed on the current page
  const resourceIds = data.items.map((r) => r.id);
  const availability = await checkResourcesAvailability(resourceIds, startAt, endAt);

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    if (startAt) params.set("start", startAt);
    if (endAt) params.set("end", endAt);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return `/workspace/resources${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Title and Intro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Available Office Resources
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Browse active facilities, check time-slot availability, and reserve spaces across company locations.
            </p>
          </div>
          <Link
            href="/workspace/reservations"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm"
          >
            <span>My Reservations</span>
            <span>→</span>
          </Link>
        </div>

        {/* Search, Category, and Availability Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
          <form method="GET" action="/workspace/resources" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Search text */}
              <div className="md:col-span-5">
                <label htmlFor="search-input" className="block text-xs font-semibold text-slate-500 mb-1">
                  Search by keyword or location
                </label>
                <input
                  id="search-input"
                  type="text"
                  name="q"
                  defaultValue={searchQuery}
                  placeholder="e.g. Conference Room A, Floor 3..."
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Category */}
              <div className="md:col-span-3">
                <label htmlFor="category-select" className="block text-xs font-semibold text-slate-500 mb-1">
                  Category
                </label>
                <select
                  id="category-select"
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

              {/* Start Date/Time */}
              <div className="md:col-span-2">
                <label htmlFor="start-input" className="block text-xs font-semibold text-slate-500 mb-1 truncate" title={OFFICE_TIMEZONE_LABEL}>
                  Start Time (Sri Lanka)
                </label>
                <input
                  id="start-input"
                  type="datetime-local"
                  name="start"
                  defaultValue={startAt}
                  className="w-full px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* End Date/Time */}
              <div className="md:col-span-2">
                <label htmlFor="end-input" className="block text-xs font-semibold text-slate-500 mb-1 truncate" title={OFFICE_TIMEZONE_LABEL}>
                  End Time (Sri Lanka)
                </label>
                <input
                  id="end-input"
                  type="datetime-local"
                  name="end"
                  defaultValue={endAt}
                  className="w-full px-2.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>All booking times are in <strong>{OFFICE_TIMEZONE_LABEL}</strong>.</span>
              </span>

              <div className="flex items-center gap-2">
                {(searchQuery || selectedCategory || startAt || endAt) && (
                  <Link
                    href="/workspace/resources"
                    id="reset-filters-link"
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Reset Filters
                  </Link>
                )}
                <button
                  type="submit"
                  id="filter-submit-button"
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
                >
                  Apply & Check Availability
                </button>
              </div>
            </div>
          </form>

          {/* Availability error notice */}
          {availability.error && (
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{availability.error}</span>
            </div>
          )}

          {/* Valid availability banner */}
          {availability.isValidRange && (
            <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 text-xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span>
                  Showing live availability for selected time range in <strong>{OFFICE_TIMEZONE_LABEL}</strong>.
                </span>
              </div>
              <span className="text-[11px] text-slate-500">
                Availability will be re-validated atomically during booking.
              </span>
            </div>
          )}
        </div>

        {/* Resources Grid */}
        {data.items.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-12 text-center shadow-sm">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No matching resources
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              We couldn&apos;t find any active resources matching your current search criteria.
            </p>
            {(searchQuery || selectedCategory || startAt || endAt) && (
              <div className="mt-4">
                <Link
                  href="/workspace/resources"
                  className="inline-flex items-center text-xs font-semibold text-emerald-600 hover:text-emerald-500"
                >
                  Clear all search filters →
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.items.map((resource) => {
              const isChecked = availability.isValidRange;
              const isAvailable = isChecked ? availability.availabilityByResourceId[resource.id] : undefined;

              const reserveHref = `/workspace/resources/${resource.id}${
                startAt && endAt
                  ? `?start=${encodeURIComponent(startAt)}&end=${encodeURIComponent(endAt)}`
                  : ""
              }`;

              return (
                <div
                  key={resource.id}
                  id={`resource-card-${resource.id}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        {resource.category?.name ?? "General"}
                      </span>

                      {/* Availability status badge if range checked */}
                      {isChecked && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            isAvailable
                              ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isAvailable ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {isAvailable ? "Available" : "Reserved for selected time"}
                        </span>
                      )}

                      {!isChecked && resource.capacity !== null && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>Up to {resource.capacity}</span>
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      <Link
                        href={`/workspace/resources/${resource.id}`}
                        className="hover:text-emerald-600 transition-colors"
                      >
                        {resource.name}
                      </Link>
                    </h2>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="truncate">{resource.location}</span>
                    </div>

                    {resource.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {resource.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Link
                      href={`/workspace/resources/${resource.id}`}
                      id={`view-resource-${resource.id}`}
                      className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                      View Details
                    </Link>

                    <Link
                      href={reserveHref}
                      id={`reserve-resource-${resource.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                      <span>Reserve</span>
                      <span>→</span>
                    </Link>
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
              Page <strong>{data.page}</strong> of <strong>{data.totalPages}</strong> ({data.total} total resources)
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
