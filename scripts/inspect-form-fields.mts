/**
 * Dump every AcroForm field in a PDF so the field map can be updated when the
 * ministry publishes a new template revision.
 *
 *   npm run forms:inspect -- templates/forms/EX-17.pdf
 */
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run forms:inspect -- <path-to.pdf>");
  process.exit(1);
}

const doc = await PDFDocument.load(await readFile(file), {
  throwOnInvalidObject: false,
});
const fields = doc.getForm().getFields();

console.log(`\n${file} — ${fields.length} fields\n`);
for (const field of fields) {
  const type = field.constructor.name.replace(/^PDF/, "");
  console.log(`  ${field.getName().padEnd(44)} ${type}`);
}
console.log(
  "\nPaste the text-field names into src/lib/forms/field-map.ts, and any " +
    "representative / DEHú checkbox names into the template descriptor.\n",
);
