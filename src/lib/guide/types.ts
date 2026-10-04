/**
 * The guide, as data.
 *
 * Landing in Barcelona exists as a PDF. These types describe the same content
 * as typed blocks so that one source renders three ways: the web page a student
 * reads, the Markdown an AI assistant is offered, and the plain-text answers in
 * the structured data. Written once, the three cannot drift apart.
 *
 * Inline markup in any string: **bold**, *italic*, and [text](/guide/slug) for
 * a link inside the guide. Nothing else. It is parsed into React nodes, never
 * injected as HTML.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  /** A box that sets one thing apart. `key` is the idea to keep; `warning` is the trap. */
  | { kind: "callout"; tone: "key" | "note" | "warning"; title: string; body: string[] }
  /** Numbered steps. `tags` are short labels (form names, fees). */
  | { kind: "steps"; items: { title: string; body: string[]; tags?: string[] }[] }
  | { kind: "checklist"; title?: string; items: string[] }
  /** Side-by-side options: routes, rungs, vocabulary. */
  | { kind: "cards"; items: { label?: string; title: string; subtitle?: string; body: string[]; meta?: string; href?: string; cta?: string }[] }
  | { kind: "table"; caption?: string; head: string[]; rows: string[][]; note?: string }
  | { kind: "phrases"; title: string; rows: { spanish: string; english: string }[] };

export interface Source {
  label: string;
  /** Present only where the official page's address is known. */
  url?: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Chapter {
  /** URL segment: /guide/<slug>. Stable once published. */
  slug: string;
  /** "01", "05A": the number the PDF uses, so the two can be cited together. */
  number: string;
  /** Short label for the contents list. */
  navTitle: string;
  /** The page's h1. Written for the question a student types into a search box. */
  title: string;
  /** Full <title>, 60 characters at most. */
  metaTitle: string;
  /** Meta description, 155 characters at most. */
  description: string;
  /** Small label above the heading. */
  kicker: string;
  /** The opening paragraph. */
  lede: string;
  /** Three to five sentences an assistant can quote on their own. */
  keyFacts: string[];
  blocks: Block[];
  faq?: Faq[];
  sources: Source[];
}
