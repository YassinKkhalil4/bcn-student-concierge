import { llmsFullTxt } from "@/lib/guide/markdown";
import { siteOrigin } from "@/lib/agents/pages";

export const dynamic = "force-dynamic";

/** For AI assistants: what the site offers and where the guide's text lives (llmstxt.org). */
export function GET(): Response {
  return new Response(llmsFullTxt(siteOrigin()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
