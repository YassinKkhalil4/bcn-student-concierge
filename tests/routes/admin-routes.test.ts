import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import {
  cookieJar,
  mockNextHeaders,
  setSessionSecrets,
  signOut,
  signInAsAdmin,
  signInAsCase,
  formRequest,
  params,
} from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";
import { intake } from "../helpers/intake";

mockNextHeaders();
setSessionSecrets();
Object.assign(process.env, {
  INVOICE_ISSUER_NAME: "BCN Student Concierge SL",
  INVOICE_ISSUER_TAX_ID: "B12345678",
  INVOICE_ISSUER_ADDRESS: "Carrer de Prova 1, 08001 Barcelona, España",
});

const PASSWORD = "correct horse battery staple";

let adminLogin: (r: Request) => Promise<Response>;
let documentDownload: (
  r: Request,
  ctx: { params: Promise<{ id: string; docId: string }> },
) => Promise<Response>;
let invoiceExport: (r: Request) => Promise<Response>;
let createCase: typeof import("../../src/lib/server/storage").createCase;
let attachDocument: typeof import("../../src/lib/server/storage").attachDocument;
let ADMIN_COOKIE: string;
let db: Db;
let client: PGlite;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY ??= randomBytes(32).toString("base64");
  const { hashPassword } = await import("../../src/lib/admin/password");
  process.env.ADMIN_PASSWORD_HASH = await hashPassword(PASSWORD);

  ({ db, client } = await useTestDb());
  ({ POST: adminLogin } = await import("../../src/app/api/admin/login/route"));
  ({ GET: documentDownload } = await import(
    "../../src/app/api/admin/cases/[id]/documents/[docId]/route"
  ));
  ({ GET: invoiceExport } = await import("../../src/app/api/admin/invoices/export/route"));
  ({ createCase, attachDocument } = await import("../../src/lib/server/storage"));
  ({ ADMIN_COOKIE } = await import("../../src/lib/admin/session"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, invoices, invoice_counters, case_documents, appointments, cases CASCADE");
});

const location = (res: Response) => new URL(res.headers.get("location")!).search;

describe("POST /api/admin/login", () => {
  it("refuses the wrong password without issuing a session", async () => {
    const res = await adminLogin(formRequest("http://localhost/api/admin/login", { password: "wrong" }));
    expect(location(res)).toContain("error=invalid");
    expect(res.headers.get("set-cookie") ?? "").not.toContain(ADMIN_COOKIE);
  });

  it("refuses an empty password", async () => {
    const res = await adminLogin(formRequest("http://localhost/api/admin/login", { password: "" }));
    expect(location(res)).toContain("error=invalid");
  });

  it("issues a Strict, HttpOnly session for the right password", async () => {
    const res = await adminLogin(formRequest("http://localhost/api/admin/login", { password: PASSWORD }));
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(ADMIN_COOKIE);
    expect(cookie).toMatch(/HttpOnly/i);
    // Strict, not Lax: the admin cookie must never ride a cross-site request.
    expect(cookie).toMatch(/SameSite=strict/i);
  });
});

describe("the admin realm is separate from the student realm", () => {
  it("does not accept a student session as an admin one", async () => {
    // A portal cookie is a real, validly signed token — for a different realm
    // and a different secret. It must not open the staff dashboard.
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await invoiceExport(
      new Request("http://localhost/api/admin/invoices/export?from=2026-01-01&to=2026-12-31"),
    );
    expect(res.status).toBe(401);
  });

  it("does not accept an admin session as a student one", async () => {
    const { GET: portalSheet } = await import("../../src/app/api/portal/appointment-sheet/route");
    await signInAsAdmin();
    expect((await portalSheet(new Request("http://localhost/api/portal/appointment-sheet"))).status).toBe(401);
  });

  it("rejects an admin cookie signed with the wrong secret", async () => {
    cookieJar.set(ADMIN_COOKIE, `${Date.now() + 3_600_000}.nonce.notarealsignature`);
    const res = await invoiceExport(
      new Request("http://localhost/api/admin/invoices/export?from=2026-01-01&to=2026-12-31"),
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/admin/cases/[id]/documents/[docId]", () => {
  it("serves the decrypted document as an attachment, never inline", async () => {
    // Rendering a user-supplied file in the admin origin is a needless risk
    // even with the upload-time magic-byte check.
    const c = await createCase(intake);
    const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const doc = await attachDocument(c.id, "passport", "passport.pdf", "application/pdf", pdf);
    await signInAsAdmin();

    const res = await documentDownload(
      new Request("http://localhost/x"),
      params({ id: c.id, docId: doc.id }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("content-disposition")).not.toMatch(/inline/);
    expect(res.headers.get("cache-control")).toBe("no-store");
    // Round-trips through encryption back to the original bytes.
    expect(Buffer.from(await res.arrayBuffer())).toEqual(
      Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]),
    );
  });

  it("will not read a document through another case's id", async () => {
    // The AAD binds ciphertext to its case; the query binds the row to it too.
    const mine = await createCase(intake);
    const theirs = await createCase(intake);
    const doc = await attachDocument(
      theirs.id, "passport", "passport.pdf", "application/pdf",
      Buffer.from([0x25, 0x50, 0x44, 0x46]),
    );
    await signInAsAdmin();
    const res = await documentDownload(
      new Request("http://localhost/x"),
      params({ id: mine.id, docId: doc.id }),
    );
    expect(res.status).toBe(404);
  });
});

describe("GET /api/admin/invoices/export", () => {
  it("rejects a malformed or inverted date range", async () => {
    await signInAsAdmin();
    for (const q of ["?from=nonsense&to=2026-12-31", "?from=2026-12-31&to=2026-01-01", ""]) {
      const res = await invoiceExport(new Request(`http://localhost/api/admin/invoices/export${q}`));
      expect(res.status, `range "${q}" was accepted`).toBe(400);
    }
  });

  it("returns the register as CSV for a valid range", async () => {
    await signInAsAdmin();
    const res = await invoiceExport(
      new Request("http://localhost/api/admin/invoices/export?from=2026-01-01&to=2026-12-31"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("facturas_2026-01-01_2026-12-31.csv");
  });
});
