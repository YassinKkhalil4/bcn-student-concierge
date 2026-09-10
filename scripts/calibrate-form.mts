/**
 * Render a measurement grid over a flat form template so field coordinates can
 * be read off visually and verified.
 *
 * The official EX-17/EX-18 PDFs carry no AcroForm fields, so text must be drawn
 * at absolute positions. Guessing those positions would put applicant data in
 * the wrong box on a legal document, so every coordinate in the map is measured
 * against this grid and then proved with `--proof`.
 *
 *   npx tsx scripts/calibrate-form.mts templates/forms/EX-17-official.pdf
 *   npx tsx scripts/calibrate-form.mts templates/forms/EX-17-official.pdf --proof
 *
 * PDF coordinates put the origin at the BOTTOM-LEFT, y increasing upward.
 * Labels on the grid use those same PDF points, so a value read off the grid
 * can be pasted straight into the coordinate map.
 */
import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { FORM_LAYOUTS } from "../src/lib/forms/layout.ts";

const file = process.argv[2];
const proofMode = process.argv.includes("--proof");
if (!file) {
  console.error("Usage: npx tsx scripts/calibrate-form.mts <template.pdf> [--proof]");
  process.exit(1);
}

const MINOR = 10;
const MAJOR = 50;

const doc = await PDFDocument.load(await readFile(file), {
  throwOnInvalidObject: false,
});
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

if (proofMode) {
  // Draw the actual mapped fields with sample values, so misplacement is
  // obvious at a glance rather than discovered at a police station.
  const formId = file.includes("EX-18") ? "EX-18" : "EX-17";
  const layout = FORM_LAYOUTS[formId];
  const pages = doc.getPages();

  for (const [name, pos] of Object.entries(layout.fields)) {
    const page = pages[pos.page];
    if (!page) continue;
    page.drawRectangle({
      x: pos.x - 1,
      y: pos.y - 3,
      width: pos.maxWidth ?? 120,
      height: (pos.size ?? 9) + 5,
      borderColor: rgb(0.85, 0.2, 0.2),
      borderWidth: 0.4,
      color: rgb(1, 0.95, 0.95),
      opacity: 0.35,
    });
    page.drawText(name, {
      x: pos.x,
      y: pos.y,
      size: 5.5,
      font,
      color: rgb(0.8, 0, 0),
    });
  }

  for (const [name, marks] of Object.entries(layout.checkboxes)) {
    for (const [value, pos] of Object.entries(marks)) {
      const page = pages[pos.page];
      if (!page) continue;
      page.drawRectangle({
        x: pos.x - 1,
        y: pos.y - 1,
        width: 10,
        height: 10,
        borderColor: rgb(0, 0.4, 0.8),
        borderWidth: 0.5,
      });
      page.drawText(`${name}:${value}`, {
        x: pos.x - 1,
        y: pos.y + 10,
        size: 4,
        font,
        color: rgb(0, 0.3, 0.7),
      });
    }
  }

  const out = file.replace(/\.pdf$/, "-PROOF.pdf");
  await writeFile(out, await doc.save());
  console.log(`Wrote ${out} — every mapped position boxed and labelled.`);
} else {
  for (const [i, page] of doc.getPages().entries()) {
    const { width, height } = page.getSize();

    for (let x = 0; x <= width; x += MINOR) {
      const major = x % MAJOR === 0;
      page.drawLine({
        start: { x, y: 0 },
        end: { x, y: height },
        thickness: major ? 0.35 : 0.15,
        color: major ? rgb(0.85, 0.1, 0.1) : rgb(0.6, 0.75, 0.95),
        opacity: major ? 0.5 : 0.35,
      });
      if (major && x > 0) {
        for (let ly = 20; ly < height; ly += 100) {
          page.drawText(String(x), { x: x + 1, y: ly, size: 4.5, font, color: rgb(0.8, 0, 0) });
        }
      }
    }

    for (let y = 0; y <= height; y += MINOR) {
      const major = y % MAJOR === 0;
      page.drawLine({
        start: { x: 0, y },
        end: { x: width, y },
        thickness: major ? 0.35 : 0.15,
        color: major ? rgb(0.85, 0.1, 0.1) : rgb(0.6, 0.75, 0.95),
        opacity: major ? 0.5 : 0.35,
      });
      if (major && y > 0) {
        for (let lx = 4; lx < width; lx += 100) {
          page.drawText(String(y), { x: lx, y: y + 1, size: 4.5, font, color: rgb(0.8, 0, 0) });
        }
      }
    }

    page.drawText(`page index ${i} — ${Math.round(width)}x${Math.round(height)}pt`, {
      x: 8,
      y: height - 12,
      size: 7,
      font: bold,
      color: rgb(0.8, 0, 0),
    });
  }

  const out = file.replace(/\.pdf$/, "-GRID.pdf");
  await writeFile(out, await doc.save());
  console.log(`Wrote ${out} — grid at ${MINOR}pt, labelled every ${MAJOR}pt.`);
}
