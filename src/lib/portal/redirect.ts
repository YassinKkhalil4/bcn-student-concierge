import { NextResponse } from "next/server";
import { isSiteLocale, localizedPath, type SiteLocale } from "@/i18n/routing";

/**
 * The page's language, sent by every portal form as a hidden "locale" field,
 * so the page a form lands on (and any email it triggers) stays in the
 * language the student was reading. Anything unexpected falls back to English.
 */
export function formLocale(form: FormData | null): SiteLocale {
  const value = form?.get("locale");
  return isSiteLocale(value) ? value : "en";
}

/**
 * 303 to a portal page in the student's language. The origin is the configured
 * one, never the request's Host header. `path` may carry a query string.
 */
export function portalRedirect(request: Request, locale: SiteLocale, path: string): NextResponse {
  const [pathname, query] = path.split("?", 2) as [string, string | undefined];
  const target = localizedPath(locale, pathname) + (query ? `?${query}` : "");
  return NextResponse.redirect(new URL(target, process.env.PUBLIC_ORIGIN ?? request.url), { status: 303 });
}
