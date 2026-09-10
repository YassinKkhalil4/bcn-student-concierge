# syntax=docker/dockerfile:1
# Production image for BCN Student Concierge. Built by docker-compose.yml.

# ── 1. Dependencies ─────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ── 2. Build ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No secrets are needed or present at build time (.dockerignore excludes every
# .env file); all configuration is read at runtime from the container env.
RUN npm run build

# ── 3. Runtime ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Unprivileged user. The app never needs root, and a compromise of the Node
# process should not hand an attacker the container.
RUN addgroup -S app && adduser -S -G app app \
 && mkdir -p /data /app/templates/forms \
 && chown app:app /data

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
# Applied automatically at startup (MIGRATE_ON_START).
COPY --from=build --chown=app:app /app/drizzle ./drizzle
# Unicode fonts for generated PDFs (invoices, authorisation, appointment sheet).
COPY --from=build --chown=app:app /app/assets ./assets

USER app
EXPOSE 3000
CMD ["node", "server.js"]
