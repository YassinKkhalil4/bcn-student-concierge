import { describe, it, expect } from "vitest";
import { intakeSchema } from "../src/lib/schema";
import {
  buildTasa012,
  splitStreet,
  splitFloorDoor,
  TASA_012_PORTAL_URL,
} from "../src/lib/tasa012";

const raw = {
  tierId: "baseline",
  identity: {
    passportNumber: "ab1234567", nie: "X1234567L", firstSurname: "okonkwo",
    secondSurname: "adeyemi", givenName: "chidi", gender: "H", birthDate: "14/03/2004",
    birthCity: "lagos", birthCountry: "nigeria", nationality: "nigerian",
  },
  family: { maritalStatus: "S", fatherFirstName: "emeka", motherFirstName: "ngozi" },
  address: {
    streetName: "carrer de mallorca", buildingNumber: "183", floorDoor: "3 2a",
    city: "barcelona", postalCode: "08036", province: "barcelona",
  },
  contact: { phone: "+34600111222", email: "chidi@example.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
};
const intake = intakeSchema.parse(raw);
const field = (s: ReturnType<typeof buildTasa012>, label: string) =>
  s.fields.find((f) => f.label === label)!;

describe("fee by route", () => {
  it("charges €16.08 for EX-17 (TIE) and €12.00 for EX-18 (CUE)", () => {
    expect(buildTasa012(intake, "EX-17").feeCents).toBe(1608);
    expect(buildTasa012(intake, "EX-18").feeCents).toBe(1200);
    expect(buildTasa012(intake, "EX-18").feeFormatted.replace(/\s/g, " ")).toBe("12 €");
    expect(buildTasa012(intake, "EX-17").feeFormatted.replace(/\s/g, " ")).toBe("16,08 €");
  });

  it("names the matching trámite for each route", () => {
    expect(buildTasa012(intake, "EX-17").tramite).toMatch(/^TIE que documenta la primera concesión/);
    expect(buildTasa012(intake, "EX-18").tramite).toMatch(/Certificado de registro de residente comunitario/);
  });
});

describe("portal fields", () => {
  const s = buildTasa012(intake, "EX-17");

  it("links to the official portal", () => {
    expect(s.url).toBe(TASA_012_PORTAL_URL);
    expect(new URL(s.url).hostname).toBe("sede.policia.gob.es");
  });

  it("puts surnames before the given name, as the label requires", () => {
    expect(field(s, "Apellidos y nombre o razón social").value).toBe("OKONKWO ADEYEMI CHIDI");
  });

  it("omits an absent second surname without leaving a gap", () => {
    const one = buildTasa012(
      intakeSchema.parse({ ...raw, identity: { ...raw.identity, secondSurname: "" } }),
      "EX-17",
    );
    expect(field(one, "Apellidos y nombre o razón social").value).toBe("OKONKWO CHIDI");
  });

  it("translates the Catalan street type for the portal dropdown", () => {
    expect(field(s, "Tipo de vía").value).toBe("CALLE");
    expect(field(s, "Nombre de la vía pública").value).toBe("MALLORCA");
  });

  it("splits floor and door", () => {
    expect(field(s, "Piso").value).toBe("3");
    expect(field(s, "Puerta").value).toBe("2A");
  });

  it("always instructs cash payment", () => {
    expect(s.paymentMethod).toBe("En efectivo");
    expect(s.studentMessage).toContain('"En efectivo"');
    expect(s.studentMessage).toMatch(/Do NOT choose "Adeudo en cuenta"/);
  });

  it("has no warnings for a complete file", () => {
    expect(s.warnings).toEqual([]);
  });
});

describe("safety", () => {
  it("warns instead of substituting the passport number when the NIE is missing", () => {
    const s = buildTasa012(
      intakeSchema.parse({ ...raw, identity: { ...raw.identity, nie: "" } }),
      "EX-17",
    );
    expect(s.warnings[0]).toMatch(/No NIE/);
    expect(field(s, "N.I.F./N.I.E.").value).toBe("");
    expect(s.studentMessage).not.toContain("AB1234567");
  });

  it("gives route-appropriate advice when the NIE is missing", () => {
    const noNie = intakeSchema.parse({ ...raw, identity: { ...raw.identity, nie: "" } });
    // Non-EU students have a visa carrying the NIE; EU citizens have neither.
    expect(buildTasa012(noNie, "EX-17").warnings[0]).toMatch(/visa/);
    expect(buildTasa012(noNie, "EX-18").warnings[0]).not.toMatch(/visa/);
    expect(buildTasa012(noNie, "EX-18").warnings[0]).toMatch(/EU citizens/);
  });

  it("flags an unrecognised street type for review rather than guessing", () => {
    const s = buildTasa012(
      intakeSchema.parse({ ...raw, address: { ...raw.address, streetName: "mallorca" } }),
      "EX-17",
    );
    expect(field(s, "Tipo de vía").review).toBeTruthy();
  });
});

describe("street parsing", () => {
  it.each([
    ["CARRER DEL CONSELL DE CENT", "CALLE", "CONSELL DE CENT"],
    ["CARRER D'ARAGÓ", "CALLE", "ARAGÓ"],
    ["AVINGUDA DIAGONAL", "AVENIDA", "DIAGONAL"],
    ["PASSEIG DE GRÀCIA", "PASEO", "GRÀCIA"],
    ["PLAÇA DE CATALUNYA", "PLAZA", "CATALUNYA"],
    ["GRAN VIA DE LES CORTS CATALANES", "GRAN VIA", "GRAN VIA DE LES CORTS CATALANES"],
    ["RAMBLA DE CATALUNYA", "RAMBLA", "CATALUNYA"],
    ["CALLE DE LA PRINCESA", "CALLE", "PRINCESA"],
  ])("%s → %s / %s", (input, type, name) => {
    expect(splitStreet(input)).toEqual({ type, name });
  });

  it("does not strip a connector that is part of the name itself", () => {
    // Only the LEADING connector goes: "DEL CONSELL DE CENT" keeps its inner "DE".
    expect(splitStreet("CARRER DEL CONSELL DE CENT").name).toContain(" DE ");
  });
});

describe("floor/door parsing", () => {
  it("handles the common shapes", () => {
    expect(splitFloorDoor(undefined)).toEqual({ piso: "", puerta: "", irregular: false });
    expect(splitFloorDoor("ATICO")).toEqual({ piso: "ATICO", puerta: "", irregular: false });
    expect(splitFloorDoor("ESC B 3 2")).toEqual({ piso: "ESC B 3 2", puerta: "", irregular: true });
  });
});
