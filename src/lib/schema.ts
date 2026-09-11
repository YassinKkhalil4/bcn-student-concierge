import { z } from "zod";
import { isCountryCode } from "./countries/codes";
import { isValidNie } from "./spanish-ids";
import { vkey } from "./validation-keys";

/**
 * Canonical intake schema. This is the contract shared by the client wizard,
 * the API route, and the PDF engine — there is exactly one definition.
 *
 * UPPERCASE POLICY
 * Spanish immigration forms are read by OCR and by officers who reject
 * inconsistent casing. Every free-text field is coerced to uppercase here, at
 * the schema boundary, so no downstream code has to remember to do it.
 *
 * Two deliberate exceptions:
 *  - `email` is lowercased. Uppercasing the local-part of an address can break
 *    delivery on case-sensitive mail servers, and it is never printed on the
 *    government form.
 *  - `maritalStatus` uses the official code set S / C / V / D / Sp. "Sp"
 *    (separado) is mixed-case ON THE OFFICIAL FORM. Blanket-uppercasing it to
 *    "SP" would produce a code the form does not define, so the enum is
 *    validated verbatim and never passed through the uppercase transform.
 */

/**
 * Trim, collapse internal whitespace, uppercase. Used for all printed text.
 *
 * The `.min(1)` is essential and easy to omit: without it an empty string
 * survives the transform, passes `.max()`, and a required field silently
 * validates as "". That would put a blank surname on a government form —
 * the schema must reject it, not the UI.
 */
/**
 * `label` documents the field in code only: messages are keys, and the form
 * supplies the field's translated label when it shows one.
 */
const upper = (max: number, _label = "This field") =>
  z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, " ").toUpperCase())
    .pipe(
      z
        .string()
        .min(1, vkey("required"))
        .max(max, vkey("tooLong", { max })),
    );

/**
 * ISO 3166-1 alpha-2 country code, chosen from a picker. Stored as the code so
 * the form route is exact and the forms can print the Spanish name.
 */
const countryCode = (_label: string) =>
  z
    .string({ required_error: vkey("required") })
    .trim()
    .toUpperCase()
    .refine(isCountryCode, vkey("chooseFromList"));

/**
 * Optional printed field.
 *
 * An untouched input posts "", not `undefined`, so the empty case MUST be
 * folded to `undefined` here. Returning "" would mark the AcroForm field as
 * modified and print an empty-but-present value; the PDF engine relies on
 * `undefined` to mean "leave this box genuinely untouched".
 */
const upperOptional = (max: number) =>
  z
    .union([z.string(), z.undefined()])
    .transform((s) =>
      s === undefined
        ? undefined
        : (s.trim().replace(/\s+/g, " ").toUpperCase() || undefined),
    )
    .refine(
      (v) => v === undefined || v.length <= max,
      `Must be ${max} characters or fewer`,
    );

/** Spanish NIE: X/Y/Z + 7 digits + control letter. */
export const nieSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[XYZ]\d{7}[A-Z]$/, vkey("nieFormat"))
  .refine(isValidNie, vkey("nieCheckLetter"));

/** DD/MM/YYYY with real calendar validation (rejects 31/02/2004). */
export const spanishDateSchema = z
  .string()
  .trim()
  .regex(/^\d{2}\/\d{2}\/\d{4}$/, vkey("dateFormat"))
  .refine((v) => {
    const [d, m, y] = v.split("/").map(Number) as [number, number, number];
    if (m < 1 || m > 12 || d < 1) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    );
  }, vkey("dateNonexistent"))
  .refine((v) => {
    const [d, m, y] = v.split("/").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    const now = new Date();
    if (dt.getTime() > now.getTime()) return false;
    return now.getUTCFullYear() - y <= 120;
  }, vkey("birthDateRange"));

export const GENDERS = ["H", "M", "X"] as const;
export const MARITAL_STATUSES = ["S", "C", "V", "D", "Sp"] as const;

export const identitySchema = z.object({
  passportNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,20}$/, vkey("passportFormat")),
  /**
   * Pre-assigned NIE. Optional: students who have not yet been issued an NIE
   * (common before the first police appointment) leave this blank and the
   * field is left empty on the form rather than filled with a placeholder.
   */
  nie: nieSchema.optional().or(z.literal("").transform(() => undefined)),
  firstSurname: upper(60, "First surname"),
  /** Most non-Spanish nationals have no second surname. Left blank, never "N/A". */
  secondSurname: upperOptional(60),
  givenName: upper(60, "Given name"),
  gender: z.enum(GENDERS, { message: vkey("gender") }),
  birthDate: spanishDateSchema,
  birthCity: upper(60, "City of birth"),
  birthCountry: countryCode("Country of birth"),
  // Spanish citizens need neither an EX-17 nor an EX-18.
  nationality: countryCode("Nationality").refine(
    (code) => code !== "ES",
    vkey("spanishCitizen"),
  ),
});

export const familySchema = z.object({
  maritalStatus: z.enum(MARITAL_STATUSES, {
    message: vkey("marital"),
  }),
  fatherFirstName: upper(60, "Father's first name"),
  motherFirstName: upper(60, "Mother's first name"),
});

export const addressSchema = z.object({
  streetName: upper(80, "Street name"),
  buildingNumber: upper(10, "Building number"),
  /** e.g. "3 2A". Optional — many student addresses have no floor/door. */
  floorDoor: upperOptional(20),
  city: upper(60, "City"),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, vkey("postalCode")),
  province: upper(60, "Province"),
});

export const contactSchema = z.object({
  /** E.164. Students arrive with a foreign number, so no country is assumed. */
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, vkey("phoneFormat"))
    .transform((s) => s.replace(/\s+/g, "")),
  email: z.string().trim().toLowerCase().email(vkey("email")),
});

export const consentSchema = z.object({
  /**
   * GDPR Art. 6(1)(a) / Art. 9. These MUST default to false in the UI and are
   * validated as literal `true` — an unchecked box fails the schema, so consent
   * can never be inferred from a default.
   */
  gdprDataProcessing: z.literal(true, {
    message: vkey("consentProcessing"),
  }),
  gdprSensitiveDocuments: z.literal(true, {
    message: vkey("consentDocuments"),
  }),
  disclaimerAcknowledged: z.literal(true, {
    message: vkey("consentDisclaimer"),
  }),
  /** Genuinely optional — must not block submission. */
  marketingOptIn: z.boolean().default(false),
});

export const intakeSchema = z.object({
  tierId: z.enum(["baseline", "soft-landing", "turnkey"]),
  identity: identitySchema,
  family: familySchema,
  address: addressSchema,
  contact: contactSchema,
  consent: consentSchema,
});

export type IntakeData = z.infer<typeof intakeSchema>;
export type IdentityData = z.infer<typeof identitySchema>;

/** Per-step schemas so the wizard can validate incrementally. */
export const STEP_SCHEMAS = [
  identitySchema,
  familySchema,
  addressSchema,
  contactSchema,
  consentSchema,
] as const;
