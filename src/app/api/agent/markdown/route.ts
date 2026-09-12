import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { isSiteLocale, routing } from "@/i18n/routing";
import { isPublicPage } from "@/lib/agents/pages";
import { renderPageMarkdown } from "@/lib/agents/markdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Markdown view of a public page, reached two ways (src/middleware.ts):
 * `Accept: text/markdown` on the page itself, or its `.md` URL.
 *
 * The page and language arrive as request headers set by that rewrite — a
 * rewrite's query string does not reach the handler. They are still treated as
 * untrusted input: only pages on the public list are rendered, so this can
 * never fall through to a path a student's data lives behind.
 */
export async function GET(): Promise<Response> {
  const head = await headers();
  const page = head.get("x-agent-markdown-path") ?? "";
  const requested = head.get("x-agent-markdown-locale") ?? routing.defaultLocale;
  const locale = isSiteLocale(requested) ? requested : routing.defaultLocale;

  if (!isPublicPage(page)) {
    return NextResponse.json({ error: "No Markdown for this page" }, { status: 404 });
  }

  const markdown = await renderPageMarkdown(page, locale);
  if (markdown === null) {
    return NextResponse.json({ error: "No Markdown for this page" }, { status: 404 });
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Language": locale,
      Vary: "Accept",
      // Reached by content negotiation, this is one of two answers at the same
      // URL, and Next drops our Vary — so no shared cache may keep it. The .md
      // URL is its own resource and is safe to cache.
      "Cache-Control":
        head.get("x-agent-markdown-negotiated") === "1" ? "no-store" : "public, max-age=600",
    },
  });
}
