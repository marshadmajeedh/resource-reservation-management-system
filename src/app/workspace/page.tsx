import Link from "next/link";
import { requireUser } from "@/features/auth/dal";
import { logoutAction } from "@/features/auth/actions";

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
      {/* Top Navigation */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50 dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold text-lg">
              R
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 dark:text-white">
                Reserve
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span id="user-display-name" className="text-sm font-semibold text-slate-900 dark:text-white">
                {user.name}
              </span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                id="logout-button"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </header>

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
