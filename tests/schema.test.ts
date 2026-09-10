import { describe, it, expect } from "vitest";
import {
  intakeSchema,
  identitySchema,
  nieSchema,
  spanishDateSchema,
  consentSchema,
} from "../src/lib/schema";

const validIdentity = {
  passportNumber: "ab1234567",
  firstSurname: "  van   der  Berg ",
  givenName: "Sofia",
  gender: "M",
  birthDate: "14/03/2004",
  birthCity: "Amsterdam",
  birthCountry: "Netherlands",
  nationality: "Dutch",
};

describe("uppercase coercion", () => {
  it("uppercases and collapses whitespace in printed fields", () => {
    const parsed = identitySchema.parse(validIdentity);
    expect(parsed.firstSurname).toBe("VAN DER BERG");
    expect(parsed.givenName).toBe("SOFIA");
    expect(parsed.passportNumber).toBe("AB1234567");
  });

  it("lowercases email rather than uppercasing it", () => {
    // Uppercasing a local-part can break delivery on case-sensitive servers.
    const parsed = intakeSchema.shape.contact.parse({
      phone: "+34600111222",
      email: "Sofia.VanDerBerg@Example.COM",
    });
    expect(parsed.email).toBe("sofia.vanderberg@example.com");
  });

  it("preserves the mixed-case 'Sp' marital code verbatim", () => {
    // "SP" is not a code the official form defines — only "Sp" is.
    const parsed = intakeSchema.shape.family.parse({
      maritalStatus: "Sp",
      fatherFirstName: "jan",
      motherFirstName: "elena",
    });
    expect(parsed.maritalStatus).toBe("Sp");
    expect(parsed.fatherFirstName).toBe("JAN");
  });
});

describe("required fields reject empty input", () => {
  // Regression: `upper()` originally piped to `z.string().max(n)` with no
  // minimum, so "" survived the uppercase transform and validated cleanly.
  // A blank surname would have been printed onto a government form.
  it.each([
    "firstSurname",
    "givenName",
    "birthCity",
    "birthCountry",
    "nationality",
  ])("rejects an empty %s", (field) => {
    const result = identitySchema.safeParse({ ...validIdentity, [field]: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only input, which trims to empty", () => {
    expect(
      identitySchema.safeParse({ ...validIdentity, firstSurname: "   " }).success,
    ).toBe(false);
  });

  it("names the offending field in the message", () => {
    const result = identitySchema.safeParse({ ...validIdentity, givenName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toMatch(/given name/i);
    }
  });

  it("still rejects over-length input", () => {
    expect(
      identitySchema.safeParse({ ...validIdentity, firstSurname: "A".repeat(61) })
        .success,
    ).toBe(false);
  });

  it("rejects an intake whose required address fields are blank", () => {
    const result = intakeSchema.shape.address.safeParse({
      streetName: "",
      buildingNumber: "",
      city: "",
      postalCode: "08036",
      province: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("optional fields", () => {
  it("maps an empty second surname to undefined, never to a placeholder", () => {
    const parsed = identitySchema.parse({ ...validIdentity, secondSurname: "" });
    expect(parsed.secondSurname).toBeUndefined();
  });

  it("accepts a genuinely absent second surname", () => {
    const parsed = identitySchema.parse(validIdentity);
    expect(parsed.secondSurname).toBeUndefined();
  });

  it("allows a blank NIE for students who have not been issued one", () => {
    const parsed = identitySchema.parse({ ...validIdentity, nie: "" });
    expect(parsed.nie).toBeUndefined();
  });
});

describe("NIE validation", () => {
  it("accepts a NIE with a correct control letter", () => {
    // 0 + 1234567 = 1234567; 1234567 % 23 = 19; "TRWAGMYFPDXBNJZSQVHLCKE"[19] = "L"
    expect(nieSchema.parse("x1234567l")).toBe("X1234567L");
  });

  it("rejects a NIE whose control letter does not match", () => {
    expect(() => nieSchema.parse("X1234567Z")).toThrow(/control letter/i);
  });

  it("rejects a NIE with a bad prefix", () => {
    expect(() => nieSchema.parse("A1234567L")).toThrow();
  });
});

describe("Spanish date validation", () => {
  it("accepts a real DD/MM/YYYY date", () => {
    expect(spanishDateSchema.parse("29/02/2004")).toBe("29/02/2004");
  });

  it("rejects a date that does not exist", () => {
    expect(() => spanishDateSchema.parse("31/02/2004")).toThrow(/does not exist/i);
    expect(() => spanishDateSchema.parse("29/02/2005")).toThrow(/does not exist/i);
  });

  it("rejects ISO format, which would silently reorder day and month", () => {
    expect(() => spanishDateSchema.parse("2004-03-14")).toThrow();
  });

  it("rejects future birth dates", () => {
    expect(() => spanishDateSchema.parse("01/01/2099")).toThrow();
  });
});

describe("GDPR consent", () => {
  const base = {
    gdprDataProcessing: true,
    gdprSensitiveDocuments: true,
    disclaimerAcknowledged: true,
  };

  it("requires every mandatory consent to be explicitly true", () => {
    expect(consentSchema.parse(base).marketingOptIn).toBe(false);
  });

  it("rejects an unchecked mandatory consent box", () => {
    expect(() =>
      consentSchema.parse({ ...base, gdprDataProcessing: false }),
    ).toThrow();
  });

  it("does not accept a truthy non-boolean as consent", () => {
    expect(() =>
      consentSchema.parse({ ...base, disclaimerAcknowledged: "yes" }),
    ).toThrow();
  });

  it("treats marketing opt-in as genuinely optional", () => {
    expect(consentSchema.parse(base).marketingOptIn).toBe(false);
  });
});

describe("address", () => {
  it("rejects a non-5-digit postal code", () => {
    const addr = {
      streetName: "carrer de mallorca",
      buildingNumber: "183",
      city: "barcelona",
      postalCode: "0801",
      province: "barcelona",
    };
    expect(() => intakeSchema.shape.address.parse(addr)).toThrow(/5 digits/i);
    expect(
      intakeSchema.shape.address.parse({ ...addr, postalCode: "08036" }).streetName,
    ).toBe("CARRER DE MALLORCA");
  });
});
