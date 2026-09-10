/**
 * Generate a synthetic AcroForm that mimics the structure of the official
 * EX-17 / EX-18 templates, for tests and local development.
 *
 * This is NOT a substitute for the real government form — it carries no
 * official layout, no barcode and no legal text. It exists so the fill engine
 * can be exercised in CI, where the real templates cannot be redistributed.
 *
 *   npx tsx scripts/make-test-template.ts templates/forms/EX-17.pdf
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { TEMPLATES } from "../src/lib/forms/field-map.ts";

const out = process.argv[2] ?? "templates/forms/EX-17.pdf";
const formId = out.includes("EX-18") ? "EX-18" : "EX-17";
const template = TEMPLATES[formId];

// Every field name the mapper can emit, so an unmatched-field regression fails.
const APPLICANT_FIELDS = [
  "pasaporte", "nie", "primer_apellido", "segundo_apellido", "nombre", "sexo",
  "fecha_nacimiento", "fecha_nacimiento_dia", "fecha_nacimiento_mes",
  "fecha_nacimiento_anio", "lugar_nacimiento", "pais_nacimiento", "nacionalidad",
  "estado_civil", "nombre_padre", "nombre_madre", "domicilio", "numero", "piso",
  "municipio", "cp", "provincia", "telefono", "email",
];

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const form = doc.getForm();

let page = doc.addPage([595, 842]); // A4
let y = 800;

function heading(text: string) {
  if (y < 80) {
    page = doc.addPage([595, 842]);
    y = 800;
  }
  page.drawText(text, { x: 40, y, size: 10, font, color: rgb(0.1, 0.2, 0.15) });
  y -= 22;
}

function addField(name: string) {
  if (y < 80) {
    page = doc.addPage([595, 842]);
    y = 800;
  }
  page.drawText(name, { x: 40, y: y + 4, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
  const field = form.createTextField(name);
  field.addToPage(page, { x: 200, y, width: 340, height: 16, borderWidth: 0.5 });
  y -= 26;
}

heading(`${template.id} — ${template.title} (TEST FIXTURE, NOT OFFICIAL)`);
heading("SECCION 1: DATOS DEL SOLICITANTE");
APPLICANT_FIELDS.forEach(addField);

heading("SECCION 2: DATOS DEL REPRESENTANTE LEGAL");
template.representativeFields.forEach(addField);

heading("NOTIFICACION ELECTRONICA (DEHU)");
for (const name of template.electronicNotificationFields) {
  if (y < 80) {
    page = doc.addPage([595, 842]);
    y = 800;
  }
  page.drawText(name, { x: 40, y: y + 4, size: 7, font, color: rgb(0.45, 0.45, 0.45) });
  const box = form.createCheckBox(name);
  box.addToPage(page, { x: 200, y, width: 14, height: 14 });
  y -= 26;
}

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, await doc.save());
console.log(`Wrote ${out} with ${form.getFields().length} fields`);
