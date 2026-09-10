/**
 * Paying the Modelo 790 Código 012 at a CaixaBank ATM, without a Spanish card.
 *
 * ⚠️ VERIFY AGAINST A REAL PAYMENT before relying on this. These steps were
 * supplied by the business; the exact on-screen label, the number of digits in
 * the barcode and which page the voucher belongs on have not been confirmed
 * against a live ATM. A wrong step here costs a student their appointment.
 * This file is the single place to correct them.
 */

export interface AtmStep {
  title: string;
  detail: string;
}

export function caixabankAtmSteps(feeFormatted: string): AtmStep[] {
  return [
    {
      title: "Go to a CaixaBank ATM",
      detail: "You do not need a CaixaBank account or any Spanish card. Take your printed Modelo 790 and the exact amount in cash.",
    },
    {
      title: "Select ‘Pagar impuestos y tasas’",
      detail: "Choose it on the start screen, without inserting a card.",
    },
    {
      title: "Scan the 13-digit barcode",
      detail: "Hold the barcode on your printed form to the ATM’s reader. The amount appears on screen: check it says " + feeFormatted + ".",
    },
    {
      title: "Insert the exact cash",
      detail: "Pay exactly " + feeFormatted + ".",
    },
    {
      title: "Staple the voucher to page 3",
      detail: "Collect the printed voucher: it is your proof of payment. Staple it to page 3 of the form and bring both to your appointment.",
    },
  ];
}

export const ATM_FALLBACK =
  "If the ATM will not read the barcode, pay at the counter inside any CaixaBank, BBVA or Santander branch during opening hours. Some branches take tax payments only in the morning.";
