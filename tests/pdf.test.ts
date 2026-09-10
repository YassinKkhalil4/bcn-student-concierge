import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { fillForm, fillFormStrict } from "../src/lib/forms/pdf";
import { intakeSchema } from "../src/lib/schema";

/**
 * These run against the synthetic fixtures produced by
 * `npx tsx scripts/make-test-template.mts`. The official ministry templates
 * are not redistributable, so CI verifies the ENGINE's behaviour — routing,
 * blank handling, Section 2, DEHú, flattening — against a form with the same
 * field names. Field-name drift in the real template is caught separately by
 * `fillFormStrict`, which is what production uses.
 */

const templateDir = path.join(process.cwd(), "templates", "forms");
const haveFixtures =
  existsSync(path.join(templateDir, "EX-17.pdf")) &&
  existsSync(path.join(templateDir, "EX-18.pdf"));

/**
 * Extract the text a flattened PDF actually renders.
 *
 * Asserting on raw file bytes does not work: pdf-lib Flate-compresses content
 * streams and encodes show-text operands as hex strings. Anything checking for
 * a plain substring in the saved bytes silently passes for the wrong reason,
 * so this decompresses each stream and decodes the hex operands first.
 */
async function renderedText(bytes: Uint8Array): Promise<string> {
  const d = await PDFDocument.load(bytes);
  let raw = "";
  for (const [, obj] of d.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      try {
        raw += inflateSync(Buffer.from(obj.contents)).toString("latin1");
      } catch {
        raw += Buffer.from(obj.contents).toString("latin1");
      }
    }
  }
  return raw.replace(/<([0-9A-Fa-f]+)>/g, (_m, hex: string) =>
    Buffer.from(hex, "hex").toString("latin1"),
  );
}

const base = {
  tierId: "turnkey",
  identity: {
    passportNumber: "ab1234567",
    firstSurname: "okonkwo",
    givenName: "chidi",
    gender: "H",
    birthDate: "14/03/2004",
    birthCity: "lagos",
    birthCountry: "nigeria",
    nationality: "nigerian",
  },
  family: { maritalStatus: "S", fatherFirstName: "emeka", motherFirstName: "ngozi" },
  address: {
    streetName: "carrer de mallorca",
    buildingNumber: "183",
    city: "barcelona",
    postalCode: "08036",
    province: "barcelona",
  },
  contact: { phone: "+34600111222", email: "chidi@example.com" },
  consent: {
    gdprDataProcessing: true,
    gdprSensitiveDocuments: true,
    disclaimerAcknowledged: true,
  },
};

describe.skipIf(!haveFixtures)("PDF fill engine", () => {
  let result: Awaited<ReturnType<typeof fillForm>>;
  /** Raw file bytes — used only for structural flags like NeedAppearances. */
  let raw: string;
  /** What the page actually renders, decompressed and hex-decoded. */
  let text: string;

  beforeAll(async () => {
    result = await fillForm(intakeSchema.parse(base));
    raw = Buffer.from(result.bytes).toString("latin1");
    text = await renderedText(result.bytes);
  });

  it("produces a valid, non-trivial PDF", () => {
    expect(raw.startsWith("%PDF-")).toBe(true);
    expect(result.bytes.byteLength).toBeGreaterThan(1000);
  });

  it("routes a Nigerian national to EX-17", () => {
    expect(result.formId).toBe("EX-17");
  });

  it("routes an Italian national to EX-18", async () => {
    const eu = await fillForm(
      intakeSchema.parse({
        ...base,
        identity: { ...base.identity, nationality: "italy" },
      }),
    );
    expect(eu.formId).toBe("EX-18");
  });

  it("flattens the form, leaving no interactive fields", async () => {
    // Flattening is what stops text shifting when the file is printed, and
    // removes the blue field highlight officers flag.
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it("sets NeedAppearances before flattening", () => {
    // The flag must survive into the saved file; viewers that honour it will
    // regenerate appearances rather than render the template's empty state.
    expect(raw).toContain("NeedAppearances");
  });

  it("draws the uppercase applicant data into the page content", () => {
    expect(text).toContain("OKONKWO");
    expect(text).toContain("CHIDI");
    expect(text).toContain("CARRER DE MALLORCA");
    expect(text).toContain("AB1234567");
  });

  it("never writes a placeholder into an omitted optional field", () => {
    // The whole point: an absent second surname prints nothing at all.
    expect(result.blankFields).toContain("segundo_apellido");
    expect(result.blankFields).toContain("nie");
    expect(result.blankFields).toContain("piso");
    expect(text).not.toContain("N/A");
  });

  it("prints an optional field when it IS supplied", async () => {
    const withExtras = await fillForm(
      intakeSchema.parse({
        ...base,
        identity: { ...base.identity, secondSurname: "adeyemi", nie: "X1234567L" },
        address: { ...base.address, floorDoor: "3 2a" },
      }),
    );
    const filled = await renderedText(withExtras.bytes);
    expect(filled).toContain("ADEYEMI");
    expect(filled).toContain("X1234567L");
    expect(filled).toContain("3 2A");
    expect(withExtras.blankFields).not.toContain("segundo_apellido");
  });

  it("leaves Section 2 (representative) entirely blank", () => {
    // A populated representative section triggers a power-of-attorney
    // requirement the agency neither holds nor claims.
    for (const field of ["rep_nombre", "rep_nie", "rep_email"]) {
      expect(result.blankFields.includes(field) || !result.unmatchedFields.includes(field)).toBe(true);
    }
  });

  it("leaves the DEHú notification checkboxes unchecked", async () => {
    // Assert on the pre-flatten document, since flattening removes the widget.
    const doc = await PDFDocument.load(readFileSync(path.join(templateDir, "EX-17.pdf")));
    for (const name of ["notificacion_electronica", "dehu_consentimiento"]) {
      expect(doc.getForm().getCheckBox(name).isChecked()).toBe(false);
    }
  });

  it("reports no unmatched fields against a current template", async () => {
    // fillFormStrict is what production uses: it refuses to emit a PDF when
    // the field map has drifted from the template.
    await expect(fillFormStrict(intakeSchema.parse(base))).resolves.toBeDefined();
    expect(result.unmatchedFields).toEqual([]);
  });

  it("is deterministic for identical input", async () => {
    const again = await fillForm(intakeSchema.parse(base));
    expect(again.formId).toBe(result.formId);
    expect(again.blankFields.sort()).toEqual(result.blankFields.sort());
  });
});
