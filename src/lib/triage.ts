import { z } from "zod";
import { isCountryCode } from "./countries/codes";
import { vkey } from "./validation-keys";
import { TRIAGE_DOCUMENT_KINDS, type TriageDocumentKind } from "./db/schema";

export { TRIAGE_DOCUMENT_KINDS };
export type { TriageDocumentKind };

/**
 * Free triage: the same-day "where do you stand" enquiry.
 *
 * Deliberately short. Triage exists to tell someone which route applies, how
 * many days they have left and what is still recoverable — none of which needs
 * a passport number, a birth date or an address. Asking for those before there
 * is an engagement would collect personal data we have no basis to hold, so the
 * schema stops at what the answer actually requires.
 */

/** How the student is currently housed — it decides whether padrón is possible. */
export const HOUSING_SITUATIONS = [
  "own-lease",
  "room-or-sublet",
  "university-residence",
  "hostel-or-airbnb",
  "staying-with-someone",
  "not-yet-housed",
] as const;
export type HousingSituation = (typeof HOUSING_SITUATIONS)[number];

/** ISO date (YYYY-MM-DD), real calendar day, not in the future, within a year. */
export const entryDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, vkey("entryDateFormat"))
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }, vkey("dateNonexistent"))
  .refine((v) => {
    const entered = Date.parse(`${v}T00:00:00Z`);
    const now = Date.now();
    // An entry stamp cannot be in the future, and a triage about an arrival
    // more than a year ago is a different (legal) conversation.
    return entered <= now && now - entered <= 366 * 24 * 60 * 60 * 1000;
  }, vkey("entryDateRange"));

export const triageSchema = z.object({
  /**
   * Not uppercased and not split into surnames: this name is only ever used to
   * address a reply. The official two-surname split belongs to intake, where it
   * goes on a government form.
   */
  fullName: z.string().trim().min(1, vkey("required")).max(120, vkey("tooLong", { max: 120 })),
  email: z.string().trim().toLowerCase().email(vkey("email")),
  nationality: z
    .string()
    .trim()
    .toUpperCase()
    .refine(isCountryCode, vkey("chooseFromList")),
  arrivedOn: entryDateSchema,
  housing: z.enum(HOUSING_SITUATIONS, { errorMap: () => ({ message: vkey("chooseFromList") }) }),
  /** Whatever they want to tell us. Optional — the structured fields carry the triage. */
  notes: z.string().trim().max(2_000, vkey("tooLong", { max: 2_000 })).optional().or(z.literal("")),
  /**
   * One consent, not intake's three: triage processes a name, an email and
   * three document images to answer a question, and nothing else.
   */
  gdprTriageConsent: z.literal(true, {
    errorMap: () => ({ message: vkey("consentProcessing") }),
  }),
});

export type TriageData = z.infer<typeof triageSchema>;

/**
 * One calendar month after entry, "de fecha a fecha": the same day number in
 * the following month, or that month's last day when the day does not exist
 * (31 January + 1 month = 28 February).
 *
 * This is the ordinary TIE window for a non-EU student and it is what triage
 * counts down to. It is an indication, not a ruling — an authorisation can
 * state its own period, which is why triage reads the student's own document
 * rather than trusting this arithmetic alone.
 */
export function addOneMonth(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number) as [number, number, number];
  const lastDayOfNextMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDayOfNextMonth);
  const target = new Date(Date.UTC(y, m, day));
  return target.toISOString().slice(0, 10);
}

/**
 * The deadline triage reports, or null where there is no one-month clock.
 *
 * EU/EEA/Swiss students have no equivalent month: the registration duty starts
 * at three months' residence, so quoting them a one-month deadline would be
 * inventing urgency. Returning null is what keeps the countdown off their page.
 */
export function deadlineFor(route: "eu" | "non-eu", arrivedOn: string): string | null {
  return route === "non-eu" ? addOneMonth(arrivedOn) : null;
}

/** Whole days from `today` to `deadline`; negative once the window has closed. */
export function daysUntil(deadline: string, today: Date = new Date()): number {
  const end = Date.parse(`${deadline}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}
