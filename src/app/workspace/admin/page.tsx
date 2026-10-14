import Link from "next/link";
import { requireAdmin } from "@/features/auth/dal";
import { WorkspaceNav } from "@/components/workspace-nav";

export const instant = false;

export const metadata = {
  title: "Admin Console - Reserve Resource Management",
  description: "Administrative console for managing office resources and staff permissions.",
};

export default async function AdminWorkspacePage() {
  // Enforces administrator role on the server before rendering
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={admin} />

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-4">
            <span
              id="admin-authorization-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
            >
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              Verified Administrator Authorization
            </span>

            <Link
              id="back-to-workspace-link"
              href="/workspace"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              ← Back to Workspace
            </Link>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Administrator Console
          </h1>

          <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            This protected section exercises <code>requireAdmin()</code>. Only accounts verified
            with the <code>ADMIN</code> role can access this console. Staff members and
            unauthenticated requests are blocked at the server level.
          </p>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              <span>Authenticated as: </span>
              <strong className="text-slate-700 dark:text-slate-200">{admin.name}</strong> ({admin.email})
            </div>
            <div>
              <span>Role: </span>
              <span className="font-mono text-purple-600 dark:text-purple-400 font-bold">{admin.role}</span>
            </div>
          </div>
        </div>

        {/* Management Quick Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/workspace/admin/resources"
            className="group p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                Resource Management
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                View the master list of all resources, create new resources, update configurations, and manage active or inactive status.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span>Go to resources</span>
              <span>→</span>
            </div>
          </Link>

          <Link
            href="/workspace/admin/categories"
            className="group p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                Category Management
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Organize facilities into clear categories. Create and rename categories to facilitate staff filtering and resource discovery.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <span>Manage categories</span>
              <span>→</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
