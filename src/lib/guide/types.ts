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

export type Tone = "eu" | "non" | "all";
export type GanttTone = "legal" | "blocks" | "easy" | "nobody";
export type Owner = "you" | "nobody" | "office";

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  /** A box that sets one thing apart. `key` is the idea to keep; `warning` is the trap; `tip` is good news. */
  | { kind: "callout"; tone: "key" | "note" | "warning" | "tip"; title: string; body: string[] }
  /** Numbered steps. `tags` are short labels (form names, fees). */
  | { kind: "steps"; items: { title: string; body: string[]; tags?: string[] }[] }
  | { kind: "checklist"; title?: string; count?: string; items: string[] }
  /** Side-by-side options: routes, rungs, vocabulary. `effort` is 1 to 4 and draws the meter. */
  | {
      kind: "cards";
      items: { label?: string; tag?: string; effort?: number; title: string; subtitle?: string; body: string[]; meta?: string; href?: string; cta?: string }[];
    }
  | { kind: "table"; caption?: string; head: string[]; rows: string[][]; note?: string; blankLastColumn?: boolean }
  | { kind: "phrases"; title: string; head: [string, string]; rows: { spanish: string; english: string }[] }
  // ── Visuals, drawn from the guide's own charts ──────────────────────────
  /** Route A and Route B as two facts cards. */
  | { kind: "routecards"; items: { tone: "eu" | "non"; label: string; title: string; lede: string; rows: { k: string; v: string }[]; href: string; cta: string }[] }
  /** The first term as lanes of stops. Each lane is one route; `wait` is the stretch nobody controls. */
  | {
      kind: "swimlanes";
      lanes: { tone: Tone; chip: string; name: string; sub: string; stops: { label: string; sub?: string; mark?: "deadline" | "final" }[]; wait?: { label: string; from: number; to: number } }[];
    }
  /** Two series compared bar by bar. Percentages are of the longest bar in the row group. */
  | {
      kind: "bars2";
      title: string;
      legend: [string, string];
      rows: ({ label: string; sub?: string; eu: { v: string; pct: number }; non: { v: string; pct: number } } | { label: string; sub?: string; chips: [string, string] })[];
    }
  /** A to-scale chart of the first 90 days. `from` and `to` are days, 0 to 90. */
  | {
      kind: "gantt";
      title: string;
      sub: string;
      legend: { tone: GanttTone; label: string }[];
      axisStart: string;
      rows: { label: string; sub: string; tag?: { tone: Tone; label: string }; tone: GanttTone; from: number; to: number; value: string; mark?: boolean }[];
      note?: string;
    }
  /** NIE, TIE and the rest: a word, its native name, what it is, what to remember. */
  | { kind: "terms"; head: [string, string, string]; rows: { term: string; native: string; kind: string; what: string[]; remember: string[] }[] }
  /** Who controls each step: you, nobody, or the office. */
  | { kind: "controls"; title: string; legend: { owner: Owner; label: string }[]; steps: { n: string; sub: string; owner: Owner }[]; next?: string }
  /** The appointment-day kit: a checklist beside the photo spec. */
  | { kind: "kit"; checklist: { title: string; count: string; items: string[] }; photo: { title: string; size: string; rules: string[]; note: string } }
  /** Horizontal strips on a shared scale: what protects you, where a policy gap sits, old rule against new. */
  | {
      kind: "strips";
      title: string;
      tag?: string;
      legend?: string;
      rows: { label: string; segs: { from: number; to: number; tone: "red" | "teal" | "ink" | "purple" | "amber" | "grey" | "gap"; text?: string; dashed?: boolean }[]; value?: string }[];
      note?: string;
    }
  /** Four stops from booking to renewal, with an address example. */
  | {
      kind: "flow";
      title: string;
      aside: string;
      steps: { icon: "calendar" | "pin" | "mail" | "renew"; title: string; body: string; tag?: string }[];
      example: { label: string; bad: string; good: string };
    }
  /** What the paperwork costs, as bars. `min` and `max` are euros. */
  | {
      kind: "costbars";
      title: string;
      total: string;
      legend: [string, string];
      rows: { label: string; tag: { tone: Tone | "free"; label: string }; value: string; min: number; max: number }[];
      axis: number[];
      note: string;
    }
  /** Twelve dots against thirteen: why a 28-day plan costs more than a monthly one. */
  | { kind: "cycle"; label: string; rows: { label: string; count: number; extra?: boolean }[] }
  /** Documents, systems and visits for each task, as stacked bars. */
  | {
      kind: "workload";
      title: string;
      sub: string;
      legend: [string, string, string];
      rows: { label: string; d: number; s: number; v: number; total: string }[];
      note: string;
    }
  /** Three big-number cards. */
  | { kind: "statcards"; items: { big: string; unit: string; tone: "teal" | "ink" | "amber"; body: string[]; ruler?: { oldLabel: string; old: string; nowLabel: string; now: string } }[] }
  /** Numbers to call. */
  | { kind: "numbers"; title: string; rows: { n: string; label: string }[] }
  /** The two packages and their add-ons. Prices are read from the site's pricing table when the data is built. */
  | {
      kind: "packages";
      terms: string[];
      tiers: { name: string; sub: string; eu: string; non: string; badge?: string }[];
      routes: [string, string];
      sections: { title: string; rows: { label: string; has: boolean[] }[] }[];
      addonsTitle: string;
      addons: { name: string; price: string; body: string }[];
    };

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
  /** "01" to "15": the number the PDF uses, so the two can be cited together. */
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
  /** Which part of the guide it sits in: "Part 1 · Get oriented". */
  part: string;
  /** Who it is for, as the PDF's coloured tags. */
  audience: { tone: Tone; label: string }[];
  /** The opening paragraph. */
  lede: string;
  /** Three to five sentences an assistant can quote on their own. */
  keyFacts: string[];
  blocks: Block[];
  faq?: Faq[];
  sources: Source[];
}
