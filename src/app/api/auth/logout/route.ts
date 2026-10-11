import { NextRequest, NextResponse } from "next/server";
import { getLogoutCookieOptions, SESSION_COOKIE_NAME } from "@/features/auth/cookies";
import { validateMutationOrigin } from "@/features/auth/csrf";

export async function POST(request: NextRequest) {
  if (!validateMutationOrigin(request.headers)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  const logoutOptions = getLogoutCookieOptions();

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: logoutOptions.httpOnly,
    secure: logoutOptions.secure,
    sameSite: logoutOptions.sameSite,
    path: logoutOptions.path,
    maxAge: logoutOptions.maxAge,
    expires: logoutOptions.expires,
  });

  return response;
}
