import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/dal";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export const instant = false;

export const metadata = {
  title: "Sign In - Reserve Resource Management",
  description: "Sign in to access your organization's resource reservation workspace.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // If already authenticated with an active account, redirect directly to workspace
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/workspace");
  }

  const { redirect: redirectTarget } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20 font-bold text-2xl mb-4">
            R
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Sign in to Reserve
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Internal Office Resource Reservation & Governance
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <LoginForm redirectTarget={redirectTarget} />
        </div>

        {/* Informational Subtext */}
        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
          Role-governed office resource scheduling system.
        </p>
      </div>
    </div>
  );
}
