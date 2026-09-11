/** Shared option lists and step metadata for the intake wizard. */

/**
 * Official codes with the Spanish word printed on the form. The gloss in the
 * student's language comes from messages/<locale>/intake.json.
 */
export const GENDER_OPTIONS = [
  { value: "H", spanish: "Hombre" },
  { value: "M", spanish: "Mujer" },
  { value: "X", spanish: "" },
] as const;

/**
 * "Sp" is intentionally mixed-case: that is how separado/a is coded on the
 * official form. See the uppercase-policy note in src/lib/schema.ts.
 */
export const MARITAL_OPTIONS = [
  { value: "S", spanish: "Soltero/a" },
  { value: "C", spanish: "Casado/a" },
  { value: "V", spanish: "Viudo/a" },
  { value: "D", spanish: "Divorciado/a" },
  { value: "Sp", spanish: "Separado/a" },
] as const;

export const STEPS = ["identity", "family", "address", "contact", "consent", "documents"] as const;

export type Values = Record<string, string>;
export type Errors = Record<string, string>;

export const INITIAL_VALUES: Values = {
  passportNumber: "",
  nie: "",
  firstSurname: "",
  secondSurname: "",
  givenName: "",
  gender: "",
  birthDate: "",
  birthCity: "",
  birthCountry: "",
  nationality: "",
  maritalStatus: "",
  fatherFirstName: "",
  motherFirstName: "",
  streetName: "",
  buildingNumber: "",
  floorDoor: "",
  // Sensible defaults for the overwhelmingly common case; both stay editable.
  city: "BARCELONA",
  postalCode: "",
  province: "BARCELONA",
  phone: "",
  email: "",
};

/** Consent boxes, in display order. Their wording is in intake.json → consent. */
export const CONSENT_ITEMS = [
  { name: "gdprDataProcessing", required: true },
  { name: "gdprSensitiveDocuments", required: true },
  { name: "disclaimerAcknowledged", required: true },
  { name: "marketingOptIn", required: false },
] as const;
