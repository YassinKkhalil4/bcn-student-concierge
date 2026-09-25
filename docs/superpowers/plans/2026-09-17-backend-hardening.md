# Backend Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four backend defects and close the gap that let them go unnoticed — 21 of 22 route handlers have no behavioural test.

**Architecture:** A route-handler test harness mocks only the Next runtime boundary (`next/headers`) and drives real handlers against a real PGlite database with real session crypto. Each defect gets a failing regression test first, then the fix. Coverage then extends across the route surface in risk order, ending with a behavioural guard that a new authenticated route cannot ship ungated.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM, PGlite (tests), Vitest 2, Stripe, Zod.

**Spec:** `docs/superpowers/specs/2026-09-17-backend-hardening-design.md`

## Global Constraints

- No frontend, component, styling or UI changes. Backend and tests only.
- The 368 existing tests must pass after every task. Never weaken an existing assertion to make a change pass.
- No restructuring of working code: no service layer, no DI, no error-taxonomy rewrite. Ordering invariants in `src/lib/server/storage.ts` and `src/lib/server/invoices.ts` are load-bearing — do not rearrange them.
- The only schema change permitted is the additive, nullable `invoices.stripe_payment_intent_id` column in Task 2.
- Money is integer cents throughout. Never introduce floating-point arithmetic into invoicing.
- Tests use the real database via `tests/helpers/db.ts` `useTestDb()`. Do not mock Drizzle or the crypto layer.
- Every defect test must be observed FAILING against unfixed code before the fix is written. That failure is the evidence the defect is real.

---

### Task 1: Route-handler test harness

**Files:**
- Modify: `vitest.config.ts`
- Create: `tests/helpers/route.ts`
- Test: `tests/routes/checkout.test.ts`

**Interfaces:**
- Produces:
  - `cookieJar: Map<string, string>` — the store the mocked `cookies()` reads.
  - `mockNextHeaders(): void` — call at module top level, before any dynamic import of a route.
  - `signInAsCase(caseId: string): Promise<void>` — puts a real portal session cookie in the jar.
  - `signInAsAdmin(): Promise<void>` — puts a real admin session cookie in the jar.
  - `signOut(): void` — empties the jar.
  - `jsonRequest(url: string, body: unknown): Request`
  - `formRequest(url: string, fields: Record<string, string | Blob>): Request`
  - `params<T>(value: T): { params: Promise<T> }`

- [ ] **Step 1: Make next-intl resolvable under Vitest**

`next-intl` imports `next/navigation` without a file extension, which Node's ESM resolver rejects outside the Next runtime. The alias only applies if Vite transforms the dependency, so it must also be inlined.

In `vitest.config.ts`, inside `test`:

```ts
    // next-intl must go through Vite's transform so the "next/navigation"
    // alias below applies; as an external dep Node resolves it raw and fails.
    server: { deps: { inline: ["next-intl"] } },
```

and replace the `resolve` block:

```ts
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // next-intl's client navigation imports "next/navigation" without an
      // extension, which Node's ESM resolver rejects outside the Next runtime.
      "next/navigation": path.resolve(import.meta.dirname, "./node_modules/next/navigation.js"),
    },
  },
```

- [ ] **Step 2: Write the harness**

Create `tests/helpers/route.ts`:

```ts
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
  pdf: () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], { type: "application/pdf" }),
  jpeg: () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])], { type: "image/jpeg" }),
  html: () => new Blob([new TextEncoder().encode("<!DOCTYPE html><script>alert(1)</script>")], { type: "application/pdf" }),
};
```

- [ ] **Step 3: Write the first route test, proving the harness drives a real gate**

Create `tests/routes/checkout.test.ts`. It asserts the auth gate on `POST /api/checkout` three ways: absent cookie, forged cookie, and a valid session reaching handler logic.

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { mockNextHeaders, setSessionSecrets, signOut, signInAsCase, signInWithForgedCase } from "../helpers/route";
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
  await client.exec("TRUNCATE rate_limits");
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
    // Signature is genuine; the case is not. Must be 404, never 500.
    await signInAsCase("B".repeat(24));
    expect((await call()).status).toBe(404);
  });
});
```

- [ ] **Step 4: Run the new test**

Run: `npx vitest run tests/routes/checkout.test.ts`
Expected: PASS, 3 tests. If `next/navigation` cannot be found, Step 1 was not applied correctly.

- [ ] **Step 5: Run the whole suite, confirming the config change broke nothing**

Run: `npm test`
Expected: all previous tests still pass, plus the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/helpers/route.ts tests/routes/checkout.test.ts
git commit -m "test: route-handler harness driving real handlers against a real database"
```

---

### Task 2: D1 — refund rectification must correct the right invoice

**Files:**
- Create: `drizzle/0006_invoice_payment_intent.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/db/schema.ts` (invoices table)
- Modify: `src/lib/server/invoices.ts`
- Modify: `src/app/api/webhooks/stripe/route.ts`
- Test: `tests/invoices.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `issueInvoiceForCheckout` gains an optional input field `stripePaymentIntentId?: string | null`.
  - `issueRefundRectification` gains an optional input field `stripePaymentIntentId?: string | null`.

- [ ] **Step 1: Write the failing test**

Add to `tests/invoices.test.ts`, inside the invoicing describe block. It reproduces the exact sequence: pay, refund fully, pay again, refund the second payment.

```ts
  it("rectifies the invoice for the payment actually refunded, not the oldest", async () => {
    const c = await createCase(intake);
    // Two separate payments on one case: legitimate after a full refund, since
    // a refunded case is no longer blocked from paying again.
    const first = await issueInvoiceForCheckout({
      caseId: c.id, stripeSessionId: "cs_first", stripePaymentIntentId: "pi_first",
      grossCents: 30_000, description: "First", billing, issuedAt: new Date("2026-03-01T10:00:00Z"),
    });
    const second = await issueInvoiceForCheckout({
      caseId: c.id, stripeSessionId: "cs_second", stripePaymentIntentId: "pi_second",
      grossCents: 65_340, description: "Second", billing, issuedAt: new Date("2026-05-01T10:00:00Z"),
    });

    // The SECOND payment is refunded in full.
    const rect = await issueRefundRectification({
      caseId: c.id, stripePaymentIntentId: "pi_second",
      refundedTotalCents: 65_340, issuedAt: new Date("2026-06-01T10:00:00Z"),
    });

    expect(rect).not.toBeNull();
    // It must correct the second invoice…
    expect(rect!.invoice.rectifiesId).toBe(second.invoice.id);
    expect(rect!.invoice.rectifiesId).not.toBe(first.invoice.id);
    // …for the second invoice's full amount, not capped at the first's total.
    expect(rect!.invoice.totalCents).toBe(-65_340);
    expect(rect!.invoice.reason).toBe("Devolución total");
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/invoices.test.ts -t "payment actually refunded"`
Expected: FAIL. Current code selects the earliest INV, so `rectifiesId` is the first invoice's id and `totalCents` is capped at `-30_000`. This failure is the proof the defect is real.

- [ ] **Step 3: Add the migration**

Create `drizzle/0006_invoice_payment_intent.sql`:

```sql
-- The PaymentIntent behind an invoice, so a refund can be matched to the
-- invoice for the payment actually refunded rather than to the case's oldest
-- invoice. Nullable: rows issued before this migration have no value, and the
-- rectification path falls back to the previous behaviour for them.
ALTER TABLE "invoices" ADD COLUMN "stripe_payment_intent_id" text;
--> statement-breakpoint
CREATE INDEX "invoices_payment_intent_idx" ON "invoices" ("stripe_payment_intent_id") WHERE "stripe_payment_intent_id" IS NOT NULL;
```

Append to the `entries` array in `drizzle/meta/_journal.json`:

```json
    {
      "idx": 6,
      "version": "7",
      "when": 1789600000000,
      "tag": "0006_invoice_payment_intent",
      "breakpoints": true
    }
```

- [ ] **Step 4: Add the column to the Drizzle schema**

In `src/lib/db/schema.ts`, in the `invoices` table, directly after the `stripeSessionId` line:

```ts
    /**
     * The PaymentIntent this invoice was paid by. A refund arrives as
     * `charge.refunded` carrying the PaymentIntent, and this is what lets the
     * rectificativa correct the invoice for THAT payment — a case can hold
     * more than one invoice once a refund frees it to be paid again.
     */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
```

and add to the table's index list:

```ts
    index("invoices_payment_intent_idx")
      .on(t.stripePaymentIntentId)
      .where(sql`${t.stripePaymentIntentId} IS NOT NULL`),
```

- [ ] **Step 5: Record the payment intent when issuing**

In `src/lib/server/invoices.ts`, add to the `issueInvoiceForCheckout` input type:

```ts
  stripePaymentIntentId?: string | null;
```

and to the `.values({...})` object:

```ts
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
```

- [ ] **Step 6: Resolve the original by payment intent**

In `src/lib/server/invoices.ts`, add `stripePaymentIntentId?: string | null;` to the `issueRefundRectification` input type, then replace the original-invoice lookup:

```ts
    // Match the invoice for the payment ACTUALLY refunded. A case can hold
    // more than one invoice: a full refund frees it to be paid again, and
    // correcting the oldest would put the wrong figures on a legal document.
    // Invoices issued before the payment intent was recorded have none, so
    // fall back to the oldest — which is right whenever there is only one.
    const [matched] = input.stripePaymentIntentId
      ? await tx
          .select()
          .from(invoices)
          .where(
            and(
              eq(invoices.caseId, input.caseId),
              eq(invoices.series, "INV"),
              eq(invoices.stripePaymentIntentId, input.stripePaymentIntentId),
            ),
          )
          .limit(1)
      : [];

    const [oldest] = matched
      ? []
      : await tx
          .select()
          .from(invoices)
          .where(and(eq(invoices.caseId, input.caseId), eq(invoices.series, "INV")))
          .orderBy(asc(invoices.issuedAt))
          .limit(1);

    const original = matched ?? oldest;
    if (!original) return null; // a refund before any invoice: nothing to correct
```

- [ ] **Step 7: Pass the payment intent through the webhook**

In `src/app/api/webhooks/stripe/route.ts`, in the `checkout.session.completed` case, hoist the payment intent so both the case update and the invoice use it. Replace the inline ternary in `updateCase` with a `const` declared above the `if (record.paymentStatus !== "paid")` block:

```ts
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);
```

Use `stripePaymentIntentId: paymentIntentId` in the `updateCase` call, and add to the `issueInvoiceForCheckout` call:

```ts
          stripePaymentIntentId: paymentIntentId,
```

In the `charge.refunded` case, add to the `issueRefundRectification` call:

```ts
          stripePaymentIntentId: paymentIntentId,
```

- [ ] **Step 8: Run the test and watch it pass**

Run: `npx vitest run tests/invoices.test.ts`
Expected: PASS, including the existing rectificativa and webhook tests, which must be unaffected.

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add drizzle src/lib/db/schema.ts src/lib/server/invoices.ts src/app/api/webhooks/stripe/route.ts tests/invoices.test.ts
git commit -m "fix: rectify the invoice for the payment actually refunded

A case can hold two INV invoices — a full refund frees it to be paid again —
and the rectificativa was always issued against the oldest, capping the
amount at the wrong base. Match on the PaymentIntent, falling back to the
oldest for rows issued before the column existed."
```

---

### Task 3: D2 — reject unauthenticated uploads before parsing the body

**Files:**
- Modify: `src/app/api/documents/route.ts`
- Test: `tests/routes/documents.test.ts`

**Interfaces:**
- Consumes: `mockNextHeaders`, `signOut`, `signInAsCase`, `formRequest`, `FIXTURES` from Task 1.

- [ ] **Step 1: Write the failing test**

Create `tests/routes/documents.test.ts`. The key assertion is that an unauthenticated request is rejected *without its body being read* — asserted by giving the request a body stream that throws if consumed.

```ts
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { mockNextHeaders, setSessionSecrets, signOut, signInAsCase, formRequest, FIXTURES } from "../helpers/route";
import { useTestDb } from "../helpers/db";
import { __setDb, type Db } from "../../src/lib/db/client";
import { createCase } from "../../src/lib/server/storage";
import { intake } from "../helpers/intake";

mockNextHeaders();
setSessionSecrets();

let POST: (r: Request) => Promise<Response>;
let db: Db;
let client: PGlite;

beforeAll(async () => {
  ({ db, client } = await useTestDb());
  ({ POST } = await import("../../src/app/api/documents/route"));
});

beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits");
});

describe("POST /api/documents — the gate comes before the body", () => {
  it("rejects an unauthenticated upload without reading its body", async () => {
    let bodyWasRead = false;
    const request = new Request("http://localhost/api/documents", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=x" },
      body: new ReadableStream({
        pull() {
          bodyWasRead = true;
          throw new Error("the body must not be parsed before the session is checked");
        },
      }),
      // @ts-expect-error — undici requires this for a stream body
      duplex: "half",
    });

    expect((await POST(request)).status).toBe(401);
    expect(bodyWasRead, "handler parsed the body before checking the session").toBe(false);
  });

  it("accepts a PDF from a signed-in student", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(
      formRequest("http://localhost/api/documents", { kind: "passport", file: FIXTURES.pdf() }),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).kind).toBe("passport");
  });

  it("rejects an HTML file wearing a PDF content type", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(
      formRequest("http://localhost/api/documents", { kind: "passport", file: FIXTURES.html() }),
    );
    expect(res.status).toBe(415);
  });

  it("rejects an unknown document kind", async () => {
    const c = await createCase(intake);
    await signInAsCase(c.id);
    const res = await POST(
      formRequest("http://localhost/api/documents", { kind: "not-a-kind", file: FIXTURES.pdf() }),
    );
    expect(res.status).toBe(400);
  });
});
```

Create `tests/helpers/intake.ts` holding a valid `IntakeData` fixture, so route tests share one. Copy the fixture already used in `tests/invoices.test.ts` (search for `const intake`) verbatim so the two cannot drift.

- [ ] **Step 2: Run it and watch the first test fail**

Run: `npx vitest run tests/routes/documents.test.ts -t "without reading its body"`
Expected: FAIL — the handler calls `request.formData()` first, so the stream is pulled and `bodyWasRead` is true.

- [ ] **Step 3: Reorder the handler**

In `src/app/api/documents/route.ts`, move the session check and the per-case limit above the `formData()` call, so the handler reads:

```ts
  const limited = await enforceRateLimit(request, "upload");
  if (limited) return limited;

  // The case comes from the signed session, never from the form: a student can
  // only ever add documents to their own file. Checked BEFORE the body is
  // parsed — formData() buffers the whole multipart payload, so an
  // unauthenticated request must be turned away before it costs us that.
  const caseId = await portalCaseId();
  if (!caseId) {
    return NextResponse.json({ error: "Your session has expired. Please sign in again." }, { status: 401 });
  }
  const perCase = await enforceRateLimit(request, "upload-case", `case:${caseId}`);
  if (perCase) return perCase;

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
```

Then update the stale comment above the `getCase` call, which claimed the case was confirmed before the body was read — that is now true of the session, and the `getCase` call is about the case still existing:

```ts
  // The case must still exist and not be purged: a session outlives neither.
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/routes/documents.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Confirm the rate-limit structural guard still holds**

The guard greps `src/app/api/documents/route.ts` for the exact per-case call. Reordering kept it.

Run: `npx vitest run tests/rate-limit.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and commit**

Run: `npm test`

```bash
git add src/app/api/documents/route.ts tests/routes/documents.test.ts tests/helpers/intake.ts
git commit -m "fix: check the upload session before parsing the multipart body"
```

---

### Task 4: D3 — one query instead of N in invoice hydration

**Files:**
- Modify: `src/lib/server/invoices.ts`
- Test: `tests/invoices.test.ts`

- [ ] **Step 1: Write the failing test**

`hydrate` is private, so assert through `listInvoicesForExport` by counting queries. Add to `tests/invoices.test.ts`:

```ts
  it("hydrates an export in a bounded number of queries", async () => {
    // Three cases, each paid and refunded: three originals, three rectificativas.
    for (const n of [1, 2, 3]) {
      const c = await createCase(intake);
      await issueInvoiceForCheckout({
        caseId: c.id, stripeSessionId: `cs_${n}`, stripePaymentIntentId: `pi_${n}`,
        grossCents: 30_000, description: `Sale ${n}`, billing, issuedAt: new Date("2026-04-01T10:00:00Z"),
      });
      await issueRefundRectification({
        caseId: c.id, stripePaymentIntentId: `pi_${n}`,
        refundedTotalCents: 30_000, issuedAt: new Date("2026-04-02T10:00:00Z"),
      });
    }

    const before = queryCount;
    const rows = await listInvoicesForExport(new Date("2026-01-01"), new Date("2027-01-01"));
    const used = queryCount - before;

    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.rectifiesNumber).map((r) => r.rectifiesNumber)).toHaveLength(3);
    // One query for the rows, one to resolve every original — not one per.
    expect(used, `hydration used ${used} queries for 3 rectificativas`).toBeLessThanOrEqual(3);
  });
```

Add the counter near the top of the file, after the test database is set up:

```ts
let queryCount = 0;
// Count statements the hydration path issues, so an N+1 is a test failure
// rather than something only visible under load.
beforeAll(() => {
  const original = client.query.bind(client);
  client.query = ((...args: Parameters<typeof original>) => {
    queryCount++;
    return original(...args);
  }) as typeof client.query;
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/invoices.test.ts -t "bounded number of queries"`
Expected: FAIL — the loop issues one query per rectificativa, so `used` is 4 or more.

- [ ] **Step 3: Replace the loop with one query**

In `src/lib/server/invoices.ts`, add `inArray` to the drizzle-orm import, then rewrite `hydrate`:

```ts
async function hydrate(rows: InvoiceRow[]): Promise<Invoice[]> {
  const db = await getDb();
  const ids = [...new Set(rows.map((r) => r.rectifiesId).filter((x): x is string => Boolean(x)))];
  // One query for every original, not one per rectificativa: the gestor's
  // annual export would otherwise make a round trip per refund.
  const originals = new Map<string, string>(
    ids.length
      ? (
          await db
            .select({ id: invoices.id, number: invoices.number })
            .from(invoices)
            .where(inArray(invoices.id, ids))
        ).map((o) => [o.id, o.number] as const)
      : [],
  );
  return rows.map((row) => ({
    ...toSummary(row),
    issuer: row.issuer,
    billing: openJson<BillingDetails>(row.billingEnvelope, billingAad(row.id)),
    rectifiesNumber: row.rectifiesId ? (originals.get(row.rectifiesId) ?? null) : null,
  }));
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/invoices.test.ts`
Expected: PASS. The existing export and rectificativa tests must still pass — `rectifiesNumber` resolution is unchanged in behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/invoices.ts tests/invoices.test.ts
git commit -m "perf: hydrate invoice originals in one query, not one per rectificativa"
```

---

### Task 5: D4 — make `npm run typecheck` green

**Files:**
- Create: `types/images.d.ts`
- Test: `tests/typecheck.test.ts`

Root cause: `next-env.d.ts` carries the `next/image-types/global` reference that types PNG imports, but it is generated by `next build` and is listed in `.gitignore`. A fresh clone therefore cannot typecheck. A committed declaration fixes it for everyone.

- [ ] **Step 1: Write the failing test**

Create `tests/typecheck.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

describe("type gate", () => {
  /**
   * A red typecheck hides the next real type error in known noise. This keeps
   * it green on a fresh clone, where next-env.d.ts (gitignored, generated by
   * next build) does not exist.
   */
  it("compiles with no errors", () => {
    let output = "";
    let failed = false;
    try {
      execFileSync("npx", ["tsc", "--noEmit"], { encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      failed = true;
      const e = error as { stdout?: string; stderr?: string };
      output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    }
    expect(failed, output).toBe(false);
  }, 180_000);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/typecheck.test.ts`
Expected: FAIL, reporting `Cannot find module '../../../../assets/guide/cover.png'`.

- [ ] **Step 3: Add the declaration**

Create `types/images.d.ts`:

```ts
/**
 * Types for static image imports (`import cover from "./cover.png"`).
 *
 * Next normally supplies this through next-env.d.ts, which `next build`
 * generates and .gitignore excludes. Without a committed copy, `tsc --noEmit`
 * fails on a fresh clone before anything has been built — so the type gate
 * only works for people who happen to have run a build.
 */
/// <reference types="next/image-types/global" />
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/typecheck.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add types/images.d.ts tests/typecheck.test.ts
git commit -m "fix: type static image imports so a fresh clone can typecheck"
```

---

### Task 6: Portal authentication route coverage

**Files:**
- Test: `tests/routes/portal-auth.test.ts`
- Read first: `src/app/api/portal/login/route.ts`, `src/app/api/portal/verify/route.ts`, `src/app/api/portal/logout/route.ts`

**Interfaces:**
- Consumes: the whole Task 1 harness.

Read the three handlers before writing assertions; match the status codes and redirect targets they actually produce rather than assuming. Where a handler redirects (303) instead of returning JSON, assert the `Location`.

- [ ] **Step 1: Write the tests**

Cover, at minimum:
- `POST /api/portal/login` with an unknown email must answer exactly as it does for a known one (no account enumeration), and must not throw when email is unconfigured.
- `POST /api/portal/verify` with a forged token is refused; with a genuine token it sets a portal cookie.
- A login link is single-use: redeeming the same token twice succeeds then fails, which is `consumeLoginLink`'s compare-and-set seen through HTTP.
- A link issued before a later sign-in is refused (every older link dies on use).
- `POST /api/portal/logout` clears the cookie.

- [ ] **Step 2: Run them**

Run: `npx vitest run tests/routes/portal-auth.test.ts`
Expected: PASS. If a test fails, determine whether it found a real defect before changing the test — report it rather than adjusting the assertion to match.

- [ ] **Step 3: Commit**

```bash
git add tests/routes/portal-auth.test.ts
git commit -m "test: portal sign-in, link redemption and single-use enforcement over HTTP"
```

---

### Task 7: Personal-data route coverage (ownership and IDOR)

**Files:**
- Test: `tests/routes/portal-resources.test.ts`
- Test: `tests/routes/admin-routes.test.ts`

The audit found the ownership checks correct. These tests pin that, so a later refactor cannot quietly remove one.

- [ ] **Step 1: Write the portal resource tests**

In `tests/routes/portal-resources.test.ts`:
- `GET /api/portal/invoices/[id]` — student A signed in, requesting student B's invoice id, gets **404** (not 403: the answer must not confirm the id exists). Requesting their own gets 200 and `application/pdf`.
- `GET /api/portal/invoices/[id]` with a malformed id gets 404, never 500.
- `GET /api/portal/form` before an appointment is booked gets 409; after a police appointment exists, 200.
- `GET /api/portal/appointment-sheet` with no appointment gets 404.
- Each of the three returns 401 with no session.

- [ ] **Step 2: Write the admin tests**

In `tests/routes/admin-routes.test.ts`:
- Every admin route returns 401 with no admin cookie, and with a *portal* cookie only (a student session must never satisfy the admin gate — this is the cross-realm check).
- `POST /api/admin/login` with the wrong password fails; with the right one sets a cookie. Use `src/lib/admin/password.ts` to produce the hash in the test.
- `GET /api/admin/cases/[id]/documents/[docId]` returns the decrypted bytes with `Content-Disposition: attachment`, never `inline`.
- `GET /api/admin/invoices/export` returns CSV for a date range.

- [ ] **Step 3: Run both**

Run: `npx vitest run tests/routes/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/routes/portal-resources.test.ts tests/routes/admin-routes.test.ts
git commit -m "test: ownership and cross-realm gates on portal and admin resources"
```

---

### Task 8: Public intake and triage route coverage

**Files:**
- Test: `tests/routes/public-forms.test.ts`

- [ ] **Step 1: Write the tests**

- `POST /api/intake` with a malformed JSON body gets 400; failing validation gets 422 with field paths; success gets 201, returns only `{ ref }`, and sets a portal cookie.
- The response body must not echo any submitted personal data — assert the serialized response contains neither the submitted email nor the passport number.
- `POST /api/triage` rejects a bad file type with 415 and the offending `path`, and must not create an enquiry when a file is rejected (assert the table is still empty).
- `POST /api/triage` succeeds with no attachments at all.
- An intake with a non-EU nationality is assigned the non-EU `formId` by the server, whatever the body asks for.

- [ ] **Step 2: Run, then run the whole suite**

Run: `npx vitest run tests/routes/public-forms.test.ts && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/routes/public-forms.test.ts
git commit -m "test: intake and triage validation, attribution and non-echo of personal data"
```

---

### Task 9: Behavioural authentication guard

**Files:**
- Test: `tests/routes/auth-guard.test.ts`

The existing scan in `tests/rate-limit.test.ts` greps source text for `enforceRateLimit(`. It cannot tell whether the call gates anything. This is its behavioural companion for authentication: it *calls* every authenticated route with no session and requires a 401.

- [ ] **Step 1: Write the guard**

```ts
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

beforeAll(async () => { ({ db, client } = await useTestDb()); });
beforeEach(async () => {
  __setDb(db);
  signOut();
  await client.exec("TRUNCATE rate_limits");
});

/**
 * Behavioural counterpart to the rate-limit scan. That one greps for a call;
 * this one CALLS every route under /api/portal/ and /api/admin/ with no
 * session and requires a 401. A new authenticated route is covered the day it
 * lands, and cannot satisfy the guard with a call that does not gate.
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
  it("found the routes", () => expect(routes.length).toBeGreaterThanOrEqual(10));

  for (const file of routes) {
    const rel = path.relative(path.join(process.cwd(), "src/app"), file).split(path.sep).join("/");
    if (EXEMPT[rel]) continue;

    it(rel, async () => {
      const mod = await import(file);
      // A dynamic route's params are never reached: the gate comes first.
      const stub = params({ id: "X".repeat(24), docId: "Y".repeat(24) });
      for (const method of ["GET", "POST"] as const) {
        const handler = mod[method];
        if (!handler) continue;
        const res = await handler(
          new Request(`http://localhost/${rel}`, method === "POST" ? { method } : {}),
          stub,
        );
        expect(res.status, `${rel} ${method} let an anonymous caller through`).toBe(401);
      }
    });
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/routes/auth-guard.test.ts`
Expected: PASS. Any route that returns something other than 401 is a real finding — report it before adding an exemption. An exemption is only legitimate if the route genuinely has no session to check, and it must carry its reason.

- [ ] **Step 3: Commit**

```bash
git add tests/routes/auth-guard.test.ts
git commit -m "test: behavioural guard that every authenticated route refuses anonymous callers"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run everything**

```bash
npm run typecheck && npm test
```

Expected: typecheck clean, every test passing, including the 368 that existed at the start.

- [ ] **Step 2: Confirm no UI file was touched**

```bash
git diff --stat main -- src/components src/app/\[locale\] src/styles
```

Expected: empty. Anything listed violates the scope boundary and must be reverted.

- [ ] **Step 3: Confirm the migration is additive**

```bash
grep -c "DROP\|NOT NULL" drizzle/0006_invoice_payment_intent.sql
```

Expected: 0.

- [ ] **Step 4: Update the spec's status**

Mark the spec `Status: implemented` and commit.

## Self-Review

**Spec coverage:** D1 → Task 2. D2 → Task 3. D3 → Task 4. D4 → Task 5. D5 → Tasks 1, 6, 7, 8. Structural guard upgrade → Task 9. Harness + vitest config → Task 1. Verification → Task 10. No spec section is unimplemented.

**Type consistency:** `stripePaymentIntentId` is the field name in the schema, both invoice functions and both webhook call sites. `cookieJar`, `mockNextHeaders`, `signInAsCase`, `signInAsAdmin`, `signOut`, `signInWithForgedCase`, `jsonRequest`, `formRequest`, `params` and `FIXTURES` are defined in Task 1 and used under those exact names in Tasks 3, 6, 7, 8 and 9.

**Risk note:** Tasks 6–8 assert against handlers whose exact status codes must be read first. A failing assertion there is to be investigated as a possible real defect, not silently reconciled.
