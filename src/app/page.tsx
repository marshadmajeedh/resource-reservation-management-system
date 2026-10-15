import Link from "next/link";
import { getCurrentUser } from "@/features/auth/dal";

export const instant = false;

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 selection:bg-emerald-500 selection:text-white">
      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 md:py-24 flex flex-col gap-16 md:gap-24">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto flex flex-col items-center">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-2.5 mb-6">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold text-xl">
              R
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
              Reserve
            </span>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 mb-6 shadow-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Office Resource Reservation</span>
          </div>

          <h1
            id="page-title"
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
          >
            Book the space and equipment you need.
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed font-normal max-w-2xl">
            Find shared office resources, reserve a time, and manage your bookings in one place.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {user ? (
              <>
                <Link
                  id="primary-cta-button"
                  href="/workspace"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  <span>Go to workspace</span>
                  <span>→</span>
                </Link>
                <Link
                  id="secondary-cta-button"
                  href="/workspace/resources"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.99] transition-all"
                >
                  Browse Resources
                </Link>
              </>
            ) : (
              <>
                <Link
                  id="primary-cta-button"
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] transition-all shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  <span>Sign in</span>
                  <span>→</span>
                </Link>
                <a
                  id="secondary-cta-button"
                  href="#features"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.99] transition-all"
                >
                  Learn more
                </a>
              </>
            )}
          </div>
        </section>

        {/* Feature Highlights */}
        <section id="features" className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Everything you need to reserve shared spaces
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Streamlined reservation management built specifically for modern workplace teams.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            {/* Feature 1: Browse resources */}
            <div
              id="feature-browse"
              className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Browse resources
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Explore meeting rooms, quiet focus booths, open desks, and equipment with capacity and location information.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>View catalog details</span>
                <span>→</span>
              </div>
            </div>

            {/* Feature 2: Reserve a time */}
            <div
              id="feature-reserve"
              className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Reserve a time
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Check live slot availability across your preferred time window and confirm your booking without overlapping conflicts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>Conflict-free scheduling</span>
                <span>→</span>
              </div>
            </div>

            {/* Feature 3: Manage your bookings */}
            <div
              id="feature-manage"
              className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Manage your bookings
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Keep track of upcoming reservations, review your meeting purposes, and release or cancel slots when plans change.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <span>Personal schedule control</span>
                <span>→</span>
              </div>
            </div>
          </div>
        </section>

        {/* Visual Office Booking Preview */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-md">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Simple & Reliable
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Designed for daily office scheduling
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Whether you need a quick 30-minute 1-on-1 booth or a day-long training room, Reserve makes finding and reserving company resources intuitive and dependable.
              </p>
            </div>

            <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 w-full md:w-80 shrink-0 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Meeting Room
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                  Example
                </span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">
                  Boardroom Horizon
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Floor 4 • East Wing • Up to 10 people
                </p>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                  <span>Sample Resource</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Illustration</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-relaxed">
                  Real availability is checked dynamically against current bookings when you choose a specific time range in the workspace.
                </p>
              </div>

              <Link
                href={user ? "/workspace/resources" : "/login"}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-xs"
              >
                <span>Browse Actual Resources</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-950 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
              R
            </div>
            <span className="font-bold text-slate-800 dark:text-slate-200">Reserve</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span>Office Resource Reservation</span>
          </div>
          <p>© 2026 Reserve. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
