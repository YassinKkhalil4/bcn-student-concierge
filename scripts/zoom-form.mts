/**
 * Magnify a region of a form template so coordinate alignment can be judged.
 *
 * Checkbox marks and narrow fields are only a few points wide; at full-page
 * scale a 4pt error is invisible, and 4pt is enough to put an "X" outside its
 * box on a legal document.
 *
 *   npx tsx scripts/zoom-form.mts <template.pdf> <x> <y> <w> <h> [scale]
 *
 * x/y/w/h are in PDF points on the source page (origin bottom-left).
 */
import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const [file, xs, ys, ws, hs, ss] = process.argv.slice(2);
if (!file || !xs || !ys || !ws || !hs) {
  console.error("Usage: npx tsx scripts/zoom-form.mts <pdf> <x> <y> <w> <h> [scale]");
  process.exit(1);
}
const [x, y, w, h] = [xs, ys, ws, hs].map(Number) as [number, number, number, number];
const scale = Number(ss ?? 4);

const src = await PDFDocument.load(await readFile(file), { throwOnInvalidObject: false });
const out = await PDFDocument.create();

// Embed page 1 and place it scaled so the requested region fills the new page.
const [embedded] = await out.embedPdf(await src.save(), [0]);
if (!embedded) throw new Error("could not embed source page");

const page = out.addPage([w * scale, h * scale]);
page.drawPage(embedded, {
  xScale: scale,
  yScale: scale,
  // Shift so the region's bottom-left lands at the new page's origin.
  x: -x * scale,
  y: -y * scale,
});

const name = file.replace(/\.pdf$/, `-ZOOM-${x}_${y}.pdf`);
await writeFile(name, await out.save());
console.log(`Wrote ${name} — region ${w}x${h}pt at ${x},${y}, magnified ${scale}x.`);
