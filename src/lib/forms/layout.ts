import type { FormId } from "./field-map";

/**
 * Absolute-position layout for the official EX-17 / EX-18 templates.
 *
 * WHY COORDINATES AND NOT FIELD NAMES
 * The ministry publishes these forms as flat documents. There is no AcroForm
 * and no XFA — verified by decompressing every object stream in both files;
 * `form.getFields()` returns zero. Page 1 of EX-17 is composed of 38 bitmap
 * image XObjects, so there is not even vector artwork to snap to. Values must
 * therefore be drawn at absolute positions.
 *
 * COORDINATE SYSTEM
 * PDF origin is BOTTOM-LEFT, y increases upward. Units are points on a
 * 595x842 A4 page. `y` is the text BASELINE, positioned to sit just above the
 * printed dotted rule it writes onto.
 *
 * HOW THESE WERE OBTAINED — repeat this rather than hand-editing:
 *   npx tsx scripts/calibrate-form.mts templates/forms/EX-17-official.pdf
 *     → renders a 10pt grid, labelled every 50pt, over the real template
 *   npx tsx scripts/calibrate-form.mts templates/forms/EX-17-official.pdf --proof
 *     → boxes and labels every mapped position so misplacement is visible
 *
 * ⚠️ FRAGILITY — READ BEFORE SWAPPING IN A NEW TEMPLATE.
 * Coordinates are far more brittle than field names. A re-issued template that
 * shifts the layout by a few points will silently print data outside its box,
 * and a larger revision can put a value in the WRONG box on a legal document.
 * Nothing detects this automatically. Any template change requires re-running
 * the calibration and reviewing the proof render field by field.
 *
 * ⚠️ These coordinates have NOT yet been signed off against a printed copy.
 * See docs/FORMS.md — the sign-off procedure is mandatory before this engine
 * is used on a real application.
 */

export interface FieldPosition {
  /** Zero-based page index. */
  page: number;
  x: number;
  /** Text baseline. */
  y: number;
  /** Font size; defaults to the layout's `defaultSize`. */
  size?: number;
  /** Available width. Text is shrunk to fit rather than overflowing its box. */
  maxWidth?: number;
}

export interface CheckboxPosition {
  page: number;
  x: number;
  y: number;
}

export interface FormLayout {
  formId: FormId;
  defaultSize: number;
  /** Logical field name → position. Names match `buildFieldValues()` output. */
  fields: Record<string, FieldPosition>;
  /** Checkbox group → option value → position of the mark. */
  checkboxes: Record<string, Record<string, CheckboxPosition>>;
}

/**
 * EX-17 — Solicitud de Tarjeta de Identidad de Extranjero (TIE).
 * All applicant data is on page index 0; pages 1-2 are instructions.
 *
 * Section 2 (DATOS DEL REPRESENTANTE A EFECTOS DE PRESENTACIÓN) and Section 3
 * (DOMICILIO A EFECTOS DE NOTIFICACIONES) are deliberately absent from this
 * map. There is no coordinate to write them to, which makes leaving them blank
 * structurally guaranteed rather than merely a policy the code follows.
 */
const EX17: FormLayout = {
  formId: "EX-17",
  defaultSize: 8,
  fields: {
    // ── Row: PASAPORTE / N.I.E. ──
    pasaporte: { page: 0, x: 99, y: 645, maxWidth: 190 },
    nie: { page: 0, x: 326, y: 645, maxWidth: 172 },

    // ── Row: 1er Apellido / 2º Apellido ──
    primer_apellido: { page: 0, x: 94, y: 625, maxWidth: 254 },
    segundo_apellido: { page: 0, x: 400, y: 625, maxWidth: 152 },

    // ── Row: Nombre / Sexo (checkboxes) ──
    nombre: { page: 0, x: 84, y: 607, maxWidth: 258 },

    // ── Row: Fecha de nacimiento / Lugar / País ──
    // Measured against the printed rules at 135.8-150.4, 162.6-178.1 and
    // 191.0-224.5; each value starts just inside its own rule, clear of the
    // printed "/" separators that sit between them.
    fecha_nacimiento_dia: { page: 0, x: 137, y: 588, maxWidth: 13 },
    fecha_nacimiento_mes: { page: 0, x: 164, y: 588, maxWidth: 14 },
    fecha_nacimiento_anio: { page: 0, x: 192, y: 588, maxWidth: 30 },
    lugar_nacimiento: { page: 0, x: 252, y: 588, maxWidth: 161 },
    pais_nacimiento: { page: 0, x: 447, y: 588, maxWidth: 106 },

    // ── Row: Nacionalidad / Estado civil (checkboxes) ──
    nacionalidad: { page: 0, x: 101, y: 570, maxWidth: 212 },

    // ── Row: Nombre del padre / Nombre de la madre ──
    nombre_padre: { page: 0, x: 119, y: 550, maxWidth: 172 },
    nombre_madre: { page: 0, x: 372, y: 550, maxWidth: 180 },

    // ── Row: Domicilio en España / Nº / Piso ──
    domicilio: { page: 0, x: 128, y: 532, maxWidth: 330 },
    numero: { page: 0, x: 487, y: 532, maxWidth: 20 },
    // Same constraint as EX-18: the section border sits at ~558, so the box is
    // tight. Using its full width avoids shrinking a normal "3 2A" to 6pt.
    piso: { page: 0, x: 540, y: 532, maxWidth: 17 },

    // ── Row: Localidad / C.P. / Provincia ──
    municipio: { page: 0, x: 94, y: 513, maxWidth: 222 },
    cp: { page: 0, x: 347, y: 513, maxWidth: 60 },
    provincia: { page: 0, x: 458, y: 513, maxWidth: 95 },

    // ── Row: Teléfono móvil / E-mail ──
    telefono: { page: 0, x: 104, y: 494, maxWidth: 152 },
    email: { page: 0, x: 295, y: 494, maxWidth: 258, size: 7 },
  },
  checkboxes: {
    /** Sexo: X / H / M, drawn as an "X" inside the printed square. */
    sexo: {
      X: { page: 0, x: 472.5, y: 606 },
      H: { page: 0, x: 504, y: 606 },
      M: { page: 0, x: 537.5, y: 606 },
    },
    /** Estado civil: S / C / V / D / Sp. */
    estado_civil: {
      S: { page: 0, x: 413, y: 569 },
      C: { page: 0, x: 443, y: 569 },
      V: { page: 0, x: 470.5, y: 569 },
      D: { page: 0, x: 498.5, y: 569 },
      Sp: { page: 0, x: 529, y: 569 },
    },
    /**
     * DEHú electronic-notification consent.
     *
     * Mapped ONLY so the calibration proof can show it is never marked. The
     * engine has no code path that writes here: opting in starts binding
     * deadlines in a mailbox that requires a Spanish digital certificate, which
     * a newly arrived student does not have.
     */
    dehu_consentimiento: {
      NEVER_CHECK: { page: 0, x: 49, y: 168 },
    },
  },
};

/**
 * EX-18 — Solicitud de inscripción en el Registro Central de Extranjeros,
 * residencia de ciudadano de la UE (Real Decreto 240/2007).
 *
 * Calibrated independently of EX-17. The two forms look alike but are NOT
 * interchangeable: EX-18 carries a four-line header where EX-17 has three, which
 * pushes every Section 1 row 2-5pt lower, and its section box extends ~5pt
 * further right. Reusing EX-17's coordinates would print each value slightly
 * high and, on the tighter fields, outside its rule.
 *
 * Measured from the 10pt grid at 3.4x magnification, both halves of Section 1.
 * Row baselines (EX-17's equivalent in brackets):
 *   pasaporte / nie          640  [645]
 *   apellidos                623  [625]
 *   nombre / sexo            605  [607]
 *   fecha / lugar / pais     585  [588]
 *   nacionalidad / civil     567  [570]
 *   padre / madre            549  [550]
 *   domicilio / nº / piso    530  [532]
 *   localidad / cp / prov    512  [513]
 *   telefono / email         495  [494]
 */
const EX18: FormLayout = {
  formId: "EX-18",
  defaultSize: 8,
  fields: {
    // ── Row: PASAPORTE / N.I.E. ──
    pasaporte: { page: 0, x: 101, y: 640, maxWidth: 195 },
    /**
     * The printed N.I.E. area is segmented — [prefix] -- [digits] - [letter] —
     * but is filled as one value, matching EX-17. A long NIE therefore runs
     * across the "--" separator. Legible, and the segmentation is listed in
     * docs/FORMS.md as a refinement for both forms rather than being applied to
     * one and not the other.
     */
    nie: { page: 0, x: 330, y: 640, maxWidth: 168 },

    // ── Row: 1er Apellido / 2º Apellido ──
    primer_apellido: { page: 0, x: 94, y: 623, maxWidth: 245 },
    segundo_apellido: { page: 0, x: 392, y: 623, maxWidth: 158 },

    // ── Row: Nombre / Sexo (checkboxes) ──
    nombre: { page: 0, x: 85, y: 605, maxWidth: 255 },

    // ── Row: Fecha de nacimiento / Lugar / País ──
    // Printed rules measured at 136.0-149.8, 162.1-176.3 and 190.0-226.0;
    // each value starts inside its own rule, clear of the "/" separators.
    fecha_nacimiento_dia: { page: 0, x: 137, y: 585, maxWidth: 12 },
    fecha_nacimiento_mes: { page: 0, x: 164, y: 585, maxWidth: 12 },
    fecha_nacimiento_anio: { page: 0, x: 192, y: 585, maxWidth: 32 },
    lugar_nacimiento: { page: 0, x: 252, y: 585, maxWidth: 172 },
    pais_nacimiento: { page: 0, x: 451, y: 585, maxWidth: 100 },

    // ── Row: Nacionalidad / Estado civil (checkboxes) ──
    nacionalidad: { page: 0, x: 100, y: 567, maxWidth: 225 },

    // ── Row: Nombre del padre / Nombre de la madre ──
    nombre_padre: { page: 0, x: 116, y: 549, maxWidth: 178 },
    nombre_madre: { page: 0, x: 380, y: 549, maxWidth: 172 },

    // ── Row: Domicilio en España / Nº / Piso ──
    domicilio: { page: 0, x: 124, y: 530, maxWidth: 345 },
    // The printed Nº rule is only ~13pt wide, but ~21pt of whitespace follows
    // it before the "Piso" label. A three-digit street number is allowed to use
    // that space: overflowing a short rule slightly is far more legible than
    // shrinking "421" to 6pt, and it stays clear of the next label at 519.7.
    numero: { page: 0, x: 486, y: 530, maxWidth: 20 },
    // Piso is genuinely constrained — the section border sits at ~558.5 — so a
    // long floor/door like "2 1B" is shrunk rather than run off the box.
    piso: { page: 0, x: 540, y: 530, maxWidth: 17 },

    // ── Row: Localidad / C.P. / Provincia ──
    municipio: { page: 0, x: 100, y: 512, maxWidth: 222 },
    cp: { page: 0, x: 355, y: 512, maxWidth: 58 },
    provincia: { page: 0, x: 470, y: 512, maxWidth: 85 },

    // ── Row: Teléfono móvil / E-mail ──
    telefono: { page: 0, x: 118, y: 495, maxWidth: 148 },
    email: { page: 0, x: 305, y: 495, maxWidth: 248, size: 7 },
  },
  checkboxes: {
    /** Printed square left edges measured at 465.7 / 500.6 / 531.3. */
    sexo: {
      X: { page: 0, x: 470, y: 606 },
      H: { page: 0, x: 505, y: 606 },
      M: { page: 0, x: 536, y: 606 },
    },
    /** Left edges at 408.6 / 437.5 / 466.3 / 494.9 / 522.9. */
    estado_civil: {
      S: { page: 0, x: 413, y: 568 },
      C: { page: 0, x: 442, y: 568 },
      V: { page: 0, x: 471, y: 568 },
      D: { page: 0, x: 499.5, y: 568 },
      Sp: { page: 0, x: 527.5, y: 568 },
    },
    /** Mapped for the calibration proof only; the engine never marks it. */
    dehu_consentimiento: {
      NEVER_CHECK: { page: 0, x: 49, y: 168 },
    },
  },
};

export const FORM_LAYOUTS: Record<FormId, FormLayout> = {
  "EX-17": EX17,
  "EX-18": EX18,
};

/** A layout with no mapped fields has not been calibrated yet. */
export function isCalibrated(formId: FormId): boolean {
  return Object.keys(FORM_LAYOUTS[formId].fields).length > 0;
}
