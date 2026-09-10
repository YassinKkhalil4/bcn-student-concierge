import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { IntakeData } from "@/lib/schema";
import {
  TEMPLATES,
  buildFieldValues,
  selectForm,
  type FieldValues,
  type FormId,
} from "./field-map";
import {
  FORM_LAYOUTS,
  isCalibrated,
  type FieldPosition,
  type FormLayout,
} from "./layout";

/**
 * Overlay engine for the official EX-17 / EX-18 templates.
 *
 * These templates carry NO AcroForm — they are flat scans (page 1 of EX-17 is
 * 38 bitmap XObjects). The previous field-name approach cannot work against
 * them, so values are drawn at absolute positions from `layout.ts`.
 *
 * Consequences worth understanding before changing anything here:
 *  - There is nothing to flatten. The output is already non-interactive, which
 *    delivers the original goal — no blue field highlight, no text shifting on
 *    print — structurally rather than as a post-processing step.
 *  - `NeedAppearances` is meaningless without form fields and is not set.
 *  - Section 2 (representative) and Section 3 (notification address) have no
 *    coordinates in the layout, so leaving them blank is structurally
 *    guaranteed: there is no code path that could write to them.
 */

const TEMPLATE_DIR =
  process.env.FORM_TEMPLATE_DIR ?? path.join(process.cwd(), "templates", "forms");

/** Official templates are suffixed to distinguish them from test fixtures. */
const TEMPLATE_FILES: Record<FormId, string> = {
  "EX-17": "EX-17-official.pdf",
  "EX-18": "EX-18-official.pdf",
};

export class TemplateNotFoundError extends Error {}
export class UncalibratedFormError extends Error {}
export class FieldOverflowError extends Error {}

export interface FillResult {
  formId: FormId;
  bytes: Uint8Array;
  /** Field names in the layout that had no value — intentionally left empty. */
  blankFields: string[];
  /** Values present in the data but with no position in the layout. */
  unmappedFields: string[];
  /** Fields whose text had to be shrunk to fit its printed box. */
  shrunkFields: string[];
}

async function loadTemplate(formId: FormId): Promise<PDFDocument> {
  const file = path.join(TEMPLATE_DIR, TEMPLATE_FILES[formId]);
  try {
    return await PDFDocument.load(await readFile(file), {
      throwOnInvalidObject: false,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new TemplateNotFoundError(
        `Template ${TEMPLATE_FILES[formId]} not found in ${TEMPLATE_DIR}. ` +
          "Official templates are not redistributed with this repository — " +
          "see docs/FORMS.md.",
      );
    }
    throw error;
  }
}

/**
 * Draw one value, shrinking it to fit rather than letting it overflow.
 *
 * Overflow on this form is not cosmetic: a long street name running past its
 * rule collides with the "Nº" box and makes both unreadable to the officer
 * keying the data. Shrinking is capped at `MIN_SIZE`; below that the text would
 * be illegible in print, so the caller is told instead of silently emitting an
 * unreadable form.
 */
const MIN_SIZE = 5.5;

function drawValue(
  page: PDFPage,
  font: PDFFont,
  value: string,
  pos: FieldPosition,
  defaultSize: number,
  name: string,
  shrunk: string[],
): void {
  let size = pos.size ?? defaultSize;

  if (pos.maxWidth) {
    let width = font.widthOfTextAtSize(value, size);
    if (width > pos.maxWidth) {
      while (size > MIN_SIZE && width > pos.maxWidth) {
        size -= 0.25;
        width = font.widthOfTextAtSize(value, size);
      }
      shrunk.push(name);
      if (width > pos.maxWidth) {
        throw new FieldOverflowError(
          `Value for "${name}" (${value.length} chars) does not fit its box ` +
            `(${pos.maxWidth}pt) even at ${MIN_SIZE}pt. Shorten it or split it ` +
            "across the form's continuation space before filing.",
        );
      }
    }
  }

  page.drawText(value, {
    x: pos.x,
    y: pos.y,
    size,
    font,
    // Near-black rather than pure black: matches ink on a printed form and
    // stays clearly distinguishable from the template's own printed text.
    color: rgb(0.05, 0.05, 0.25),
  });
}

/** Mark a checkbox with an "X" sized to sit inside the printed square. */
function drawMark(page: PDFPage, font: PDFFont, x: number, y: number): void {
  page.drawText("X", { x, y, size: 9, font, color: rgb(0.05, 0.05, 0.25) });
}

function assertCalibrated(formId: FormId): void {
  if (!isCalibrated(formId)) {
    throw new UncalibratedFormError(
      `${formId} has no calibrated layout. Its coordinates differ from ` +
        `${formId === "EX-18" ? "EX-17" : "EX-18"} and cannot be reused — ` +
        "copying them would print applicant data in the wrong boxes. Run " +
        "scripts/calibrate-form.mts against the template and populate " +
        "FORM_LAYOUTS in src/lib/forms/layout.ts.",
    );
  }
}

export async function fillForm(data: IntakeData): Promise<FillResult> {
  const formId = selectForm(data.identity.nationality);
  assertCalibrated(formId);

  const layout: FormLayout = FORM_LAYOUTS[formId];
  const pdfDoc = await loadTemplate(formId);
  const pages = pdfDoc.getPages();

  // WinAnsi Helvetica covers the Latin-1 range these forms use. Names outside
  // it throw on encode — deliberately, so the problem surfaces here rather than
  // printing mojibake onto a legal document. Supply the passport MRZ
  // transliteration, which is what the authorities expect anyway.
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const values: FieldValues = buildFieldValues(data, formId);
  const blankFields: string[] = [];
  const unmappedFields: string[] = [];
  const shrunkFields: string[] = [];

  // ── Text values ──
  for (const [name, position] of Object.entries(layout.fields)) {
    const value = values[name];
    if (value === undefined || value === "") {
      // Genuinely empty: nothing is drawn. No "N/A", no dash, no placeholder.
      blankFields.push(name);
      continue;
    }
    const page = pages[position.page];
    if (!page) continue;
    drawValue(page, font, value, position, layout.defaultSize, name, shrunkFields);
  }

  // Anything the mapper produced that has nowhere to go. Reported rather than
  // silently dropped — a value the client supplied and expects on their form.
  const positionedNames = new Set(Object.keys(layout.fields));
  const checkboxGroups = new Set(Object.keys(layout.checkboxes));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === "") continue;
    if (positionedNames.has(name) || checkboxGroups.has(name)) continue;
    // fecha_nacimiento is intentionally unmapped: the form splits the date into
    // three boxes, which are mapped individually.
    if (name === "fecha_nacimiento") continue;
    unmappedFields.push(name);
  }

  // ── Checkboxes ──
  for (const [group, options] of Object.entries(layout.checkboxes)) {
    // The DEHú box is mapped for calibration only and must never be marked.
    if (group === "dehu_consentimiento") continue;

    const selected = values[group];
    if (selected === undefined) continue;

    const position = options[selected];
    if (!position) {
      throw new FieldOverflowError(
        `No checkbox position for ${group}="${selected}". Valid: ` +
          `${Object.keys(options).join(", ")}.`,
      );
    }
    const page = pages[position.page];
    if (page) drawMark(page, font, position.x, position.y);
  }

  const bytes = await pdfDoc.save({ useObjectStreams: false });
  return { formId, bytes, blankFields, unmappedFields, shrunkFields };
}

/**
 * Strict variant for production. Refuses to emit a form when any supplied value
 * has no home on it, rather than quietly filing an incomplete application.
 */
export async function fillFormStrict(data: IntakeData): Promise<FillResult> {
  const result = await fillForm(data);
  if (result.unmappedFields.length > 0) {
    throw new FieldOverflowError(
      `These values have no position on ${result.formId}: ` +
        `${result.unmappedFields.join(", ")}. Update src/lib/forms/layout.ts.`,
    );
  }
  return result;
}

export { TEMPLATES };
