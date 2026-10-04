import { PRIVATE_PREFIXES, siteOrigin } from "@/lib/agents/pages";

export const dynamic = "force-dynamic";

/**
 * robots.txt (RFC 9309), plus Content Signals (contentsignals.org).
 *
 * Written by hand rather than through Next's MetadataRoute helper, which
 * cannot express the Content-Signal directive.
 *
 * The policy, which is a business decision and belongs to the owner:
 *   - The marketing and legal pages are open to everyone, including AI
 *     assistants that answer questions and cite sources. Students find this
 *     service by asking exactly those questions.
 *   - Bulk collection for model training is allowed on those same pages.
 *   - Everything holding personal data — intake, portal, dashboard, API — is
 *     closed to every crawler. robots.txt is only a request, so those paths
 *     are also behind sessions and carry X-Robots-Tag: noindex.
 */

/** Crawlers that read a page to answer a question and cite it. Welcome. */
const ANSWER_ENGINES = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
];

/** Crawlers that collect pages for model training. Welcome on public pages. */
const TRAINING_CRAWLERS = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Bytespider",
  "meta-externalagent",
  "Amazonbot",
  "cohere-ai",
  "Diffbot",
  "Omgilibot",
  "Timpibot",
];

/**
 * ai-train=yes  — this content may be used to train or fine-tune a model.
 * ai-input=yes  — using a page to answer someone's question is fine.
 * search=yes    — ordinary search indexing is fine.
 */
const CONTENT_SIGNAL = "ai-train=yes, search=yes, ai-input=yes";

function group(agents: string[], lines: string[]): string {
  return [...agents.map((a) => `User-agent: ${a}`), ...lines].join("\n");
}

const disallowPrivate = PRIVATE_PREFIXES.map((p) => `Disallow: ${p}/`);

export function GET(): Response {
  const body = [
    "# BCN Student Concierge — https://bcnstudent.com",
    "# Public pages are open. Anything holding a student's data is not.",
    "",
    group(["*"], [
      `Content-Signal: ${CONTENT_SIGNAL}`,
      "Allow: /",
      ...disallowPrivate,
    ]),
    "",
    "# AI assistants answering a question, and citing us: welcome.",
    group(ANSWER_ENGINES, [
      `Content-Signal: ${CONTENT_SIGNAL}`,
      "Allow: /",
      ...disallowPrivate,
    ]),
    "",
    "# Collection for model training: welcome on public pages.",
    group(TRAINING_CRAWLERS, [
      `Content-Signal: ${CONTENT_SIGNAL}`,
      "Allow: /",
      ...disallowPrivate,
    ]),
    "",
    `Sitemap: ${siteOrigin()}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
