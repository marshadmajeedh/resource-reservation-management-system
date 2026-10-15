"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import { createStaffAction } from "@/features/staff/actions";
import type { StaffActionResult } from "@/features/staff/types";

export function StaffCreateForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");

  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, isPending] = useActionState<
    StaffActionResult,
    FormData
  >(async (prev, formData) => {
    const result = await createStaffAction(prev, formData);
    // Always clear passwords after submission, regardless of success or failure
    setPasswordValue("");
    setConfirmPasswordValue("");

    if (result.success) {
      setNameValue("");
      setEmailValue("");
    }
    return result;
  }, { success: false });

  // Auto-scroll or focus when opened
  useEffect(() => {
    if (isOpen) {
      const nameInput = document.getElementById("staff-name-input");
      nameInput?.focus();
    }
  }, [isOpen]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Create Staff Account
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Provision a new staff member account. Newly created accounts are granted the <code>STAFF</code> role and activated immediately.
          </p>
        </div>

        <button
          type="button"
          id="toggle-create-staff-button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto ${
            isOpen
              ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm shadow-emerald-600/20"
          }`}
          aria-expanded={isOpen}
          aria-controls="create-staff-form-container"
        >
          {isOpen ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Close Form</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Staff Member</span>
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div id="create-staff-form-container" className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          {/* Important Security & Credential Disclosure Notice */}
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-300 text-xs leading-relaxed space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Credential Distribution & Security Notice</span>
            </div>
            <p>
              Staff self-service password reset is not implemented in this assessment. Initial credentials do not automatically expire or self-destruct.
              The administrator must manually communicate the initial password to the staff member through an appropriate private, secure channel.
            </p>
          </div>

          {state?.error && (
            <div
              role="alert"
              id="staff-create-error"
              className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/80 text-red-700 dark:text-red-300 text-sm flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-semibold">Creation Error</p>
                <p className="mt-0.5 text-xs text-red-600 dark:text-red-300">{state.error}</p>
              </div>
            </div>
          )}

          {state?.success && state.staff && (
            <div
              role="status"
              id="staff-create-success"
              className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3"
            >
              <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold">Staff Account Created Successfully!</p>
                <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-300">
                  Account for <strong>{state.staff.name}</strong> ({state.staff.email}) is active and ready for login. Remember to securely communicate their initial password.
                </p>
              </div>
            </div>
          )}

          <form ref={formRef} action={formAction} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Name Field */}
              <div>
                <label
                  htmlFor="staff-name-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-name-input"
                  name="name"
                  type="text"
                  required
                  maxLength={100}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  placeholder="e.g. Alice Johnson"
                  disabled={isPending}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
                    state?.fieldErrors?.name
                      ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  }`}
                  aria-invalid={Boolean(state?.fieldErrors?.name)}
                  aria-describedby={state?.fieldErrors?.name ? "name-error" : undefined}
                />
                {state?.fieldErrors?.name && (
                  <p id="name-error" className="mt-1 text-xs text-red-500 font-medium">
                    {state.fieldErrors.name}
                  </p>
                )}
              </div>

              {/* Email Field */}
              <div>
                <label
                  htmlFor="staff-email-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-email-input"
                  name="email"
                  type="email"
                  required
                  maxLength={255}
                  value={emailValue}
                  onChange={(e) => setEmailValue(e.target.value)}
                  placeholder="alice@reserve.local"
                  disabled={isPending}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
                    state?.fieldErrors?.email
                      ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  }`}
                  aria-invalid={Boolean(state?.fieldErrors?.email)}
                  aria-describedby={state?.fieldErrors?.email ? "email-error" : undefined}
                />
                {state?.fieldErrors?.email && (
                  <p id="email-error" className="mt-1 text-xs text-red-500 font-medium">
                    {state.fieldErrors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Initial Password */}
              <div>
                <label
                  htmlFor="staff-password-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Initial Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-password-input"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  disabled={isPending}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
                    state?.fieldErrors?.password
                      ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  }`}
                  aria-invalid={Boolean(state?.fieldErrors?.password)}
                  aria-describedby={state?.fieldErrors?.password ? "password-error" : undefined}
                />
                {state?.fieldErrors?.password ? (
                  <p id="password-error" className="mt-1 text-xs text-red-500 font-medium">
                    {state.fieldErrors.password}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Must be 8 to 128 characters long.
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  htmlFor="staff-confirm-password-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="staff-confirm-password-input"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  maxLength={128}
                  value={confirmPasswordValue}
                  onChange={(e) => setConfirmPasswordValue(e.target.value)}
                  placeholder="Repeat initial password"
                  autoComplete="new-password"
                  disabled={isPending}
                  className={`w-full px-3.5 py-2.5 rounded-xl text-sm bg-slate-50 dark:bg-slate-950 border transition-all text-slate-900 dark:text-slate-100 ${
                    state?.fieldErrors?.confirmPassword
                      ? "border-red-300 dark:border-red-800 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      : "border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  }`}
                  aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)}
                  aria-describedby={state?.fieldErrors?.confirmPassword ? "confirm-error" : undefined}
                />
                {state?.fieldErrors?.confirmPassword && (
                  <p id="confirm-error" className="mt-1 text-xs text-red-500 font-medium">
                    {state.fieldErrors.confirmPassword}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-create-staff-button"
                disabled={isPending}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 transition-all shadow-sm shadow-emerald-600/20 cursor-pointer flex items-center gap-2"
              >
                {isPending && (
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                <span>{isPending ? "Creating Account..." : "Create Staff Account"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
