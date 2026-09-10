import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptDocument, decryptDocument, safeEqual } from "../src/lib/crypto";

beforeAll(() => {
  process.env.DOCUMENT_MASTER_KEY = randomBytes(32).toString("base64");
});

describe("document encryption", () => {
  const passport = Buffer.from("%PDF-1.4 fake passport scan bytes");
  const aad = "case123:doc456:passport";

  it("round-trips a document", () => {
    const enc = encryptDocument(Buffer.from(passport), aad);
    expect(decryptDocument(enc, aad).toString()).toBe(passport.toString());
  });

  it("does not leave plaintext in the ciphertext", () => {
    const enc = encryptDocument(Buffer.from(passport), aad);
    expect(Buffer.from(enc.ciphertext, "base64").toString()).not.toContain("passport");
  });

  it("uses a fresh key and IV per document", () => {
    const a = encryptDocument(Buffer.from(passport), aad);
    const b = encryptDocument(Buffer.from(passport), aad);
    // Identical plaintext must never produce identical ciphertext.
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.wrappedKey).not.toBe(b.wrappedKey);
    expect(a.iv).not.toBe(b.iv);
  });

  it("fails closed when the ciphertext is tampered with", () => {
    const enc = encryptDocument(Buffer.from(passport), aad);
    const bytes = Buffer.from(enc.ciphertext, "base64");
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() =>
      decryptDocument({ ...enc, ciphertext: bytes.toString("base64") }, aad),
    ).toThrow();
  });

  it("refuses to decrypt under a different case id", () => {
    // AAD binding stops a swapped database row decrypting as another
    // applicant's passport.
    const enc = encryptDocument(Buffer.from(passport), aad);
    expect(() => decryptDocument(enc, "case999:doc456:passport")).toThrow();
  });

  it("rejects a forged auth tag", () => {
    const enc = encryptDocument(Buffer.from(passport), aad);
    expect(() =>
      decryptDocument({ ...enc, authTag: randomBytes(16).toString("base64") }, aad),
    ).toThrow();
  });

  it("records the algorithm and key version for rotation", () => {
    const enc = encryptDocument(Buffer.from(passport), aad);
    expect(enc.algorithm).toBe("aes-256-gcm");
    expect(enc.keyVersion).toBeGreaterThanOrEqual(1);
  });
});

describe("safeEqual", () => {
  it("compares equal strings", () => {
    expect(safeEqual("token-abc", "token-abc")).toBe(true);
  });

  it("returns false on mismatch without throwing on length differences", () => {
    expect(safeEqual("short", "considerably-longer")).toBe(false);
    expect(safeEqual("token-abc", "token-abd")).toBe(false);
  });
});
