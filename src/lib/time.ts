/**
 * Appointment times are Barcelona wall-clock times. Staff type them as local
 * time (a datetime-local input has no zone); the database stores an instant.
 * These convert between the two through Europe/Madrid, including across the
 * daylight-saving changes in March and October.
 */

const ZONE = "Europe/Madrid";

const parts = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Madrid wall-clock fields for an instant, as a UTC-epoch number. */
function wallClockAsUtc(t: number): number {
  const p = Object.fromEntries(parts.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
}

/** "2026-10-02T09:30" (Madrid) → the instant it denotes. */
export function madridLocalToUtc(local: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`Not a local date-time: ${local}`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes: the first guess's offset can be on the wrong side of a DST change.
  let t = naive - (wallClockAsUtc(naive) - naive);
  t = naive - (wallClockAsUtc(t) - t);
  return new Date(t);
}

/** An instant → "2026-10-02T09:30" in Madrid, for pre-filling an input. */
export function utcToMadridLocal(date: Date): string {
  return new Date(wallClockAsUtc(date.getTime())).toISOString().slice(0, 16);
}

/** "Friday 2 October 2026" and "09:30", in Madrid time. */
export function formatMadrid(date: Date, locale = "en-GB"): { date: string; time: string } {
  return {
    date: new Intl.DateTimeFormat(locale, {
      timeZone: ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat(locale, { timeZone: ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date),
  };
}
