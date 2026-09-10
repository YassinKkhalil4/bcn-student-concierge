import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Admin password hashing — scrypt, stored as
 *   scrypt:<N>:<r>:<p>:<saltB64>:<hashB64>
 * in ADMIN_PASSWORD_HASH. Generate with `npm run admin:hash-password`.
 *
 * Colon-separated, NOT the conventional `$`: Next.js loads .env files through
 * dotenv-expand, which reads `$32768` as a variable reference and silently
 * rewrites the hash — leaving a login that can never succeed. Base64 never
 * contains ':', so the format survives env files, shells and dashboards.
 *
 * scrypt rather than a fast hash: if the env var ever leaks, each guess costs
 * ~100ms and 64MB of memory, which puts a decent password out of reach.
 */

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, len: number) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, len, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, N, R, P, KEYLEN);
  return ["scrypt", N, R, P, salt.toString("base64"), hash.toString("base64")].join(":");
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64");
  const params = [Number(n), Number(r), Number(p)];
  if (params.some((v) => !Number.isSafeInteger(v) || v < 1) || expected.length < 32) return false;

  const actual = await derive(
    password,
    Buffer.from(saltB64, "base64"),
    params[0]!,
    params[1]!,
    params[2]!,
    expected.length,
  );
  return timingSafeEqual(actual, expected);
}
