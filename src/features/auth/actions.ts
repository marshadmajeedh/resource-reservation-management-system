"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateCredentials } from "./service.ts";
import { getLogoutCookieOptions, getSessionCookieOptions, SESSION_COOKIE_NAME } from "./cookies.ts";
import { validateMutationOrigin, sanitizeRedirectUrl } from "./csrf.ts";

export interface LoginFormState {
  error?: string;
  success?: boolean;
}

/**
 * Server Action for User Login.
 *
 * Security Mandates:
 * 1. Checks Origin/Referer header to defend against CSRF attacks.
 * 2. Does not trim or lowercase password.
 * 3. Sets JWT in an HttpOnly, Secure, SameSite=Lax cookie.
 * 4. Sanitizes redirect destination to prevent open redirect vulnerabilities.
 */
export async function loginAction(
  _prevState: LoginFormState | null,
  formData: FormData
): Promise<LoginFormState> {
  const reqHeaders = await headers();
  if (!validateMutationOrigin(reqHeaders)) {
    return { error: "Cross-origin request rejected." };
  }

  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTarget = formData.get("redirect");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Invalid email or password." };
  }

  const result = await authenticateCredentials({ email, password });

  if (!result.success) {
    return { error: result.error };
  }

  const cookieStore = await cookies();
  const cookieOptions = getSessionCookieOptions();

  cookieStore.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    maxAge: cookieOptions.maxAge,
    expires: cookieOptions.expires,
  });

  const destination = sanitizeRedirectUrl(
    typeof redirectTarget === "string" ? redirectTarget : null,
    "/workspace"
  );

  redirect(destination);
}

/**
 * Server Action for User Logout.
 *
 * Security & Limitation Note:
 * Clears the session cookie from the browser using matching cookie options.
 * Deleting the cookie removes it from the browser; however, in a stateless JWT architecture
 * without a distributed blacklist or session table, an externally copied JWT remains
 * cryptographically valid until its 8-hour expiry.
 */
export async function logoutAction(): Promise<void> {
  const reqHeaders = await headers();
  if (!validateMutationOrigin(reqHeaders)) {
    throw new Error("Cross-origin request rejected.");
  }

  const cookieStore = await cookies();
  const logoutOptions = getLogoutCookieOptions();

  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: logoutOptions.httpOnly,
    secure: logoutOptions.secure,
    sameSite: logoutOptions.sameSite,
    path: logoutOptions.path,
    maxAge: logoutOptions.maxAge,
    expires: logoutOptions.expires,
  });

  redirect("/login");
}
