/**
 * Modelo 790 Código 012 payment guidance.
 *
 * This box exists because it is the single most common point of failure on the
 * day of the appointment: the form MUST arrive at the police station already
 * stamped as paid, and — for a student with no Spanish digital certificate —
 * the only route to that stamp is a physical bank. Students who assume they can
 * pay online arrive with an unpaid form and lose the appointment.
 */

const BANKS = ["CaixaBank", "BBVA", "Banco Santander", "Banco Sabadell"];

const STEPS = [
  "We generate your Modelo 790 Código 012 configured for cash payment (“en efectivo”), carrying the unique barcode the bank scanner reads.",
  "Print it in colour, single-sided, at 100% scale. Do not resize it — a rescaled barcode will not scan, and the form will be refused.",
  "Take the printout to a Spanish bank branch or an ATM with a barcode scanner. Present all copies; the teller stamps them.",
  "Keep the stamped copy marked “Ejemplar para el interesado”. Carry it to your police appointment alongside your EX-17 or EX-18 — an unstamped form ends the appointment.",
];

export function Modelo790Notice() {
  return (
    <div className="rounded-2xl border border-bone-line bg-white p-7">
      <h3 className="font-display text-xl font-semibold text-ink">
        Modelo 790 Código 012 — paid in cash, at a bank counter
      </h3>

      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        The state fee for your residency card is not part of our fee and cannot be
        paid by card on our site. Spanish tax agency rules route this form through
        a barcode read at a physical bank: online settlement requires a Spanish
        digital certificate or a Spanish bank's own online banking, neither of
        which a newly-arrived student has.
      </p>

      <ol className="mt-6 space-y-4">
        {STEPS.map((step, i) => (
          <li key={step} className="flex gap-4">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-olive text-[11px] font-semibold text-bone">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-ink-muted">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 rounded-lg bg-bone-warm px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink">
          Branches that accept this payment
        </p>
        <p className="mt-2 text-sm text-ink-muted">{BANKS.join(" · ")}</p>
        <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">
          Not every branch accepts tax payments from non-customers, and some accept
          them only during morning hours. We confirm a specific nearby branch and
          its counter hours with your appointment itinerary.
        </p>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-ink-soft">
        The fee amount is set by the Spanish government and changes periodically;
        the figure printed on your form at the time of generation is the one that
        applies. We never collect this fee on the government's behalf.
      </p>
    </div>
  );
}
