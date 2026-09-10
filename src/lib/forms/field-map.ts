import type { IntakeData } from "@/lib/schema";

/**
 * Maps our domain model to the logical field names the form layout draws.
 *
 * These names are OURS, not the template's. The official ministry PDFs carry no
 * AcroForm — they are flat scans — so there are no internal field names to
 * match. Each name here is a key into the coordinate map in `layout.ts`, which
 * is where the actual page positions live.
 *
 * Adding a value here without a matching position in `layout.ts` is reported by
 * the engine as `unmappedFields`, and `fillFormStrict()` refuses to emit the
 * form — a value the client supplied must never be silently dropped from their
 * application.
 */

export type FormId = "EX-17" | "EX-18";

/** A value of `undefined` means: leave the field genuinely empty. */
export type FieldValues = Record<string, string | undefined>;

export interface FormTemplate {
  id: FormId;
  title: string;
  file: string;
  /**
   * Sections that must never receive data, recorded for documentation and for
   * the calibration proof render.
   *
   * These are NOT enforced by filtering at runtime. They are enforced
   * structurally: no coordinate for them exists in `layout.ts`, so the engine
   * has no way to write there even if a future change tried to. That is a
   * stronger guarantee than a runtime check, which a refactor could remove.
   *
   *  - Section 2, DATOS DEL REPRESENTANTE: filling it declares that we act as
   *    the applicant's legal representative, which triggers a power-of-attorney
   *    requirement we neither hold nor claim.
   *  - Section 3, DOMICILIO A EFECTOS DE NOTIFICACIONES: belongs to the
   *    applicant, not to us.
   *  - The DEHú consent box: opting in starts legally binding deadlines in a
   *    mailbox that needs a Spanish digital certificate to open, which a newly
   *    arrived student does not have.
   */
  neverFilled: readonly string[];
}

export const TEMPLATES: Record<FormId, FormTemplate> = {
  "EX-17": {
    id: "EX-17",
    title: "Solicitud de Tarjeta de Identidad de Extranjero (TIE)",
    file: "EX-17.pdf",
    neverFilled: [
      "seccion_2_representante",
      "seccion_3_domicilio_notificaciones",
      "representante_legal_en_su_caso",
      "dehu_consentimiento",
    ],
  },
  "EX-18": {
    id: "EX-18",
    title: "Solicitud de Certificado de Registro de Ciudadano de la UE (CUE)",
    file: "EX-18.pdf",
    neverFilled: [
      "seccion_2_representante",
      "seccion_3_domicilio_notificaciones",
      "representante_legal_en_su_caso",
      "dehu_consentimiento",
    ],
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
