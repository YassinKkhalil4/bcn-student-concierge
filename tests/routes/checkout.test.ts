import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import { randomBytes } from "node:crypto";
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
import { intake } from "../helpers/intake";

// Stripe itself is out of scope: what matters here is what the route asks it to
// charge for, so the session factory is replaced and its arguments inspected.
vi.mock("../../src/lib/server/stripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/server/stripe")>()),
  createCheckoutSession: vi.fn(async () => ({ id: "cs_test_1", url: "https://checkout.stripe.test/s/1" })),
}));

mockNextHeaders();
setSessionSecrets();

let POST: (r: Request) => Promise<Response>;
let db: Db;
let client: PGlite;
let createCase: typeof import("../../src/lib/server/storage").createCase;
let getCase: typeof import("../../src/lib/server/storage").getCase;
let createCheckoutSession: typeof import("../../src/lib/server/stripe").createCheckoutSession;

beforeAll(async () => {
  ({ db, client } = await useTestDb());
  process.env.DOCUMENT_MASTER_KEY ??= randomBytes(32).toString("base64");
  process.env.PUBLIC_ORIGIN = "https://example.test";
  ({ POST } = await import("../../src/app/api/checkout/route"));
  ({ createCase, getCase } = await import("../../src/lib/server/storage"));
  ({ createCheckoutSession } = await import("../../src/lib/server/stripe"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, case_documents, appointments, cases CASCADE");
  vi.mocked(createCheckoutSession).mockClear();
});

const call = (body?: unknown) =>
  POST(
    new Request("http://localhost/api/checkout", {
      method: "POST",
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    }),
  );

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

describe("POST /api/checkout — add-ons", () => {
  async function signedInCase() {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    return c;
  }

  it("opens checkout with no add-ons when no body is sent", async () => {
    await signedInCase();
    const res = await call();
    expect(res.status).toBe(200);
    expect(vi.mocked(createCheckoutSession).mock.calls[0]![0].addons).toEqual([]);
  });

  it("passes the ticked add-ons to Stripe, priced from the server table, and records them on the case", async () => {
    const c = await signedInCase();
    const res = await call({ addons: ["esim", "t-jove", "esim"] });
    expect(res.status).toBe(200);
    const params = vi.mocked(createCheckoutSession).mock.calls[0]![0];
    // Catalogue order, duplicates collapsed, the case's own tier and route.
    expect(params.addons?.map((a) => a.id)).toEqual(["t-jove", "esim"]);
    expect(params.tierId).toBe("soft-landing");
    expect(params.route).toBe("non-eu");
    expect((await getCase(c.id))?.addonIds).toEqual(["t-jove", "esim"]);
  });

  it("refuses the whole request when any add-on is unknown, and charges nothing", async () => {
    const c = await signedInCase();
    for (const addons of [["t-jove", "free-laptop"], "t-jove", [1], { id: "isic" }]) {
      const res = await call({ addons });
      expect(res.status, JSON.stringify(addons)).toBe(400);
    }
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect((await getCase(c.id))?.addonIds).toEqual([]);
  });

  it("ignores any price sent by the browser", async () => {
    await signedInCase();
    const res = await call({ addons: ["isic"], amount: 1, priceCents: 1, unit_amount: 1 });
    expect(res.status).toBe(200);
    const params = vi.mocked(createCheckoutSession).mock.calls[0]![0];
    expect(Object.keys(params)).not.toContain("amount");
    expect(params.addons?.[0]?.priceCents).toBe(2_000);
  });
});
