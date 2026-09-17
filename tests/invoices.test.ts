import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from "pdf-lib";
import { inflateSync } from "node:zlib";
import fontkit from "@pdf-lib/fontkit";
import type { PGlite } from "@electric-sql/pglite";
import { intakeSchema } from "../src/lib/schema";
import { createCase, getCase } from "../src/lib/server/storage";
import {
  getInvoice,
  issueInvoiceForCheckout,
  issueRefundRectification,
  listInvoicesForCase,
  listInvoicesForExport,
  type BillingDetails,
} from "../src/lib/server/invoices";
import {
  centsToSpanishDecimal,
  formatInvoiceNumber,
  madridYear,
  splitGross,
} from "../src/lib/invoicing/numbering";
import { csvText, invoicesToCsv } from "../src/lib/invoicing/csv";
import { renderInvoicePdf } from "../src/lib/invoicing/pdf";
import { unsupportedCharacters } from "../src/lib/pdf/fonts";
import { invoices } from "../src/lib/db/schema";
import type { Db } from "../src/lib/db/client";
import { useTestDb } from "./helpers/db";

let db: Db;
let client: PGlite;

const ISSUER = {
  INVOICE_ISSUER_NAME: "BCN Student Concierge SL",
  INVOICE_ISSUER_TAX_ID: "B12345678",
  INVOICE_ISSUER_ADDRESS: "Carrer de Prova 1, 08001 Barcelona, España",
};
const setIssuer = () => Object.assign(process.env, ISSUER);
const clearIssuer = () => {
  for (const k of Object.keys(ISSUER)) delete process.env[k];
};

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
});
beforeEach(async () => {
  setIssuer();
  await client.exec("TRUNCATE invoices, invoice_counters, case_documents, appointments, cases CASCADE");
});

const intake = intakeSchema.parse({
  tierId: "soft-landing",
  identity: {
    passportNumber: "ab1234567", firstSurname: "okonkwo", givenName: "chidi", gender: "H",
    birthDate: "14/03/2004", birthCity: "lagos", birthCountry: "NG", nationality: "NG",
  },
  family: { maritalStatus: "S", fatherFirstName: "emeka", motherFirstName: "ngozi" },
  address: { streetName: "carrer de mallorca", buildingNumber: "183", city: "barcelona", postalCode: "08036", province: "barcelona" },
  contact: { phone: "+34600111222", email: "chidi@example.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
});

const BILLING: BillingDetails = {
  name: "Łukasz Żółkiewski-Nowak",
  email: "parent@example.com",
  taxId: null,
  address: { line1: "ul. Długa 5", line2: null, postalCode: "00-001", city: "Warszawa", state: null, country: "PL" },
};

const issue = (caseId: string, session: string, issuedAt = new Date("2026-09-10T10:00:00Z"), gross = 65340) =>
  issueInvoiceForCheckout({
    caseId, stripeSessionId: session, grossCents: gross, description: "Servicio — The Digital Soft-Landing",
    billing: BILLING, issuedAt,
  });

describe("arithmetic", () => {
  it("splits each package's gross price into the exact advertised base and IVA", () => {
    expect(splitGross(36179)).toEqual({ baseCents: 29900, ivaCents: 6279, totalCents: 36179 });
    expect(splitGross(65340)).toEqual({ baseCents: 54000, ivaCents: 11340, totalCents: 65340 });
    expect(splitGross(133100)).toEqual({ baseCents: 110000, ivaCents: 23100, totalCents: 133100 });
  });

  it("always adds back up to the gross, to the cent", () => {
    for (let gross = 1; gross < 20000; gross += 7) {
      const s = splitGross(gross);
      expect(s.baseCents + s.ivaCents).toBe(gross);
    }
  });

  it("splits a refund as the exact mirror of the sale", () => {
    expect(splitGross(-65340)).toEqual({ baseCents: -54000, ivaCents: -11340, totalCents: -65340 });
  });

  it("numbers invoices in the format the database enforces", () => {
    expect(formatInvoiceNumber("INV", 2026, 1)).toBe("INV-2026-0001");
    expect(formatInvoiceNumber("RECT", 2026, 12345)).toBe("RECT-2026-12345");
    expect(() => formatInvoiceNumber("INV", 2026, 0)).toThrow();
  });

  it("uses the Madrid calendar year, not UTC", () => {
    // 23:30 UTC on 31 Dec is 00:30 on 1 Jan in Barcelona.
    expect(madridYear(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(madridYear(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });

  it("formats Spanish decimals", () => {
    expect(centsToSpanishDecimal(54000)).toBe("540,00");
    expect(centsToSpanishDecimal(-6279)).toBe("-62,79");
    expect(centsToSpanishDecimal(5)).toBe("0,05");
  });
});

describe("issuing", () => {
  it("numbers consecutively with no gaps", async () => {
    const a = await createCase(intake);
    const b = await createCase(intake);
    expect((await issue(a.id, "cs_a")).invoice.number).toBe("INV-2026-0001");
    expect((await issue(b.id, "cs_b")).invoice.number).toBe("INV-2026-0002");
  });

  it("returns the existing invoice for a repeated delivery", async () => {
    const a = await createCase(intake);
    const first = await issue(a.id, "cs_a");
    const again = await issue(a.id, "cs_a");
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.invoice.number).toBe(first.invoice.number);
    expect(await listInvoicesForCase(a.id)).toHaveLength(1);
  });

  it("issues exactly one invoice when the same payment is delivered twice at once", async () => {
    const a = await createCase(intake);
    const results = await Promise.all([issue(a.id, "cs_a"), issue(a.id, "cs_a"), issue(a.id, "cs_a")]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await listInvoicesForCase(a.id)).toHaveLength(1);
  });

  it("keeps the sequence gapless under concurrent payments", async () => {
    const cs = await Promise.all(Array.from({ length: 8 }, () => createCase(intake)));
    await Promise.all(cs.map((c, i) => issue(c.id, `cs_${i}`)));
    const numbers = (await db.select({ n: invoices.sequence }).from(invoices)).map((r) => r.n).sort((x, y) => x - y);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("consumes no number when the issuer is not configured", async () => {
    const a = await createCase(intake);
    clearIssuer();
    await expect(issue(a.id, "cs_a")).rejects.toThrow(/INVOICE_ISSUER/);
    setIssuer();
    expect((await issue(a.id, "cs_a")).invoice.number).toBe("INV-2026-0001");
  });

  it("restarts numbering in the new Madrid year", async () => {
    const a = await createCase(intake);
    const b = await createCase(intake);
    expect((await issue(a.id, "cs_a", new Date("2026-12-31T22:00:00Z"))).invoice.number).toBe("INV-2026-0001");
    expect((await issue(b.id, "cs_b", new Date("2026-12-31T23:30:00Z"))).invoice.number).toBe("INV-2027-0001");
  });

  it("encrypts the payer at rest and reads it back", async () => {
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_a");
    const dump = JSON.stringify((await client.query("SELECT * FROM invoices")).rows);
    expect(dump).not.toContain("Żółkiewski");
    expect(dump).not.toContain("parent@example.com");
    expect((await getInvoice(invoice.id))!.billing.name).toBe(BILLING.name);
  });

  it("freezes the issuer onto the invoice", async () => {
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_a");
    process.env.INVOICE_ISSUER_ADDRESS = "Somewhere new";
    expect((await getInvoice(invoice.id))!.issuer.address).toBe(ISSUER.INVOICE_ISSUER_ADDRESS);
  });

  it("cannot be altered afterwards", async () => {
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_a");
    await expect(db.update(invoices).set({ totalCents: 1 }).where(eq(invoices.id, invoice.id))).rejects.toThrow();
    await expect(db.delete(invoices).where(eq(invoices.id, invoice.id))).rejects.toThrow();
  });
});

describe("rectificativas", () => {
  it("mirrors the original on a full refund, once", async () => {
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_a");
    const r = await issueRefundRectification({ caseId: a.id, refundedTotalCents: 65340, issuedAt: new Date("2026-09-20T10:00:00Z") });
    expect(r!.invoice.number).toBe("RECT-2026-0001");
    expect(r!.invoice.totalCents).toBe(-65340);
    expect(r!.invoice.baseCents).toBe(-54000);
    expect(r!.invoice.rectifiesId).toBe(invoice.id);
    expect(r!.invoice.reason).toBe("Devolución total");
    // The same refund delivered again rectifies nothing new.
    expect(await issueRefundRectification({ caseId: a.id, refundedTotalCents: 65340, issuedAt: new Date() })).toBeNull();
  });

  it("issues one rectificativa per partial refund, for its own amount", async () => {
    const a = await createCase(intake);
    await issue(a.id, "cs_a");
    const first = await issueRefundRectification({ caseId: a.id, refundedTotalCents: 10000, issuedAt: new Date() });
    const second = await issueRefundRectification({ caseId: a.id, refundedTotalCents: 25000, issuedAt: new Date() });
    expect(first!.invoice.totalCents).toBe(-10000);
    expect(second!.invoice.totalCents).toBe(-15000);
    expect(second!.invoice.reason).toBe("Devolución parcial");
  });

  it("never rectifies more than was invoiced", async () => {
    const a = await createCase(intake);
    await issue(a.id, "cs_a");
    const r = await issueRefundRectification({ caseId: a.id, refundedTotalCents: 999999, issuedAt: new Date() });
    expect(r!.invoice.totalCents).toBe(-65340);
  });

  it("has nothing to rectify before an invoice exists", async () => {
    const a = await createCase(intake);
    expect(await issueRefundRectification({ caseId: a.id, refundedTotalCents: 100, issuedAt: new Date() })).toBeNull();
  });

  it("rectifies the invoice for the payment actually refunded, not the oldest", async () => {
    // A case can hold two invoices: a full refund leaves it no longer "paid",
    // so it can legitimately be paid again. Correcting the oldest would put
    // the wrong figures — and the wrong cap — on a legal document.
    const a = await createCase(intake);
    const first = await issueInvoiceForCheckout({
      caseId: a.id, stripeSessionId: "cs_first", stripePaymentIntentId: "pi_first",
      grossCents: 30000, description: "First engagement", billing: BILLING,
      issuedAt: new Date("2026-03-01T10:00:00Z"),
    });
    const second = await issueInvoiceForCheckout({
      caseId: a.id, stripeSessionId: "cs_second", stripePaymentIntentId: "pi_second",
      grossCents: 65340, description: "Second engagement", billing: BILLING,
      issuedAt: new Date("2026-05-01T10:00:00Z"),
    });

    // The SECOND payment is refunded in full.
    const rect = await issueRefundRectification({
      caseId: a.id, stripePaymentIntentId: "pi_second",
      refundedTotalCents: 65340, issuedAt: new Date("2026-06-01T10:00:00Z"),
    });

    expect(rect).not.toBeNull();
    expect(rect!.invoice.rectifiesId).toBe(second.invoice.id);
    expect(rect!.invoice.rectifiesId).not.toBe(first.invoice.id);
    // The second invoice's full amount, not capped at the first invoice's total.
    expect(rect!.invoice.totalCents).toBe(-65340);
    expect(rect!.invoice.reason).toBe("Devolución total");
  });

  it("still rectifies the only invoice when no payment intent was recorded", async () => {
    // Every invoice issued before the column existed has none. The fallback
    // must keep those working exactly as before.
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_legacy");
    const r = await issueRefundRectification({
      caseId: a.id, stripePaymentIntentId: "pi_unknown_to_us",
      refundedTotalCents: 65340, issuedAt: new Date("2026-09-20T10:00:00Z"),
    });
    expect(r!.invoice.rectifiesId).toBe(invoice.id);
    expect(r!.invoice.totalCents).toBe(-65340);
  });
});

describe("CSV export", () => {
  it("is Spanish-Excel CSV: BOM, semicolons, decimal commas, CRLF", async () => {
    const a = await createCase(intake);
    await issue(a.id, "cs_a");
    await issueRefundRectification({ caseId: a.id, refundedTotalCents: 65340, issuedAt: new Date("2026-09-20T10:00:00Z") });
    const csv = invoicesToCsv(await listInvoicesForExport(new Date("2026-01-01"), new Date("2027-01-01")));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('"Base imponible";"Tipo IVA (%)";"Cuota IVA";"Total"');
    expect(lines[1]).toMatch(/"INV-2026-0001";.*;540,00;21,00;113,40;653,40$/);
    // The refund stays a plain negative number, not a guarded text cell.
    expect(lines[2]).toMatch(/"RECT-2026-0001";.*"INV-2026-0001";"Devolución total".*;-540,00;21,00;-113,40;-653,40$/);
    expect(lines[1]).toContain('"Łukasz Żółkiewski-Nowak"');
  });

  it("neutralises formulas in text fields", () => {
    expect(csvText("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvText("+34 600")).toBe(`"'+34 600"`);
    expect(csvText("@SUM(A1)")).toBe(`"'@SUM(A1)"`);
    expect(csvText("-1+1")).toBe(`"'-1+1"`);
    expect(csvText("Normal name")).toBe(`"Normal name"`);
  });
});

describe("invoice PDF", () => {
  it("renders a one-page PDF with a Unicode payer name", async () => {
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_a");
    const pdf = await renderInvoicePdf((await getInvoice(invoice.id))!, a.ref);
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe(`Factura ${invoice.number}`);
  });

  it("embeds a font that can actually draw every character on the invoice", async () => {
    // Regression: with pdf-lib font SUBSETTING the PDF was structurally valid
    // but most letters and the total line were missing. Page-count and title
    // checks passed; only opening the file showed it. So inspect the embedded
    // font programs themselves.
    const a = await createCase(intake);
    const { invoice } = await issue(a.id, "cs_a");
    const pdf = await PDFDocument.load(await renderInvoicePdf((await getInvoice(invoice.id))!, a.ref));
    // Follow each FontDescriptor to its embedded TrueType program (FontFile2).
    const fonts: { hasGlyphForCodePoint(cp: number): boolean }[] = [];
    for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFDict) || obj.get(PDFName.of("Type"))?.toString() !== "/FontDescriptor") continue;
      const ref = obj.get(PDFName.of("FontFile2"));
      if (!(ref instanceof PDFRef)) continue;
      const stream = pdf.context.lookup(ref) as PDFRawStream;
      const bytes = stream.dict.get(PDFName.of("Filter"))
        ? inflateSync(Buffer.from(stream.contents))
        : Buffer.from(stream.contents);
      fonts.push(fontkit.create(bytes) as unknown as { hasGlyphForCodePoint(cp: number): boolean });
    }
    expect(fonts.length).toBeGreaterThanOrEqual(2); // regular + bold
    const drawn = `FACTURA Total ${BILLING.name} ${BILLING.address!.line1} ${BILLING.address!.city} 653,40 € Nº IVA Base imponible`;
    for (const font of fonts) {
      const missing = [...drawn].filter((ch) => ch.trim() && !font.hasGlyphForCodePoint(ch.codePointAt(0)!));
      expect(missing, "glyphs missing from embedded font").toEqual([]);
    }
  });

  it("renders a rectificativa", async () => {
    const a = await createCase(intake);
    await issue(a.id, "cs_a");
    const r = await issueRefundRectification({ caseId: a.id, refundedTotalCents: 65340, issuedAt: new Date() });
    const doc = await PDFDocument.load(await renderInvoicePdf((await getInvoice(r!.invoice.id))!));
    expect(doc.getTitle()).toBe(`Factura rectificativa ${r!.invoice.number}`);
  });

  it("knows which characters the font cannot draw", async () => {
    expect(await unsupportedCharacters("Łukasz Ștefan Иван Γιώργος")).toEqual([]);
    expect(await unsupportedCharacters("王伟")).toEqual(["王", "伟"]);
  });
});

describe("Stripe webhook (end to end, signed events)", () => {
  const WHSEC = "whsec_test_" + randomBytes(16).toString("hex");
  let POST: (r: Request) => Promise<Response>;
  let sign: (payload: string) => string;

  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
    process.env.STRIPE_WEBHOOK_SECRET = WHSEC;
    ({ POST } = await import("../src/app/api/webhooks/stripe/route"));
    const { default: Stripe } = await import("stripe");
    const s = new Stripe("sk_test_dummy");
    sign = (payload) => s.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  });
  afterEach(() => setIssuer());

  const deliver = (event: object) => {
    const payload = JSON.stringify(event);
    return POST(new Request("http://x/api/webhooks/stripe", {
      method: "POST", body: payload, headers: { "stripe-signature": sign(payload) },
    }));
  };
  const paid = (caseId: string) => ({
    id: "evt_1", type: "checkout.session.completed", created: Math.floor(Date.parse("2026-09-10T10:00:00Z") / 1000),
    data: { object: {
      id: "cs_live_1", object: "checkout.session", client_reference_id: caseId, payment_status: "paid",
      payment_intent: "pi_1", amount_total: 65340, currency: "eur", metadata: {},
      customer_details: { name: "Parent Name", email: "parent@example.com", tax_ids: [{ type: "eu_vat", value: "DE123456789" }],
        address: { line1: "Hauptstr. 1", line2: null, postal_code: "10115", city: "Berlin", state: null, country: "DE" } },
    } },
  });

  it("marks the case paid and issues the invoice from Stripe's billing details", async () => {
    const c = await createCase(intake);
    expect((await deliver(paid(c.id))).status).toBe(200);
    expect((await getCase(c.id))!.paymentStatus).toBe("paid");
    const [inv] = await listInvoicesForCase(c.id);
    const full = (await getInvoice(inv!.id))!;
    expect(full.number).toBe("INV-2026-0001");
    expect(full.billing.name).toBe("Parent Name"); // the payer, not the student
    expect(full.billing.taxId).toEqual({ type: "eu_vat", value: "DE123456789" });
    expect(full.issuedAt).toBe("2026-09-10T10:00:00.000Z"); // Stripe's time, not now
  });

  it("does not invoice twice when Stripe redelivers", async () => {
    const c = await createCase(intake);
    await deliver(paid(c.id));
    await deliver(paid(c.id));
    expect(await listInvoicesForCase(c.id)).toHaveLength(1);
  });

  it("still issues the invoice on Stripe's retry after a failed first attempt", async () => {
    // Regression: the old handler returned early once a case was "paid", so an
    // invoice that failed the first time was never issued on retry.
    const c = await createCase(intake);
    clearIssuer();
    expect((await deliver(paid(c.id))).status).toBe(500); // Stripe will retry
    expect((await getCase(c.id))!.paymentStatus).toBe("paid");
    expect(await listInvoicesForCase(c.id)).toHaveLength(0);
    setIssuer();
    expect((await deliver(paid(c.id))).status).toBe(200);
    expect(await listInvoicesForCase(c.id)).toHaveLength(1);
  });

  it("issues a rectificativa when the charge is refunded", async () => {
    const c = await createCase(intake);
    await deliver(paid(c.id));
    const refund = {
      id: "evt_2", type: "charge.refunded", created: Math.floor(Date.now() / 1000),
      data: { object: { id: "ch_1", object: "charge", payment_intent: "pi_1", refunded: true, amount_refunded: 65340 } },
    };
    expect((await deliver(refund)).status).toBe(200);
    const all = await listInvoicesForCase(c.id);
    expect(all.map((i) => i.number)).toEqual(["INV-2026-0001", `RECT-${new Date().getFullYear()}-0001`]);
    expect((await getCase(c.id))!.paymentStatus).toBe("refunded");
  });

  it("rectifies a refund of the second payment when a case has paid twice", async () => {
    // cases.stripe_payment_intent_id is only written on the transition to
    // paid, so it keeps the FIRST payment for ever. A refund of a later
    // payment therefore finds no case by that route, and without the invoice
    // carrying its own PaymentIntent the refund is silently dropped — no
    // rectificativa, and the books are wrong.
    const c = await createCase(intake);
    await deliver(paid(c.id));
    const second = paid(c.id);
    await deliver({
      ...second,
      id: "evt_second",
      data: { object: { ...second.data.object, id: "cs_live_2", payment_intent: "pi_2" } },
    });
    const sold = await listInvoicesForCase(c.id);
    expect(sold.map((i) => i.number)).toEqual(["INV-2026-0001", "INV-2026-0002"]);

    // Refund the SECOND payment (pi_2), which the case row does not point at.
    const refund = {
      id: "evt_refund_second", type: "charge.refunded", created: Math.floor(Date.now() / 1000),
      data: { object: { id: "ch_2", object: "charge", payment_intent: "pi_2", refunded: true, amount_refunded: 65340 } },
    };
    expect((await deliver(refund)).status).toBe(200);

    const all = await listInvoicesForCase(c.id);
    const rect = all.find((i) => i.series === "RECT");
    expect(rect, "no rectificativa issued for the refunded payment").toBeDefined();
    // It must correct the SECOND invoice — the one pi_2 paid for.
    expect(rect!.rectifiesId).toBe(sold[1]!.id);
    expect(rect!.totalCents).toBe(-65340);
  });

  it("rejects an unsigned delivery", async () => {
    const res = await POST(new Request("http://x", { method: "POST", body: "{}", headers: { "stripe-signature": "t=1,v1=bad" } }));
    expect(res.status).toBe(400);
    void sql;
  });
});
