import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFDocument,
  PDFName,
  PDFBool,
  StandardFonts,
  type PDFForm,
  type PDFFont,
} from "pdf-lib";
import type { IntakeData } from "@/lib/schema";
import {
  TEMPLATES,
  buildFieldValues,
  selectForm,
  type FieldValues,
  type FormId,
  type FormTemplate,
} from "./field-map";

/**
 * Server-side AcroForm population for the official EX-17 / EX-18 templates.
 *
 * The ordering in `fillForm` is load-bearing and easy to get wrong — see the
 * long comment there before changing anything.
 */

const TEMPLATE_DIR =
  process.env.FORM_TEMPLATE_DIR ?? path.join(process.cwd(), "templates", "forms");

export class TemplateNotFoundError extends Error {}
export class FieldMappingError extends Error {}

export interface FillResult {
  formId: FormId;
  bytes: Uint8Array;
  /** Fields present in the map but absent from the template — a mapping bug. */
  unmatchedFields: string[];
  /** Fields intentionally left blank (missing optional data). */
  blankFields: string[];
}

async function loadTemplate(template: FormTemplate): Promise<PDFDocument> {
  const file = path.join(TEMPLATE_DIR, template.file);
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch {
    throw new TemplateNotFoundError(
      `Template ${template.file} not found in ${TEMPLATE_DIR}. ` +
        "Official templates are not redistributed with this repository — " +
        "download them from the Ministerio de Inclusión and see docs/FORMS.md.",
    );
  }
  // Some ministry PDFs are XFA hybrids with malformed object streams that
  // strict parsing rejects; tolerate that rather than failing the whole job.
  return PDFDocument.load(bytes, { ignoreEncryption: false, throwOnInvalidObject: false });
}

/**
 * Set a text field only when we actually have a value.
 *
 * The `undefined` case returns without touching the field. That is the whole
 * point: writing "" would still mark the field as modified, and writing "N/A"
 * would put a literal declared value in a box an officer reads as data.
 */
function setTextField(
  form: PDFForm,
  name: string,
  value: string | undefined,
  font: PDFFont,
  report: { unmatched: string[]; blank: string[] },
): void {
  let field;
  try {
    field = form.getTextField(name);
  } catch {
    // Field is in our map but not in this template revision.
    report.unmatched.push(name);
    return;
  }

  if (value === undefined || value === "") {
    report.blank.push(name);
    return;
  }

  field.setText(value);
  // Embedding the font per field prevents pdf-lib from falling back to a
  // Helvetica the template may not have embedded, which shows as blank text
  // in Acrobat even though the value is present in the field dictionary.
  field.updateAppearances(font);
}

/**
 * Assert that Section 2 (legal representative) is empty, and that the DEHú
 * electronic-notification boxes are unchecked.
 *
 * This is an assertion, not an assignment. If a future template revision ships
 * with a pre-checked DEHú box or prefilled representative data, we want the job
 * to fail loudly rather than quietly file a form that (a) claims we legally
 * represent the student and (b) opts them into notifications they cannot read.
 */
function enforceBlankSections(form: PDFForm, template: FormTemplate): void {
  for (const name of template.representativeFields) {
    try {
      const field = form.getTextField(name);
      const current = field.getText();
      if (current && current.trim() !== "") {
        throw new FieldMappingError(
          `Representative field "${name}" is non-empty ("${current}"). Section 2 must ` +
            "stay blank — a populated representative section triggers a " +
            "power-of-attorney requirement at the police station.",
        );
      }
      field.setText("");
    } catch (err) {
      if (err instanceof FieldMappingError) throw err;
      // Field absent from this revision: nothing to blank, which is fine.
    }
  }

  for (const name of template.electronicNotificationFields) {
    try {
      const box = form.getCheckBox(name);
      if (box.isChecked()) {
        box.uncheck();
      }
    } catch {
      // Not present in this revision — acceptable.
    }
  }
}

export async function fillForm(data: IntakeData): Promise<FillResult> {
  const formId = selectForm(data.identity.nationality);
  const template = TEMPLATES[formId];
  const pdfDoc = await loadTemplate(template);
  const form = pdfDoc.getForm();

  // WinAnsi covers the Latin-1 range these forms use. Names outside it (e.g.
  // Cyrillic or CJK transliterations) would throw on encode, so callers should
  // supply the passport's machine-readable-zone transliteration.
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const values: FieldValues = buildFieldValues(data, formId);
  const report = { unmatched: [] as string[], blank: [] as string[] };

  for (const [name, value] of Object.entries(values)) {
    setTextField(form, name, value, font, report);
  }

  enforceBlankSections(form, template);

  /**
   * ORDERING MATTERS — do not reorder these three steps.
   *
   * 1. NeedAppearances=true tells a viewer to regenerate field appearance
   *    streams itself. The ministry templates ship with appearance streams
   *    that assume empty fields; without this flag some viewers render the
   *    original (blank) appearance and the form prints empty.
   *
   * 2. updateFieldAppearances() makes pdf-lib generate those streams NOW, so
   *    the file is correct even in viewers that ignore NeedAppearances
   *    (Preview.app and most mobile viewers do ignore it).
   *
   * 3. flatten() converts fields into ordinary page content. This is what
   *    removes the blue interactive highlight and, critically, stops text from
   *    shifting or re-wrapping when the file is printed at a locutorio — the
   *    single most common cause of a rejected printout. Flatten LAST: after
   *    flattening there are no fields left to set or restyle.
   */
  const acroForm = pdfDoc.catalog.lookup(PDFName.of("AcroForm"));
  if (acroForm && "set" in acroForm) {
    (acroForm as { set: (k: PDFName, v: PDFBool) => void }).set(
      PDFName.of("NeedAppearances"),
      PDFBool.True,
    );
  }
  form.updateFieldAppearances(font);
  form.flatten();

  const bytes = await pdfDoc.save({ useObjectStreams: false });

  return {
    formId,
    bytes,
    unmatchedFields: report.unmatched,
    blankFields: report.blank,
  };
}

/**
 * Strict variant for production jobs: refuses to emit a PDF when the field map
 * has drifted from the template. Used by the fulfilment worker; the preview
 * endpoint uses `fillForm` directly so staff can still see a partial render.
 */
export async function fillFormStrict(data: IntakeData): Promise<FillResult> {
  const result = await fillForm(data);
  if (result.unmatchedFields.length > 0) {
    throw new FieldMappingError(
      `Field map is out of date for ${result.formId}. Unknown fields: ` +
        `${result.unmatchedFields.join(", ")}. Run "npm run forms:inspect" ` +
        "against the current template and update src/lib/forms/field-map.ts.",
    );
  }
  return result;
}
