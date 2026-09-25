import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  mockNextHeaders,
  setSessionSecrets,
  signOut,
  signInAsCase,
  signInWithForgedCase,
} from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";

mockNextHeaders();
setSessionSecrets();

let POST: (r: Request) => Promise<Response>;
let db: Db;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await useTestDb());
  ({ POST } = await import("../../src/app/api/checkout/route"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, case_documents, appointments, cases CASCADE");
});

const call = () => POST(new Request("http://localhost/api/checkout", { method: "POST" }));

describe("POST /api/checkout — session gate", () => {
  it("refuses a request with no session", async () => {
    expect((await call()).status).toBe(401);
  });

  it("refuses a forged session cookie", async () => {
    await signInWithForgedCase("A".repeat(24));
    expect((await call()).status).toBe(401);
  });

  it("refuses a validly signed session for a case that does not exist", async () => {
    // The signature is genuine; the case is not. A missing case is 404, and
    // must never surface as a 500 — an unhandled throw here would be a
    // disclosure channel as well as an outage.
    await signInAsCase("B".repeat(24));
    expect((await call()).status).toBe(404);
  });
});
