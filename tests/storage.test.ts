import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import type { PGlite } from "@electric-sql/pglite";
import { intakeSchema } from "../src/lib/schema";
import { documentKey, casePrefix, BlobNotFoundError, blobStore } from "../src/lib/server/blob-store";
import { cases, caseDocuments } from "../src/lib/db/schema";
import type { Db } from "../src/lib/db/client";
import {
  createCase,
  getCase,
  updateCase,
  setStage,
  attachDocument,
  readDocument,
  purgeCase,
  listCases,
  countCasesByBucket,
  listExpiredCaseIds,
  findCaseIdByPaymentIntent,
} from "../src/lib/server/storage";
import { useTestDb } from "./helpers/db";

const DATA_DIR = path.join(process.cwd(), ".test-data");
let db: Db;
let client: PGlite;

beforeAll(async () => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  process.env.DATA_DIR = DATA_DIR;
  delete process.env.S3_BUCKET; // local blob driver
  // One database per file (booting Postgres costs ~1s); tables are emptied
  // between tests instead.
  ({ db, client } = await useTestDb());
});

beforeEach(async () => {
  await rm(DATA_DIR, { recursive: true, force: true });
  await client.exec("TRUNCATE case_documents, cases CASCADE");
});

afterAll(async () => {
  await rm(DATA_DIR, { recursive: true, force: true });
});

const raw = {
  tierId: "baseline",
  identity: {
    passportNumber: "ab1234567", firstSurname: "okonkwo", givenName: "chidi",
    gender: "H", birthDate: "14/03/2004", birthCity: "lagos",
    birthCountry: "nigeria", nationality: "nigerian",
  },
  family: { maritalStatus: "S", fatherFirstName: "emeka", motherFirstName: "ngozi" },
  address: {
    streetName: "carrer de mallorca", buildingNumber: "183", city: "barcelona",
    postalCode: "08036", province: "barcelona",
  },
  contact: { phone: "+34600111222", email: "chidi@example.com" },
  consent: { gdprDataProcessing: true, gdprSensitiveDocuments: true, disclaimerAcknowledged: true },
};
const intake = intakeSchema.parse(raw);
const PASSPORT = Buffer.from("%PDF-1.4 SENSITIVE PASSPORT SCAN CONTENT");

describe("cases", () => {
  it("creates a case with the form routed from nationality", async () => {
    const rec = await createCase(intake);
    expect(rec.formId).toBe("EX-17");
    expect(rec.stage).toBe("new");
    expect(rec.paymentStatus).toBe("pending");

    const eu = await createCase(
      intakeSchema.parse({ ...raw, identity: { ...raw.identity, nationality: "italy" } }),
    );
    expect(eu.formId).toBe("EX-18");
  });

  it("round-trips the intake payload", async () => {
    const rec = await createCase(intake);
    const back = await getCase(rec.id);
    expect(back!.intake).toEqual(intake);
  });

  it("returns null for malformed ids without querying", async () => {
    expect(await getCase("../../etc/passwd")).toBeNull();
    expect(await getCase("x")).toBeNull();
  });

  it("matches a refund back to its case via the PaymentIntent", async () => {
    const rec = await createCase(intake);
    await updateCase(rec.id, { paymentStatus: "paid", stripePaymentIntentId: "pi_123" });
    expect(await findCaseIdByPaymentIntent("pi_123")).toBe(rec.id);
    expect(await findCaseIdByPaymentIntent("pi_other")).toBeNull();
  });
});

describe("workflow stage and the retention clock", () => {
  it("starts the clock on completion and stops it on reopen", async () => {
    const rec = await createCase(intake);
    await setStage(rec.id, "completed");
    expect((await getCase(rec.id))!.serviceCompletedAt).toBeTruthy();

    await setStage(rec.id, "in_progress");
    expect((await getCase(rec.id))!.serviceCompletedAt).toBeNull();
  });

  it("never extends retention by re-marking a completed case", async () => {
    const rec = await createCase(intake);
    await setStage(rec.id, "completed");
    const first = (await getCase(rec.id))!.serviceCompletedAt;
    await new Promise((r) => setTimeout(r, 20));
    await setStage(rec.id, "completed");
    expect((await getCase(rec.id))!.serviceCompletedAt).toBe(first);
  });

  it("refuses to change the stage of a purged case", async () => {
    const rec = await createCase(intake);
    await purgeCase(rec.id);
    expect(await setStage(rec.id, "in_progress")).toBe(false);
  });
});

describe("intake encryption", () => {
  it("never stores intake data in plaintext", async () => {
    const rec = await createCase(intake);
    const dump = JSON.stringify((await client.query("SELECT * FROM cases")).rows);
    for (const secret of ["OKONKWO", "CHIDI", "AB1234567", "chidi@example.com", "MALLORCA", "14/03/2004"]) {
      expect(dump, secret).not.toContain(secret);
    }
    // …while the application still reads it back intact.
    expect((await getCase(rec.id))!.intake).toEqual(intake);
  });

  it("refuses an intake envelope copied onto another case", async () => {
    // AAD binds each envelope to its case id. Copying one row's envelope onto
    // another must fail loudly, not show one applicant's data on another's file.
    const a = await createCase(intake);
    const b = await createCase(intakeSchema.parse({
      ...raw, identity: { ...raw.identity, firstSurname: "rossi" },
    }));
    const [row] = await db.select({ env: cases.intakeEnvelope }).from(cases).where(eq(cases.id, a.id));
    await db.update(cases).set({ intakeEnvelope: row!.env }).where(eq(cases.id, b.id));
    await expect(getCase(b.id)).rejects.toThrow();
  });

  it("uses a fresh data key per case", async () => {
    await createCase(intake);
    await createCase(intake);
    const rows = await db.select({ env: cases.intakeEnvelope }).from(cases);
    expect(rows[0]!.env!.wrappedKey).not.toBe(rows[1]!.env!.wrappedKey);
    expect(rows[0]!.env!.ciphertext).not.toBe(rows[1]!.env!.ciphertext);
  });
});

describe("documents", () => {
  it("keeps ciphertext out of Postgres", async () => {
    const rec = await createCase(intake);
    await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));

    const dump = JSON.stringify(
      (await client.query("SELECT * FROM case_documents")).rows,
    );
    expect(dump).not.toContain("SENSITIVE");
    expect(dump).not.toContain(PASSPORT.toString("base64"));
    // The wrapped DEK is here — useless without the master key.
    expect(dump).toContain("wrapped_key");
  });

  it("round-trips a document through the blob store", async () => {
    const rec = await createCase(intake);
    const doc = await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));
    const { document, bytes } = await readDocument(rec.id, doc.id);
    expect(bytes.toString()).toBe(PASSPORT.toString());
    expect(document.mimeType).toBe("application/pdf");
    expect(document.byteSize).toBe(PASSPORT.byteLength);
  });

  it("stores the body as raw ciphertext, not base64", async () => {
    const rec = await createCase(intake);
    const doc = await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));
    const body = await blobStore().get(doc.blobKey);
    expect(body.byteLength).toBe(PASSPORT.byteLength);
    expect(body.toString("latin1")).not.toContain("SENSITIVE");
  });

  it("does not lose documents uploaded concurrently", async () => {
    // Regression for the old JSON store: each upload rewrote the whole case, so
    // parallel uploads overwrote each other. Rows make this safe.
    const rec = await createCase(intake);
    await Promise.all(
      (["passport", "acceptance-letter", "lease"] as const).map((kind) =>
        attachDocument(rec.id, kind, `${kind}.pdf`, "application/pdf", Buffer.from(PASSPORT)),
      ),
    );
    expect((await getCase(rec.id))!.documents).toHaveLength(3);
  });

  it("refuses to read a document through another case's id", async () => {
    const a = await createCase(intake);
    const b = await createCase(intake);
    const doc = await attachDocument(a.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));
    await expect(readDocument(b.id, doc.id)).rejects.toThrow(/not found/i);
  });

  it("refuses uploads to a purged case", async () => {
    const rec = await createCase(intake);
    await purgeCase(rec.id);
    await expect(
      attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT)),
    ).rejects.toThrow();
  });
});

describe("retention purge", () => {
  it("erases bodies, rows and intake, and keeps payment metadata", async () => {
    const rec = await createCase(intake);
    await updateCase(rec.id, { paymentStatus: "paid" });
    const doc = await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));

    await purgeCase(rec.id);

    expect(await blobStore().exists(doc.blobKey)).toBe(false);
    const after = await getCase(rec.id);
    expect(after!.purgedAt).toBeTruthy();
    expect(after!.intake).toBeNull();
    expect(after!.documents).toHaveLength(0);
    expect(after!.paymentStatus).toBe("paid");
    const [{ n }] = (await db.select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(caseDocuments).where(eq(caseDocuments.caseId, rec.id))) as [{ n: number }];
    expect(n).toBe(0);
  });

  it("is idempotent and keeps the original purge timestamp", async () => {
    const rec = await createCase(intake);
    await purgeCase(rec.id);
    const first = (await getCase(rec.id))!.purgedAt;
    await purgeCase(rec.id);
    expect((await getCase(rec.id))!.purgedAt).toBe(first);
  });

  it("does not mark a case purged if blob deletion fails", async () => {
    // The tombstone is what we would show a regulator; it must never record a
    // deletion that did not happen.
    const rec = await createCase(intake);
    await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));

    const store = blobStore();
    const original = store.deletePrefix.bind(store);
    store.deletePrefix = async () => { throw new Error("bucket unreachable"); };
    try {
      await expect(purgeCase(rec.id)).rejects.toThrow("bucket unreachable");
    } finally {
      store.deletePrefix = original;
    }
    const after = await getCase(rec.id);
    expect(after!.purgedAt).toBeNull();
    expect(after!.intake).not.toBeNull();

    await purgeCase(rec.id); // the next run finishes the job
    expect((await getCase(rec.id))!.purgedAt).toBeTruthy();
  });

  it("is backed by a database constraint, not just code", async () => {
    const rec = await createCase(intake);
    await expect(
      db.update(cases).set({ purgedAt: new Date() }).where(eq(cases.id, rec.id)),
    ).rejects.toThrow();
  });

  it("selects only completed cases past the retention window", async () => {
    const old = await createCase(intake);
    const recent = await createCase(intake);
    const open = await createCase(intake);
    await db.update(cases)
      .set({ stage: "completed", serviceCompletedAt: new Date(Date.now() - 45 * 86_400_000) })
      .where(eq(cases.id, old.id));
    await setStage(recent.id, "completed");

    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    expect(await listExpiredCaseIds(cutoff)).toEqual([old.id]);
    void open;
  });
});

describe("admin listing", () => {
  it("places each open case in exactly one queue", async () => {
    const unpaid = await createCase(intake);
    const paid = await createCase(intake);
    await updateCase(paid.id, { paymentStatus: "paid" });
    const working = await createCase(intake);
    await updateCase(working.id, { paymentStatus: "paid" });
    await setStage(working.id, "in_progress");
    const done = await createCase(intake);
    await setStage(done.id, "completed");
    const gone = await createCase(intake);
    await purgeCase(gone.id);

    expect(await countCasesByBucket()).toEqual({
      action: 1, in_progress: 1, unpaid: 1, completed: 1, purged: 1, all: 5,
    });
    expect((await listCases({ bucket: "action" })).map((c) => c.id)).toEqual([paid.id]);
    expect((await listCases({ bucket: "unpaid" })).map((c) => c.id)).toEqual([unpaid.id]);
  });

  it("searches by name, email, passport number and reference", async () => {
    const rec = await createCase(intake);
    await createCase(intakeSchema.parse({
      ...raw, identity: { ...raw.identity, firstSurname: "rossi" },
      contact: { ...raw.contact, email: "other@example.com" },
    }));
    for (const q of ["okonkwo", "Chidi@Example", "AB1234567", rec.id.slice(0, 8)]) {
      expect((await listCases({ query: q })).map((c) => c.id), q).toContain(rec.id);
    }
    expect(await listCases({ query: "nobody-matches-this" })).toHaveLength(0);
  });

  it("matches regardless of accents and case", async () => {
    const rec = await createCase(intakeSchema.parse({
      ...raw, identity: { ...raw.identity, firstSurname: "garcía" },
    }));
    expect((await listCases({ query: "garcia" })).map((c) => c.id)).toEqual([rec.id]);
    expect((await listCases({ query: "GARCÍA" })).map((c) => c.id)).toEqual([rec.id]);
  });

  it("treats SQL wildcards in a search as literal text", async () => {
    await createCase(intake);
    expect(await listCases({ query: "%" })).toHaveLength(0);
    expect(await listCases({ query: "50%" })).toHaveLength(0);
  });

  it("summarises applicant and uploaded document kinds", async () => {
    const rec = await createCase(intake);
    await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));
    const [row] = await listCases();
    expect(row!.applicant).toBe("OKONKWO, CHIDI");
    expect(row!.documentKinds).toEqual(["passport"]);
  });
});

describe("blob key safety", () => {
  it("works with a relative DATA_DIR, as documented in .env.example", async () => {
    // Regression: a relative root made every key fail the containment check.
    const { __setBlobStore } = await import("../src/lib/server/blob-store");
    const previous = process.env.DATA_DIR;
    process.env.DATA_DIR = "./.test-data";
    __setBlobStore(null);
    try {
      await blobStore().put("cases/x/documents/y", Buffer.from("ok"), "text/plain");
      expect((await blobStore().get("cases/x/documents/y")).toString()).toBe("ok");
      await expect(blobStore().put("../escape", Buffer.from("x"), "text/plain")).rejects.toThrow(
        /escapes storage root/,
      );
    } finally {
      process.env.DATA_DIR = previous;
      __setBlobStore(null);
    }
  });

  it("namespaces documents under their case", () => {
    expect(documentKey("case1", "doc1").startsWith(casePrefix("case1"))).toBe(true);
  });

  it("refuses a key that escapes the storage root", async () => {
    await expect(
      blobStore().put("../../../etc/passwd", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow(/escapes storage root/i);
  });

  it("throws BlobNotFoundError for a missing object", async () => {
    await expect(blobStore().get("cases/nope/documents/nope")).rejects.toBeInstanceOf(BlobNotFoundError);
  });
});
