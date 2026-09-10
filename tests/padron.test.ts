import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { intakeSchema } from "../src/lib/schema";
import { isValidCif, isValidDni, isValidNie, isValidSpanishTaxId } from "../src/lib/spanish-ids";
import {
  authorizationInputSchema,
  fillPadronAuthorization,
  AuthorizationNotApplicableError,
  UnprintableCharactersError,
  AUTHORIZATION_TEMPLATE,
} from "../src/lib/forms/padron-authorization";
import { academicYear, enrolmentRequest, residenceRequest, COLLECTIVE_AUTHORIZATION_URL } from "../src/lib/request-templates";

const raw = {
  tierId: "baseline",
  identity: {
    passportNumber: "a01234567", nie: "X1234567L", firstSurname: "okonkwo", secondSurname: "adeyemi",
    givenName: "chidi", gender: "H", birthDate: "14/03/2004", birthCity: "lagos", birthCountry: "NG", nationality: "NG",
  },
  family: { maritalStatus: "S", fatherFirstName: "a", motherFirstName: "b" },
  address: { streetName: "carrer del consell de cent", buildingNumber: "421", floorDoor: "2 1b", city: "barcelona", postalCode: "08009", province: "barcelona" },
  contact: { phone: "+34600111222", email: "a@b.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
};
const intake = intakeSchema.parse(raw);
const tenant = { signerName: "maria garcía", signerId: "12345678Z", relation: "tenant", ownerName: "Inmobiliaria Gràcia SL", ownerTaxId: "A46103834" };

describe("Spanish ID check characters", () => {
  it("validates DNI and NIE letters", () => {
    expect(isValidDni("12345678Z")).toBe(true);
    expect(isValidDni("12345678A")).toBe(false);
    expect(isValidNie("X1234567L")).toBe(true);
    expect(isValidNie("Y1234567X")).toBe(true);
    expect(isValidNie("X1234567Z")).toBe(false);
  });

  it("validates published company CIFs and rejects a wrong control", () => {
    expect(isValidCif("A46103834")).toBe(true); // Mercadona
    expect(isValidCif("A28015865")).toBe(true); // Telefónica
    expect(isValidCif("A46103835")).toBe(false);
  });

  it("enforces letter vs digit controls by entity type", () => {
    // Entity A must use the digit; P (public body) must use the letter.
    expect(isValidCif("A4610383D")).toBe(false);
    expect(isValidSpanishTaxId("a-46.103.834")).toBe(true);
  });
});

describe("authorisation input", () => {
  it("requires the owner's name and NIF when a tenant signs", () => {
    const r = authorizationInputSchema.safeParse({ ...tenant, ownerName: "", ownerTaxId: "" });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["ownerName", "ownerTaxId"]));
  });

  it("rejects a mistyped owner NIF", () => {
    expect(authorizationInputSchema.safeParse({ ...tenant, ownerTaxId: "A46103835" }).success).toBe(false);
  });

  it("checks a DNI-shaped signer ID but accepts a passport", () => {
    expect(authorizationInputSchema.safeParse({ ...tenant, signerId: "12345678A" }).success).toBe(false);
    expect(authorizationInputSchema.safeParse({ ...tenant, signerId: "PA1234567" }).success).toBe(true);
  });

  it("wants a company's name and NIF together", () => {
    expect(authorizationInputSchema.safeParse({ ...tenant, companyName: "Coliving SL" }).success).toBe(false);
    expect(authorizationInputSchema.safeParse({ ...tenant, companyName: "Coliving SL", companyTaxId: "A46103834" }).success).toBe(true);
  });

  it("accepts only a 20-character cadastral reference", () => {
    expect(authorizationInputSchema.safeParse({ ...tenant, cadastralRef: "123" }).success).toBe(false);
    expect(authorizationInputSchema.safeParse({ ...tenant, cadastralRef: "9872023 VH5797S 0001 WX" }).success).toBe(true);
  });
});

const haveTemplate = existsSync(path.join(process.cwd(), "templates", "forms", AUTHORIZATION_TEMPLATE));

describe.skipIf(!haveTemplate)("filling Barcelona's official authorisation", () => {
  async function fieldsOf(input: object) {
    const bytes = await fillPadronAuthorization(intake, authorizationInputSchema.parse(input), { flatten: false });
    const form = (await PDFDocument.load(bytes)).getForm();
    return {
      text: (name: string) => form.getTextField(name).getText() ?? "",
      relation: form.getRadioGroup("Group1").getSelected(),
    };
  }

  it("maps every value to its printed box", async () => {
    const f = await fieldsOf(tenant);
    expect(f.text("Texto1")).toBe("MARIA GARCÍA");
    expect(f.text("Texto2")).toBe("12345678Z");
    expect(f.text("Texto5")).toBe("CARRER DEL CONSELL DE CENT");
    expect(f.text("Texto6")).toBe("421");
    expect(f.text("Texto8")).toBe("2 1B");
    expect(f.text("Texto9")).toBe("INMOBILIARIA GRÀCIA SL");
    expect(f.text("Texto10")).toBe("A46103834");
    // Student: given name, then surnames; the NIE when they have one.
    expect(f.text("Texto11")).toBe("CHIDI OKONKWO ADEYEMI");
    expect(f.text("Texto12")).toBe("X1234567L");
  });

  it("selects the tenant option", async () => {
    expect((await fieldsOf(tenant)).relation).toBe("Opción3");
    expect((await fieldsOf({ ...tenant, relation: "owner" })).relation).toBe("Opción1");
  });

  it("never prints owner details in the tenant row for an owner", async () => {
    const f = await fieldsOf({ ...tenant, relation: "owner" });
    expect(f.text("Texto9")).toBe("");
    expect(f.text("Texto10")).toBe("");
  });

  it("leaves the date, staircase and other rows for the signer", async () => {
    const f = await fieldsOf(tenant);
    expect(f.text("Data")).toBe(""); // dated by hand: validity runs from the signature
    expect(f.text("Texto7")).toBe("");
    for (let n = 13; n <= 24; n++) expect(f.text(`Texto${n}`), `Texto${n}`).toBe("");
  });

  it("uses the passport when the student has no NIE", async () => {
    const noNie = intakeSchema.parse({ ...raw, identity: { ...raw.identity, nie: "" } });
    const bytes = await fillPadronAuthorization(noNie, authorizationInputSchema.parse(tenant), { flatten: false });
    expect((await PDFDocument.load(bytes)).getForm().getTextField("Texto12").getText()).toBe("A01234567");
  });

  it("prints Polish, Romanian and Catalan letters", async () => {
    const f = await fieldsOf({ ...tenant, signerName: "Łukasz Wiśniewski-Ștefan" });
    expect(f.text("Texto1")).toBe("ŁUKASZ WIŚNIEWSKI-ȘTEFAN");
  });

  it("flattens the real output so it cannot be edited or re-flowed", async () => {
    const bytes = await fillPadronAuthorization(intake, authorizationInputSchema.parse(tenant));
    expect((await PDFDocument.load(bytes)).getForm().getFields()).toHaveLength(0);
  });

  it("refuses characters the font cannot draw instead of printing boxes", async () => {
    await expect(
      fillPadronAuthorization(intake, authorizationInputSchema.parse({ ...tenant, signerName: "王小明" })),
    ).rejects.toBeInstanceOf(UnprintableCharactersError);
  });

  it("refuses an address outside Barcelona — this is Barcelona's form", async () => {
    const elsewhere = intakeSchema.parse({ ...raw, address: { ...raw.address, city: "l'hospitalet de llobregat" } });
    await expect(
      fillPadronAuthorization(elsewhere, authorizationInputSchema.parse(tenant)),
    ).rejects.toBeInstanceOf(AuthorizationNotApplicableError);
  });
});

describe("Spanish request templates", () => {
  it("asks the residence for the stamped collective-home form", () => {
    const r = residenceRequest(intake);
    expect(r.body).toContain("Autorització d'empadronament de domicili col·lectiu");
    expect(r.body).toContain("sello");
    expect(r.body).toContain(COLLECTIVE_AUTHORIZATION_URL);
    expect(r.body).toContain("CHIDI OKONKWO ADEYEMI");
    expect(r.body).toContain("NIE X1234567L");
    expect(r.body).toMatch(/Chidi Okonkwo Adeyemi$/); // signed in title case
  });

  it("fills the enrolment email and leaves visible gaps when details are missing", () => {
    const blank = enrolmentRequest(intake, {});
    expect(blank.body).toContain("[universidad]");
    const full = enrolmentRequest(intake, { university: "EU Business School", programme: "BBA", year: "2026/2027" });
    expect(full.body).toContain("estudiante de BBA en EU Business School");
    expect(full.body).toContain("curso académico 2026/2027");
    expect(full.body).toContain("tiempo completo");
  });

  it("rolls the academic year over in August", () => {
    expect(academicYear(new Date(2026, 6, 31))).toBe("2025/2026");
    expect(academicYear(new Date(2026, 7, 1))).toBe("2026/2027");
  });
});
