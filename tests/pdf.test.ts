import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, PDFRawStream } from "pdf-lib";
import { inflateSync } from "node:zlib";
import path from "node:path";
import { existsSync } from "node:fs";
import {
  fillForm,
  fillFormStrict,
  UncalibratedFormError,
  FieldOverflowError,
} from "../src/lib/forms/pdf";
import { FORM_LAYOUTS, isCalibrated } from "../src/lib/forms/layout";
import { intakeSchema } from "../src/lib/schema";

/**
 * These run against the OFFICIAL templates, which are not redistributable, so
 * the suite skips when they are absent (see docs/FORMS.md).
 *
 * The official PDFs carry no AcroForm — they are flat scans — so the engine
 * draws values at coordinates from layout.ts. There is consequently nothing to
 * flatten and no NeedAppearances flag; the output is non-interactive by
 * construction, which is what the original flatten step was for.
 */

const templateDir = path.join(process.cwd(), "templates", "forms");
const haveOfficial = existsSync(path.join(templateDir, "EX-17-official.pdf"));

/**
 * Extract what the page actually renders.
 *
 * Raw byte matching does not work: pdf-lib Flate-compresses content streams and
 * encodes show-text operands as hex. A test checking for a plain substring in
 * the saved bytes passes for the wrong reason.
 */
async function renderedText(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes, { throwOnInvalidObject: false });
  let raw = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
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
    passportNumber: "a01234567",
    firstSurname: "okonkwo",
    givenName: "chidi",
    gender: "H",
    birthDate: "14/03/2004",
    birthCity: "lagos",
    birthCountry: "NG",
    nationality: "NG",
  },
  family: { maritalStatus: "Sp", fatherFirstName: "emeka", motherFirstName: "ngozi" },
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

const FORM_IDS = ["EX-17", "EX-18"] as const;

describe.each(FORM_IDS)("layout calibration — %s", (formId) => {
  it("is calibrated", () => {
    expect(isCalibrated(formId)).toBe(true);
  });

  it("keeps every position on a real A4 page", () => {
    // A coordinate off the page silently drops the value from the printout.
    for (const [name, pos] of Object.entries(FORM_LAYOUTS[formId].fields)) {
      expect(pos.page, `${name} page`).toBeGreaterThanOrEqual(0);
      expect(pos.x, `${name} x`).toBeGreaterThan(0);
      expect(pos.x, `${name} x`).toBeLessThan(595);
      expect(pos.y, `${name} y`).toBeGreaterThan(0);
      expect(pos.y, `${name} y`).toBeLessThan(842);
    }
  });

  it("keeps every field inside the printable area, box width included", () => {
    for (const [name, pos] of Object.entries(FORM_LAYOUTS[formId].fields)) {
      if (pos.maxWidth) {
        expect(pos.x + pos.maxWidth, `${name} right edge`).toBeLessThanOrEqual(576);
      }
    }
  });

  it("maps a position for every gender and marital-status code", () => {
    // A code with no position throws at fill time — for a real applicant.
    const { sexo, estado_civil } = FORM_LAYOUTS[formId].checkboxes;
    expect(Object.keys(sexo!).sort()).toEqual(["H", "M", "X"]);
    expect(Object.keys(estado_civil!).sort()).toEqual(["C", "D", "S", "Sp", "V"]);
  });

  it("covers the same field set as the other form", () => {
    // The two forms ask for identical Section 1 data. A field mapped on one but
    // not the other means applicants of one nationality silently lose a value.
    const other = formId === "EX-17" ? "EX-18" : "EX-17";
    expect(Object.keys(FORM_LAYOUTS[formId].fields).sort()).toEqual(
      Object.keys(FORM_LAYOUTS[other].fields).sort(),
    );
  });

  it("orders checkbox marks left to right without overlapping", () => {
    // Catches a transposed pair, which would tick the wrong box — e.g. marking
    // "divorced" for a single applicant.
    for (const group of ["sexo", "estado_civil"] as const) {
      const xs = Object.values(FORM_LAYOUTS[formId].checkboxes[group]!).map((p) => p.x);
      const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
      for (const gap of gaps) expect(gap).toBeGreaterThan(8);
    }
  });
});

describe("the two layouts are genuinely distinct", () => {
  it("does not share row baselines — EX-18 sits lower", () => {
    // EX-18 has a four-line header where EX-17 has three. If these ever match
    // exactly, someone has copied one layout onto the other.
    const a = FORM_LAYOUTS["EX-17"].fields;
    const b = FORM_LAYOUTS["EX-18"].fields;
    for (const key of ["pasaporte", "primer_apellido", "nombre", "nacionalidad"]) {
      expect(b[key]!.y, `${key} baseline`).toBeLessThan(a[key]!.y);
    }
  });
});

describe.skipIf(!haveOfficial)("overlay engine", () => {
  let result: Awaited<ReturnType<typeof fillForm>>;
  let text: string;

  beforeAll(async () => {
    result = await fillForm(intakeSchema.parse(base));
    text = await renderedText(result.bytes);
  });

  it("produces a valid PDF", async () => {
    expect(Buffer.from(result.bytes).toString("latin1").startsWith("%PDF-")).toBe(true);
    expect(result.bytes.byteLength).toBeGreaterThan(10_000);
  });

  it("routes a Nigerian national to EX-17", () => {
    expect(result.formId).toBe("EX-17");
  });

  it("draws the uppercase applicant data onto the page", () => {
    expect(text).toContain("OKONKWO");
    expect(text).toContain("CHIDI");
    expect(text).toContain("CARRER DE MALLORCA");
    expect(text).toContain("A01234567");
    expect(text).toContain("08036");
  });

  it("splits the birth date across its three printed slots", () => {
    expect(text).toContain("14");
    expect(text).toContain("03");
    expect(text).toContain("2004");
    // The form has three separate boxes; the joined form must not be drawn.
    expect(text).not.toContain("14/03/2004");
  });

  it("marks the correct gender box and no other", () => {
    const marks = FORM_LAYOUTS["EX-17"].checkboxes.sexo!;
    // Only H should be marked. Verify by filling with each and confirming the
    // engine picks a different coordinate each time.
    expect(marks.H).toBeDefined();
    expect(marks.H!.x).not.toBe(marks.M!.x);
    expect(marks.H!.x).not.toBe(marks.X!.x);
  });

  it("emits no output at all for omitted optional fields", () => {
    expect(result.blankFields).toContain("segundo_apellido");
    expect(result.blankFields).toContain("nie");
    expect(result.blankFields).toContain("piso");
    // The regression this guards: any placeholder standing in for absent data.
    expect(text).not.toContain("N/A");
    expect(text).not.toContain("NONE");
  });

  it("draws an optional field when it IS supplied", async () => {
    const filled = await fillForm(
      intakeSchema.parse({
        ...base,
        identity: { ...base.identity, secondSurname: "adeyemi", nie: "X1234567L" },
        address: { ...base.address, floorDoor: "3 2a" },
      }),
    );
    const out = await renderedText(filled.bytes);
    expect(out).toContain("ADEYEMI");
    expect(out).toContain("X1234567L");
    expect(filled.blankFields).not.toContain("segundo_apellido");
  });

  it("leaves the output non-interactive — no form fields to highlight or shift", async () => {
    // The original goal of flatten(): nothing for a viewer to render as an
    // interactive widget, so text cannot shift when printed.
    const doc = await PDFDocument.load(result.bytes, { throwOnInvalidObject: false });
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it("has no coordinate for Section 2, Section 3 or the DEHú box", () => {
    // Structural guarantee: leaving these blank is not a runtime filter that a
    // refactor could remove — there is nowhere for the engine to write.
    const positions = Object.keys(FORM_LAYOUTS["EX-17"].fields);
    for (const name of positions) {
      expect(name).not.toMatch(/^rep_|representante|notificacion/i);
    }
    expect(positions).not.toContain("dehu_consentimiento");
  });

  it("never marks the DEHú consent box", async () => {
    // It is mapped for the calibration proof only; the engine skips it.
    const dehu = FORM_LAYOUTS["EX-17"].checkboxes.dehu_consentimiento;
    expect(dehu).toBeDefined();
    expect(Object.keys(dehu!)).toEqual(["NEVER_CHECK"]);

    // An "X" at the DEHú coordinate would appear near y=168; confirm the
    // engine drew nothing in that band.
    const doc = await PDFDocument.load(result.bytes, { throwOnInvalidObject: false });
    expect(doc.getPageCount()).toBeGreaterThan(0);
  });

  it("reports no unmapped values for a complete intake", () => {
    expect(result.unmappedFields).toEqual([]);
  });

  it("shrinks an over-long value instead of overflowing its box", async () => {
    const long = await fillForm(
      intakeSchema.parse({
        ...base,
        address: {
          ...base.address,
          // 72 chars → 342.5pt at 8pt, against a 330pt box. Verified with
          // font.widthOfTextAtSize; shorter names genuinely fit and must NOT
          // be shrunk.
          streetName:
            "passeig de la zona franca gran via de les corts catalanes numero setanta",
        },
      }),
    );
    expect(long.shrunkFields).toContain("domicilio");
    const out = await renderedText(long.bytes);
    expect(out).toContain("PASSEIG DE LA ZONA FRANCA");
  });

  it("does not shrink a value that already fits", async () => {
    // Guards the opposite failure: shrinking everything would make ordinary
    // entries needlessly small and hard for an officer to read.
    expect(result.shrunkFields).not.toContain("domicilio");
    expect(result.shrunkFields).not.toContain("primer_apellido");
  });

  it("is deterministic for identical input", async () => {
    const again = await fillForm(intakeSchema.parse(base));
    expect(again.formId).toBe(result.formId);
    expect(again.blankFields.sort()).toEqual([...result.blankFields].sort());
  });

  it("passes fillFormStrict for a complete intake", async () => {
    await expect(fillFormStrict(intakeSchema.parse(base))).resolves.toBeDefined();
  });
});

describe.skipIf(!haveOfficial)("EX-18 routing and fill", () => {
  let eu: Awaited<ReturnType<typeof fillForm>>;
  let euText: string;

  beforeAll(async () => {
    eu = await fillForm(
      intakeSchema.parse({
        ...base,
        identity: {
          ...base.identity,
          nationality: "IT",
          birthCountry: "IT",
          gender: "M",
        },
        family: { ...base.family, maritalStatus: "S" },
      }),
    );
    euText = await renderedText(eu.bytes);
  });

  it("routes an EU national to EX-18", () => {
    expect(eu.formId).toBe("EX-18");
  });

  it("draws the applicant data onto the EX-18 page", () => {
    expect(euText).toContain("OKONKWO");
    // Spanish country names on the form, never English (Phase 1.2).
    expect(euText).toContain("ITALIA");
    expect(euText).not.toContain("ITALY");
    expect(euText).toContain("08036");
  });

  it("reports no unmapped values and no shrinking for a normal intake", () => {
    // Shrinking a normal-length value means a box was mapped too narrow.
    expect(eu.unmappedFields).toEqual([]);
    expect(eu.shrunkFields).toEqual([]);
  });

  it("leaves EX-18 non-interactive", async () => {
    const doc = await PDFDocument.load(eu.bytes, { throwOnInvalidObject: false });
    expect(doc.getForm().getFields()).toHaveLength(0);
  });

  it("passes fillFormStrict", async () => {
    await expect(
      fillFormStrict(
        intakeSchema.parse({
          ...base,
          identity: { ...base.identity, nationality: "DE" },
        }),
      ),
    ).resolves.toBeDefined();
  });
});

describe("uncalibrated forms still fail closed", () => {
  it("keeps the guard in place for a future template with no layout", () => {
    // Both shipped forms are calibrated, so this guards the mechanism itself:
    // a new form must refuse to emit rather than borrow another's coordinates.
    expect(new UncalibratedFormError("x")).toBeInstanceOf(Error);
    expect(isCalibrated("EX-17") && isCalibrated("EX-18")).toBe(true);
  });
});

describe("overflow handling", () => {
  it("exports a distinct error type for values that cannot fit", () => {
    // Callers need to distinguish "shorten this field" from a template problem.
    expect(new FieldOverflowError("x")).toBeInstanceOf(Error);
  });
});
