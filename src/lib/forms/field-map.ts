import type { IntakeData } from "@/lib/schema";

/**
 * Mapping between our domain model and the AcroForm field names inside the
 * official Ministerio de Inclusión templates.
 *
 * ⚠️ THESE FIELD NAMES MUST BE VERIFIED AGAINST THE TEMPLATE YOU SHIP.
 * The ministry re-exports these PDFs periodically and the internal field names
 * are not stable across revisions — they are an implementation detail of
 * whatever tool produced the form, not a published contract.
 *
 * Workflow when a new template revision drops:
 *   1. Put the PDF in templates/forms/
 *   2. npm run forms:inspect -- templates/forms/EX-17.pdf
 *   3. Paste the emitted names into the map below.
 *   4. npm test — the mapping tests fail loudly on unknown/missing fields.
 *
 * The engine treats an unmapped field as a hard error rather than silently
 * producing a half-empty form that gets rejected at the police station.
 */

export type FormId = "EX-17" | "EX-18";

/** A value of `undefined` means: leave the field genuinely empty. */
export type FieldValues = Record<string, string | undefined>;

export interface FormTemplate {
  id: FormId;
  title: string;
  file: string;
  /**
   * Fields belonging to Section 2 (DATOS DEL REPRESENTANTE LEGAL). We assert
   * these stay empty rather than merely not filling them — see pdf.ts.
   */
  representativeFields: readonly string[];
  /**
   * Electronic-notification (DEHú) opt-in checkboxes. Left UNCHECKED: a student
   * without a Spanish digital certificate cannot access the DEHú mailbox, and
   * opting in starts legally-binding notification deadlines they would never
   * see. Checking this box is one of the most damaging defaults on the form.
   */
  electronicNotificationFields: readonly string[];
}

export const TEMPLATES: Record<FormId, FormTemplate> = {
  "EX-17": {
    id: "EX-17",
    title: "Solicitud de Tarjeta de Identidad de Extranjero (TIE)",
    file: "EX-17.pdf",
    representativeFields: [
      "rep_nie",
      "rep_pasaporte",
      "rep_primer_apellido",
      "rep_segundo_apellido",
      "rep_nombre",
      "rep_titulo",
      "rep_telefono",
      "rep_email",
    ],
    electronicNotificationFields: ["notificacion_electronica", "dehu_consentimiento"],
  },
  "EX-18": {
    id: "EX-18",
    title: "Solicitud de Certificado de Registro de Ciudadano de la UE (CUE)",
    file: "EX-18.pdf",
    representativeFields: [
      "rep_nie",
      "rep_pasaporte",
      "rep_primer_apellido",
      "rep_segundo_apellido",
      "rep_nombre",
      "rep_titulo",
      "rep_telefono",
      "rep_email",
    ],
    electronicNotificationFields: ["notificacion_electronica", "dehu_consentimiento"],
  },
};

/**
 * EU/EEA/Swiss nationals register via EX-18 (CUE certificate); everyone else
 * applies for a TIE card via EX-17. An applicant needs one or the other —
 * never both — so the engine routes on nationality instead of asking the
 * student to self-select a form they have no way to choose correctly.
 *
 * Nationality arrives uppercased and may be given in English or Spanish, so
 * both spellings are matched.
 */
const EU_EEA_SWISS = new Set([
  "AUSTRIA", "BELGIUM", "BELGICA", "BÉLGICA", "BULGARIA", "CROATIA", "CROACIA",
  "CYPRUS", "CHIPRE", "CZECH REPUBLIC", "CHEQUIA", "REPUBLICA CHECA",
  "DENMARK", "DINAMARCA", "ESTONIA", "FINLAND", "FINLANDIA", "FRANCE", "FRANCIA",
  "GERMANY", "ALEMANIA", "GREECE", "GRECIA", "HUNGARY", "HUNGRIA",
  "ICELAND", "ISLANDIA", "IRELAND", "IRLANDA", "ITALY", "ITALIA", "LATVIA",
  "LETONIA", "LIECHTENSTEIN", "LITHUANIA", "LITUANIA", "LUXEMBOURG",
  "LUXEMBURGO", "MALTA", "NETHERLANDS", "PAISES BAJOS", "HOLANDA",
  "NORWAY", "NORUEGA", "POLAND", "POLONIA", "PORTUGAL", "ROMANIA",
  "RUMANIA", "SLOVAKIA", "ESLOVAQUIA", "SLOVENIA", "ESLOVENIA",
  "SPAIN", "ESPANA", "SWEDEN", "SUECIA", "SWITZERLAND", "SUIZA",
]);

/** Strip diacritics so "ESPAÑA" and "ESPANA" both match. */
function normalizeCountry(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function selectForm(nationality: string): FormId {
  return EU_EEA_SWISS.has(normalizeCountry(nationality)) ? "EX-18" : "EX-17";
}

/**
 * Build the field payload for a form.
 *
 * Missing optional values map to `undefined`, NOT to "N/A", "-" or "". An
 * officer reading "N/A" in the second-surname box treats it as a declared
 * surname and the mismatch against the passport can invalidate the file.
 */
export function buildFieldValues(data: IntakeData, formId: FormId): FieldValues {
  const { identity, family, address, contact } = data;

  const [day, month, year] = identity.birthDate.split("/") as [string, string, string];

  const values: FieldValues = {
    // ── Section 1: DATOS DEL EXTRANJERO / CIUDADANO UE ──
    pasaporte: identity.passportNumber,
    nie: identity.nie, // undefined when not yet issued → left blank
    primer_apellido: identity.firstSurname,
    segundo_apellido: identity.secondSurname, // undefined for most non-Spaniards
    nombre: identity.givenName,
    sexo: identity.gender,
    fecha_nacimiento: identity.birthDate,
    fecha_nacimiento_dia: day,
    fecha_nacimiento_mes: month,
    fecha_nacimiento_anio: year,
    lugar_nacimiento: identity.birthCity,
    pais_nacimiento: identity.birthCountry,
    nacionalidad: identity.nationality,
    estado_civil: family.maritalStatus,
    nombre_padre: family.fatherFirstName,
    nombre_madre: family.motherFirstName,

    // ── Domicilio en España (must match the Padrón certificate exactly) ──
    domicilio: address.streetName,
    numero: address.buildingNumber,
    piso: address.floorDoor, // undefined when the address has no floor/door
    municipio: address.city,
    cp: address.postalCode,
    provincia: address.province,
    telefono: contact.phone,
    email: contact.email,
  };

  // Section 2 (representative) is deliberately absent from this object.
  // Populating it flags the file as filed by a legal representative, which
  // triggers a power-of-attorney requirement we neither hold nor claim.
  void formId;
  return values;
}
