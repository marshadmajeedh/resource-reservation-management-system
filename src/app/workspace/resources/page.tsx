import Link from "next/link";
import { requireUser } from "@/features/auth/dal";
import { listCategories, listResources } from "@/features/resources/service";
import { WorkspaceNav } from "@/components/workspace-nav";

export const instant = false;

export const metadata = {
  title: "Browse Resources - Reserve Resource Management",
  description: "Explore and discover active office facilities, rooms, and equipment.",
};

interface ResourcesPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    page?: string;
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

  const buildPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (selectedCategory) params.set("categoryId", selectedCategory);
    if (newPage > 1) params.set("page", String(newPage));
    const qs = params.toString();
    return `/workspace/resources${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={user} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Title and Intro */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Available Office Resources
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Browse active facilities, meeting rooms, pods, and office assets across company locations.
          </p>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <form method="GET" action="/workspace/resources" className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="search-input" className="sr-only">
                Search resources
              </label>
              <input
                id="search-input"
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Search by name or location (e.g. Room 4B, East Wing)..."
                className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="w-full md:w-64">
              <label htmlFor="category-select" className="sr-only">
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

            <button
              type="submit"
              id="filter-submit-button"
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
            >
              Search
            </button>

            {(searchQuery || selectedCategory) && (
              <Link
                href="/workspace/resources"
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-center"
              >
                Reset
              </Link>
            )}
          </form>
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
            {(searchQuery || selectedCategory) && (
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
            {data.items.map((resource) => (
              <div
                key={resource.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {resource.category?.name ?? "General"}
                    </span>
                    {resource.capacity !== null && (
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

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Active Resource
                  </span>
                  <Link
                    href={`/workspace/resources/${resource.id}`}
                    id={`view-resource-${resource.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors"
                  >
                    <span>View Details</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
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
