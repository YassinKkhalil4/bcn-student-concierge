import type { InvoiceIssuer } from "@/lib/db/schema";

/**
 * The business issuing the invoices, from the environment:
 *
 *   INVOICE_ISSUER_NAME     legal name (autónomo: full name; SL: razón social)
 *   INVOICE_ISSUER_TAX_ID   NIF
 *   INVOICE_ISSUER_ADDRESS  fiscal address, one line
 *
 * Frozen onto each invoice at issue, so a later move or rename never rewrites
 * an invoice already sent.
 */
export class IssuerNotConfiguredError extends Error {}

export function invoiceIssuer(): InvoiceIssuer {
  const name = process.env.INVOICE_ISSUER_NAME?.trim();
  const taxId = process.env.INVOICE_ISSUER_TAX_ID?.trim();
  const address = process.env.INVOICE_ISSUER_ADDRESS?.trim();
  if (!name || !taxId || !address) {
    // Thrown, not defaulted: an invoice without the issuer's NIF is not a valid
    // factura, and issuing one would consume a number in the sequence.
    throw new IssuerNotConfiguredError(
      "INVOICE_ISSUER_NAME, INVOICE_ISSUER_TAX_ID and INVOICE_ISSUER_ADDRESS must be set",
    );
  }
  return { name, taxId, address };
}

export function issuerConfigured(): boolean {
  try {
    invoiceIssuer();
    return true;
  } catch {
    return false;
  }
}
