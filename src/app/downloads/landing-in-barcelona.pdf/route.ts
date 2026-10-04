import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import {
  GUIDE_VISITOR_COOKIE,
  SOURCE_COOKIE,
  SOURCE_PARAM,
  attributionCookieOptions,
  attributionFromRequest,
  parseSource,
} from "@/lib/attribution";
import { generateToken } from "@/lib/crypto";
import { LOCALES, type Locale } from "@/lib/db/schema";
import { guideFilename } from "@/lib/guide";
import { recordGuideDownload } from "@/lib/server/guide-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The guide PDF, at its stable URL (GUIDE_PATH), saved as GUIDE_FILENAME.
 *
 * Ungated on purpose: no email, no form. Served by a handler rather than as a
 * static file so each download is recorded — with the school link it came
 * through — and the browser is given the anonymous download id that later
 * lets a triage enquiry be attributed to it (src/lib/attribution.ts).
 */
const DIR = path.join(process.cwd(), "assets", "guide");
const fileFor = (locale: string | null) =>
  path.join(DIR, !locale || locale === "en" ? "landing-in-barcelona.pdf" : `landing-in-barcelona.${locale}.pdf`);

const cached = new Map<string, Promise<Buffer>>();
const pdf = (locale: string | null) => {
  const key = locale ?? "en";
  let p = cached.get(key);
  if (!p) {
    // A language without its own file gets the English one, never a 404.
    p = readFile(fileFor(locale)).catch(() => readFile(fileFor(null)));
    p.catch(() => cached.delete(key));
    cached.set(key, p);
  }
  return p;
};

/** `?l=` is only ever one of the site's languages. */
const localeOf = (request: NextRequest): Locale | null => {
  const requested = request.nextUrl.searchParams.get("l");
  return (LOCALES as readonly string[]).includes(requested ?? "") ? (requested as Locale) : null;
};

/** Link unfurlers, crawlers and prefetches are not readers. */
function isAutomated(request: NextRequest): boolean {
  const purpose = request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  if (purpose.includes("prefetch")) return true;
  const ua = request.headers.get("user-agent") ?? "";
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|curl|wget|python|headless/i.test(ua);
}

function headers(size: number, locale: string | null): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${guideFilename(locale)}"`,
    // Every download must reach this handler to be counted, so no shared
    // cache may answer for it.
    "Cache-Control": "private, no-store",
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const locale = localeOf(request);
  let body: Buffer;
  try {
    body = await pdf(locale);
  } catch (error) {
    console.error("[guide] PDF missing", error);
    return NextResponse.json({ error: "Guide unavailable" }, { status: 503 });
  }

  const known = attributionFromRequest(request);
  // The link's own ?s= wins: a forwarded link carries the school that sent it.
  const source = parseSource(request.nextUrl.searchParams.get(SOURCE_PARAM)) ?? known.source;
  const visitorId = known.guideVisitorId ?? generateToken();
  if (!isAutomated(request)) {
    // Analytics must never cost a reader the file.
    await recordGuideDownload({ visitorId, source, locale }).catch((error) =>
      console.error("[guide] could not record download", error),
    );
  }

  const response = new NextResponse(new Uint8Array(body), { status: 200, headers: headers(body.length, locale) });
  response.cookies.set(GUIDE_VISITOR_COOKIE, visitorId, attributionCookieOptions);
  if (source) response.cookies.set(SOURCE_COOKIE, source, attributionCookieOptions);
  return response;
}

export async function HEAD(request: NextRequest): Promise<NextResponse> {
  const locale = localeOf(request);
  try {
    const body = await pdf(locale);
    return new NextResponse(null, { status: 200, headers: headers(body.length, locale) });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
