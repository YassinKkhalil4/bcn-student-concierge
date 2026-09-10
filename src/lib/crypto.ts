import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  hkdfSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Envelope encryption for personal data at rest — uploaded identity documents
 * AND the intake questionnaire (via sealJson / openJson below).
 *
 * DESIGN NOTE — why this is not "end-to-end" encryption:
 * The brief asked for E2EE. True E2EE would mean only the client holds the key
 * and the server can never read the plaintext. That is incompatible with a
 * server-side PDF engine that must read the passport data to populate EX-17/18,
 * and with staff who must review documents before a police appointment.
 * Claiming E2EE while holding a decryption key would be a false security
 * claim in a GDPR privacy notice — a regulatory liability, not just sloppiness.
 *
 * What this actually provides, and what the privacy policy states:
 *   - AES-256-GCM authenticated encryption of every file at rest.
 *   - A unique data-encryption key (DEK) per file, so one compromised object
 *     never unlocks another.
 *   - Each DEK wrapped by a master key-encryption key (KEK) held outside the
 *     database. In production the KEK lives in a KMS/HSM (see docs/SECURITY.md);
 *     rotating it re-wraps DEKs without touching ciphertext.
 *
 * The threat this stops: database or object-store exfiltration. It does not
 * stop a fully compromised application server, and we do not pretend it does.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce, the GCM-recommended size
const TAG_BYTES = 16;

export class CryptoConfigError extends Error {}

/**
 * Master KEK, from env in dev / from KMS in production. Read lazily so that
 * importing this module during a build without secrets does not throw.
 */
function getMasterKey(): Buffer {
  const raw = process.env.DOCUMENT_MASTER_KEY;
  if (!raw) {
    throw new CryptoConfigError(
      "DOCUMENT_MASTER_KEY is not set. Generate one with: openssl rand -base64 32",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new CryptoConfigError(
      `DOCUMENT_MASTER_KEY must decode to exactly ${KEY_BYTES} bytes (got ${key.length}). ` +
        "Generate one with: openssl rand -base64 32",
    );
  }
  return key;
}

/**
 * Derive a purpose-bound KEK from the master key. Domain separation means a
 * key used for wrapping document DEKs can never be confused with one used for
 * another purpose, even though both come from the same master secret.
 */
function deriveKek(purpose: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", getMasterKey(), Buffer.alloc(0), `bcn-sc:${purpose}`, KEY_BYTES),
  );
}

export interface EncryptedPayload {
  /** Ciphertext, base64. */
  ciphertext: string;
  /** Per-file DEK, wrapped under the master KEK, base64. */
  wrappedKey: string;
  iv: string;
  authTag: string;
  algorithm: typeof ALGORITHM;
  /** KEK generation, so rotation can be tracked per object. */
  keyVersion: number;
}

const CURRENT_KEY_VERSION = Number(process.env.DOCUMENT_KEY_VERSION ?? "1");

function wrapKey(dek: Buffer): string {
  const kek = deriveKek("dek-wrap");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, kek, iv);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  // iv || tag || wrapped — fixed-width prefixes make unwrapping unambiguous.
  return Buffer.concat([iv, cipher.getAuthTag(), wrapped]).toString("base64");
}

function unwrapKey(wrapped: string): Buffer {
  const kek = deriveKek("dek-wrap");
  const buf = Buffer.from(wrapped, "base64");
  if (buf.length !== IV_BYTES + TAG_BYTES + KEY_BYTES) {
    throw new Error("Wrapped key is malformed");
  }
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const body = buf.subarray(IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]);
}

/**
 * Encrypt a document. `aad` binds the ciphertext to its metadata (case id +
 * document kind), so an attacker with write access to the database cannot
 * swap one applicant's passport for another's and have it decrypt cleanly.
 */
export function encryptDocument(plaintext: Buffer, aad: string): EncryptedPayload {
  const dek = randomBytes(KEY_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  const payload: EncryptedPayload = {
    ciphertext: ciphertext.toString("base64"),
    wrappedKey: wrapKey(dek),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    algorithm: ALGORITHM,
    keyVersion: CURRENT_KEY_VERSION,
  };

  // Zero the DEK. Best-effort in a GC'd runtime, but it shortens the window in
  // which a heap dump would expose it.
  dek.fill(0);
  return payload;
}

export function decryptDocument(payload: EncryptedPayload, aad: string): Buffer {
  const dek = unwrapKey(payload.wrappedKey);
  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      dek,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    // .final() throws if the tag does not verify — tampering fails closed.
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
  } finally {
    dek.fill(0);
  }
}

/** Constant-time compare for tokens and signatures. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch; compare lengths separately.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** URL-safe opaque identifier, 256 bits of entropy. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Encrypt a JSON-serialisable value (the intake questionnaire) with the same
 * envelope scheme as documents. `aad` must bind it to its owner — the intake
 * uses `case:<id>:intake`, so an envelope copied onto another case row fails
 * authentication rather than showing one applicant's data on another's file.
 */
export function sealJson(value: unknown, aad: string): EncryptedPayload {
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  try {
    return encryptDocument(plaintext, aad);
  } finally {
    plaintext.fill(0);
  }
}

export function openJson<T>(payload: EncryptedPayload, aad: string): T {
  const plaintext = decryptDocument(payload, aad);
  try {
    return JSON.parse(plaintext.toString("utf8")) as T;
  } finally {
    plaintext.fill(0);
  }
}

/**
 * Keyed, one-way pseudonym for a low-entropy identifier such as an IP address.
 *
 * A plain SHA-256 of an IPv4 address is reversible by brute force (there are
 * only 2^32 of them); an HMAC under a key derived from the master key is not.
 * Stable for a given input and purpose, so it still works as a counter key.
 */
export function pseudonymize(value: string, purpose: string): string {
  return createHmac("sha256", deriveKek(`pseudonym:${purpose}`))
    .update(value)
    .digest("base64url")
    .slice(0, 32);
}
