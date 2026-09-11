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

export function documentsAlertText(ref: string): string {
  return `📄 Docs Uploaded: Ref #${ref}\nReady for review.`;
}

export async function notifyPaymentReceived(p: { ref: string; totalCents: number; packageName: string }): Promise<void> {
  await sendTelegram(paymentAlertText(p));
}

export async function notifyDocumentsSubmitted(ref: string): Promise<void> {
  await sendTelegram(documentsAlertText(ref));
}
