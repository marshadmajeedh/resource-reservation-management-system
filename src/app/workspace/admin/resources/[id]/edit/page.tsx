import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/features/auth/dal";
import {
  getResourceById,
  listCategories,
  isValidUuid,
} from "@/features/resources/service";
import { WorkspaceNav } from "@/components/workspace-nav";
import { ResourceForm } from "../../resource-form";

export const instant = false;

export const metadata = {
  title: "Edit Resource - Reserve Resource Management",
  description: "Modify existing office resource properties, location, or capacity.",
};

interface EditResourcePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditResourcePage({
  params,
}: EditResourcePageProps) {
  const admin = await requireAdmin();
  const { id } = await params;

  if (!isValidUuid(id)) {
    notFound();
  }

  const [resource, categories] = await Promise.all([
    getResourceById(id, admin),
    listCategories(),
  ]);

  if (!resource) {
    notFound();
  }

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
            <span className="text-slate-900 dark:text-white font-medium">Edit: {resource.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Edit Resource
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Update resource configuration. Resource ID, creation timestamp, and existing reservation histories are strictly preserved.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <ResourceForm
            mode="edit"
            categories={categories}
            initialData={resource}
          />
        </div>
      </main>
    </div>
  );
}
