import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const response = NextResponse.redirect(
    new URL("/admin/login", process.env.PUBLIC_ORIGIN ?? request.url),
    { status: 303 },
  );
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
