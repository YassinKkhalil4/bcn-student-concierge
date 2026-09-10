import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";

/**
 * Unicode fonts for generated PDFs (invoices, the Padrón authorisation, the
 * appointment sheet).
 *
 * pdf-lib's built-in Helvetica only encodes Windows-1252: a payer called
 * "Łukasz" or a landlord called "Ștefan" makes it THROW. Noto Sans (SIL OFL,
 * assets/fonts/OFL.txt) covers Latin, Greek and Cyrillic.
 *
 * The official EX-17/EX-18 are the exception and keep Helvetica: names on
 * them must match the passport's machine-readable transliteration anyway.
 */

const FONT_DIR = process.env.FONT_DIR ?? path.join(process.cwd(), "assets", "fonts");

let bytes: { regular: Uint8Array; bold: Uint8Array } | null = null;
/** Parsed once, only to answer "can this font draw that character?". */
let coverage: { hasGlyphForCodePoint(cp: number): boolean } | null = null;

async function load() {
  bytes ??= {
    regular: await readFile(path.join(FONT_DIR, "NotoSans-Regular.ttf")),
    bold: await readFile(path.join(FONT_DIR, "NotoSans-Bold.ttf")),
  };
  return bytes;
}

export interface UnicodeFonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function embedUnicodeFonts(doc: PDFDocument): Promise<UnicodeFonts> {
  const { regular, bold } = await load();
  doc.registerFontkit(fontkit);
  // NOT subset. pdf-lib's subsetting with fontkit silently drops glyphs: the
  // first invoice rendered with `subset: true` lost most of its letters and its
  // total line, while still producing a structurally valid PDF. Embedding the
  // whole font costs size (see tests/invoices.test.ts) but every glyph is there.
  return {
    regular: await doc.embedFont(regular, { subset: false }),
    bold: await doc.embedFont(bold, { subset: false }),
  };
}

/**
 * Characters in `text` the font cannot draw (e.g. Chinese, Arabic). A custom
 * font renders these as empty boxes rather than throwing, so callers check
 * first and ask for a Latin transliteration instead of printing blanks.
 */
export async function unsupportedCharacters(text: string): Promise<string[]> {
  coverage ??= fontkit.create(Buffer.from((await load()).regular)) as unknown as {
    hasGlyphForCodePoint(cp: number): boolean;
  };
  const font = coverage;
  const missing = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp > 0x20 && !font.hasGlyphForCodePoint(cp)) missing.add(ch);
  }
  return [...missing];
}
