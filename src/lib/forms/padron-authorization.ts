import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { z } from "zod";
import type { IntakeData } from "@/lib/schema";
import { embedUnicodeFonts, unsupportedCharacters } from "@/lib/pdf/fonts";
import { formatSpanishId, isValidPersonalId, isValidSpanishTaxId, isValidCif } from "@/lib/spanish-ids";
import { TemplateNotFoundError } from "./pdf";
import { vkey } from "@/lib/validation-keys";
import { AUTHORIZATION_TEMPLATE, TEMPLATE_DIR, templatePath } from "./templates";

/**
 * Barcelona's official "Autorització d'inscripció al Padró municipal
 * d'habitants" (Autoritzaciodomicili_cat.pdf), filled for a student who lives
 * in a flat that is not in their name.
 *
 * The city's PDF is a genuine AcroForm, so fields are filled by name — but the
 * names are the generic Texto1…Texto24, so they are mapped here by position
 * against the printed labels (see FIELD below).
 *
 * Nothing entered about the signer (the landlord or main tenant) is stored:
 * the form is generated on request, streamed back, and forgotten.
 */



/** Field name → what the printed form asks for there. */
const FIELD = {
  signerName: "Texto1", // Persona que autoritza — Nom i cognoms
  signerId: "Texto2", // DNI/NIE
  companyName: "Texto3", // En cas de representació, indiqueu la persona jurídica
  companyTaxId: "Texto4", // NIF (of that company)
  street: "Texto5", // Dades del domicili — Carrer
  number: "Texto6", // Núm.
  staircase: "Texto7", // Escala
  floorDoor: "Texto8", // Pis i porta
  cadastralRef: "RC", // Referència cadastral
  ownerName: "Texto9", // Nom i cognoms o raó social de la persona arrendadora
  ownerTaxId: "Texto10", // NIF de la persona arrendadora
  studentName: "Texto11", // Autoritzo… — first row: Nom i cognoms
  studentId: "Texto12", // Document d'identitat
  // Texto13…Texto24 are further people to register; left blank.
  // "Data" is left blank on purpose: the signer dates it by hand when signing,
  // and the authorisation is valid for three months from THAT date.
} as const;

/** Relationship radio (Group1): export values, in printed order. */
const RELATION = {
  owner: "Opción1", // Propietari/a de l'immoble
  usufruct: "Opción2", // Titular de l'usdefruit
  tenant: "Opción3", // Inquilí/a – Llogater/a (titular del contracte de lloguer)
  // Opción4 (parent registering a minor) does not apply to our students.
} as const;

// Messages are keys (see src/lib/validation-keys.ts): the portal words them in
// the student's language and names the field itself.
const upper = (max: number) =>
  z
    .string({ required_error: vkey("required") })
    .trim()
    .transform((s) => s.replace(/\s+/g, " ").toUpperCase())
    .pipe(z.string().min(2, vkey("required")).max(max, vkey("tooLong", { max })));

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((s) => s?.trim().replace(/\s+/g, " ").toUpperCase() || undefined)
    .refine((s) => s === undefined || s.length <= max, vkey("tooLong", { max }));

/**
 * What the student types about whoever signs. The signer's ID may be a
 * passport — the city's own checklist accepts "DNI / targeta de residència /
 * passaport" — but a DNI- or NIE-shaped number must pass its check letter.
 */
export const authorizationInputSchema = z
  .object({
    signerName: upper(80),
    signerId: z
      .string({ required_error: vkey("required") })
      .transform(formatSpanishId)
      .refine((v) => /^[A-Z0-9]{5,20}$/.test(v), vkey("signerIdFormat"))
      .refine(
        (v) => !(/^\d{8}[A-Z]$/.test(v) || /^[XYZ]\d{7}[A-Z]$/.test(v)) || isValidPersonalId(v),
        vkey("signerIdCheckLetter"),
      ),
    relation: z.enum(["owner", "usufruct", "tenant"], { message: vkey("relation") }),
    ownerName: optionalText(80),
    ownerTaxId: z
      .string()
      .optional()
      .transform((s) => (s ? formatSpanishId(s) : undefined) || undefined),
    companyName: optionalText(80),
    companyTaxId: z
      .string()
      .optional()
      .transform((s) => (s ? formatSpanishId(s) : undefined) || undefined),
    cadastralRef: z
      .string()
      .optional()
      .transform((s) => s?.replace(/\s+/g, "").toUpperCase() || undefined)
      .refine((s) => s === undefined || /^[0-9A-Z]{20}$/.test(s), vkey("cadastralRef")),
  })
  .superRefine((v, ctx) => {
    // A tenant signing needs the OWNER's details too: the form asks for the
    // landlord's name and NIF in the tenant row.
    if (v.relation === "tenant") {
      if (!v.ownerName) ctx.addIssue({ code: "custom", path: ["ownerName"], message: vkey("ownerNameForTenant") });
      if (!v.ownerTaxId) ctx.addIssue({ code: "custom", path: ["ownerTaxId"], message: vkey("ownerTaxIdForTenant") });
    }
    if (v.ownerTaxId && !isValidSpanishTaxId(v.ownerTaxId)) {
      ctx.addIssue({ code: "custom", path: ["ownerTaxId"], message: vkey("taxIdInvalid") });
    }
    if (Boolean(v.companyName) !== Boolean(v.companyTaxId)) {
      ctx.addIssue({ code: "custom", path: [v.companyName ? "companyTaxId" : "companyName"], message: vkey("companyBoth") });
    }
    if (v.companyTaxId && !isValidCif(v.companyTaxId)) {
      ctx.addIssue({ code: "custom", path: ["companyTaxId"], message: vkey("companyTaxIdInvalid") });
    }
  });

export type AuthorizationInput = z.infer<typeof authorizationInputSchema>;

/**
 * Errors the student can act on. `code` and `params` let the portal word them
 * in the student's language; `message` is the English for logs and staff.
 */
export class AuthorizationNotApplicableError extends Error {
  readonly code = "notBarcelona";
  constructor(message: string, readonly params: Record<string, string>) {
    super(message);
  }
}
export class UnprintableCharactersError extends Error {
  readonly code = "unprintable";
  constructor(message: string, readonly params: Record<string, string>) {
    super(message);
  }
}

const BASE_SIZE = 10;
const MIN_SIZE = 6;
const PADDING = 4;

function fitSize(font: PDFFont, text: string, width: number): number {
  let size = BASE_SIZE;
  while (size > MIN_SIZE && font.widthOfTextAtSize(text, size) > width - PADDING) size -= 0.5;
  return size;
}

/** The address row, validated against the fact that this is Barcelona's form. */
function addressFor(intake: IntakeData) {
  const city = intake.address.city.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (city !== "BARCELONA") {
    throw new AuthorizationNotApplicableError(
      `This is the City of Barcelona's form, but the address is in ${intake.address.city}. ` +
        "Each municipality has its own Padrón authorisation — contact us and we will get the right one.",
      { city: intake.address.city },
    );
  }
  return intake.address;
}

export async function fillPadronAuthorization(
  intake: IntakeData,
  input: AuthorizationInput,
  /** Tests only: keep the fields so their values can be read back. */
  { flatten = true }: { flatten?: boolean } = {},
): Promise<Uint8Array> {
  const address = addressFor(intake);
  const { identity } = intake;

  const values: Record<keyof typeof FIELD, string | undefined> = {
    signerName: input.signerName,
    signerId: input.signerId,
    companyName: input.companyName,
    companyTaxId: input.companyTaxId,
    street: address.streetName,
    number: address.buildingNumber,
    staircase: undefined,
    floorDoor: address.floorDoor,
    cadastralRef: input.cadastralRef,
    // Only meaningful in the tenant row; never printed for owners.
    ownerName: input.relation === "tenant" ? input.ownerName : undefined,
    ownerTaxId: input.relation === "tenant" ? input.ownerTaxId : undefined,
    // "Nom i cognoms": given name first, then surnames.
    studentName: [identity.givenName, identity.firstSurname, identity.secondSurname].filter(Boolean).join(" "),
    // The NIE if the student has one; otherwise the passport they register with.
    studentId: identity.nie ?? identity.passportNumber,
  };

  const printable = Object.values(values).filter(Boolean).join(" ");
  const missing = await unsupportedCharacters(printable);
  if (missing.length) {
    throw new UnprintableCharactersError(
      `These characters cannot be printed on the form: ${missing.join(" ")}. ` +
        "Please write names in Latin letters, exactly as on the ID document.",
      { chars: missing.join(" ") },
    );
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(templatePath(AUTHORIZATION_TEMPLATE));
  } catch {
    throw new TemplateNotFoundError(
      `${AUTHORIZATION_TEMPLATE} is missing from ${TEMPLATE_DIR} — see docs/FORMS.md.`,
    );
  }

  const doc = await PDFDocument.load(bytes);
  const { regular } = await embedUnicodeFonts(doc);
  const form = doc.getForm();

  for (const [key, fieldName] of Object.entries(FIELD) as [keyof typeof FIELD, string][]) {
    const value = values[key];
    if (!value) continue; // blank means untouched — never a placeholder
    const field = form.getTextField(fieldName);
    const width = field.acroField.getWidgets()[0]!.getRectangle().width;
    field.setText(value);
    // The template fixes every field at 12pt; narrow boxes (Núm. is 50pt wide)
    // need smaller type or the value runs out of its box.
    field.setFontSize(fitSize(regular, value, width));
  }

  form.getRadioGroup("Group1").select(RELATION[input.relation]);

  // Draw appearances with the Unicode font, then flatten: the result prints
  // identically everywhere and cannot be edited after the student downloads it.
  form.updateFieldAppearances(regular);
  if (flatten) form.flatten();
  return doc.save();
}
