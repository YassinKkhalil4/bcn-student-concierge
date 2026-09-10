import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { randomBytes } from "node:crypto";
import {
  createSessionToken,
  verifySessionToken,
  adminConfigured,
  SESSION_TTL_SECONDS,
} from "../src/lib/admin/session";
import { hashPassword, verifyPassword } from "../src/lib/admin/password";

const SECRET = randomBytes(32).toString("base64");

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
});

describe("session tokens", () => {
  it("accepts a token it issued", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("rejects missing, empty and malformed tokens", async () => {
    for (const t of [undefined, null, "", "abc", "1.2", "a.b.c.d"]) {
      expect(await verifySessionToken(t)).toBe(false);
    }
  });

  it("rejects an expired token", async () => {
    const issued = Date.now() - (SESSION_TTL_SECONDS + 5) * 1000;
    expect(await verifySessionToken(await createSessionToken(issued))).toBe(false);
  });

  it("rejects a token whose expiry was extended", async () => {
    // Moving the expiry changes the signed payload, so the signature fails.
    const [, nonce, sig] = (await createSessionToken()).split(".");
    const forged = `${Date.now() + 3_600_000}.${nonce}.${sig}`;
    expect(await verifySessionToken(forged)).toBe(false);
  });

  it("rejects a tampered signature", async () => {
    const token = await createSessionToken();
    const flipped = token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA");
    expect(await verifySessionToken(flipped)).toBe(false);
  });

  it("rejects every existing session once the secret is rotated", async () => {
    const token = await createSessionToken();
    process.env.ADMIN_SESSION_SECRET = randomBytes(32).toString("base64");
    expect(await verifySessionToken(token)).toBe(false);
  });

  it("fails closed when the secret is missing or too short", async () => {
    const token = await createSessionToken();
    delete process.env.ADMIN_SESSION_SECRET;
    expect(await verifySessionToken(token)).toBe(false);
    process.env.ADMIN_SESSION_SECRET = randomBytes(8).toString("base64");
    expect(await verifySessionToken(token)).toBe(false);
    await expect(createSessionToken()).rejects.toThrow(/not configured/);
  });

  it("reports admin as unconfigured without both env vars", () => {
    delete process.env.ADMIN_PASSWORD_HASH;
    expect(adminConfigured()).toBe(false);
  });
});

describe("password hashing", () => {
  let stored: string;
  beforeAll(async () => {
    stored = await hashPassword("correct horse battery staple");
  });

  it("verifies the right password", async () => {
    expect(await verifyPassword("correct horse battery staple", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    expect(await verifyPassword("correct horse battery stapl", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects when no hash is configured or it is malformed", async () => {
    expect(await verifyPassword("x", undefined)).toBe(false);
    expect(await verifyPassword("x", "plaintext-password")).toBe(false);
    expect(await verifyPassword("x", "scrypt:0:8:1:AAAA:AAAA")).toBe(false);
  });

  it("never stores the password itself", () => {
    expect(stored).not.toContain("correct horse");
    expect(stored.startsWith("scrypt:")).toBe(true);
  });

  it("uses no characters that env-file expansion would rewrite", () => {
    // dotenv-expand (used by Next.js) treats "$..." as a variable reference.
    expect(stored).not.toContain("$");
  });
});
