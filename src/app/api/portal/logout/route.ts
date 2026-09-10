import { NextResponse } from "next/server";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL("/portal/login", process.env.PUBLIC_ORIGIN ?? request.url),
    { status: 303 },
  );
  response.cookies.set(PORTAL_COOKIE, "", { ...portalCookieOptions, maxAge: 0 });
  return response;
}
