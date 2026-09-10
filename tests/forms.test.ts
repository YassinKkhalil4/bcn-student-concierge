import { describe, it, expect } from "vitest";
import { buildFieldValues, selectForm, TEMPLATES } from "../src/lib/forms/field-map";
import { COUNTRY_CODES, EU_EEA_CH, spanishFormName } from "../src/lib/countries";
import { intakeSchema } from "../src/lib/schema";
import { validateUpload, sanitizeFilename } from "../src/lib/server/uploads";

const raw = {
  tierId: "soft-landing",
  identity: {
    passportNumber: "ab1234567",
    firstSurname: "okonkwo",
    givenName: "chidi",
    gender: "H",
    birthDate: "14/03/2004",
    birthCity: "lagos",
    birthCountry: "NG",
    nationality: "NG",
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

const data = intakeSchema.parse(raw);
const forms_raw = () => structuredClone(raw);

describe("form routing", () => {
  it("routes non-EU nationals to EX-17 (TIE)", () => {
    expect(selectForm("NIGERIAN")).toBe("EX-17");
    expect(selectForm("UNITED STATES")).toBe("EX-17");
  });

  it("routes EU/EEA/Swiss nationals to EX-18 (CUE)", () => {
    expect(selectForm("ITALY")).toBe("EX-18");
    expect(selectForm("GERMANY")).toBe("EX-18");
    expect(selectForm("SWITZERLAND")).toBe("EX-18");
  });

  it("still routes legacy free-text names, ignoring diacritics", () => {
    expect(selectForm("ALEMANIA")).toBe("EX-18");
    expect(selectForm("BÉLGICA")).toBe("EX-18");
    expect(selectForm("belgica")).toBe("EX-18");
  });

  it("routes ISO codes exactly", () => {
    expect(selectForm("NG")).toBe("EX-17");
    expect(selectForm("GB")).toBe("EX-17"); // post-Brexit: not EU
    expect(selectForm("US")).toBe("EX-17");
    for (const eu of ["IT", "DE", "FR", "NL", "PL", "IE", "NO", "IS", "LI", "CH"]) {
      expect(selectForm(eu), eu).toBe("EX-18");
    }
  });

  it("never routes Spain to EX-18 — Spanish citizens need neither form", () => {
    expect(selectForm("ES")).toBe("EX-17");
    expect(EU_EEA_CH.has("ES")).toBe(false);
  });
});

describe("countries on the forms", () => {
  it("prints the Spanish name, never the English one", () => {
    expect(spanishFormName("GB")).toBe("REINO UNIDO");
    expect(spanishFormName("US")).toBe("ESTADOS UNIDOS");
    expect(spanishFormName("NL")).toBe("PAÍSES BAJOS");
    expect(spanishFormName("IT")).toBe("ITALIA");
    expect(spanishFormName("DE")).toBe("ALEMANIA");
  });

  it("uses form-appropriate names where ICU's display name is not", () => {
    expect(spanishFormName("HK")).toBe("HONG KONG");
    expect(spanishFormName("VI")).not.toContain("EE. UU.");
  });

  it("has a Spanish name for every code", () => {
    for (const code of COUNTRY_CODES) expect(spanishFormName(code), code).toMatch(/^[A-ZÁÉÍÓÚÜÑ .,'()-]+$/);
  });

  it("keeps legacy free text as entered", () => {
    expect(spanishFormName("utopia")).toBe("UTOPIA");
  });

  it("refuses Spanish nationality and unknown codes at intake", () => {
    const base = forms_raw();
    expect(() => intakeSchema.parse({ ...base, identity: { ...base.identity, nationality: "ES" } })).toThrow(/Spanish citizens/);
    expect(() => intakeSchema.parse({ ...base, identity: { ...base.identity, nationality: "XX" } })).toThrow();
    expect(intakeSchema.parse({ ...base, identity: { ...base.identity, nationality: "gb" } }).identity.nationality).toBe("GB");
  });
});

describe("field mapping", () => {
  const values = buildFieldValues(data, "EX-17");

  it("emits uppercase values", () => {
    expect(values.primer_apellido).toBe("OKONKWO");
    expect(values.domicilio).toBe("CARRER DE MALLORCA");
  });

  it("leaves a missing second surname undefined rather than 'N/A'", () => {
    expect(values.segundo_apellido).toBeUndefined();
    // Guard against every placeholder anyone might be tempted to substitute.
    for (const placeholder of ["N/A", "NA", "-", "NONE", ""]) {
      expect(values.segundo_apellido).not.toBe(placeholder);
    }
  });

  it("leaves a missing NIE and floor/door undefined", () => {
    expect(values.nie).toBeUndefined();
    expect(values.piso).toBeUndefined();
  });

  it("splits the birth date into day, month and year components", () => {
    expect(values.fecha_nacimiento_dia).toBe("14");
    expect(values.fecha_nacimiento_mes).toBe("03");
    expect(values.fecha_nacimiento_anio).toBe("2004");
    expect(values.fecha_nacimiento).toBe("14/03/2004");
  });

  it("never emits a value for a section that must stay blank", () => {
    // Section 2 (representative), Section 3 (notification address) and the DEHú
    // box. The mapper must not produce them; layout.ts additionally gives them
    // no coordinate, so there is nowhere to draw them even if it did.
    for (const field of TEMPLATES["EX-17"].neverFilled) {
      expect(values[field]).toBeUndefined();
    }
  });

  it("emits no key that looks like representative or notification data", () => {
    for (const key of Object.keys(values)) {
      expect(key).not.toMatch(/^rep_|representante|notificacion|dehu/i);
    }
  });

  it("carries the address through unchanged for the Padrón match", () => {
    expect(values.numero).toBe("183");
    expect(values.cp).toBe("08036");
    expect(values.municipio).toBe("BARCELONA");
  });
});

describe("upload validation", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);

  it("accepts PDF, PNG and JPEG by magic bytes", () => {
    expect(validateUpload(pdf, "passport.pdf").mimeType).toBe("application/pdf");
    expect(validateUpload(png, "passport.png").mimeType).toBe("image/png");
    expect(validateUpload(jpeg, "passport.jpg").mimeType).toBe("image/jpeg");
  });

  it("rejects HTML disguised with a .pdf extension", () => {
    // The stored-XSS case: extension says PDF, content is a script.
    const html = new TextEncoder().encode("<html><script>alert(1)</script>");
    expect(validateUpload(html, "passport.pdf").ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(validateUpload(new Uint8Array(0), "empty.pdf").ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const huge = new Uint8Array(11 * 1024 * 1024);
    huge.set(pdf);
    expect(validateUpload(huge, "big.pdf").ok).toBe(false);
  });

  it("strips path traversal from filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("a/b/c/scan.pdf")).toBe("scan.pdf");
    expect(sanitizeFilename("shell$(rm -rf).pdf")).toBe("shell__rm_-rf_.pdf");
  });
});
