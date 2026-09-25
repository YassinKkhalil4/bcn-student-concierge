import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * tailwind.config.ts says it out loud — "one hue, three jobs, no second accent
 * anywhere", and "tokens are named for their job, never for their hue". That
 * held everywhere except one line of the staff dashboard, which had quietly
 * grown a blue from Tailwind's stock palette. Nothing was watching, so nothing
 * caught it for as long as it was there.
 *
 * These tests are what watches now.
 */

const ROOT = process.cwd();

/** Tailwind's built-in palettes. Using one means bypassing the token system. */
const STOCK_PALETTES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const STOCK_COLOUR = new RegExp(
  String.raw`\b(?:bg|text|ring|border|fill|stroke|decoration|divide|outline|shadow|from|via|to|accent|caret|placeholder)-(?:${STOCK_PALETTES})-\d{2,3}\b`,
  "g",
);

/**
 * `text-white` and `bg-black` are the same bypass wearing a different hat: this
 * page's white is `paper` and its black is `ink`.
 *
 * `bg-white` is the exception, and a deliberate one: `paper` is warm (#FBFAF7)
 * and a panel is "a square white plate" on it (globals.css). The two are
 * different values doing different jobs, so pure white earns its place as a
 * ground — but only as a ground.
 */
const ABSOLUTE_COLOUR =
  /\b(?:text|ring|border|fill|stroke|decoration|divide)-(?:white|black)\b|\bbg-black\b/g;

/** A raw hex or rgb() in markup is a value no theme can ever reach. */
const RAW_COLOUR = /#[0-9a-fA-F]{6}\b|\brgba?\(\s*\d/g;

/** Comments describe the rule; they are not the rule being broken. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceFiles(dir: string, extension: RegExp, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, extension, out);
    else if (extension.test(entry)) out.push(full);
  }
  return out;
}

/** Generated country-name tables are data, not markup. */
const EXEMPT = /\.generated\.ts$/;

function scan(pattern: RegExp, extension = /\.tsx?$/): string[] {
  const offenders: string[] = [];
  for (const file of sourceFiles(path.join(ROOT, "src"), extension)) {
    if (EXEMPT.test(file)) continue;
    const found = stripComments(readFileSync(file, "utf8")).match(pattern);
    if (found) offenders.push(`${path.relative(ROOT, file)} → ${[...new Set(found)].join(", ")}`);
  }
  return offenders;
}

describe("design tokens", () => {
  it("uses no colour from Tailwind's stock palettes", () => {
    expect(scan(STOCK_COLOUR)).toEqual([]);
  });

  it("uses no absolute white or black — the page's are `paper` and `ink`", () => {
    expect(scan(ABSOLUTE_COLOUR).filter((o) => !o.includes("bg-white"))).toEqual([]);
  });

  it("hard-codes no colour value in markup", () => {
    // .tsx only. `rgb()` in src/lib is pdf-lib's drawing API colouring a PDF,
    // which has no stylesheet to read a token from; src/app/icon.svg is the
    // favicon, a standalone file for the same reason.
    expect(scan(RAW_COLOUR, /\.tsx$/)).toEqual([]);
  });
});
