/**
 * The inline markup used in guide strings, in one place.
 *
 *   **bold**   *italic*   [label](/guide/slug)
 *
 * `parseInline` is the only parser. The React renderer, the Markdown export and
 * the plain text in the structured data all start from its tokens, so a string
 * means the same thing in all three.
 */

export type Inline =
  | { t: "text"; v: string }
  | { t: "strong"; v: string }
  | { t: "em"; v: string }
  | { t: "link"; v: string; href: string };

const TOKEN = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((\/(?:guide\/[a-z0-9-]+|guide|triage|pricing))\)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ t: "text", v: text.slice(last, at) });
    if (m[1] !== undefined) out.push({ t: "strong", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "em", v: m[2] });
    else out.push({ t: "link", v: m[3]!, href: m[4]! });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

/** Plain text: markup removed, link labels kept. */
export const toPlain = (text: string): string =>
  parseInline(text)
    .map((n) => n.v)
    .join("");

/** Markdown with absolute links, for the `.md` representation. */
export function toMarkdown(text: string, origin: string): string {
  return parseInline(text)
    .map((n) =>
      n.t === "strong" ? `**${n.v}**` : n.t === "em" ? `*${n.v}*` : n.t === "link" ? `[${n.v}](${origin}${n.href})` : n.v,
    )
    .join("");
}
