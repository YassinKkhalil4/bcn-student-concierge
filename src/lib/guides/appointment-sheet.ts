import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import { embedUnicodeFonts } from "@/lib/pdf/fonts";
import type { AppointmentSheetContent } from "./appointment-content";

/**
 * Draws the one-page appointment-day sheet (A4). The content comes from
 * appointmentSheetContent(); this file only decides where it goes.
 */

const INK = rgb(0.06, 0.09, 0.075);
const OLIVE = rgb(0.184, 0.31, 0.243);
const MUTED = rgb(0.29, 0.333, 0.318);
const SOFT = rgb(0.486, 0.529, 0.514);
const PANEL = rgb(0.957, 0.945, 0.918);
const LINE = rgb(0.894, 0.875, 0.831);

const W = 595.28;
const H = 841.89;
const M = 48;
const CONTENT = W - M * 2;
/** Lowest y body text may reach; below this is the footer's. */
const FLOOR = 78;

export class SheetOverflowError extends Error {}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function renderAppointmentSheet(c: AppointmentSheetContent): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${c.title} — ${c.purpose}`);
  doc.setAuthor("BCN Student Concierge");
  const { regular, bold } = await embedUnicodeFonts(doc);
  const page = doc.addPage([W, H]);

  let y = H - M;
  const text = (s: string, x: number, size: number, font: PDFFont, color = INK) =>
    page.drawText(s, { x, y, size, font, color });

  /** Wrapped paragraph at x; advances y. */
  const para = (s: string, x: number, width: number, size: number, font: PDFFont, color = INK, leading = size * 1.35) => {
    for (const l of wrap(s, font, size, width)) {
      page.drawText(l, { x, y, size, font, color });
      y -= leading;
    }
  };

  const section = (title: string) => {
    y -= 10;
    guard();
    text(title, M, 12.5, bold, OLIVE);
    y -= 18;
  };

  const guard = () => {
    if (y < FLOOR) throw new SheetOverflowError("The appointment sheet no longer fits on one page.");
  };

  // ── Header ──
  text("BCN STUDENT CONCIERGE", M, 8, bold, OLIVE);
  y -= 30;
  text(c.title, M, 24, bold);
  y -= 19;
  text(c.purpose, M, 12, regular, MUTED);
  y -= 22;

  // ── When / where panel ──
  const panelTop = y;
  const panelH = 118;
  page.drawRectangle({ x: M, y: panelTop - panelH, width: CONTENT, height: panelH, color: PANEL });
  const colL = M + 16;
  const colR = M + CONTENT / 2 + 4;
  const colW = CONTENT / 2 - 24;

  y = panelTop - 22;
  text("WHEN", colL, 7.5, bold, SOFT);
  y -= 17;
  text(c.when.date, colL, 11.5, bold);
  y -= 26;
  text(c.when.time, colL, 22, bold, OLIVE);
  y -= 18;
  text("Arrive 15 minutes early.", colL, 9, regular, MUTED);
  if (c.confirmationCode) {
    y -= 16;
    text(`Justificante: ${c.confirmationCode}`, colL, 9, regular, MUTED);
  }

  y = panelTop - 22;
  text("WHERE", colR, 7.5, bold, SOFT);
  y -= 17;
  para(c.office.name, colR, colW, 11, bold);
  para(c.office.address, colR, colW, 10, regular, INK, 13);
  // Only printed when staff recorded it: a placeholder on a printed sheet
  // helps nobody standing at a Metro entrance.
  if (c.office.metro) {
    y -= 6;
    text("NEAREST METRO", colR, 7.5, bold, SOFT);
    y -= 14;
    para(c.office.metro, colR, colW, 10, regular);
  }

  y = panelTop - panelH - 8;

  // ── Checklist ──
  section("Bring with you");
  for (const item of c.checklist) {
    guard();
    page.drawRectangle({ x: M + 2, y: y - 1.5, width: 9, height: 9, borderColor: OLIVE, borderWidth: 1 });
    para(item, M + 20, CONTENT - 20, 10, regular, INK, 13.5);
    y -= 3;
  }

  // ── Phrases ──
  section("Say it in Spanish");
  for (const p of c.phrases) {
    guard();
    para(p.spanish, M, CONTENT, 10.5, bold, INK, 13.5);
    para(p.phonetic, M, CONTENT, 9, regular, OLIVE, 12);
    para(p.meaning, M, CONTENT, 9, regular, MUTED, 12);
    y -= 6;
  }

  // ── After ──
  section("After the appointment");
  for (const line of c.after) {
    guard();
    text("•", M + 3, 9.5, bold, OLIVE);
    para(line, M + 16, CONTENT - 16, 9.5, regular, INK, 12.5);
  }
  guard();

  // ── Footer ──
  page.drawLine({ start: { x: M, y: 58 }, end: { x: W - M, y: 58 }, thickness: 0.6, color: LINE });
  y = 45;
  para(c.footer, M, CONTENT, 7.5, regular, SOFT, 10);

  return doc.save();
}

