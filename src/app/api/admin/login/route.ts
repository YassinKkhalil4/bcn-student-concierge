import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/admin/password";
import { clientIdentifier, rateLimit } from "@/lib/rate-limit";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  adminConfigured,
  createSessionToken,
} from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redirect targets are fixed paths — never taken from the request. Resolved
 * against PUBLIC_ORIGIN so that behind the proxy they point straight at
 * https://bcnstudent.com rather than the internal address the app sees.
 */
function back(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, process.env.PUBLIC_ORIGIN ?? request.url), {
    status: 303,
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  // 5 attempts per 15 minutes, failing CLOSED. Checked before the password so a
  // locked-out client cannot keep making the server run scrypt. The form is a
  // plain HTML post, so a lockout redirects back with a message, not JSON.
  if (!(await rateLimit(clientIdentifier(request.headers), "admin-login")).allowed) {
    return back(request, "/admin/login?error=locked");
  }

  if (!adminConfigured()) {
    console.error("[admin] login attempted but ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET unset");
    return back(request, "/admin/login?error=unconfigured");
  }

  const form = await request.formData().catch(() => null);
  const password = form?.get("password");
  // Cap the length: scrypt cost scales with input, and nobody's password is 1KB.
  if (typeof password !== "string" || password.length === 0 || password.length > 256) {
    return back(request, "/admin/login?error=invalid");
  }

  if (!(await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH))) {
    console.warn("[admin] failed login");
    return back(request, "/admin/login?error=invalid");
  }

  const response = back(request, "/admin");
  response.cookies.set(ADMIN_COOKIE, await createSessionToken(), {
    httpOnly: true, // unreachable from page scripts
    secure: process.env.NODE_ENV === "production",
    // Strict: the cookie is never sent on a request started by another site,
    // which shuts out CSRF against the admin actions entirely.
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  console.info("[admin] login");
  return response;
}
