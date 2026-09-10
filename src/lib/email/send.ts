/**
 * Transactional email via Resend's HTTP API (plain fetch — no SDK needed).
 *
 * Configuration: RESEND_API_KEY and EMAIL_FROM (an address on a domain verified
 * in Resend, e.g. "BCN Student Concierge <hello@bcnstudent.com>"). Create the
 * domain in Resend's EU region (eu-west-1) so mail is sent from the EU.
 *
 * Development without a key: messages are printed to the server console so the
 * sign-in flow can be tested locally. Production without a key is an error —
 * never a console fallback, because a printed sign-in link in production logs
 * is a working credential in the logs.
 */

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export class EmailNotConfiguredError extends Error {}

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new EmailNotConfiguredError("RESEND_API_KEY and EMAIL_FROM must be set");
    }
    console.info(
      `\n[email:dev] To: ${email.to}\n[email:dev] Subject: ${email.subject}\n${email.text}\n`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    // Status only: the response body can echo the recipient address.
    throw new Error(`Resend rejected the email (HTTP ${response.status})`);
  }
}

/** Escape user-influenced text for interpolation into an HTML email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
