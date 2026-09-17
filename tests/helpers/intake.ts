import { intakeSchema } from "../../src/lib/schema";

/**
 * A valid completed questionnaire, shared by the route suites so they cannot
 * drift from one another. Nigerian nationality, so the case takes the non-EU
 * route (EX-17) — the branch worth exercising, since the EU route is the
 * shorter one.
 */
export const intake = intakeSchema.parse({
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
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
});
