"use client";

import { useActionState, useState } from "react";
import {
  createCategoryAction,
  renameCategoryAction,
} from "@/features/resources/actions";
import type { ResourceCategory, ResourceActionResult } from "@/features/resources/types";

interface CategoryManagerProps {
  initialCategories: ResourceCategory[];
}

export function CategoryManager({ initialCategories }: CategoryManagerProps) {
  const [createName, setCreateName] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const [createState, createAction, isCreating] = useActionState<
    ResourceActionResult,
    FormData
  >(async (prev, formData) => {
    setSuccessMessage(null);
    const res = await createCategoryAction(prev, formData);
    if (res.success) {
      setCreateName("");
      setSuccessMessage("Category created successfully!");
    }
    return res;
  }, { success: false });

  return (
    <div className="space-y-8">
      {/* Create Category Section */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
          Add New Category
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Categories organize office resources for staff browsing and filtering.
        </p>

        <form action={createAction} className="mt-6 space-y-4 max-w-xl">
          {createState?.error && !createState?.fieldErrors?.name && (
            <div
              role="alert"
              id="category-create-error"
              className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-red-700 dark:text-red-300 text-sm flex items-start gap-2.5"
            >
              <svg
                className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span>{createState.error}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              id="category-success-message"
              className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/80 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2"
            >
              <span className="font-semibold">{successMessage}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="category-name-input"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Category Name <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <input
                id="category-name-input"
                name="name"
                type="text"
                maxLength={100}
                placeholder="e.g. Conference Rooms, Hot Desks, Hardware"
                required
                value={createName}
                onChange={(e) => {
                  setCreateName(e.target.value);
                  if (successMessage) setSuccessMessage(null);
                }}
                aria-invalid={Boolean(createState?.fieldErrors?.name)}
                aria-describedby={createState?.fieldErrors?.name ? "category-name-error" : undefined}
                className={`flex-1 px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
                  createState?.fieldErrors?.name
                    ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                }`}
              />
              <button
                type="submit"
                id="create-category-button"
                disabled={isCreating}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer whitespace-nowrap"
              >
                {isCreating ? "Creating..." : "Add Category"}
              </button>
            </div>
            {createState?.fieldErrors?.name && (
              <p id="category-name-error" className="mt-1.5 text-xs text-red-500 font-medium">
                {createState.fieldErrors.name}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Existing Categories List */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Configured Categories
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {initialCategories.length} categor{initialCategories.length === 1 ? "y" : "ies"} registered in database
            </p>
          </div>
        </div>

        {initialCategories.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-dashed border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500">
              No categories have been created yet. Add one above to begin creating resources.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {initialCategories.map((cat) => (
              <CategoryRow
                key={cat.id}
                category={cat}
                isRenaming={renamingId === cat.id}
                onStartRename={() => {
                  if (successMessage) setSuccessMessage(null);
                  setRenamingId(cat.id);
                }}
                onCancelRename={() => setRenamingId(null)}
                onRenameSuccess={(newName) => {
                  setRenamingId(null);
                  setSuccessMessage(`Category "${newName}" renamed successfully!`);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryRow({
  category,
  isRenaming,
  onStartRename,
  onCancelRename,
  onRenameSuccess,
}: {
  category: ResourceCategory;
  isRenaming: boolean;
  onStartRename: () => void;
  onCancelRename: () => void;
  onRenameSuccess: (newName: string) => void;
}) {
  const resourceCount = category._count?.resources ?? 0;

  return (
    <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {isRenaming ? (
        <CategoryRenameForm
          category={category}
          onCancel={onCancelRename}
          onSuccess={onRenameSuccess}
        />
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-slate-900 dark:text-white">
            {category.name}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            {resourceCount} resource{resourceCount === 1 ? "" : "s"}
          </span>
        </div>
      )}

      {!isRenaming && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartRename}
            id={`rename-category-${category.id}`}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Rename
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryRenameForm({
  category,
  onCancel,
  onSuccess,
}: {
  category: ResourceCategory;
  onCancel: () => void;
  onSuccess: (newName: string) => void;
}) {
  const [name, setName] = useState(category.name);

  const [renameState, renameAction, isSubmitting] = useActionState<
    ResourceActionResult,
    FormData
  >(async (prev, formData) => {
    const res = await renameCategoryAction(prev, formData);
    if (res.success) {
      const newName = (formData.get("name") as string) || category.name;
      onSuccess(newName);
    }
    return res;
  }, { success: false });

  return (
    <form action={renameAction} className="flex-1 space-y-2">
      <input type="hidden" name="id" value={category.id} />
      {renameState?.error && !renameState?.fieldErrors?.name && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
          {renameState.error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
          autoFocus
          aria-label="Category Name *"
          aria-invalid={Boolean(renameState?.fieldErrors?.name)}
          aria-describedby={renameState?.fieldErrors?.name ? `rename-error-${category.id}` : undefined}
          className={`flex-1 max-w-sm px-3 py-1.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
            renameState?.fieldErrors?.name
              ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              : "border-slate-300 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          }`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
        >
          {isSubmitting ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          Cancel
        </button>
      </div>
      {renameState?.fieldErrors?.name && (
        <p id={`rename-error-${category.id}`} className="text-xs text-red-600 dark:text-red-400 font-medium">
          {renameState.fieldErrors.name}
        </p>
      )}
    </form>
  );
}
