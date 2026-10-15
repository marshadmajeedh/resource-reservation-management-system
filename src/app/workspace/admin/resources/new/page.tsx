import Link from "next/link";
import { requireAdmin } from "@/features/auth/dal";
import { listCategories } from "@/features/resources/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ResourceForm } from "../resource-form";

export const instant = false;

export const metadata = {
  title: "New Resource - Reserve",
  description: "Create a new bookable or manageable office facility resource.",
};

export default async function NewResourcePage() {
  const admin = await requireAdmin();
  const categories = await listCategories();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={admin} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <Link
              href="/workspace/admin/resources"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Resources
            </Link>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-medium">New Resource</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Create Office Resource
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Define new workspaces, rooms, or equipment available for reservation.
          </p>
        </div>

        {categories.length === 0 ? (
          <div
            role="alert"
            className="p-6 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-3"
          >
            <div className="flex items-center gap-2.5 font-bold text-base">
              <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Category Required</span>
            </div>
            <p className="text-sm">
              Before creating any resources, you must create at least one resource category
              (e.g., Conference Rooms, Hot Desks, Pods).
            </p>
            <div>
              <Link
                href="/workspace/admin/categories"
                id="create-category-first-link"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 shadow-sm transition-all"
              >
                Go to Category Management
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <ResourceForm mode="create" categories={categories} />
          </div>
        )}
      </main>
    </div>
  );
}
