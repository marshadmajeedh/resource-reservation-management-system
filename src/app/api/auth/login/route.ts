import { NextRequest, NextResponse } from "next/server";
import { authenticateCredentials } from "@/features/auth/service";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/features/auth/cookies";
import { validateMutationOrigin } from "@/features/auth/csrf";

export async function POST(request: NextRequest) {
  if (!validateMutationOrigin(request.headers)) {
    return NextResponse.json(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }

  const { email, password } = (body as Record<string, unknown>) || {};
  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 400 }
    );
  }

  const result = await authenticateCredentials({ email, password });

  if (!result.success) {
    const status = result.retryAfterSeconds ? 429 : 401;
    return NextResponse.json({ error: result.error }, { status });
  }

  const response = NextResponse.json({ user: result.user }, { status: 200 });
  const cookieOptions = getSessionCookieOptions();

  response.cookies.set(SESSION_COOKIE_NAME, result.token, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path,
    maxAge: cookieOptions.maxAge,
    expires: cookieOptions.expires,
  });

  return response;
}
