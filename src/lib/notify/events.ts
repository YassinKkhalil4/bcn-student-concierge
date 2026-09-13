import { sendTelegram } from "./telegram";

/**
 * Staff alerts for case events. Each takes the case REFERENCE and amounts —
 * never personal data — and is called exactly once per event by its caller
 * (the invoice is created once per payment; submission transitions once).
 */

const EUR = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });

export function paymentAlertText(p: { ref: string; totalCents: number; packageName: string }): string {
  return `🔔 New Client: Ref #${p.ref} (${EUR.format(p.totalCents / 100)} Paid)\n${p.packageName}`;
}

/**
 * Triage is time-critical and unpaid: the alert leads with how long the student
 * has left, because that — not the enquiry itself — decides what staff do next.
 * Like every other alert here it carries no personal data, only the reference.
 */
export function triageAlertText(p: {
  ref: string;
  route: string;
  daysLeft: number | null;
  documents: number;
}): string {
  const clock =
    p.daysLeft === null
      ? "EU route — no one-month clock"
      : p.daysLeft < 0
        ? `⚠️ window closed ${Math.abs(p.daysLeft)}d ago`
        : `${p.daysLeft}d left`;
  return `🩺 Triage: Ref #${p.ref}\n${p.route === "eu" ? "EU/EEA/CH" : "Non-EU"} · ${clock} · ${p.documents}/3 docs`;
}

export function documentsAlertText(ref: string): string {
  return `📄 Docs Uploaded: Ref #${ref}\nReady for review.`;
}

export async function notifyPaymentReceived(p: { ref: string; totalCents: number; packageName: string }): Promise<void> {
  await sendTelegram(paymentAlertText(p));
}

export async function notifyDocumentsSubmitted(ref: string): Promise<void> {
  await sendTelegram(documentsAlertText(ref));
}

export async function notifyTriageReceived(p: {
  ref: string;
  route: string;
  daysLeft: number | null;
  documents: number;
}): Promise<void> {
  await sendTelegram(triageAlertText(p));
}
