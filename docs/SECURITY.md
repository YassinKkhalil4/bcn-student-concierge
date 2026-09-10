# Security & compliance

This document covers the controls implemented in code, and — just as important
— the controls that **cannot** be implemented in code and must be configured at
your infrastructure layer before launch.

---

## 1. TLS 1.3 — MUST be configured at the edge

**Application code cannot enforce a TLS version.** By the time a request reaches
Next.js, the handshake is already complete. Anyone claiming to enforce TLS 1.3
"in the app" has not enforced it at all.

What the app does: emits `Strict-Transport-Security` with a two-year max-age,
`includeSubDomains` and `preload`, plus `upgrade-insecure-requests` in the CSP.
That forces HTTPS on repeat visits but says nothing about the version.

What you must configure:

| Platform | Setting |
|---|---|
| **Cloudflare** | SSL/TLS → Edge Certificates → Minimum TLS Version = **1.3**; enable TLS 1.3 |
| **Vercel** | TLS 1.3 is enabled and 1.0/1.1 disabled by default. To *require* 1.3, front it with Cloudflare — Vercel still permits 1.2. |
| **AWS ALB** | Security policy `ELBSecurityPolicy-TLS13-1-3-2021-06` (1.3 only) |
| **nginx** | `ssl_protocols TLSv1.3;` and `ssl_prefer_server_ciphers off;` |

Verify after deploying — do not assume:

```bash
# Should CONNECT:
openssl s_client -tls1_3 -connect bcnstudentconcierge.com:443 </dev/null
# Should FAIL if 1.3 is genuinely required:
openssl s_client -tls1_2 -connect bcnstudentconcierge.com:443 </dev/null
```

Submit the domain to <https://hstspreload.org> once you are confident, since
preload is difficult to reverse.

---

## 2. Encryption at rest — what it is, and what it is not

Implemented in `src/lib/crypto.ts`:

- **AES-256-GCM** authenticated encryption per document.
- **A unique data-encryption key (DEK) per file**, so one compromised object
  never unlocks another.
- **Each DEK wrapped** under a key-encryption key derived from a master secret
  via HKDF with domain separation.
- **AAD binding** to `caseId:documentId:kind`, so a swapped database row fails
  authentication rather than decrypting as another applicant's passport.

### This is not end-to-end encryption

The brief asked for E2EE. It was implemented as strong encryption at rest, and
the privacy notice says so plainly, because:

> True E2EE means only the client holds the key and the server can never read
> the plaintext. That is incompatible with a server-side PDF engine that must
> read passport data to populate EX-17/EX-18, and with staff who must review
> documents before an appointment.

Claiming E2EE while holding a decryption key would be a **false statement in a
GDPR privacy notice** — a regulatory liability, not merely imprecise marketing.
The threat this design defeats is database/object-store exfiltration. It does
not defeat a fully compromised application server, and the privacy page says
that too.

### Where ciphertext actually lives

Document **bodies** go to S3-compatible object storage (`src/lib/server/blob-store.ts`),
keyed `cases/<caseId>/documents/<documentId>`. Only **metadata** — the wrapped
DEK, IV and auth tag — stays in the case record. Ciphertext is never embedded
inline in JSON.

Works with AWS S3, Cloudflare R2 or MinIO. R2 needs `S3_ENDPOINT`,
`S3_REGION=auto` and `S3_FORCE_PATH_STYLE=true`, and must **not** be sent SSE
headers — it encrypts at rest unconditionally and rejects them.

Provider encryption (SSE-KMS on S3) sits *underneath* the envelope encryption.
It protects against the provider's disks being stolen; ours protects against the
provider account being compromised. Neither replaces the other.

In production, a missing `S3_BUCKET` is a **hard startup error**, not a fallback
to local disk — on serverless that fallback silently loses every uploaded
passport at the next deploy.

⚠️ **Still outstanding:** case *metadata* remains a local JSON file. It has no
transactions and no replication, and concurrent writes to one case can interleave
and lose data. Replace it with Postgres before scaling beyond one instance. The
sensitive document bodies are no longer affected by this.

### Key management

Development reads `DOCUMENT_MASTER_KEY` from the environment. **Production must
not.** Move the master key into a KMS/HSM:

- AWS KMS, GCP Cloud KMS, or Azure Key Vault
- Replace `getMasterKey()` in `src/lib/crypto.ts` with a KMS `Decrypt` call for
  the wrapped DEK — the envelope structure is already correct for this, which is
  why DEKs are wrapped rather than used directly.

**Rotation.** Bump `DOCUMENT_KEY_VERSION`, then re-wrap existing DEKs under the
new KEK. Because only the small wrapped keys change, rotation never rewrites
ciphertext — no re-encryption of document bodies is required.

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

## 4. Rate limiting — Upstash Redis

Enforced in `src/middleware.ts`, backed by `@upstash/ratelimit` over Upstash
Redis. Limiting lives in middleware rather than in each route handler so a new
API route **cannot ship unprotected by omission** — the default is protected.

Upstash is used rather than a raw Redis client because middleware runs on the
Edge runtime, which has no TCP sockets. Upstash speaks HTTP.

| Endpoint | Limit | Window |
|---|---|---|
| `POST /api/intake` | 5 | 1 hour |
| `POST /api/documents` | 20 | 1 hour |
| `POST /api/checkout` | 10 | 15 min |

Sliding window, not fixed: a fixed window lets a caller burst the full quota at
the end of one window and again at the start of the next, giving 2x the intended
rate across the boundary.

**The Stripe webhook is deliberately not rate limited.** Stripe retries on any
non-2xx, so a 429 would cause redelivery, and a burst of legitimate events could
throttle payment confirmations. It is protected by signature verification, which
is the right control for a machine caller.

### Failure mode: fails open, loudly

If Redis is unreachable or unconfigured, requests are **allowed** and the result
is flagged `degraded`, with an error logged in production.

This is deliberate. Rate limiting is abuse protection, not authentication.
Failing closed would turn an Upstash outage into a total outage of the intake
portal, blocking legitimate families mid-application. If your threat model makes
abuse costlier than downtime, invert it in `src/lib/rate-limit.ts` — but do it
deliberately.

### Configuration

```bash
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...
```

`TRUST_PROXY` must stay `false` unless your edge **appends** to
`x-forwarded-for` rather than passing it through. If a client can spoof that
header, they vary it per request and are never limited.

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
| Storage limitation (Art. 5(1)(e)) | `scripts/purge-expired.mts`, run daily |
| Retention period | 30 days after `serviceCompletedAt` |
| Right to erasure | `purgeCase()` — call on request, ahead of the automatic job |
| Accountability (Art. 5(2)) | A tombstone records that the file existed and was purged |
| Legal retention override (Art. 17(3)(b)) | Invoice metadata survives the purge; Spanish commercial law requires it |

Install the cron job:

```bash
0 3 * * * cd /srv/bcn && npm run purge:expired >> /var/log/bcn-purge.log 2>&1
```

Dry-run first — it reports what it would delete without deleting anything:

```bash
npm run purge:expired -- --dry-run
```

The job is idempotent, so a retry after a failure is always safe.

---

## 8. Pre-launch checklist

- [ ] TLS 1.3 minimum enforced at the edge, and **verified with `openssl`**
- [ ] `DOCUMENT_MASTER_KEY` moved into a KMS, not an env file
- [ ] `UPSTASH_REDIS_REST_URL` / `_TOKEN` set (limiter fails open without them)
- [ ] `S3_BUCKET` configured; bucket private, versioning + lifecycle rules set
- [ ] Case metadata store migrated off local JSON to Postgres
- [ ] `TRUST_PROXY` set correctly for your actual edge behaviour
- [ ] Stripe webhook endpoint registered; signing secret set
- [ ] Apple Pay domain verified in Stripe
- [ ] Purge cron installed and dry-run reviewed
- [ ] Malware scanning added to the upload path
- [ ] Official EX-17/EX-18 templates installed and field map verified (`docs/FORMS.md`)
- [ ] Privacy notice reviewed by a Spanish data-protection lawyer
- [ ] Scope-of-service disclaimer reviewed against current anti-intrusismo guidance
- [ ] `.data/` and `.env*` confirmed absent from version control
