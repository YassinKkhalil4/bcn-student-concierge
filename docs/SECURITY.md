# Security & compliance

This document covers the controls implemented in code, and — just as important
— the controls that **cannot** be implemented in code and must be configured at
your infrastructure layer before launch.

---

## 1. TLS 1.3 — enforced by Caddy

**Application code cannot enforce a TLS version**: by the time a request reaches
Next.js, the handshake is over. It is enforced by the reverse proxy in
`deploy/Caddyfile`:

```
tls {
    protocols tls1.3
}
```

TLS 1.2 and older are refused outright. Certificates for `bcnstudent.com` and
`www.bcnstudent.com` are issued and renewed automatically by Let's Encrypt.

The app adds `Strict-Transport-Security` (two years, `includeSubDomains`,
`preload`) and `upgrade-insecure-requests`, so browsers refuse plain HTTP after
the first visit.

Verify after deploying — do not assume:

```bash
# Should CONNECT:
openssl s_client -tls1_3 -connect bcnstudent.com:443 </dev/null
# Should FAIL:
openssl s_client -tls1_2 -connect bcnstudent.com:443 </dev/null
```

Submit the domain to <https://hstspreload.org> once you are confident, since
preload is difficult to reverse.

---

## 2. Encryption at rest — what it is, and what it is not

Implemented in `src/lib/crypto.ts`. **All personal data is encrypted before it
is stored** — both the intake questionnaire and every uploaded document:

- **AES-256-GCM** authenticated encryption.
- **A unique data-encryption key (DEK) per record** — per case intake, per
  document — so one compromised record never unlocks another.
- **Each DEK wrapped** under a key-encryption key derived from the master key
  via HKDF with domain separation.
- **AAD binding.** Intake envelopes are bound to `case:<id>:intake`, documents to
  `<caseId>:<documentId>:<kind>`. An envelope copied onto another row fails
  authentication instead of showing one applicant's data on another's file.

What Postgres holds, therefore: opaque ids, workflow stage, payment status,
timestamps, and ciphertext. A dump of the database — or a stolen backup, or a
volume snapshot — reveals no name, passport number or address.

### This is not end-to-end encryption

The brief asked for E2EE. It was implemented as strong encryption at rest, and
the privacy notice says so plainly, because:

> True E2EE means only the client holds the key and the server can never read
> the plaintext. That is incompatible with a server-side PDF engine that must
> read passport data to populate EX-17/EX-18, and with staff who must review
> documents before an appointment.

Claiming E2EE while holding a decryption key would be a **false statement in a
GDPR privacy notice** — a regulatory liability, not merely imprecise marketing.

### The threat model on a single VPS — read this

The master key lives in `.env` on the same server as the data. So:

| Threat | Protected? |
|---|---|
| Database dump, stolen backup, leaked volume snapshot | **Yes** — ciphertext only, as long as the key is not in the backup |
| Someone with read access to Postgres but not the host | **Yes** |
| Root compromise of the VPS | **No** — the attacker has the key and the data |
| Compromise of the running app process | **No** — it must decrypt to work |

Two rules follow:

1. **Never put `.env` in the same backup as the database and documents.** A
   backup containing both is a plaintext backup.
2. Harden the host itself (see `docs/DEPLOY.md`): SSH keys only, firewall,
   unattended security updates. On a VPS, host security *is* data security.

To move beyond this, keep the master key off the host — a KMS such as AWS KMS or
a Hashicorp Vault instance, with `getMasterKey()` in `crypto.ts` replaced by a
call to it. The wrapped-DEK structure is already shaped for that.

### Where the data lives

| Data | Store | Form |
|---|---|---|
| Case metadata + intake | Postgres `cases` | intake as AES-GCM envelope (`intake_envelope`) |
| Document envelopes | Postgres `case_documents` | wrapped DEK, IV, tag — no ciphertext |
| Document bodies | `documents` volume at `DATA_DIR` (or S3 if `S3_BUCKET` set) | raw ciphertext, 0600 files |
| Master key | `.env` on the host | plaintext — protect accordingly |

Documents are rows rather than a list inside the case, so concurrent uploads
cannot overwrite each other. Production refuses to start unless `DATABASE_URL`
is set and document storage points at an explicit absolute path (the volume) or
a bucket — never an implicit path inside the container.

**Erasure is enforced by the database**, not just the code:
`CHECK (purged_at IS NULL OR intake_envelope IS NULL)` makes a "purged" record
that still holds personal data impossible to write.

**Searching encrypted data.** Postgres cannot search inside the intake, so the
dashboard decrypts and matches in the app (accent- and case-insensitive). Each
search scans at most the 5,000 most recent cases in the selected queue — ample
for this business. Past that, add blind indexes (HMACs of normalised surname,
email and passport number) instead of decrypting to search.

### Key rotation — not yet implemented

Every envelope records `keyVersion`, so rotation can be added without a data
migration: introduce the new key alongside the old, and re-wrap each record's
small DEK under the new one (no bulk re-encryption). There is no tooling for
this yet. Until there is, `DOCUMENT_MASTER_KEY` must not change — replacing it
makes every existing record undecryptable.

---

## 3. Content Security Policy

Generated per-request in `src/middleware.ts` with a **nonce**, not a static
header.

Next.js emits inline `<script>` tags to bootstrap hydration. A static CSP cannot
know their contents, so the only options are `'unsafe-inline'` — which defeats
the purpose of a script CSP entirely — or a per-request nonce. This app uses the
nonce plus `'strict-dynamic'`.

**Known tradeoff:** a per-request nonce makes responses dynamic, so pages are not
served from the full-page static cache. This costs some CDN efficiency on the
marketing pages. It is the right trade here because the same origin serves the
passport-upload portal, and a CSP that is weak on one route is weak on all of
them.

`'unsafe-eval'` appears **only** in development, for the webpack HMR runtime.
Verify it is absent in production:

```bash
curl -sI https://your-domain.com | grep -i content-security-policy
```

---

## 4. Rate limiting — Postgres

Backed by the same Postgres as everything else (`src/lib/rate-limit.ts`, table
`rate_limits`) — no extra service on the VPS.

| Endpoint | Limit | Window | If the limiter fails |
|---|---|---|---|
| `POST /api/intake` | 5 | 1 hour | allow |
| `POST /api/documents` | 20 | 1 hour | allow |
| `POST /api/checkout` | 10 | 15 min | allow |
| `POST /api/admin/login` | 5 | 15 min | **deny** (production) |

**Sliding-window counter**, not a fixed window: the effective count is the
current window plus the previous one weighted by its remaining overlap, so a
caller cannot burst a full quota at the end of one window and again at the start
of the next. Each check is a single atomic `INSERT … ON CONFLICT` — verified to
admit exactly 5 of 20 simultaneous requests against a real Postgres server.

**Enforced in route handlers, not middleware.** Next.js middleware runs in the
Edge sandbox, which cannot open a Postgres connection. To keep the guarantee that
a new route cannot ship unprotected by omission, `tests/rate-limit.test.ts`
scans every API route and **fails if a POST handler does not call the limiter**.
Exemptions are listed in that test with their reason:

- **Stripe webhook** — Stripe retries on 429, which would delay payment
  confirmations. Protected by signature verification instead.
- **Admin logout** — only clears the caller's own cookie.

**No IP addresses are stored.** The counter key is an HMAC of the client IP
under a key derived from the master key — an IP is personal data under GDPR,
and a plain hash of an IPv4 address can be reversed by brute force. Counters
older than two hours are deleted by the hourly maintenance job.

**Where the client IP comes from.** Caddy overwrites `X-Real-IP` with the
connecting socket's address and strips `X-Forwarded-For`; the app port is never
published. The header can therefore only have come from Caddy. **Do not publish
the app port** (`3000`) — if clients could reach the app directly, they could
set `X-Real-IP` themselves and evade every limit.

### Failure mode

Public forms fail **open**: rate limiting is abuse protection, not
authentication, and a limiter fault must not lock families out mid-application.
(On this deployment the limiter shares Postgres with the forms, so a database
outage takes both down together anyway.) Admin login is the one scope that fails
**closed** in production — a brief staff lockout beats unlimited password
guesses.

---

## 5. Upload validation

Extensions and client `Content-Type` are attacker-controlled and are ignored.
Files are validated by **magic bytes** (`src/lib/server/uploads.ts`), accepting
only PDF, JPEG and PNG, capped at 10 MB.

This blocks the stored-XSS case: an HTML file named `passport.pdf` that executes
the moment a staff member opens it in a browser tab. There is a test for exactly
this.

**Additionally recommended before launch:** run uploads through a malware
scanner (ClamAV or a provider API). Magic-byte validation confirms a file is a
PDF; it does not confirm the PDF is benign.

---

## 6. Payment security

- Card data never touches the server — Stripe Checkout is hosted.
- **Prices are read from the server-side tier table**, keyed by the tier stored
  on the case. Never from the request body. A client-supplied amount is the
  classic e-commerce flaw that lets anyone buy the €1,100 tier for €1.
- Return URLs are built from `PUBLIC_ORIGIN`, never from the `Host` or `Origin`
  header, which an attacker controls and could use to redirect a paying customer
  to a lookalike confirmation page.
- Webhooks verify the Stripe signature against the **raw** body. Parsing JSON
  first re-serializes it and the signature will never match.
- Webhook handlers are idempotent; Stripe retries and can deliver twice.

**Apple Pay** requires domain verification in the Stripe dashboard
(Settings → Payment methods → Apple Pay → Add domain). It then appears
automatically on eligible devices under the existing `card` method type.

---

## 7. GDPR & data lifecycle

| Requirement | Implementation |
|---|---|
| Consent must be affirmative | `z.literal(true)` — an unchecked box fails validation. `ConsentBox` offers no `defaultChecked` path at all. |
| Storage limitation (Art. 5(1)(e)) | The server purges expired cases itself, hourly (`src/lib/server/jobs.ts`) |
| Retention period | `RETENTION_DAYS` (30) after a case is marked completed in the dashboard |
| Right to erasure | "Erase now" on the case page, ahead of the automatic job |
| Accountability (Art. 5(2)) | A tombstone records that the file existed and when it was purged |
| Legal retention override (Art. 17(3)(b)) | Payment metadata survives the purge; Spanish commercial law requires it |

**The purge runs inside the app process** — no cron to install or forget. It
starts 30 seconds after boot and repeats every `MAINTENANCE_INTERVAL_MINUTES`,
under a Postgres advisory lock so a second instance never runs it concurrently.
It is idempotent: the "purged" marker is written only after the documents and
the intake are gone, so an interrupted run is finished by the next.

Preview or force a run by hand (from a checkout with `DATABASE_URL` set):

```bash
npm run purge:expired -- --dry-run
```

⚠️ **Backups outlive the purge.** A deleted case still exists in any backup taken
before its deletion. Keep backup retention at or below 30 days so the privacy
notice stays true, or state the backup period in it. (Backups hold only
ciphertext — provided `.env` is not backed up with them.)

---

## 8. Staff dashboard (`/admin`)

- **Auth:** one admin password, scrypt-hashed in `ADMIN_PASSWORD_HASH`
  (`npm run admin:hash-password`; colon-separated so Next's env expansion cannot
  corrupt it). Sessions are HMAC-signed with `ADMIN_SESSION_SECRET`, 8-hour TTL,
  `HttpOnly`, `Secure`, `SameSite=Strict`.
- **Two gates:** middleware rejects unauthenticated `/admin` and `/api/admin`
  requests, and every page, route handler and server action re-verifies the
  session itself, so one matcher mistake cannot expose documents.
- **Login rate limit** (5 per 15 min) is the one limiter that **fails closed** in
  production: if the limiter breaks, a short staff lockout beats unlimited guesses.
- **Revocation:** sessions are stateless. To sign everyone out, rotate
  `ADMIN_SESSION_SECRET`.
- **Documents** are decrypted on demand and served as attachments, never inline.
  Filenames carry the case reference, not the applicant's name.
- **Access log:** downloads, stage changes, manual erasures and failed logins are
  logged by case reference, with no personal data.

**Limitation:** a single shared credential means the log records *what* was
accessed but not *who*. Once more than one or two people use the dashboard,
move to per-user accounts (e.g. SSO via your identity provider).

## 9. Pre-launch checklist

- [ ] `openssl s_client -tls1_2 -connect bcnstudent.com:443` **fails** (TLS 1.3 only)
- [ ] App port 3000 not published; `curl http://<server-ip>:3000` refused from outside
- [ ] `.env` is `chmod 600`, and excluded from every backup that holds data
- [ ] `DOCUMENT_MASTER_KEY` backed up somewhere separate — losing it loses all data
- [ ] `ADMIN_PASSWORD_HASH` and `ADMIN_SESSION_SECRET` set (dashboard stays locked otherwise)
- [ ] Postgres + `documents` volume backed up nightly, retention ≤ 30 days (`docs/DEPLOY.md`)
- [ ] A restore rehearsed at least once
- [ ] Stripe webhook registered at `https://bcnstudent.com/api/webhooks/stripe`; signing secret set
- [ ] Apple Pay domain `bcnstudent.com` verified in Stripe
- [ ] Retention seen running: `docker compose logs app | grep "\[retention\] run ok"` (one line per hour)
- [ ] Host hardened: SSH keys only, firewall (22/80/443), unattended upgrades
- [ ] Malware scanning added to the upload path
- [ ] Official EX-17/EX-18 templates in `templates/forms/` and printouts signed off (`docs/FORMS.md`)
- [ ] Privacy notice reviewed by a Spanish data-protection lawyer
- [ ] Scope-of-service disclaimer reviewed against current anti-intrusismo guidance
