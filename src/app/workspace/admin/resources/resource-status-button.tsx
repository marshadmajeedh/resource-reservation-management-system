"use client";

import { useActionState, useState } from "react";
import { setResourceStatusAction } from "@/features/resources/actions";
import type { ResourceActionResult } from "@/features/resources/types";

interface ResourceStatusButtonProps {
  resourceId: string;
  resourceName: string;
  isActive: boolean;
}

export function ResourceStatusButton({
  resourceId,
  resourceName,
  isActive,
}: ResourceStatusButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const [state, formAction, isPending] = useActionState<
    ResourceActionResult,
    FormData
  >(async (prev, formData) => {
    const res = await setResourceStatusAction(prev, formData);
    if (res.success) {
      setShowConfirm(false);
    }
    return res;
  }, { success: false });

  if (isActive) {
    return (
      <div className="relative inline-block">
        {!showConfirm ? (
          <button
            type="button"
            id={`deactivate-button-${resourceId}`}
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 transition-colors"
          >
            Deactivate
          </button>
        ) : (
          <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg space-y-2 text-left min-w-[240px]">
            <p className="text-xs text-slate-700 dark:text-slate-300">
              Confirm deactivation for <strong>{resourceName}</strong>?
            </p>
            {state?.error && (
              <p
                role="alert"
                className="text-[11px] text-red-600 dark:text-red-400 font-medium"
              >
                {state.error}
              </p>
            )}
            <div className="flex items-center gap-2">
              <form action={formAction}>
                <input type="hidden" name="id" value={resourceId} />
                <input type="hidden" name="isActive" value="false" />
                <button
                  type="submit"
                  disabled={isPending}
                  id={`confirm-deactivate-${resourceId}`}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50"
                >
                  {isPending ? "Deactivating..." : "Yes, Deactivate"}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form action={formAction} className="inline-block">
      <input type="hidden" name="id" value={resourceId} />
      <input type="hidden" name="isActive" value="true" />
      <button
        type="submit"
        disabled={isPending}
        id={`activate-button-${resourceId}`}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition-colors disabled:opacity-50"
      >
        {isPending ? "Activating..." : "Activate"}
      </button>
      {state?.error && (
        <span role="alert" className="block text-[11px] text-red-500 mt-1">
          {state.error}
        </span>
      )}
    </form>
  );
}
