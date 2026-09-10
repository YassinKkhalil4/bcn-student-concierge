import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import type { PGlite } from "@electric-sql/pglite";
import { intakeSchema } from "../src/lib/schema";
import { madridLocalToUtc, utcToMadridLocal, formatMadrid } from "../src/lib/time";
import { appointmentSheetContent } from "../src/lib/guides/appointment-content";
import { renderAppointmentSheet, SheetOverflowError } from "../src/lib/guides/appointment-sheet";
import { appointmentSheetForCase } from "../src/lib/guides/sheet-for-case";
import { caixabankAtmSteps } from "../src/lib/guides/caixabank-atm";
import { appointmentInputSchema, saveAppointment, listAppointments, deleteAppointment } from "../src/lib/server/appointments";
import { createCase, purgeCase } from "../src/lib/server/storage";
import { useTestDb } from "./helpers/db";

let client: PGlite;
beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  ({ client } = await useTestDb());
});
beforeEach(async () => {
  await client.exec("TRUNCATE case_documents, appointments, cases CASCADE");
});

describe("Madrid wall-clock time", () => {
  it("converts summer (CEST, UTC+2) and winter (CET, UTC+1) times", () => {
    expect(madridLocalToUtc("2026-07-01T09:30").toISOString()).toBe("2026-07-01T07:30:00.000Z");
    expect(madridLocalToUtc("2026-12-01T09:30").toISOString()).toBe("2026-12-01T08:30:00.000Z");
  });

  it("is right on the days the clocks change", () => {
    // Clocks go forward 29 Mar 2026 and back 25 Oct 2026.
    expect(madridLocalToUtc("2026-03-29T12:00").toISOString()).toBe("2026-03-29T10:00:00.000Z");
    expect(madridLocalToUtc("2026-10-25T12:00").toISOString()).toBe("2026-10-25T11:00:00.000Z");
  });

  it("round-trips for pre-filling the edit form", () => {
    for (const local of ["2026-01-15T08:00", "2026-06-30T17:45", "2026-10-25T09:15"]) {
      expect(utcToMadridLocal(madridLocalToUtc(local))).toBe(local);
    }
  });

  it("prints the Barcelona time, whatever the server's zone", () => {
    expect(formatMadrid(madridLocalToUtc("2026-10-02T09:30")).time).toBe("09:30");
  });

  it("rejects malformed input", () => {
    expect(() => madridLocalToUtc("02/10/2026 09:30")).toThrow();
  });
});

const base = {
  ref: "BCN-12345",
  applicantName: "Chidi Okonkwo",
  scheduledAt: madridLocalToUtc("2026-10-02T09:30"),
  officeName: "Comisaría de Policía Nacional",
  officeAddress: "Rambla de Guipúscoa, 74, Barcelona",
  nearestMetro: null,
  confirmationCode: "CITA-1",
};

describe("appointment sheet content by route", () => {
  it("EX-17: photo, fingerprints and card collection", () => {
    const c = appointmentSheetContent({ ...base, formId: "EX-17" });
    expect(c.checklist.join(" ")).toMatch(/32 × 26 mm/);
    expect(c.phrases[0]!.spanish).toMatch(/toma de huellas/);
    expect(c.after.join(" ")).toMatch(/resguardo/);
  });

  it("EX-18: no photo and no fingerprints — EU registration involves neither", () => {
    const c = appointmentSheetContent({ ...base, formId: "EX-18" });
    const all = JSON.stringify(c);
    // "photocopy" of the ID is legitimate; a *photo* (the 32 × 26 mm picture) is not.
    expect(all).not.toMatch(/32 × 26|\bphotos?\b|huellas|fingerprint/i);
    expect(c.phrases[0]!.spanish).toMatch(/certificado de registro de ciudadano de la Unión/);
  });

  it("both: the paid fee receipt and the printed appointment confirmation", () => {
    for (const formId of ["EX-17", "EX-18"] as const) {
      const list = appointmentSheetContent({ ...base, formId }).checklist.join(" ");
      expect(list, formId).toMatch(/Modelo 790 Código 012, paid/);
      expect(list, formId).toMatch(/justificante de cita/);
      expect(list, formId).toMatch(new RegExp(`Your ${formId}, printed and signed`));
    }
  });

  it("gives every Spanish phrase a phonetic and a meaning", () => {
    for (const formId of ["EX-17", "EX-18"] as const) {
      for (const p of appointmentSheetContent({ ...base, formId }).phrases) {
        expect(p.phonetic.length).toBeGreaterThan(5);
        expect(p.meaning.length).toBeGreaterThan(5);
      }
    }
  });
});

describe("appointment sheet rendering", () => {
  it("fits on exactly one page for both routes, with or without Metro", async () => {
    for (const formId of ["EX-17", "EX-18"] as const) {
      for (const nearestMetro of [null, "L2 · Bac de Roda, then 6 minutes walking along the Rambla"]) {
        const bytes = await renderAppointmentSheet(appointmentSheetContent({ ...base, formId, nearestMetro }));
        expect((await PDFDocument.load(bytes)).getPageCount(), `${formId} metro=${Boolean(nearestMetro)}`).toBe(1);
      }
    }
  });

  it("refuses to spill onto a second page", async () => {
    const c = appointmentSheetContent({ ...base, formId: "EX-17" });
    c.checklist = Array.from({ length: 60 }, (_, i) => `Item ${i} with a fairly long description to take space`);
    await expect(renderAppointmentSheet(c)).rejects.toBeInstanceOf(SheetOverflowError);
  });
});

const intake = intakeSchema.parse({
  tierId: "baseline",
  identity: { passportNumber: "a01234567", firstSurname: "okonkwo", givenName: "chidi", gender: "H", birthDate: "14/03/2004", birthCity: "lagos", birthCountry: "NG", nationality: "NG" },
  family: { maritalStatus: "S", fatherFirstName: "a", motherFirstName: "b" },
  address: { streetName: "carrer de mallorca", buildingNumber: "183", city: "barcelona", postalCode: "08036", province: "barcelona" },
  contact: { phone: "+34600111222", email: "a@b.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
});
const input = (over: Record<string, string> = {}) =>
  appointmentInputSchema.parse({
    kind: "police", officeCode: "cnp-rambla-guipuscoa", officeName: "Comisaría de Policía Nacional",
    officeAddress: "Rambla de Guipúscoa, 74, Barcelona", scheduledLocal: "2026-10-02T09:30", ...over,
  });

describe("recording appointments", () => {
  it("keeps one appointment per kind, replacing on rebooking", async () => {
    const c = await createCase(intake);
    await saveAppointment(c.id, input());
    await saveAppointment(c.id, input({ scheduledLocal: "2026-10-09T11:00" }));
    await saveAppointment(c.id, input({ kind: "padron", officeCode: "custom", officeName: "OAC Eixample", officeAddress: "Carrer d'Aragó, 328, Barcelona" }));
    const rows = await listAppointments(c.id);
    expect(rows.map((r) => r.kind).sort()).toEqual(["padron", "police"]);
    expect(utcToMadridLocal(rows.find((r) => r.kind === "police")!.scheduledAt)).toBe("2026-10-09T11:00");
  });

  it("refuses to book for an erased case", async () => {
    const c = await createCase(intake);
    await purgeCase(c.id);
    expect(await saveAppointment(c.id, input())).toBe(false);
  });

  it("builds the sheet only once a police appointment exists", async () => {
    const c = await createCase(intake);
    expect(await appointmentSheetForCase(c.id)).toBeNull();
    await saveAppointment(c.id, input({ kind: "padron", officeCode: "custom", officeName: "OAC", officeAddress: "Somewhere 1, Barcelona" }));
    expect(await appointmentSheetForCase(c.id)).toBeNull();
    await saveAppointment(c.id, input());
    const sheet = await appointmentSheetForCase(c.id);
    expect(sheet!.ref).toBe(c.ref);
    expect((await PDFDocument.load(sheet!.bytes)).getPageCount()).toBe(1);
    await deleteAppointment(c.id, "police");
    expect(await appointmentSheetForCase(c.id)).toBeNull();
  });

  it("validates what staff type", () => {
    expect(appointmentInputSchema.safeParse({ ...input(), scheduledLocal: "tomorrow" }).success).toBe(false);
    expect(appointmentInputSchema.safeParse({ kind: "police", officeCode: "x", officeName: "", officeAddress: "", scheduledLocal: "2026-10-02T09:30" }).success).toBe(false);
  });
});

describe("CaixaBank ATM guide", () => {
  it("walks through the five steps in order, with the route's fee", () => {
    const steps = caixabankAtmSteps("16,08 €");
    expect(steps.map((s) => s.title)).toEqual([
      "Go to a CaixaBank ATM",
      "Select ‘Pagar impuestos y tasas’",
      "Scan the 13-digit barcode",
      "Insert the exact cash",
      "Staple the voucher to page 3",
    ]);
    expect(steps.map((s) => s.detail).join(" ")).toContain("16,08 €");
  });
});
