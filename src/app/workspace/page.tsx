import Link from "next/link";
import { requireUser } from "@/features/auth/dal";
import { WorkspaceNav } from "@/components/workspace-nav";

export const instant = false;

export const metadata = {
  title: "Workspace - Reserve Resource Management",
  description: "User workspace for resource reservation and profile management.",
};

export default async function WorkspacePage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={user} />

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        {/* Profile / Status Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome, {user.name}
              </h1>
              <span
                id="user-role-badge"
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  isAdmin
                    ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800"
                    : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                }`}
              >
                {isAdmin ? "Admin" : "Staff"}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Your account is verified and authenticated via server-side session.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              id="browse-resources-link"
              href="/workspace/resources"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20"
            >
              Browse Resources
            </Link>
            {isAdmin && (
              <Link
                id="admin-console-link"
                href="/workspace/admin"
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-md shadow-purple-600/20"
              >
                Admin Console
              </Link>
            )}
          </div>
        </div>

        {/* Feature Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/workspace/resources"
            className="group p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                Resource Catalog
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Explore available office conference rooms, focus booths, and equipment. Search by name or filter by location and category.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>View catalog</span>
              <span>→</span>
            </div>
          </Link>

          {isAdmin ? (
            <Link
              href="/workspace/admin/resources"
              className="group p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-purple-500/50 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-10 w-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors">
                  Administrative Management
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Configure facilities, manage categories, edit resource capacities, and control activation or deactivation states.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1 text-xs font-semibold text-purple-600 dark:text-purple-400">
                <span>Manage resources</span>
                <span>→</span>
              </div>
            </Link>
          ) : (
            <div className="p-6 rounded-3xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                  Staff Role
                </span>
                <h2 className="mt-2 text-base font-bold text-slate-700 dark:text-slate-300">
                  Standard Access
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  As a staff member, you have access to browse active office resources and facility specifications across your organization.
                </p>
              </div>
              <p className="mt-4 text-[11px] text-slate-400">
                Facility configuration is managed by workspace administrators.
              </p>
            </div>
          )}
        </div>

        {/* Account Details Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Session Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                User ID
              </span>
              <p id="user-id-value" className="mt-1 font-mono text-xs text-slate-700 dark:text-slate-300 truncate">
                {user.id}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Email Address
              </span>
              <p id="user-email-value" className="mt-1 font-semibold text-sm text-slate-900 dark:text-white truncate">
                {user.email}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Assigned Role
              </span>
              <p id="user-role-value" className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                {user.role}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                Account Status
              </span>
              <p className="mt-1 font-semibold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
