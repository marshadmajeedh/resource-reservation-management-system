"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/features/auth/actions";
import type { SafeUser } from "@/features/auth/types";

interface WorkspaceNavProps {
  user: SafeUser;
}

export function WorkspaceNav({ user }: WorkspaceNavProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";

  const navLinks = [
    { href: "/workspace", label: "Overview", exact: true },
    { href: "/workspace/resources", label: "Browse Resources", exact: false },
    { href: "/workspace/reservations", label: "My Reservations", exact: false },
  ];

  const adminLinks = [
    { href: "/workspace/admin/resources", label: "Manage Resources", exact: false },
    { href: "/workspace/admin/categories", label: "Categories", exact: false },
    { href: "/workspace/admin/reservations", label: "All Reservations", exact: false },
  ];

  const isLinkActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-50 dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Main Nav */}
          <div className="flex items-center gap-8">
            <Link href="/workspace" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-md shadow-emerald-500/20 text-white font-bold text-lg transition-transform group-hover:scale-105">
                R
              </div>
              <div className="flex items-center">
                <span className="font-bold tracking-tight text-slate-900 dark:text-white">
                  Reserve
                </span>
                <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Workspace
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5" aria-label="Main navigation">
              {navLinks.map((link) => {
                const active = isLinkActive(link.href, link.exact);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {isAdmin && (
                <>
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1.5" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-purple-600 dark:text-purple-400 px-1.5">
                    Admin
                  </span>
                  {adminLinks.map((link) => {
                    const active = isLinkActive(link.href, link.exact);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          active
                            ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span id="user-display-name" className="text-xs font-semibold text-slate-900 dark:text-white">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {isAdmin ? "Administrator" : "Staff"}
              </span>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                id="nav-logout-button"
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="md:hidden py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {navLinks.map((link) => {
            const active = isLinkActive(link.href, link.exact);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                  active
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                    : "text-slate-600 dark:text-slate-300"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {isAdmin &&
            adminLinks.map((link) => {
              const active = isLinkActive(link.href, link.exact);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                    active
                      ? "bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
        </div>
      </div>
    </header>
  );
}
