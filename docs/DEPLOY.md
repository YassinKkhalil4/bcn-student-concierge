# Deploying to a VPS

BCN Student Concierge runs as two containers behind a Caddy on the host:

```
internet ──443──▶ caddy (host) ──▶ 127.0.0.1:3005 ──▶ app (Next.js) ──▶ db (Postgres 16)
                  TLS 1.3                             bcn_net bridge, no published port
```

- **Caddy runs on the host**, not in Compose, so it can front this and other
  sites on the same machine. It terminates TLS (1.3 only), gets certificates
  automatically, and proxies to the app on loopback.
- **app** publishes `127.0.0.1:3005` only — unreachable from the internet
  except through the proxy. It runs migrations at startup and the 30-day
  retention purge hourly: there is no cron to install for GDPR deletion.
- **db** publishes nothing. It is reachable only by the app, over `bcn_net`.
- Encrypted documents live in `./data` on the host; Postgres in the `pgdata`
  volume. Both containers have CPU and memory limits (`deploy.resources`).

## 1. Server

- **Location: the EU.** The data is EU residents' identity documents; an EU
  data centre keeps it out of international-transfer territory (e.g. Hetzner
  Falkenstein/Helsinki, OVHcloud, Scaleway).
- **Size:** 2 vCPU, 4 GB RAM, 40 GB disk is comfortable.
- **OS:** Ubuntu 24.04 LTS, with Docker Engine and the Compose plugin
  (<https://docs.docker.com/engine/install/ubuntu/>).

### Harden the host first

On a single VPS, host security *is* data security — the master key lives here.

```bash
# As root, once:
adduser deploy && usermod -aG sudo,docker deploy
# Copy your SSH key to deploy, then in /etc/ssh/sshd_config:
#   PasswordAuthentication no
#   PermitRootLogin no
systemctl restart ssh

ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp
ufw enable

apt install -y unattended-upgrades && dpkg-reconfigure -plow unattended-upgrades
```

Note: Docker publishes ports by writing its own iptables rules, which bypass
ufw. That is why the app is published as `127.0.0.1:3005` — bound to loopback,
Docker's rules cannot expose it. Never bind a container to `0.0.0.0`, and never
give `db` a `ports:` entry at all. Only the host's Caddy listens publicly, on
80 and 443.

## 2. DNS

Point both names at the server before the first start, or Caddy cannot obtain
certificates:

| Type | Name | Value |
|---|---|---|
| A | `bcnstudent.com` | server IPv4 |
| A | `www.bcnstudent.com` | server IPv4 |
| AAAA | both (optional) | server IPv6 |

## 3. Install

```bash
sudo mkdir -p /srv/bcnstudent && sudo chown deploy: /srv/bcnstudent
git clone <your-repo-url> /srv/bcnstudent
cd /srv/bcnstudent

cp .env.example .env
chmod 600 .env

# Encrypted uploads live here. 10001 is the uid the app runs as in the image;
# without this the app cannot write a single document.
mkdir -p data templates/forms
sudo chown -R 10001:10001 data
```

Fill in `.env`:

| Variable | How |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `DOCUMENT_MASTER_KEY` | `openssl rand -base64 32` — **also store it in your password manager**; losing it loses every record |
| `ADMIN_SESSION_SECRET` | `openssl rand -base64 32` |
| `ADMIN_PASSWORD_HASH` | on your own machine, in a checkout: `npm run admin:hash-password`, then paste the line |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | after step 5 |
| `PORTAL_SESSION_SECRET` | `openssl rand -base64 32` |
| `RESEND_API_KEY`, `EMAIL_FROM` | see "Email" below |
| `INVOICE_ISSUER_NAME`, `_TAX_ID`, `_ADDRESS` | your legal name, NIF and fiscal address, exactly as on your invoices |

The server refuses to start in production if any required setting is missing,
and lists them all — check `docker compose logs app` after the first start.

Copy the official form templates to the server (they are not in git):

```bash
scp EX-17-official.pdf EX-18-official.pdf Autoritzaciodomicili_cat.pdf \
    deploy@bcnstudent.com:/srv/bcnstudent/templates/forms/
```

The filenames matter — they are what the app looks for. At every start the app
logs which it found:

```
[forms] official templates present
[forms] EX-18-official.pdf missing from /app/templates/forms — copy the official PDFs there (docs/FORMS.md).
```

A missing template does not stop the site, so payments and uploads keep
working; the staff dashboard shows a banner, and form downloads return a
"temporarily unavailable" error until the file is in place.

Start the containers:

```bash
docker compose up -d --build
docker compose logs -f app
```

Expect, within a minute:

```
[jobs] migrations up to date
[jobs] retention maintenance every 60 min
```

### The host's Caddy

Compose no longer runs Caddy. Put the block from `deploy/Caddyfile` into the
host's `/etc/caddy/Caddyfile` — substituting your domain and ACME email — and
reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Two lines in it are load-bearing:

- `reverse_proxy 127.0.0.1:3005` — where Compose publishes the app.
- `header_up X-Real-IP {remote_host}` with `header_up -X-Forwarded-For` —
  the rate limiter keys on `X-Real-IP`, so a value the client sent must never
  survive to the app. Set `TRUST_PROXY=true` in `.env` only because this line
  is there.

## 4. Verify

```bash
# TLS 1.3 accepted, 1.2 refused:
openssl s_client -tls1_3 -connect bcnstudent.com:443 </dev/null | grep Protocol
openssl s_client -tls1_2 -connect bcnstudent.com:443 </dev/null   # must fail

# The app answers on loopback, on the host:
curl -sI http://127.0.0.1:3005 | head -1

# …and NOT from anywhere else (run from another machine):
curl -m 5 http://<server-ip>:3005     # must fail to connect
curl -m 5 http://<server-ip>:5432     # must fail to connect

# Security headers present:
curl -sI https://bcnstudent.com | grep -iE "strict-transport|content-security"
```

Then sign in at `https://bcnstudent.com/admin`.

## 5. Email (Resend)

Sign-in links and notices are sent through [Resend](https://resend.com).

1. Resend → Domains → Add `bcnstudent.com`, **region: EU (eu-west-1)**.
2. Add the DNS records Resend shows (SPF, DKIM, and optionally DMARC). Wait
   until all show as verified — unverified domains land in spam or bounce.
3. Create an API key with "sending access" only; put it in `RESEND_API_KEY`.
4. `EMAIL_FROM="BCN Student Concierge <hello@bcnstudent.com>"`.

Test it: open `https://bcnstudent.com/portal/login`, enter the email of a test
case, and redeem the link on your phone.

## 6. Stripe

Dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://bcnstudent.com/api/webhooks/stripe`
- Events: `checkout.session.completed`, `charge.refunded`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`, then
`docker compose up -d` to apply it. For Apple Pay, verify `bcnstudent.com`
under Settings → Payment methods → Apple Pay.

## 7. Telegram alerts (optional)

1. In Telegram, message **@BotFather**, send `/newbot`, and follow the prompts.
   It replies with the bot token (`123456789:AA…`) → `TELEGRAM_BOT_TOKEN`.
2. Open a chat with your new bot and send it any message.
3. Visit `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser; the
   number under `"chat":{"id":…}` → `TELEGRAM_CHAT_ID`.
4. `docker compose up -d`. You get one message per payment and one per
   "Submit for review" — case references and amounts only, never names, since
   Telegram is outside the EU and alerts appear on your lock screen.

Alerts are best-effort: if Telegram is down, nothing fails and the case is in
the dashboard as usual. Setting only one of the two variables, or a malformed
token, stops the server at startup rather than failing silently.

## 8. Updating

```bash
cd /srv/bcnstudent
git pull
docker compose up -d --build
```

Migrations apply automatically at startup, under an advisory lock.

### Moving off the bundled Caddy (one time)

Earlier versions ran Caddy as a third container and kept uploads in a Docker
volume named `bcnstudent_documents`. If you are updating such a server, move
the documents onto the host **before** starting the new compose file —
otherwise the app comes up with an empty `./data` and every stored document
looks lost (it is not: it is still in the old volume).

```bash
cd /srv/bcnstudent
docker compose down

mkdir -p data
docker run --rm -v bcnstudent_documents:/from -v "$PWD/data":/to \
  alpine sh -c 'cp -a /from/. /to/'
sudo chown -R 10001:10001 data

# Install the host proxy, then bring the two containers up.
# Caddy, if it is not already on the host — it is not in Ubuntu's own
# repositories: https://caddyserver.com/docs/install#debian-ubuntu-raspbian
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile   # edit domain + email first
sudo systemctl reload caddy
docker compose up -d --build
```

Check `ls data | wc -l` against the old count before deleting anything. Once
the site is verified, `docker volume rm bcnstudent_documents bcnstudent_caddy_data
bcnstudent_caddy_config` clears what is left behind.

## 9. Backups

`deploy/backup.sh` dumps Postgres and archives `./data` (the encrypted
uploads), keeping 30 days (matching the retention promised in the privacy notice):

```bash
sudo mkdir -p /var/backups/bcnstudent && sudo chown deploy: /var/backups/bcnstudent
crontab -e
# 30 2 * * *  /srv/bcnstudent/deploy/backup.sh >> /var/log/bcnstudent-backup.log 2>&1
```

- Copy the backup directory **off the server** too (e.g. `restic` or `rclone`
  to storage at a different provider). A backup on the same disk does not
  survive losing the server.
- **Never back up `.env` alongside the data.** Personal data in the backups is
  ciphertext only while the master key is kept elsewhere.

### Restore

```bash
docker compose up -d db
docker compose exec -T db pg_restore -U bcn -d bcn --clean --if-exists < db-<stamp>.dump
tar xzf documents-<stamp>.tar.gz -C ./data
sudo chown -R 10001:10001 data      # tar restores the archive's own ownership
docker compose up -d
```

The restored data is readable only with the **same** `DOCUMENT_MASTER_KEY`.
Rehearse this once before launch.

## 10. Day to day

| Task | Command |
|---|---|
| Logs | `docker compose logs -f app` |
| Restart | `docker compose restart app` |
| Database shell | `docker compose exec db psql -U bcn bcn` |
| Status | `docker compose ps` |

Retention runs by itself and logs one `[retention] run ok — purged N, …` line per
run. If those lines stop appearing, deletion has stopped: investigate.
