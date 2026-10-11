import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-50 dark:border-slate-800/80 dark:bg-slate-950/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold text-lg">
              R
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 dark:text-white">
                Reserve
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                Resource System
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              id="header-login-link"
              href="/login"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              id="header-workspace-link"
              href="/workspace"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 transition-all"
            >
              Workspace
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 flex flex-col gap-16">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 mb-6 shadow-sm">
            <span>Next.js App Router</span>
            <span className="text-indigo-300 dark:text-indigo-600">•</span>
            <span>TypeScript</span>
            <span className="text-indigo-300 dark:text-indigo-600">•</span>
            <span>PostgreSQL</span>
          </div>

          <h1
            id="page-title"
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
          >
            Resource Reservation Management
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            A high-reliability office scheduling platform designed with strict conflict prevention, role-based governance, and end-to-end auditability.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              id="view-features-btn"
              href="#feature-architecture"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium text-sm text-white bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/25"
            >
              Explore Architecture
            </a>
            <a
              id="view-specs-btn"
              href="#stack-specs"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-medium text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-[0.98] transition-all"
            >
              System Specs
            </a>
          </div>
        </section>

        {/* Feature Layer Architecture Cards */}
        <section id="feature-architecture" className="space-y-6">
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Lightweight Feature Layers
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Modular domain structure separating UI presentation, business validation, and direct database queries.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Auth Layer Card */}
            <div
              id="feature-card-auth"
              className="relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-300 flex items-center justify-center font-bold text-base mb-4">
                  01
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Authentication & Roles
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Strict separation of <strong>Admin</strong> and <strong>Staff</strong> roles. Uses secure password hashing and verified JWT sessions in HttpOnly cookies without mock prototype role-switching.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>src/features/auth</span>
                <span className="text-violet-600 dark:text-violet-400 font-sans font-medium">Domain Ready</span>
              </div>
            </div>

            {/* Resources Layer Card */}
            <div
              id="feature-card-resources"
              className="relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 flex items-center justify-center font-bold text-base mb-4">
                  02
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Resource Inventory
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Admins manage office resources (meeting rooms, desks, hardware). Staff seamlessly search and browse resource availability with capacity and location details.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>src/features/resources</span>
                <span className="text-cyan-600 dark:text-cyan-400 font-sans font-medium">Domain Ready</span>
              </div>
            </div>

            {/* Reservations Layer Card */}
            <div
              id="feature-card-reservations"
              className="relative p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold text-base mb-4">
                  03
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Conflict-Free Bookings
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Prevents overlapping confirmed reservations on the same resource while allowing clean back-to-back bookings. Preserves complete booking history without office-hour restrictions.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 font-mono">
                <span>src/features/reservations</span>
                <span className="text-amber-600 dark:text-amber-400 font-sans font-medium">Domain Ready</span>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture & Specs */}
        <section
          id="stack-specs"
          className="rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-white to-slate-100/60 dark:from-slate-900 dark:to-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm"
        >
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
            Technical Foundation Checklist
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Framework</span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">Next.js 16 (App Router)</p>
              <p className="mt-1 text-xs text-slate-500">Fast Turbopack builds & Server Components</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Type System</span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">TypeScript 5 Strict</p>
              <p className="mt-1 text-xs text-slate-500">Domain contracts in src/features/*/types</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Database Ready</span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">PostgreSQL (Supabase)</p>
              <p className="mt-1 text-xs text-slate-500">Session pooler connection string configured</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Styling System</span>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">Tailwind CSS v4</p>
              <p className="mt-1 text-xs text-slate-500">Modern responsive UI with zero runtime overhead</p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-950 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© 2026 Resource Reservation Management System. Technical Assessment Foundation.</p>
          <p className="font-mono">Single App Architecture • Zero Unnecessary Abstractions</p>
        </div>
      </footer>
    </div>
  );
}
