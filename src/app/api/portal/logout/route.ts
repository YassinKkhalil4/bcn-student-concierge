import { NextResponse } from "next/server";
import { PORTAL_COOKIE, portalCookieOptions } from "@/lib/portal/session";
import { formLocale, portalRedirect } from "@/lib/portal/redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  const form = await request.formData().catch(() => null);
  const response = portalRedirect(request, formLocale(form), "/portal/login");
  response.cookies.set(PORTAL_COOKIE, "", { ...portalCookieOptions, maxAge: 0 });
  return response;
}
