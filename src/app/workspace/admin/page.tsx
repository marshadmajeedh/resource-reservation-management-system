import Link from "next/link";
import { requireAdmin } from "@/features/auth/dal";

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
      {/* Top Navigation */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50 dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-md shadow-purple-500/20 text-white font-bold text-lg">
              A
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 dark:text-white">
                Reserve
              </span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Admin Area
              </span>
            </div>
          </div>

          <div>
            <Link
              id="back-to-workspace-link"
              href="/workspace"
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              ← Back to Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span
              id="admin-authorization-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
            >
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              Verified Administrator Authorization
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Administrator Console
          </h1>

          <p className="mt-3 text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            This protected page exercises <code>requireAdmin()</code>. Only accounts verified
            with the <code>ADMIN</code> role can access this page. Staff members and
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
      </main>
    </div>
  );
}
