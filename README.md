# BCN Student Concierge

Next.js application for **BCN Student Concierge** (<https://bcnstudent.com>),
a boutique administrative facilitation agency serving international students at
private universities in Barcelona. Self-hosted on a single VPS with Docker —
see **[docs/DEPLOY.md](docs/DEPLOY.md)**.

## Local development

```bash
npm install
cp .env.example .env.local
openssl rand -base64 32   # paste into DOCUMENT_MASTER_KEY
npm run dev
```

No database server needed: with `DATABASE_URL` unset, development uses an
embedded Postgres (PGlite) under `.data/`, migrated automatically — same SQL,
same constraints as production. To use the staff dashboard locally, set
`ADMIN_PASSWORD_HASH` (`npm run admin:hash-password`) and `ADMIN_SESSION_SECRET`.

Official form templates are not redistributable — see `docs/FORMS.md`. PDF
render tests skip when they are absent.

## Production

```bash
cp .env.example .env && chmod 600 .env   # fill it in
docker compose up -d --build
```

Caddy (TLS 1.3, automatic certificates) → Next.js → Postgres, on one VPS.
Migrations and the 30-day retention purge run inside the app. Full runbook,
hardening and backups: [docs/DEPLOY.md](docs/DEPLOY.md).

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run purge:expired` | GDPR retention job — add `-- --dry-run` first |
| `npm run db:generate` | Generate a migration after editing `src/lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` (deploy step) |
| `npm run admin:hash-password` | Produce `ADMIN_PASSWORD_HASH` for the staff dashboard |
| `npm run forms:inspect -- <pdf>` | Check whether a template has form fields |
| `npm run forms:grid -- <pdf>` | Render a measurement grid for calibration |
| `npm run forms:proof` | Box every mapped coordinate on the template |
| `npm run forms:zoom -- <pdf> <x> <y> <w> <h> [scale]` | Magnify a region |
| `npm run i18n:translate` | Translate new or changed English strings with DeepL (needs `DEEPL_API_KEY` in `.env.local`) |
| `npm run i18n:check` | Validate every catalogue without calling DeepL |

## Architecture

```
src/
├─ app/
│  ├─ [locale]/                 Public site in six languages (English unprefixed)
│  │  ├─ page.tsx                 Landing — value prop, problem/solution, pricing, FAQ
│  │  ├─ pricing/                 Three tiers, Modelo 790 guidance, exclusions
│  │  ├─ intake/                  Secure multi-step portal (noindex)
│  │  ├─ portal/                  Student file: sign-in, uploads, Padrón, fees
│  │  └─ terms|privacy|legal/     Legal pages
│  ├─ admin/                    Staff dashboard (authenticated, noindex)
│  │  ├─ page.tsx                 Case queues + search
│  │  ├─ cases/[id]/              Case file, documents, workflow, Tasa 012 helper
│  │  └─ login/                   Password sign-in
│  └─ api/
│     ├─ intake/                Validate + open a case
│     ├─ documents/             Magic-byte validated, encrypted upload
│     ├─ checkout/              Stripe session (server-side pricing)
│     ├─ webhooks/stripe/       Signature-verified, idempotent
│     └─ admin/                 Login/logout, document + form downloads
├─ i18n/                       Routing, catalogue loading, translation safety rules
├─ lib/
│  ├─ schema.ts                 Zod contract — shared by client, API and PDF engine
│  ├─ pricing.ts                Single source of truth for prices and IVA
│  ├─ crypto.ts                 AES-256-GCM envelope encryption
│  ├─ rate-limit.ts             Postgres sliding-window limiter
│  ├─ tasa012.ts                Modelo 790-012 portal summary + student message
│  ├─ db/                       Drizzle schema + node-postgres pool (PGlite locally)
│  ├─ admin/                    Session signing, password hashing, guards
│  ├─ forms/                    Coordinate overlay engine for EX-17/EX-18
│  │  ├─ field-map.ts             Domain model → logical field names
│  │  ├─ layout.ts                Logical names → absolute page coordinates
│  │  └─ pdf.ts                   Draws values onto the flat template
│  └─ server/
│     ├─ blob-store.ts            S3/R2 object storage for document bodies
│     ├─ storage.ts               Case repository — intake sealed before Postgres
│     ├─ maintenance.ts           Retention purge + housekeeping
│     ├─ jobs.ts                  Boot-time migrations + hourly scheduler
│     ├─ uploads.ts               Magic-byte validation
│     └─ stripe.ts                Checkout + webhook verification
├─ middleware.ts                Nonce CSP, admin gate
└─ instrumentation.ts           Starts background jobs once per server process
messages/<locale>/*.json        UI text; English is the source, the rest generated
drizzle/                        SQL migrations (generated, committed)
deploy/                         Caddyfile, backup script
Dockerfile, docker-compose.yml  VPS deployment
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

**Crawlers and agents get the public pages, and only those.** `robots.txt`
(RFC 9309) opens the marketing and legal pages, closes `/intake`, `/portal`,
`/admin` and `/api` to every crawler, and carries Content Signals
(`ai-train=no, search=yes, ai-input=yes` — a business decision, set in
`src/app/robots.txt/route.ts`). The sitemap lists the same pages in all six
languages with their `hreflang` alternates. Those pages also answer
`Accept: text/markdown`, and have a `.md` address (`/pricing.md`,
`/fr/privacy.md`), advertised with a `Link: …; rel="describedby"` header —
an assistant reads clean Markdown instead of scraping HTML. The Markdown is
generated from the same message catalogues and the same price table as the
pages, so it cannot quote stale wording or a stale price, and every document
carries the scope-of-service disclaimer. `src/lib/agents/pages.ts` is the one
list of public pages, shared by all three, and `tests/agents.test.ts` fails if
anything private reaches it.

**Six languages, and only six:** English (main, unprefixed URLs), Spanish,
Catalan, French, Italian and German (`/es`, `/ca`, `/fr`, `/it`, `/de`). The
staff dashboard is English only. Catalogues are translated by
`scripts/i18n-translate.mts` with DeepL — formal register, a glossary that
keeps official names verbatim (Padrón, NIE, TIE, Modelo 790, EX-17, EX-18…),
Catalan pivoted from the Spanish — then corrected by hand in
`scripts/i18n-overrides.json`, which always wins. `tests/i18n.test.ts` fails the
build on a missing key, a lost placeholder or tag, a mistranslated official
term, or a message that no longer parses. Things students send to Spanish
institutions (the residence and university emails, the phrases on the
appointment sheet) stay in Spanish on purpose. The site never calls DeepL at
runtime, and DeepL only ever sees site copy — never a student's data.

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

`docs/SECURITY.md` §12 has the full checklist. The load-bearing items:

- TLS 1.2 verified **refused** at `bcnstudent.com` (Caddy enforces 1.3)
- `.env` is `chmod 600` and **never** in the same backup as the data
- `DOCUMENT_MASTER_KEY` stored in a password manager — losing it loses all data
- Nightly backups running, copied off-server, restore rehearsed once
- Admin credentials set (`npm run admin:hash-password`, `ADMIN_SESSION_SECRET`)
- Stripe webhook registered at `https://bcnstudent.com/api/webhooks/stripe`
- EX-17 and EX-18 coordinates signed off against a physical printout (`docs/FORMS.md`)
- Legal pages reviewed by a Spanish data-protection lawyer — the English, and
  the five translations (each shows a notice that the English prevails)
- A native-speaker read of each language, above all Catalan: DeepL's Catalan
  needed rewriting in most places, and `scripts/i18n-overrides.json` holds that
  hand translation

## Legal positioning

The agency provides **independent logistical facilitation** — not legal
representation. This is a compliance requirement under Spanish anti-intrusismo
regulation, not marketing copy, and it shapes the code:

- The disclaimer renders in the footer of **every** page
- Section 2 (legal representative) of every form is asserted blank
- The intake form requires explicit acknowledgement of the scope limitation
- `/legal` explains what the agency will refuse and refer onward

See `docs/FORMS.md` for why each of those form-level rules exists.
