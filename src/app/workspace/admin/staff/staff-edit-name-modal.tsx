"use client";

import { useActionState, useState } from "react";
import { updateStaffNameAction } from "@/features/staff/actions";
import type { StaffActionResult } from "@/features/staff/types";

interface StaffEditNameModalProps {
  staffId: string;
  staffName: string;
  staffEmail: string;
}

export function StaffEditNameModal({
  staffId,
  staffName,
  staffEmail,
}: StaffEditNameModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="inline-block">
      <button
        type="button"
        id={`edit-staff-button-${staffId}`}
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
      >
        Edit Name
      </button>

      {isOpen && (
        <StaffEditNameDialog
          staffId={staffId}
          staffName={staffName}
          staffEmail={staffEmail}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

interface StaffEditNameDialogProps {
  staffId: string;
  staffName: string;
  staffEmail: string;
  onClose: () => void;
}

function StaffEditNameDialog({
  staffId,
  staffName,
  staffEmail,
  onClose,
}: StaffEditNameDialogProps) {
  const [nameValue, setNameValue] = useState(staffName);

  const [state, formAction, isPending] = useActionState<
    StaffActionResult,
    FormData
  >(async (prev, formData) => {
    const res = await updateStaffNameAction(prev, formData);
    if (res.success) {
      onClose();
    }
    return res;
  }, { success: false });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`edit-staff-name-title-${staffId}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-left">
        <div>
          <h3
            id={`edit-staff-name-title-${staffId}`}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
          >
            Edit Staff Member Name
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Update display name for this staff account. Email modifications are outside this scope.
          </p>
        </div>

        {state?.error && !state?.fieldErrors?.name && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-red-700 dark:text-red-300 text-xs font-medium"
          >
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={staffId} />

          {/* Read-Only Email Display */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Email Address
            </label>
            <div className="px-3.5 py-2.5 rounded-xl text-sm bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 cursor-not-allowed font-mono">
              {staffEmail}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Email addresses are permanently assigned and cannot be edited.
            </p>
          </div>

          {/* Editable Name Field */}
          <div>
            <label
              htmlFor={`edit-name-input-${staffId}`}
              className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1"
            >
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id={`edit-name-input-${staffId}`}
              name="name"
              type="text"
              required
              maxLength={100}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              disabled={isPending}
              aria-invalid={Boolean(state?.fieldErrors?.name)}
              aria-describedby={state?.fieldErrors?.name ? `edit-name-error-${staffId}` : undefined}
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
                state?.fieldErrors?.name
                  ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              }`}
            />
            {state?.fieldErrors?.name && (
              <p
                id={`edit-name-error-${staffId}`}
                className="mt-1 text-xs text-red-500 font-medium"
              >
                {state.fieldErrors.name}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id={`save-staff-name-button-${staffId}`}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
            >
              {isPending && (
                <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              <span>{isPending ? "Saving..." : "Save Name"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
