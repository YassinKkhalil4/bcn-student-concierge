import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { mockNextHeaders, setSessionSecrets, signOut, params } from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";

mockNextHeaders();
setSessionSecrets();

let db: Db;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await useTestDb());
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits, case_documents, appointments, cases CASCADE");
});

/**
 * Behavioural counterpart to the rate-limit scan in tests/rate-limit.test.ts.
 *
 * That one greps the source for a call to enforceRateLimit; it cannot tell
 * whether the call gates anything. This one CALLS every route under
 * /api/portal/ and /api/admin/ with no session and requires a 401. A new
 * authenticated route is covered the day it lands, and cannot satisfy the
 * guard with a call that does not gate.
 */
const EXEMPT: Record<string, string> = {
  "api/portal/login/route.ts": "sign-in is the way in; it has no session yet",
  "api/portal/verify/route.ts": "redeems a signed link; it has no session yet",
  "api/portal/logout/route.ts": "only clears the caller's own cookie",
  "api/admin/login/route.ts": "sign-in is the way in; it has no session yet",
  "api/admin/logout/route.ts": "only clears the caller's own cookie",
};

const routes: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (entry === "route.ts") routes.push(full);
  }
};
walk(path.join(process.cwd(), "src/app/api/portal"));
walk(path.join(process.cwd(), "src/app/api/admin"));

describe("every authenticated route refuses an anonymous caller", () => {
  it("finds the routes", () => {
    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of routes) {
    const rel = path.relative(path.join(process.cwd(), "src/app"), file).split(path.sep).join("/");
    if (EXEMPT[rel]) continue;

    it(rel, async () => {
      // Raw path, not a file URL: pathToFileURL percent-encodes the [id]
      // segments of a dynamic route and Vite then cannot resolve them.
      const mod = (await import(/* @vite-ignore */ file)) as Record<
        string,
        ((r: Request, ctx?: unknown) => Promise<Response>) | undefined
      >;
      // A dynamic route's params are never reached: the gate comes first.
      const stub = params({ id: "X".repeat(24), docId: "Y".repeat(24) });
      let called = 0;
      for (const method of ["GET", "POST"] as const) {
        const handler = mod[method];
        if (!handler) continue;
        called++;
        const request =
          method === "POST"
            ? new Request(`http://localhost/${rel}`, { method })
            : new Request(`http://localhost/${rel}`);
        const res = await handler(request, stub);
        expect(res.status, `${rel} ${method} let an anonymous caller through`).toBe(401);
      }
      expect(called, `${rel} exports no GET or POST handler`).toBeGreaterThan(0);
    });
  }
});
