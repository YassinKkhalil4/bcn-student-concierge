import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { randomBytes } from "node:crypto";
import { rm, readFile } from "node:fs/promises";
import path from "node:path";
import { intakeSchema } from "../src/lib/schema";
import { documentKey, casePrefix, BlobNotFoundError } from "../src/lib/server/blob-store";

const DATA_DIR = path.join(process.cwd(), ".test-data");

beforeAll(() => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
  process.env.DATA_DIR = DATA_DIR;
  delete process.env.S3_BUCKET; // force the local driver
});

afterAll(async () => {
  await rm(DATA_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(DATA_DIR, { recursive: true, force: true });
});

const intake = intakeSchema.parse({
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
  consent: {
    gdprDataProcessing: true, gdprSensitiveDocuments: true,
    disclaimerAcknowledged: true,
  },
});

const PASSPORT = Buffer.from("%PDF-1.4 SENSITIVE PASSPORT SCAN CONTENT");

describe("key layout", () => {
  it("namespaces documents under their case", () => {
    expect(documentKey("case1", "doc1")).toBe("cases/case1/documents/doc1");
    expect(casePrefix("case1")).toBe("cases/case1/");
  });

  it("makes a case purge a single prefix delete", () => {
    expect(documentKey("case1", "doc1").startsWith(casePrefix("case1"))).toBe(true);
  });
});

describe("document storage", () => {
  it("keeps ciphertext OUT of the metadata record", async () => {
    const { createCase, attachDocument, getCase } = await import(
      "../src/lib/server/storage"
    );
    const rec = await createCase(intake);
    await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));

    // Read the raw metadata file, not the parsed object.
    const raw = await readFile(
      path.join(DATA_DIR, "cases", `${rec.id}.json`),
      "utf8",
    );
    expect(raw).not.toContain("ciphertext");
    // The plaintext must not be there either, in any encoding.
    expect(raw).not.toContain("SENSITIVE");
    expect(raw).not.toContain(PASSPORT.toString("base64"));

    const updated = await getCase(rec.id);
    const doc = updated!.documents[0]!;
    expect(doc.blobKey).toBe(documentKey(rec.id, doc.id));
    // The wrapped DEK stays in metadata — it is useless without the master key.
    expect(doc.crypto.wrappedKey).toBeTruthy();
    expect(doc.crypto.algorithm).toBe("aes-256-gcm");
  });

  it("round-trips a document through the blob store", async () => {
    const { createCase, attachDocument, readDocument } = await import(
      "../src/lib/server/storage"
    );
    const rec = await createCase(intake);
    const doc = await attachDocument(
      rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT),
    );
    const back = await readDocument(rec.id, doc.id);
    expect(back.toString()).toBe(PASSPORT.toString());
  });

  it("stores the body as raw ciphertext, not base64", async () => {
    const { createCase, attachDocument } = await import("../src/lib/server/storage");
    const { blobStore } = await import("../src/lib/server/blob-store");
    const rec = await createCase(intake);
    const doc = await attachDocument(
      rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT),
    );

    const body = await blobStore().get(doc.blobKey);
    // Raw ciphertext is the same length as the plaintext under GCM; base64
    // would be ~33% larger. This is the regression guard for re-introducing
    // base64 inflation.
    expect(body.byteLength).toBe(PASSPORT.byteLength);
    expect(body.toString("latin1")).not.toContain("SENSITIVE");
  });

  it("reports the original byte size, not the ciphertext size", async () => {
    const { createCase, attachDocument } = await import("../src/lib/server/storage");
    const rec = await createCase(intake);
    const doc = await attachDocument(
      rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT),
    );
    expect(doc.byteSize).toBe(PASSPORT.byteLength);
  });
});

describe("retention purge", () => {
  it("deletes document bodies from the blob store, not just the metadata", async () => {
    const { createCase, attachDocument, purgeCase, getCase } = await import(
      "../src/lib/server/storage"
    );
    const { blobStore } = await import("../src/lib/server/blob-store");

    const rec = await createCase(intake);
    const doc = await attachDocument(
      rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT),
    );
    expect(await blobStore().exists(doc.blobKey)).toBe(true);

    await purgeCase(rec.id);

    // The regression this guards: a purge that clears metadata but orphans the
    // passport scan in the bucket, while the tombstone claims deletion.
    expect(await blobStore().exists(doc.blobKey)).toBe(false);

    const after = await getCase(rec.id);
    expect(after!.purgedAt).toBeTruthy();
    expect(after!.intake).toBeNull();
    expect(after!.documents).toHaveLength(0);
    // Invoice metadata survives, per Spanish commercial law.
    expect(after!.paymentStatus).toBeDefined();
  });

  it("is idempotent", async () => {
    const { createCase, attachDocument, purgeCase, getCase } = await import(
      "../src/lib/server/storage"
    );
    const rec = await createCase(intake);
    await attachDocument(rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT));

    await purgeCase(rec.id);
    const first = (await getCase(rec.id))!.purgedAt;
    await purgeCase(rec.id);
    // A second purge must not overwrite the recorded deletion timestamp.
    expect((await getCase(rec.id))!.purgedAt).toBe(first);
  });

  it("makes the document unreadable after purge", async () => {
    const { createCase, attachDocument, purgeCase, readDocument } = await import(
      "../src/lib/server/storage"
    );
    const rec = await createCase(intake);
    const doc = await attachDocument(
      rec.id, "passport", "p.pdf", "application/pdf", Buffer.from(PASSPORT),
    );
    await purgeCase(rec.id);
    await expect(readDocument(rec.id, doc.id)).rejects.toThrow();
  });
});

describe("blob key safety", () => {
  it("refuses a key that escapes the storage root", async () => {
    const { blobStore } = await import("../src/lib/server/blob-store");
    await expect(
      blobStore().put("../../../etc/passwd", Buffer.from("x"), "text/plain"),
    ).rejects.toThrow(/escapes storage root/i);
  });

  it("throws BlobNotFoundError for a missing object", async () => {
    const { blobStore } = await import("../src/lib/server/blob-store");
    await expect(blobStore().get("cases/nope/documents/nope")).rejects.toBeInstanceOf(
      BlobNotFoundError,
    );
  });
});
