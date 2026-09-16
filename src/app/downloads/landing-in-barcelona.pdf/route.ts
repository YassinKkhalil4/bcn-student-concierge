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
import { GUIDE_FILENAME } from "@/lib/guide";
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
const FILE = path.join(process.cwd(), "assets", "guide", "landing-in-barcelona.pdf");

let cached: Promise<Buffer> | null = null;
const pdf = () => (cached ??= readFile(FILE).catch((error) => {
  cached = null;
  throw error;
}));

/** Link unfurlers, crawlers and prefetches are not readers. */
function isAutomated(request: NextRequest): boolean {
  const purpose = request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  if (purpose.includes("prefetch")) return true;
  const ua = request.headers.get("user-agent") ?? "";
  return !ua || /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|curl|wget|python|headless/i.test(ua);
}

function headers(size: number): HeadersInit {
  return {
    "Content-Type": "application/pdf",
    "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${GUIDE_FILENAME}"`,
    // Every download must reach this handler to be counted, so no shared
    // cache may answer for it.
    "Cache-Control": "private, no-store",
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  let body: Buffer;
  try {
    body = await pdf();
  } catch (error) {
    console.error("[guide] PDF missing", error);
    return NextResponse.json({ error: "Guide unavailable" }, { status: 503 });
  }

  const known = attributionFromRequest(request);
  // The link's own ?s= wins: a forwarded link carries the school that sent it.
  const source = parseSource(request.nextUrl.searchParams.get(SOURCE_PARAM)) ?? known.source;
  const visitorId = known.guideVisitorId ?? generateToken();
  const requested = request.nextUrl.searchParams.get("l");
  const locale = (LOCALES as readonly string[]).includes(requested ?? "") ? (requested as Locale) : null;

  if (!isAutomated(request)) {
    // Analytics must never cost a reader the file.
    await recordGuideDownload({ visitorId, source, locale }).catch((error) =>
      console.error("[guide] could not record download", error),
    );
  }

  const response = new NextResponse(new Uint8Array(body), { status: 200, headers: headers(body.length) });
  response.cookies.set(GUIDE_VISITOR_COOKIE, visitorId, attributionCookieOptions);
  if (source) response.cookies.set(SOURCE_COOKIE, source, attributionCookieOptions);
  return response;
}

export async function HEAD(): Promise<NextResponse> {
  try {
    const body = await pdf();
    return new NextResponse(null, { status: 200, headers: headers(body.length) });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
