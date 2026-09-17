import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { mockNextHeaders, setSessionSecrets, signOut, formRequest } from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";
import { intake } from "../helpers/intake";

mockNextHeaders();
setSessionSecrets();

let login: (r: Request) => Promise<Response>;
let verify: (r: Request) => Promise<Response>;
let logout: (r: Request) => Promise<Response>;
let createCase: typeof import("../../src/lib/server/storage").createCase;
let createLoginLinkToken: typeof import("../../src/lib/portal/session").createLoginLinkToken;
let PORTAL_COOKIE: string;
let db: Db;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await useTestDb());
  ({ POST: login } = await import("../../src/app/api/portal/login/route"));
  ({ POST: verify } = await import("../../src/app/api/portal/verify/route"));
  ({ POST: logout } = await import("../../src/app/api/portal/logout/route"));
  ({ createCase } = await import("../../src/lib/server/storage"));
  ({ createLoginLinkToken, PORTAL_COOKIE } = await import("../../src/lib/portal/session"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, case_documents, appointments, cases CASCADE");
});

const url = (res: Response) => new URL(res.headers.get("location")!).pathname
  + new URL(res.headers.get("location")!).search;

describe("POST /api/portal/login — requesting a sign-in link", () => {
  it("answers a known and an unknown address identically", async () => {
    // The response must not reveal who is a client. Both are 303 to sent=1.
    await createCase(intake);
    const known = await login(
      formRequest("http://localhost/api/portal/login", { email: intake.contact.email, locale: "en" }),
    );
    const unknown = await login(
      formRequest("http://localhost/api/portal/login", { email: "nobody@example.com", locale: "en" }),
    );
    expect(known.status).toBe(303);
    expect(unknown.status).toBe(303);
    expect(url(known)).toBe(url(unknown));
    expect(url(known)).toContain("sent=1");
  });

  it("rejects a malformed address without claiming a link was sent", async () => {
    const res = await login(
      formRequest("http://localhost/api/portal/login", { email: "not-an-email", locale: "en" }),
    );
    expect(url(res)).toContain("error=email");
  });

  it("never sets a session cookie — the link is what signs you in", async () => {
    await createCase(intake);
    const res = await login(
      formRequest("http://localhost/api/portal/login", { email: intake.contact.email, locale: "en" }),
    );
    expect(res.headers.get("set-cookie") ?? "").not.toContain(PORTAL_COOKIE);
  });
});

describe("POST /api/portal/verify — redeeming the link", () => {
  it("refuses a forged token", async () => {
    const res = await verify(
      formRequest("http://localhost/api/portal/verify", { token: "forged.1.2.3", locale: "en" }),
    );
    expect(url(res)).toContain("error=link");
    expect(res.headers.get("set-cookie") ?? "").not.toContain(PORTAL_COOKIE);
  });

  it("signs the student in with a genuine token", async () => {
    const c = await createCase(intake);
    const token = await createLoginLinkToken(c.id);
    const res = await verify(formRequest("http://localhost/api/portal/verify", { token, locale: "en" }));
    expect(res.status).toBe(303);
    expect(url(res)).toBe("/portal");
    expect(res.headers.get("set-cookie")).toContain(PORTAL_COOKIE);
  });

  it("accepts a link exactly once", async () => {
    // Single-use without a token table: consumeLoginLink's compare-and-set,
    // seen through HTTP. A leaked link in a forwarded email is spent.
    const c = await createCase(intake);
    const token = await createLoginLinkToken(c.id);
    const first = await verify(formRequest("http://localhost/api/portal/verify", { token, locale: "en" }));
    const second = await verify(formRequest("http://localhost/api/portal/verify", { token, locale: "en" }));
    expect(url(first)).toBe("/portal");
    expect(url(second)).toContain("error=link");
  });

  it("invalidates every older link when a newer one is used", async () => {
    const c = await createCase(intake);
    const older = await createLoginLinkToken(c.id, Date.now() - 60_000);
    const newer = await createLoginLinkToken(c.id);
    expect(url(await verify(formRequest("http://localhost/api/portal/verify", { token: newer, locale: "en" })))).toBe("/portal");
    expect(url(await verify(formRequest("http://localhost/api/portal/verify", { token: older, locale: "en" })))).toContain("error=link");
  });

  it("refuses an expired token", async () => {
    const c = await createCase(intake);
    // Issued over the 30-minute lifetime ago.
    const stale = await createLoginLinkToken(c.id, Date.now() - 31 * 60_000);
    expect(url(await verify(formRequest("http://localhost/api/portal/verify", { token: stale, locale: "en" })))).toContain("error=link");
  });

  it("refuses a token for a case that no longer exists", async () => {
    const token = await createLoginLinkToken("Z".repeat(24));
    expect(url(await verify(formRequest("http://localhost/api/portal/verify", { token, locale: "en" })))).toContain("error=link");
  });
});

describe("POST /api/portal/logout", () => {
  it("clears the session cookie", async () => {
    const res = await logout(formRequest("http://localhost/api/portal/logout", { locale: "en" }));
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(PORTAL_COOKIE);
    // Cleared, not reissued: empty value or an immediate expiry.
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
