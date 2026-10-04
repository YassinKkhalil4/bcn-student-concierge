import type { Chapter } from "./types";
import pdfEs from "./i18n/pdf-es.json";
import pdfCa from "./i18n/pdf-ca.json";
import pdfFr from "./i18n/pdf-fr.json";
import pdfIt from "./i18n/pdf-it.json";
import pdfDe from "./i18n/pdf-de.json";
import webEs from "./i18n/web-es.json";
import webCa from "./i18n/web-ca.json";
import webFr from "./i18n/web-fr.json";
import webIt from "./i18n/web-it.json";
import webDe from "./i18n/web-de.json";

/**
 * The guide in the site's other languages.
 *
 * English is the source. A translation is a dictionary from an English string
 * to its translation, and a chapter is translated by walking its data and
 * replacing every string it finds a match for. Two dictionaries feed each
 * language:
 *
 *   pdf-<locale>.json  the PDF's own text units (English HTML → translated
 *                      HTML), so the PDF and the web page say the same thing in
 *                      the same words;
 *   web-<locale>.json  the strings only the web has: key facts, questions and
 *                      answers, search titles and descriptions.
 *
 * Both are keyed in the inline markup the chapters use (**bold**, *italic*) so
 * one lookup serves both. A string with no translation stays English, and a
 * test fails the build rather than let that ship.
 */

type Dict = Record<string, string>;

/** A PDF text unit's HTML, in the inline markup the chapters use. */
export function mdKey(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(b|strong)>/gi, "**")
    .replace(/<\/?(i|em)>/gi, "*")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const asMd = (pdf: Dict): Dict => Object.fromEntries(Object.entries(pdf).map(([k, v]) => [mdKey(k), mdKey(v)]));

const SOURCES: Record<string, { pdf: Dict; web: Dict }> = {
  es: { pdf: pdfEs, web: webEs },
  ca: { pdf: pdfCa, web: webCa },
  fr: { pdf: pdfFr, web: webFr },
  it: { pdf: pdfIt, web: webIt },
  de: { pdf: pdfDe, web: webDe },
};

const cache = new Map<string, Dict>();
export function dictionary(locale: string): Dict {
  if (locale === "en" || !SOURCES[locale]) return {};
  let d = cache.get(locale);
  if (!d) {
    // The web file wins where both have a string: it is written for the page.
    d = { ...asMd(SOURCES[locale]!.pdf), ...SOURCES[locale]!.web };
    cache.set(locale, d);
  }
  return d;
}

/** Keys whose string values are identifiers, not words. */
const SKIP = new Set(["slug", "number", "kind", "tone", "href", "icon", "owner", "url", "id"]);
const needsTranslation = (s: string) => /\p{L}{2}/u.test(s.replace(/\*+/g, "").replace(/\]\([^)]*\)/g, "]"));

/** Every string of a chapter that a translation must cover. */
export function chapterStrings(c: Chapter): string[] {
  const out: string[] = [];
  const walk = (v: unknown, key = "") => {
    if (typeof v === "string") {
      if (!SKIP.has(key) && needsTranslation(v)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(c);
  return [...new Set(out)];
}

/** The chapter in `locale`, English wherever a string has no translation. */
export function localizeChapter(c: Chapter, locale: string): Chapter {
  if (locale === "en") return c;
  const d = dictionary(locale);
  const walk = (v: unknown, key = ""): unknown => {
    if (typeof v === "string") return !SKIP.has(key) && needsTranslation(v) ? (d[v] ?? v) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
    return v;
  };
  return walk(c) as Chapter;
}

/** The strings of `c` that `locale` does not translate yet. */
export function missingStrings(c: Chapter, locale: string): string[] {
  if (locale === "en") return [];
  const d = dictionary(locale);
  return chapterStrings(c).filter((s) => d[s] === undefined);
}
