import { llmsFullTxt } from "@/lib/agents/markdown";
import { siteOrigin } from "@/lib/agents/pages";

export const dynamic = "force-dynamic";

/** For AI assistants: all public content in one Markdown document (llmstxt.org). */
export async function GET(): Promise<Response> {
  return new Response(await llmsFullTxt(siteOrigin()), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
