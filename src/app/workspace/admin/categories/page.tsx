import { requireAdmin } from "@/features/auth/dal";
import { listCategories } from "@/features/resources/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { CategoryManager } from "./category-manager";

export const instant = false;

export const metadata = {
  title: "Manage Categories - Reserve",
  description: "Create and rename resource categories for office facilities.",
};

export default async function AdminCategoriesPage() {
  const admin = await requireAdmin();
  const categories = await listCategories();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <WorkspaceNav user={admin} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
            Administration
          </span>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Resource Categories
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
            Categories classify office assets such as meeting rooms, focus pods, hot desks,
            and shared equipment. Names must be unique.
          </p>
        </div>

        <CategoryManager initialCategories={categories} />
      </main>
    </div>
  );
}
