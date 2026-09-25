import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { IntlMessageFormat } from "intl-messageformat";
import { LOCALES } from "../src/i18n/routing";
import { LOCALES as DB_LOCALES } from "../src/lib/db/schema";
import { CLIENT_NAMESPACES, NAMESPACES } from "../src/i18n/messages";
import { problems, type Target } from "../src/i18n/protection";

/**
 * The translated catalogues are generated, then corrected by hand
 * (scripts/i18n-overrides.json). These tests are what stop a catalogue that
 * would break a page — or mislead a student about an official term — from
 * being committed.
 */

const ROOT = process.cwd();
type Json = string | Json[] | { [k: string]: Json };

function flatten(value: Json, prefix = "", out = new Map<string, string>()): Map<string, string> {
  if (typeof value === "string") out.set(prefix, value);
  else if (Array.isArray(value)) value.forEach((v, i) => flatten(v, `${prefix}.${i}`, out));
  else for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
}

const catalogue = (locale: string, ns: string) =>
  flatten(JSON.parse(readFileSync(path.join(ROOT, "messages", locale, `${ns}.json`), "utf8")) as Json);

const TARGETS = LOCALES.filter((l) => l !== "en");

describe("languages", () => {
  it("offers exactly English, Spanish, Catalan, French, Italian and German", () => {
    expect([...LOCALES].sort()).toEqual(["ca", "de", "en", "es", "fr", "it"]);
    // The language saved on a case must be one the site can render.
    expect([...DB_LOCALES].sort()).toEqual([...LOCALES].sort());
    const dirs = readdirSync(path.join(ROOT, "messages")).filter((d) => statSync(path.join(ROOT, "messages", d)).isDirectory());
    expect(dirs.sort()).toEqual([...LOCALES].sort());
  });

  it("has a catalogue file for every namespace in every language", () => {
    for (const locale of LOCALES) {
      const files = readdirSync(path.join(ROOT, "messages", locale)).map((f) => f.replace(/\.json$/, ""));
      expect(files.sort(), locale).toEqual([...NAMESPACES].sort());
    }
  });
});

describe("catalogues", () => {
  it("have exactly the English keys — nothing missing, nothing extra", () => {
    for (const ns of NAMESPACES) {
      const english = [...catalogue("en", ns).keys()].sort();
      for (const locale of TARGETS) {
        expect([...catalogue(locale, ns).keys()].sort(), `${locale}/${ns}`).toEqual(english);
      }
    }
  });

  it("keep placeholders, tags, URLs and protected terms (Padrón, NIE, TIE, Modelo 790, EX-17, EX-18…)", () => {
    const failures: string[] = [];
    for (const ns of NAMESPACES) {
      const english = catalogue("en", ns);
      for (const locale of TARGETS) {
        for (const [key, translated] of catalogue(locale, ns)) {
          for (const p of problems(english.get(key)!, translated, locale as Target)) failures.push(`${locale} ${ns}.${key}: ${p}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("parse as ICU messages and render with their placeholders and tags in every language", () => {
    const failures: string[] = [];
    for (const ns of NAMESPACES) {
      for (const locale of LOCALES) {
        for (const [key, message] of catalogue(locale, ns)) {
          try {
            const format = new IntlMessageFormat(message, locale);
            const values: Record<string, unknown> = {};
            for (const m of message.matchAll(/\{(\w+)\}/g)) values[m[1]!] = `«${m[1]}»`;
            for (const m of message.matchAll(/<(\w+)>/g)) values[m[1]!] = (chunks: string[]) => chunks.join("");
            const out = format.format(values);
            const text = Array.isArray(out) ? out.join("") : String(out);
            // Every placeholder came through: an apostrophe can silently escape one.
            for (const name of Object.keys(values)) {
              if (typeof values[name] === "string" && !text.includes(values[name] as string)) {
                failures.push(`${locale} ${ns}.${key}: {${name}} swallowed`);
              }
            }
          } catch (error) {
            failures.push(`${locale} ${ns}.${key}: ${(error as Error).message}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("define every validation message the schemas can produce", () => {
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry)) for (const m of readFileSync(full, "utf8").matchAll(/vkey\("(\w+)"/g)) used.add(m[1]!);
      }
    };
    walk(path.join(ROOT, "src"));
    expect(used.size).toBeGreaterThan(20);
    for (const locale of LOCALES) {
      const defined = catalogue(locale, "validation");
      for (const key of used) expect(defined.has(key), `${locale} validation.${key}`).toBe(true);
    }
  });
});

describe("staff dashboard", () => {
  it("stays in English: nothing under admin uses the translation layer", () => {
    const offenders: string[] = [];
    for (const dir of ["src/app/admin", "src/components/admin"]) {
      const walk = (d: string) => {
        for (const entry of readdirSync(d)) {
          const full = path.join(d, entry);
          if (statSync(full).isDirectory()) walk(full);
          else if (/next-intl|@\/i18n\//.test(readFileSync(full, "utf8"))) offenders.push(path.relative(ROOT, full));
        }
      };
      walk(path.join(ROOT, dir));
    }
    expect(offenders).toEqual([]);
  });
});

describe("client message payload", () => {
  /**
   * Each route hands its NextIntlClientProvider only the catalogues its client
   * tree reads (src/i18n/messages.ts, CLIENT_NAMESPACES) rather than all eleven,
   * which is what stops the 14 kB legal catalogue shipping to the browser on a
   * page that never reads it. A namespace a client component reads but no route
   * provides is a runtime error in that component, not a fallback — so this
   * fails the build instead.
   */
  it("provides every namespace a client component reads", () => {
    const used = new Map<string, string[]>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry)) continue;
        const source = readFileSync(full, "utf8");
        if (!source.includes('"use client"')) continue;
        for (const m of source.matchAll(/useTranslations\("([^".]+)/g)) {
          const ns = m[1]!;
          used.set(ns, [...(used.get(ns) ?? []), path.relative(ROOT, full)]);
        }
      }
    };
    walk(path.join(ROOT, "src", "components"));
    walk(path.join(ROOT, "src", "app"));

    const provided = new Set<string>(Object.values(CLIENT_NAMESPACES).flat());
    expect(used.size).toBeGreaterThan(3);
    for (const [ns, files] of used) {
      expect(provided.has(ns), `${ns} — read by ${files.join(", ")}`).toBe(true);
    }
  });

  it("names only real namespaces", () => {
    const real = new Set<string>(NAMESPACES);
    for (const ns of new Set<string>(Object.values(CLIENT_NAMESPACES).flat())) {
      expect(real.has(ns), ns).toBe(true);
    }
  });
});
