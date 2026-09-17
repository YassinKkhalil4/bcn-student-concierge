import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import {
  mockNextHeaders,
  setSessionSecrets,
  signOut,
  signInAsCase,
  params,
} from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";
import { intake } from "../helpers/intake";
import type { BillingDetails } from "../../src/lib/server/invoices";

mockNextHeaders();
setSessionSecrets();
Object.assign(process.env, {
  INVOICE_ISSUER_NAME: "BCN Student Concierge SL",
  INVOICE_ISSUER_TAX_ID: "B12345678",
  INVOICE_ISSUER_ADDRESS: "Carrer de Prova 1, 08001 Barcelona, España",
});

let invoicePdf: (r: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
let portalForm: (r: Request) => Promise<Response>;
let sheet: (r: Request) => Promise<Response>;
let createCase: typeof import("../../src/lib/server/storage").createCase;
let issueInvoiceForCheckout: typeof import("../../src/lib/server/invoices").issueInvoiceForCheckout;
let db: Db;
let client: PGlite;

const BILLING: BillingDetails = {
  name: "Parent Name",
  email: "parent@example.com",
  taxId: null,
  address: { line1: "C/ Test 1", line2: null, postalCode: "08001", city: "Barcelona", state: null, country: "ES" },
};

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY ??= randomBytes(32).toString("base64");
  ({ db, client } = await useTestDb());
  ({ GET: invoicePdf } = await import("../../src/app/api/portal/invoices/[id]/route"));
  ({ GET: portalForm } = await import("../../src/app/api/portal/form/route"));
  ({ GET: sheet } = await import("../../src/app/api/portal/appointment-sheet/route"));
  ({ createCase } = await import("../../src/lib/server/storage"));
  ({ issueInvoiceForCheckout } = await import("../../src/lib/server/invoices"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, invoices, invoice_counters, case_documents, appointments, cases CASCADE");
});

const get = (path: string) => new Request(`http://localhost${path}`);

describe("GET /api/portal/invoices/[id] — one student's invoice", () => {
  it("serves the signed-in student their own invoice as a PDF", async () => {
    const c = await createCase(intake);
    const { invoice } = await issueInvoiceForCheckout({
      caseId: c.id, stripeSessionId: "cs_own", stripePaymentIntentId: "pi_own",
      grossCents: 65340, description: "Servicio", billing: BILLING, issuedAt: new Date(),
    });
    await signInAsCase(c.id);
    const res = await invoicePdf(get("/api/portal/invoices/x"), params({ id: invoice.id }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("gives another student's invoice the same 404 as one that does not exist", async () => {
    // Not 403: the answer must not confirm that another client's invoice id
    // is real. Both cases must be indistinguishable.
    const mine = await createCase(intake);
    const theirs = await createCase(intake);
    const { invoice } = await issueInvoiceForCheckout({
      caseId: theirs.id, stripeSessionId: "cs_theirs", stripePaymentIntentId: "pi_theirs",
      grossCents: 65340, description: "Servicio", billing: BILLING, issuedAt: new Date(),
    });
    await signInAsCase(mine.id);

    const other = await invoicePdf(get("/api/portal/invoices/x"), params({ id: invoice.id }));
    const absent = await invoicePdf(get("/api/portal/invoices/x"), params({ id: "Q".repeat(24) }));
    expect(other.status).toBe(404);
    expect(absent.status).toBe(404);
    expect(await other.json()).toEqual(await absent.json());
  });

  it("answers a malformed invoice id with 404, never a 500", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await invoicePdf(get("/api/portal/invoices/x"), params({ id: "../../etc/passwd" }));
    expect(res.status).toBe(404);
  });
});

describe("GET /api/portal/form — the pre-filled EX-17", () => {
  it("withholds the form until staff have booked the police appointment", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await portalForm(get("/api/portal/form"));
    expect(res.status).toBe(409);
  });
});

describe("GET /api/portal/appointment-sheet", () => {
  it("has nothing to give before an appointment exists", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    expect((await sheet(get("/api/portal/appointment-sheet"))).status).toBe(404);
  });
});
