"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createResourceAction,
  updateResourceAction,
} from "@/features/resources/actions";
import type {
  Resource,
  ResourceCategory,
  ResourceActionResult,
} from "@/features/resources/types";

interface ResourceFormProps {
  mode: "create" | "edit";
  categories: ResourceCategory[];
  initialData?: Resource | null;
}

export function ResourceForm({
  mode,
  categories,
  initialData,
}: ResourceFormProps) {
  const router = useRouter();

  const actionFn = mode === "create" ? createResourceAction : updateResourceAction;

  const [state, formAction, isPending] = useActionState<
    ResourceActionResult,
    FormData
  >(async (prev, formData) => {
    const res = await actionFn(prev, formData);
    if (res.success) {
      router.push("/workspace/admin/resources");
      router.refresh();
    }
    return res;
  }, { success: false });

  return (
    <form action={formAction} className="space-y-6 max-w-2xl" noValidate>
      {mode === "edit" && initialData && (
        <input type="hidden" name="id" value={initialData.id} />
      )}

      {state?.error && !state?.fieldErrors && (
        <div
          role="alert"
          id="resource-form-error"
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
          <span className="font-medium">{state.error}</span>
        </div>
      )}

      {/* Resource Name */}
      <div className="space-y-1.5">
        <label
          htmlFor="resource-name"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Resource Name <span className="text-red-500">*</span>
        </label>
        <input
          id="resource-name"
          name="name"
          type="text"
          maxLength={100}
          required
          defaultValue={initialData?.name ?? ""}
          placeholder="e.g. Executive Boardroom A, Mobile 4K Projector"
          className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        {state?.fieldErrors?.name && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
            {state.fieldErrors.name}
          </p>
        )}
      </div>

      {/* Category Selection */}
      <div className="space-y-1.5">
        <label
          htmlFor="resource-category"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Category <span className="text-red-500">*</span>
        </label>
        <select
          id="resource-category"
          name="categoryId"
          required
          defaultValue={initialData?.categoryId ?? ""}
          className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        >
          <option value="" disabled>
            Select a category...
          </option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        {state?.fieldErrors?.categoryId && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
            {state.fieldErrors.categoryId}
          </p>
        )}
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label
          htmlFor="resource-location"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Physical Location <span className="text-red-500">*</span>
        </label>
        <input
          id="resource-location"
          name="location"
          type="text"
          maxLength={150}
          required
          defaultValue={initialData?.location ?? ""}
          placeholder="e.g. 4th Floor - East Wing, Storage Room B"
          className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        {state?.fieldErrors?.location && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
            {state.fieldErrors.location}
          </p>
        )}
      </div>

      {/* Capacity */}
      <div className="space-y-1.5">
        <label
          htmlFor="resource-capacity"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Capacity <span className="text-slate-400 font-normal lowercase">(optional positive integer)</span>
        </label>
        <input
          id="resource-capacity"
          name="capacity"
          type="number"
          min={1}
          max={100000}
          step={1}
          defaultValue={initialData?.capacity ?? ""}
          placeholder="e.g. 10 (leave blank if not applicable)"
          className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        {state?.fieldErrors?.capacity && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
            {state.fieldErrors.capacity}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label
          htmlFor="resource-description"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300"
        >
          Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
        </label>
        <textarea
          id="resource-description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={initialData?.description ?? ""}
          placeholder="Add amenities, equipment, access instructions, or usage guidelines..."
          className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        {state?.fieldErrors?.description && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 font-medium">
            {state.fieldErrors.description}
          </p>
        )}
      </div>

      {/* Initial Active Status (Create mode only) */}
      {mode === "create" && (
        <div className="flex items-center gap-3 pt-2">
          <input
            id="resource-active-check"
            name="isActive"
            type="checkbox"
            defaultChecked={true}
            value="true"
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label
            htmlFor="resource-active-check"
            className="text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            Activate resource immediately upon creation
          </label>
        </div>
      )}

      {/* Edit preservation note */}
      {mode === "edit" && (
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
          <strong>Note:</strong> Modifying resource details preserves the unique resource ID, creation date, active status, and all existing reservation histories.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="submit"
          disabled={isPending}
          id="submit-resource-button"
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer"
        >
          {isPending
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
            ? "Create Resource"
            : "Save Changes"}
        </button>
        <Link
          href="/workspace/admin/resources"
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
