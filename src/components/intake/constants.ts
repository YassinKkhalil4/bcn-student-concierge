/** Shared option lists and step metadata for the intake wizard. */

export const GENDER_OPTIONS = [
  { value: "H", label: "H — Hombre / Male" },
  { value: "M", label: "M — Mujer / Female" },
  { value: "X", label: "X — Other / Not specified" },
] as const;

/**
 * "Sp" is intentionally mixed-case: that is how separado/a is coded on the
 * official form. See the uppercase-policy note in src/lib/schema.ts.
 */
export const MARITAL_OPTIONS = [
  { value: "S", label: "S — Soltero/a (single)" },
  { value: "C", label: "C — Casado/a (married)" },
  { value: "V", label: "V — Viudo/a (widowed)" },
  { value: "D", label: "D — Divorciado/a (divorced)" },
  { value: "Sp", label: "Sp — Separado/a (separated)" },
] as const;

export const STEPS = [
  { id: "identity", label: "Identity" },
  { id: "family", label: "Civil status" },
  { id: "address", label: "Spanish address" },
  { id: "contact", label: "Contact" },
  { id: "consent", label: "Consent" },
  { id: "documents", label: "Documents" },
] as const;

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

export const CONSENT_COPY = [
  {
    name: "gdprDataProcessing" as const,
    label: "I consent to the processing of my personal data",
    body: "BCN Student Concierge may process the data above to prepare my forms, book appointments and administer my file, under GDPR Art. 6(1)(b). Data is held in the EU and deleted 30 days after service completion.",
    required: true,
  },
  {
    name: "gdprSensitiveDocuments" as const,
    label: "I consent to the storage of my identity documents",
    body: "My passport, visa and enrolment documents may be stored in encrypted form for the duration of my engagement. I understand I may withdraw this consent and request deletion at any time, and that withdrawal may prevent completion of the service.",
    required: true,
  },
  {
    name: "disclaimerAcknowledged" as const,
    label: "I understand this is not legal representation",
    body: "I understand BCN Student Concierge is an independent administrative facilitation service, is not a law firm or gestoría, does not represent me before any authority, and does not provide binding legal or immigration advice. All applications are submitted in my own name.",
    required: true,
  },
  {
    name: "marketingOptIn" as const,
    label: "Send me arrival tips before I travel",
    body: "Occasional practical email about arriving in Barcelona. Unsubscribe at any time. This is genuinely optional and does not affect your service.",
    required: false,
  },
];
