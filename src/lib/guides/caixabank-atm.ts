/**
 * Paying the Modelo 790 Código 012 at a CaixaBank ATM, without a Spanish card.
 *
 * ⚠️ VERIFY AGAINST A REAL PAYMENT before relying on this. These steps were
 * supplied by the business; the exact on-screen label, the number of digits in
 * the barcode and which page the voucher belongs on have not been confirmed
 * against a live ATM. A wrong step here costs a student their appointment.
 * The wording lives in messages/en/guides.json → "atm" (the other languages
 * are translated from it): correct it there, then re-run the translation.
 */

export interface AtmStep {
  title: string;
  detail: string;
}

/** The "guides" catalogue's raw lookup — next-intl's `t.raw`. */
type RawLookup = (key: string) => unknown;

export function caixabankAtmSteps(raw: RawLookup, feeFormatted: string): AtmStep[] {
  // The raw catalogue text still has its {fee} placeholder; fill it here so the
  // step list stays one array in the catalogue rather than ten loose keys.
  return (raw("atm.steps") as AtmStep[]).map((s) => ({
    title: s.title,
    detail: s.detail.replaceAll("{fee}", feeFormatted),
  }));
}
