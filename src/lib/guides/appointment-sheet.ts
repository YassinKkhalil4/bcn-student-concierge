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

/**
 * One page, always. Longer languages (German runs a fifth longer than English)
 * get the body set a little tighter before giving up.
 */
export async function renderAppointmentSheet(c: AppointmentSheetContent): Promise<Uint8Array> {
  const scales = [1, 0.93, 0.86];
  for (const [i, k] of scales.entries()) {
    try {
      return await draw(c, k);
    } catch (error) {
      if (!(error instanceof SheetOverflowError) || i === scales.length - 1) throw error;
    }
  }
  throw new SheetOverflowError("unreachable");
}

async function draw(c: AppointmentSheetContent, k: number): Promise<Uint8Array> {
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
  text(c.labels.when, colL, 7.5, bold, SOFT);
  y -= 17;
  text(c.when.date, colL, 11.5, bold);
  y -= 26;
  text(c.when.time, colL, 22, bold, OLIVE);
  y -= 18;
  text(c.labels.arrive, colL, 9, regular, MUTED);
  if (c.confirmationCode) {
    y -= 16;
    text(`Justificante: ${c.confirmationCode}`, colL, 9, regular, MUTED);
  }

  y = panelTop - 22;
  text(c.labels.where, colR, 7.5, bold, SOFT);
  y -= 17;
  para(c.office.name, colR, colW, 11, bold);
  para(c.office.address, colR, colW, 10, regular, INK, 13);
  // Only printed when staff recorded it: a placeholder on a printed sheet
  // helps nobody standing at a Metro entrance.
  if (c.office.metro) {
    y -= 6;
    text(c.labels.metro, colR, 7.5, bold, SOFT);
    y -= 14;
    para(c.office.metro, colR, colW, 10, regular);
  }

  y = panelTop - panelH - 8;

  // ── Checklist ──
  section(c.labels.bring);
  for (const item of c.checklist) {
    guard();
    page.drawRectangle({ x: M + 2, y: y - 1.5, width: 9, height: 9, borderColor: OLIVE, borderWidth: 1 });
    para(item, M + 20, CONTENT - 20, 10 * k, regular, INK, 13.5 * k);
    y -= 3 * k;
  }

  // ── Phrases (not for readers who already speak Spanish) ──
  if (c.phrases.length) {
    section(c.labels.phrases);
    if (c.phoneticKey) {
      y += 4;
      para(c.phoneticKey, M, CONTENT, 7.5 * k, regular, SOFT, 10 * k);
      y -= 4;
    }
    for (const p of c.phrases) {
      guard();
      para(p.spanish, M, CONTENT, 10.5 * k, bold, INK, 13.5 * k);
      para(p.phonetic, M, CONTENT, 9 * k, regular, OLIVE, 12 * k);
      para(p.meaning, M, CONTENT, 9 * k, regular, MUTED, 12 * k);
      y -= 6 * k;
    }
  }

  // ── After ──
  section(c.labels.after);
  for (const line of c.after) {
    guard();
    text("•", M + 3, 9.5 * k, bold, OLIVE);
    para(line, M + 16, CONTENT - 16, 9.5 * k, regular, INK, 12.5 * k);
  }
  guard();

  // ── Footer ──
  page.drawLine({ start: { x: M, y: 58 }, end: { x: W - M, y: 58 }, thickness: 0.6, color: LINE });
  y = 45;
  para(c.footer, M, CONTENT, 7.5, regular, SOFT, 10);

  return doc.save();
}

