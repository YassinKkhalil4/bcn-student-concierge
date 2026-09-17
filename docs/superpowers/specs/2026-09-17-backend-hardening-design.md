# Backend hardening: defect fixes and route-handler test coverage

Status: implemented (see docs/superpowers/plans/2026-09-17-backend-hardening.md)
Date: 2026-09-17

## Context

An audit of the backend (architecture, server logic, persistence, state) found a
codebase in good health. The invariants that usually go unwritten are written
down and, in the main, correctly implemented:

- Invoice issuance is idempotent per Stripe session and deliberately re-runs on
  a case already marked paid, so a failed first attempt still issues on retry.
- Invoice numbering takes `SELECT … FOR UPDATE` on the case row and increments
  the counter in the same transaction, so the correlative series has no gaps.
- IVA arithmetic is integer-only, with IVA as the remainder, so
  `base + iva == gross` to the cent. Fiscal year and day boundaries are
  Europe/Madrid and DST-correct.
- Documents are sealed per file with AES-256-GCM, the AAD binding
  `caseId:documentId:kind`, so a swapped row fails authentication.
- The retention purge writes its "done" marker last and is backed by a database
  CHECK, so a crash mid-purge leaves the case retryable, never falsely complete.
- Every authenticated route derives the case id from the signed session, never
  from the request body. The full route surface was checked for IDOR; none found.

This work is therefore **not** a restructuring. It fixes four specific defects
and closes the one large structural gap: the HTTP layer is almost entirely
untested.

## Problem statement

### D1 — Refund rectification can correct the wrong invoice

`issueRefundRectification` (src/lib/server/invoices.ts) selects the *earliest*
`INV` invoice for the case:

```
.where(and(eq(invoices.caseId, …), eq(invoices.series, "INV")))
.orderBy(asc(invoices.issuedAt)).limit(1)
```

A case can hold two `INV` rows. `issueInvoiceForCheckout` is idempotent per
*session*, not per case, and the checkout route only blocks when
`paymentStatus === "paid"`. So: pay, refund in full (status becomes
`refunded`), pay again — two invoices. A refund of the second payment then
issues a rectificativa against the first invoice, and the
`Math.min(refundedTotalCents, original.totalCents)` cap is applied to the wrong
base. The result is wrong figures on a legal tax document.

Severity: highest. Incorrect facturas rectificativas are a compliance problem,
not merely a bug.

### D2 — Upload body parsed before the session check

In `src/app/api/documents/route.ts` the handler awaits `request.formData()` —
which buffers the whole multipart body — before calling `portalCaseId()`. The
comment in the same handler asserts the case is confirmed "before reading the
body"; the ordering defeats that claim. Bounded by the 300/hour per-IP upload
limit, so this is hardening rather than an open hole, but the stated invariant
should be true.

### D3 — N+1 query in invoice export

`hydrate()` issues one query per distinct `rectifiesId`. On the gestor's annual
export that is one database round trip per rectificativa.

### D4 — `npm run typecheck` is red

`src/app/[locale]/guide/page.tsx` imports a PNG with no ambient module
declaration. A red type gate means the next genuine type error is hidden in
known noise.

### D5 — 21 of 22 route handlers have no behavioural test

The Stripe webhook is tested end to end with genuinely signed events, and it is
the one route where a past regression was caught and pinned. The other 21 are
protected by convention and by a *static* scan in `tests/rate-limit.test.ts`
that greps for the string `enforceRateLimit(` and cannot tell whether the call
gates anything.

Nothing asserts that an expired session returns 401, that another student's
invoice id returns 404, or that a JPEG renamed `.pdf` returns 415. D2 exists
precisely because no test would have noticed the ordering.

## Design

### Test harness

`tests/helpers/route.ts`, built on the idiom the webhook suite already uses
(dynamic `import()` of the route module after environment setup).

It provides:

- A `vi.mock("next/headers")` whose `cookies()` reads a mutable jar the helper
  owns, so a test can present no cookie, a forged one, an expired one or a
  genuine signed session.
- Request builders for JSON, multipart and form-encoded bodies, and for the
  `{ params }` second argument of dynamic routes.
- Session builders that call the real `createPortalSession` /
  `createSessionToken`, so tests exercise real HMAC verification rather than a
  stub of it.

Real database (PGlite via the existing `useTestDb`), real crypto, real
handlers. The only mock is the Next runtime boundary the test process genuinely
lacks.

Two `vitest.config.ts` changes are required and were proven necessary by a
spike:

- an alias mapping `next/navigation` to its `.js` file, because next-intl
  imports it extensionless and Node's ESM resolver rejects that;
- `server.deps.inline: ["next-intl"]`, because as an external dependency Vite
  never rewrites the import and the alias does not apply.

### D1 — match rectification to the refunded payment

Add a nullable `stripe_payment_intent_id` column to `invoices` (additive
migration). `issueInvoiceForCheckout` records the payment intent from the
Checkout Session. `issueRefundRectification` takes the payment intent from the
`charge.refunded` event and resolves the invoice by it.

Backward compatibility: when no invoice matches the payment intent — every row
predating the migration — fall back to the current "earliest INV for the case"
behaviour. Existing data therefore keeps working unchanged, and a case with one
invoice behaves identically before and after.

The already-rectified sum stays keyed on the resolved original's id, so
idempotency across repeated deliveries and correctness across several partial
refunds are preserved per invoice rather than per case.

### D2 — reorder the upload handler

Move `portalCaseId()` (and the per-case rate limit that depends on it) above
`request.formData()`. An unauthenticated request is then rejected before its
body is parsed, and the handler's comment becomes true.

### D3 — one query instead of N

Replace the loop in `hydrate()` with a single `inArray` query over the distinct
`rectifiesId` values.

### D4 — declare the image modules

Add an ambient declaration for image imports so `tsc --noEmit` passes.

### D5 — coverage, in risk order

1. Money and authentication: checkout, portal login / verify / logout, admin
   login / logout.
2. Personal data: documents upload, portal form / invoices / appointment sheet,
   admin document download, admin invoice and export.
3. Remainder: intake, triage, portal locale, portal submit, portal padrón
   authorization, admin case form and appointment sheet, agent markdown.

Each route asserts, as applicable: the auth gate, the ownership check,
validation failures with their status codes, and the success path.

### Structural guard upgrade

Add a behavioural companion to the existing static scan: every route under
`/api/portal/` and `/api/admin/`, minus a documented exemption list, is called
with no session and must return 401. Enumerated from the filesystem like the
existing scan, so a newly added route is covered the day it lands and cannot
satisfy the guard with a call that does not gate.

## Testing strategy

Test-driven throughout. For each of D1–D4 the regression test is written first
and must fail against current code — that failure is the evidence the defect is
real, not inferred from reading. Then the fix, then green.

The 368 existing tests must pass at every step. The full suite is run after
each phase, not only at the end.

## Scope boundaries

Explicitly out of scope:

- Any frontend, component, styling or UI change.
- Restructuring of code that works. No service layer, no dependency injection,
  no error-taxonomy rewrite. The ordering invariants in the storage and invoice
  layers are load-bearing and are not being rearranged.
- Any change to the retention, crypto or numbering designs, which the audit
  found correct.

The only schema change is the additive, nullable `invoices` column in D1.
