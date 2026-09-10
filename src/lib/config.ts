import { secretFromEnv } from "@/lib/auth/hmac";

/**
 * Production configuration check, run once at server start
 * (src/lib/server/jobs.ts).
 *
 * Every missing setting is reported TOGETHER and the process refuses to start.
 * The alternative — booting fine and failing on first use — means discovering
 * a missing invoice issuer when the first client pays, or a missing email key
 * when a student is locked out of their file.
 */
export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  const problems: string[] = [];
  const need = (name: string, why: string) => {
    if (!env[name]?.trim()) problems.push(`${name} — ${why}`);
  };

  need("DATABASE_URL", "case data");
  need("PUBLIC_ORIGIN", "links in emails and Stripe return URLs");
  if (env.PUBLIC_ORIGIN && !env.PUBLIC_ORIGIN.startsWith("https://")) {
    problems.push("PUBLIC_ORIGIN — must be https:// in production");
  }
  const masterKey = Buffer.from(env.DOCUMENT_MASTER_KEY ?? "", "base64");
  if (masterKey.length !== 32) problems.push("DOCUMENT_MASTER_KEY — must decode to 32 bytes");
  if (!secretFromEnv("PORTAL_SESSION_SECRET")) {
    problems.push("PORTAL_SESSION_SECRET — at least 32 bytes, base64");
  }
  need("RESEND_API_KEY", "sign-in links cannot be emailed without it");
  need("EMAIL_FROM", "sender address on a domain verified in Resend");
  need("STRIPE_SECRET_KEY", "checkout");
  need("STRIPE_WEBHOOK_SECRET", "payment confirmation");
  need("INVOICE_ISSUER_NAME", "legal name on every factura");
  need("INVOICE_ISSUER_TAX_ID", "NIF on every factura");
  need("INVOICE_ISSUER_ADDRESS", "fiscal address on every factura");

  if (problems.length) {
    throw new Error(
      `Refusing to start: production configuration is incomplete.\n  - ${problems.join("\n  - ")}\n` +
        "See .env.example and docs/DEPLOY.md.",
    );
  }

  // Optional, but worth saying out loud.
  if (!env.ADMIN_PASSWORD_HASH || !secretFromEnv("ADMIN_SESSION_SECRET")) {
    console.warn("[config] staff dashboard is locked: ADMIN_PASSWORD_HASH / ADMIN_SESSION_SECRET not set");
  }
}
