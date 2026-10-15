import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/dal";
import { getResourceById, isValidUuid } from "@/features/resources/service";
import { BookingForm } from "@/features/reservations/components/booking-form";
import { WorkspaceNav } from "@/components/workspace-nav";

export const instant = false;

interface ResourceDetailPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    start?: string;
    end?: string;
  }>;
}

export async function generateMetadata({ params }: ResourceDetailPageProps) {
  const { id } = await params;
  if (!isValidUuid(id)) {
    return { title: "Resource Not Found - Reserve" };
  }
  return {
    title: "Resource Details - Reserve Resource Management",
  };
}

export default async function ResourceDetailPage({
  params,
  searchParams,
}: ResourceDetailPageProps) {
  const user = await requireUser();
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const initialStart = sp.start || "";
  const initialEnd = sp.end || "";

  if (!isValidUuid(id)) {
    notFound();
  }

  const resource = await getResourceById(id, user);

  if (!resource) {
    notFound();
  }

  const isAdmin = user.role === "ADMIN";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={user} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
          <Link
            href="/workspace/resources"
            className="hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Resources
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-medium truncate">
            {resource.name}
          </span>
        </nav>

        {/* Administrative Inactive Notice */}
        {!resource.isActive && isAdmin && (
          <div
            role="status"
            className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center justify-between gap-4 text-xs"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>
                <strong>Admin Notice:</strong> This resource is currently deactivated. Non-administrator staff cannot view or access this resource.
              </span>
            </div>
            <Link
              href={`/workspace/admin/resources/${resource.id}/edit`}
              className="font-semibold underline shrink-0 hover:text-amber-700"
            >
              Configure in Admin
            </Link>
          </div>
        )}

        {/* Resource Header Card */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {resource.category?.name ?? "General"}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    resource.isActive
                      ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      resource.isActive ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {resource.isActive ? "Active Resource" : "Deactivated"}
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {resource.name}
              </h1>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/workspace/admin/resources/${resource.id}/edit`}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Edit Configuration
                </Link>
              </div>
            )}
          </div>

          {/* Quick Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Location
              </span>
              <p className="mt-1 font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{resource.location}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Capacity
              </span>
              <p className="mt-1 font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>{resource.capacity !== null ? `${resource.capacity} people` : "Not specified"}</span>
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Added On
              </span>
              <p className="mt-1 font-semibold text-sm text-slate-900 dark:text-white">
                {new Date(resource.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </section>

        {/* Description Section */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Resource Description & Information
          </h2>

          {resource.description ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {resource.description}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">
              No detailed description provided for this resource.
            </p>
          )}
        </section>

        {/* Interactive Booking Section */}
        <section id="reserve-section">
          <BookingForm
            resourceId={resource.id}
            resourceName={resource.name}
            resourceLocation={resource.location}
            resourceCapacity={resource.capacity}
            isActive={resource.isActive}
            initialStart={initialStart}
            initialEnd={initialEnd}
          />
        </section>
      </main>
    </div>
  );
}
