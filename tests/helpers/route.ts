import { vi } from "vitest";
import { randomBytes } from "node:crypto";

/**
 * Drives real route handlers in-process.
 *
 * Route handlers read their session through `cookies()` from next/headers,
 * which only exists inside the Next runtime. That boundary is the ONLY thing
 * mocked here: the database is real (PGlite), the session tokens are real
 * HMACs produced by the app's own signing code, and the handler under test is
 * the one that ships. A test that passes here exercised the real auth gate.
 */

export const cookieJar = new Map<string, string>();

/**
 * Call at module top level, before importing any route module. vi.mock is
 * hoisted, so this must not be inside a beforeAll.
 */
export function mockNextHeaders(): void {
  vi.mock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) =>
        cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
      getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
      has: (name: string) => cookieJar.has(name),
      set: (name: string, value: string) => void cookieJar.set(name, value),
      delete: (name: string) => void cookieJar.delete(name),
    }),
    headers: async () => new Headers(),
  }));
}

/** Secrets the session code needs. Call before importing a route module. */
export function setSessionSecrets(): void {
  process.env.PORTAL_SESSION_SECRET ??= randomBytes(32).toString("base64url");
  process.env.ADMIN_SESSION_SECRET ??= randomBytes(32).toString("base64url");
  process.env.DOCUMENT_MASTER_KEY ??= randomBytes(32).toString("base64");
  process.env.PUBLIC_ORIGIN ??= "https://test.example";
}

export async function signInAsCase(caseId: string): Promise<void> {
  const { PORTAL_COOKIE, createPortalSession } = await import("../../src/lib/portal/session");
  cookieJar.set(PORTAL_COOKIE, await createPortalSession(caseId));
}

export async function signInAsAdmin(): Promise<void> {
  const { ADMIN_COOKIE, createSessionToken } = await import("../../src/lib/admin/session");
  cookieJar.set(ADMIN_COOKIE, await createSessionToken());
}

export function signOut(): void {
  cookieJar.clear();
}

/** A forged token of the right shape — must still be rejected. */
export async function signInWithForgedCase(caseId: string): Promise<void> {
  const { PORTAL_COOKIE } = await import("../../src/lib/portal/session");
  cookieJar.set(PORTAL_COOKIE, `${caseId}.${Date.now() + 3_600_000}.notavalidsignature`);
}

export function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function formRequest(url: string, fields: Record<string, string | Blob>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request(url, { method: "POST", body: form });
}

/** The `{ params }` second argument Next passes to a dynamic route. */
export function params<T>(value: T): { params: Promise<T> } {
  return { params: Promise.resolve(value) };
}

/** A valid file of each accepted type, by magic bytes. */
export const FIXTURES = {
  pdf: () =>
    new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], {
      type: "application/pdf",
    }),
  jpeg: () =>
    new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: "image/jpeg" }),
  /** HTML wearing a PDF content type — the polyglot the magic-byte check exists for. */
  html: () =>
    new Blob([new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>")], {
      type: "application/pdf",
    }),
};
