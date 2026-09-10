# BCN Student Concierge

Production-ready Next.js application for a boutique administrative facilitation
agency serving international students at private universities in Barcelona.

## Quick start

```bash
npm install
cp .env.example .env.local
# Generate the document encryption key:
openssl rand -base64 32   # paste into DOCUMENT_MASTER_KEY

# Optional: object storage + rate limiting (required in production).
# Without S3_BUCKET, documents go to local disk in dev and the app REFUSES to
# start in production. Without Upstash, rate limiting fails open and logs.

# Official form templates are not redistributable — see docs/FORMS.md.
# PDF render tests skip when they are absent.

npm run dev
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest suite (108 tests) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run purge:expired` | GDPR retention job — add `-- --dry-run` first |
| `npm run forms:inspect -- <pdf>` | Check whether a template has form fields |
| `npm run forms:grid -- <pdf>` | Render a measurement grid for calibration |
| `npm run forms:proof` | Box every mapped coordinate on the template |
| `npm run forms:zoom -- <pdf> <x> <y> <w> <h> [scale]` | Magnify a region |

## Architecture

```
src/
├─ app/
│  ├─ page.tsx                  Landing — value prop, problem/solution, pricing, FAQ
│  ├─ pricing/                  Three tiers, Modelo 790 guidance, exclusions
│  ├─ intake/                   Secure multi-step portal (noindex)
│  ├─ terms|privacy|legal/      Legal pages
│  └─ api/
│     ├─ intake/                Validate + open a case
│     ├─ documents/             Magic-byte validated, encrypted upload
│     ├─ checkout/              Stripe session (server-side pricing)
│     └─ webhooks/stripe/       Signature-verified, idempotent
├─ lib/
│  ├─ schema.ts                 Zod contract — shared by client, API and PDF engine
│  ├─ pricing.ts                Single source of truth for prices and IVA
│  ├─ crypto.ts                 AES-256-GCM envelope encryption
│  ├─ rate-limit.ts             Upstash Redis sliding-window limiter
│  ├─ forms/                    Coordinate overlay engine for EX-17/EX-18
│  │  ├─ field-map.ts             Domain model → logical field names
│  │  ├─ layout.ts                Logical names → absolute page coordinates
│  │  └─ pdf.ts                   Draws values onto the flat template
│  └─ server/
│     ├─ blob-store.ts            S3/R2 object storage for document bodies
│     ├─ storage.ts               Case metadata + retention purge
│     ├─ uploads.ts               Magic-byte validation
│     └─ stripe.ts                Checkout + webhook verification
└─ middleware.ts                Per-request nonce CSP + rate limiting
```

### Design decisions worth knowing

**One schema, three consumers.** `src/lib/schema.ts` is the contract for the
client wizard, the API route, and the PDF engine. A step cannot pass client-side
then fail server-side for a different reason. The server always re-validates —
anything running in a browser is advisory.

**Uppercase happens at the schema boundary,** not in components or the PDF
engine, so no downstream code has to remember to do it. Two deliberate
exceptions, both documented in the file: `email` is lowercased (uppercasing a
local-part can break delivery), and the marital-status code `Sp` is preserved
verbatim — `SP` is not a code the official form defines.

**Missing optional fields become `undefined`, never `""` or `"N/A"`.** The PDF
engine relies on `undefined` to mean "leave this box untouched". This is
enforced in the schema and tested from both directions.

**Prices come from the server-side tier table,** keyed by the tier stored on the
case — never from the request body.

## Deliberate deviations from the brief

Three requirements could not be implemented as literally specified. Each was
built as the closest defensible equivalent rather than faked:

**1. "End-to-end encrypted storage" → envelope encryption at rest.**
True E2EE means the server cannot decrypt. That is incompatible with a
server-side PDF engine that must read passport data, and with staff reviewing
documents before appointments. Implemented instead: AES-256-GCM with a unique
key per file, each wrapped under a master KEK, with AAD binding to the case.
Claiming E2EE in a GDPR privacy notice while holding a decryption key would be a
false statement to regulators, so the privacy page states the real limitation.

**2. "Enforce TLS 1.3" → HSTS in code, TLS version at the edge.**
Application code cannot enforce a TLS version; the handshake completes before
Next.js sees the request. `docs/SECURITY.md` gives the exact Cloudflare / ALB /
nginx settings and the `openssl` commands to verify them.

**3. EX-17 and EX-18 are mutually exclusive.**
The brief implied generating both. An applicant needs one: EX-17 for the TIE
(non-EU), EX-18 for the CUE (EU/EEA/Swiss). The engine routes on nationality
rather than asking students to choose a form they cannot correctly choose.

**4. The official templates have no form fields to populate.**
The brief specified populating official AcroForm templates. The real EX-17 and
EX-18 are flat print documents — page 1 of EX-17 is 38 bitmap images, with no
AcroForm, no XFA and no widget annotations. The engine therefore draws values at
calibrated absolute coordinates. Both forms are calibrated as separate layouts —
EX-18's rows sit 2-5pt lower than EX-17's. `docs/FORMS.md` carries the
calibration workflow and the mandatory print sign-off before live use.

## What must be done before launch

`docs/SECURITY.md` carries the full checklist. The load-bearing items:

- TLS 1.3 minimum configured **and verified** at the edge
- `DOCUMENT_MASTER_KEY` moved into a KMS
- `UPSTASH_REDIS_REST_URL` / `_TOKEN` set — the limiter fails open without them
- `S3_BUCKET` configured — production refuses to start without it
- Case metadata migrated off local JSON to Postgres
- EX-17 and EX-18 coordinates signed off against a physical printout (docs/FORMS.md)
- Legal pages reviewed by a Spanish data-protection lawyer

## Legal positioning

The agency provides **independent logistical facilitation** — not legal
representation. This is a compliance requirement under Spanish anti-intrusismo
regulation, not marketing copy, and it shapes the code:

- The disclaimer renders in the footer of **every** page
- Section 2 (legal representative) of every form is asserted blank
- The intake form requires explicit acknowledgement of the scope limitation
- `/legal` explains what the agency will refuse and refer onward

See `docs/FORMS.md` for why each of those form-level rules exists.
