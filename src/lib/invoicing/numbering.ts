import type { InvoiceSeries } from "@/lib/db/schema";

/**
 * Pure invoicing arithmetic: numbering, fiscal year, and splitting a gross
 * amount into base + IVA. No I/O — everything here is deterministic and tested.
 */

/** Standard Spanish IVA, in basis points (21.00 %). */
export const IVA_RATE_BP = 2100;

/**
 * The calendar year in Europe/Madrid.
 *
 * Numbering restarts each year, and the year is the Spanish one: a payment at
 * 00:30 on 1 January in Barcelona is 23:30 on 31 December in UTC, and must be
 * numbered in the NEW year.
 */
export function madridYear(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric" }).format(date),
  );
}

/**
 * "INV-2026-0001". Four digits minimum; a fifth appears on its own past 9,999
 * rather than wrapping. The database CHECK invoices_number_matches_parts pins
 * this exact format, so the two can never disagree.
 */
export function formatInvoiceNumber(series: InvoiceSeries, year: number, sequence: number): string {
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error(`Bad sequence ${sequence}`);
  return `${series}-${year}-${String(sequence).padStart(4, "0")}`;
}

export interface Amounts {
  baseCents: number;
  ivaCents: number;
  totalCents: number;
}

/**
 * Split a gross (IVA-inclusive) amount into base imponible and cuota de IVA.
 *
 * base = round(gross / 1.21), IVA = gross − base. Computing IVA as the
 * remainder, not by rounding it separately, guarantees base + IVA == gross to
 * the cent — which the database also enforces. Integer arithmetic only.
 *
 * Works for negative amounts (rectificativas): the split is symmetric.
 */
export function splitGross(grossCents: number, rateBp = IVA_RATE_BP): Amounts {
  if (!Number.isSafeInteger(grossCents)) throw new Error(`Bad amount ${grossCents}`);
  const sign = grossCents < 0 ? -1 : 1;
  const abs = Math.abs(grossCents);
  // Round half-up on the absolute value, then restore the sign, so a refund's
  // base is the exact negative of the equivalent sale's base.
  const base = Math.floor((abs * 10_000 * 2 + (10_000 + rateBp)) / ((10_000 + rateBp) * 2));
  return {
    baseCents: sign * base,
    ivaCents: sign * (abs - base),
    totalCents: grossCents,
  };
}

/** "54000" → "540,00" — Spanish decimal comma, no thousands separator (CSV-safe). */
export function centsToSpanishDecimal(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

/** Madrid's UTC offset (ms) at an instant — +1 h in winter, +2 h in summer. */
function madridOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant a Madrid calendar day ("2026-07-01") begins. The gestor's
 * "1 July" is Spain's 1 July: an invoice at 00:30 there belongs to July even
 * though it is still 30 June in UTC.
 */
export function madridDayStart(day: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got ${day}`);
  const naive = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Midnight local = naive UTC midnight minus the offset in force at that time.
  // Evaluated twice so a day starting right after a DST switch settles correctly.
  const first = naive - madridOffsetMs(new Date(naive));
  return new Date(naive - madridOffsetMs(new Date(first)));
}

/**
 * [start, end) of an inclusive Madrid date range. The end is the START of the
 * day after `to` — not start(to) + 24 h, which is wrong on the two DST days a
 * year (23 and 25 hours long).
 */
export function madridRange(from: string, to: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!m) throw new Error(`Expected YYYY-MM-DD, got ${to}`);
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1));
  return { start: madridDayStart(from), end: madridDayStart(next.toISOString().slice(0, 10)) };
}
