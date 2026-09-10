import type { Metadata } from "next";
import { LegalPage, Clause } from "@/components/LegalPage";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { TIERS, priceWithIva, formatEur } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Contractual terms for BCN Student Concierge administrative facilitation services.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Terms of service"
      updated="10 September 2026"
    >
      <LegalDisclaimer variant="prominent" />

      <Clause heading="1. Nature of the service">
        <p>
          We provide administrative facilitation: document preparation from information
          you supply, appointment booking on public systems in your name, and practical
          guidance on settling in Barcelona. We do not provide legal representation or
          binding immigration advice. See our{" "}
          <a href="/legal" className="text-olive underline">
            scope of service
          </a>{" "}
          page, which forms part of these terms.
        </p>
      </Clause>

      <Clause heading="2. Fees and IVA">
        <p>
          Package fees are fixed and quoted exclusive of IVA, with the 21% and the
          gross total displayed before payment:
        </p>
        <ul className="ml-5 list-disc space-y-1.5">
          {TIERS.map((tier) => {
            const p = priceWithIva(tier.basePriceCents);
            return (
              <li key={tier.id}>
                {tier.name} — {formatEur(p.baseCents)} + {formatEur(p.ivaCents)} IVA ={" "}
                <span className="font-medium text-ink">{formatEur(p.totalCents)}</span>
              </li>
            );
          })}
        </ul>
        <p>
          Government fees — including the Modelo 790 Código 012 state fee and card
          issuance costs — are set by the Spanish authorities, paid by you directly,
          and are not included in any package. We never collect fees on the
          government's behalf.
        </p>
      </Clause>

      <Clause heading="3. Right of withdrawal">
        <p>
          As a consumer contracted at distance, you have 14 days to withdraw without
          giving a reason (Real Decreto Legislativo 1/2007, Art. 102). If you ask us to
          begin work within that period and we complete the service, the right of
          withdrawal is lost once performance is complete, and you owe a proportionate
          amount for work already done if you withdraw part-way. We will not start work
          inside the withdrawal period without your express request.
        </p>
      </Clause>

      <Clause heading="4. Your obligations">
        <p>
          You must provide accurate, complete information and genuine documents, review
          every document we prepare before signing it, and attend appointments in
          person with the originals. Information you give us becomes a declaration you
          sign in your own name; we cannot verify originals we have never seen.
        </p>
        <p>
          Supplying falsified documents ends the engagement immediately with no refund,
          and may constitute a criminal offence under Spanish law.
        </p>
      </Clause>

      <Clause heading="5. What we are and are not liable for">
        <p>
          We are liable for our own errors: a form we prepared incorrectly from
          accurate data you supplied, or an appointment we failed to book as agreed. In
          those cases we correct the error and rebook at our cost.
        </p>
        <p>
          We are not liable for decisions of Spanish authorities, appointment
          availability, changes in law or procedure, consequences of inaccurate
          information you supplied, or your failure to attend an appointment. Our total
          liability is limited to the fee you paid us, except where liability cannot be
          limited by law — including death, personal injury, fraud, or gross
          negligence, none of which we attempt to exclude.
        </p>
      </Clause>

      <Clause heading="6. Cancellation and refunds">
        <p>
          Before we begin work: full refund. After preparation has begun but before
          appointments are booked: 50% refund. After appointments are secured: no
          refund, as the substantive value has been delivered. If we cannot deliver the
          service for reasons within our control, you receive a full refund.
        </p>
      </Clause>

      <Clause heading="7. Data protection">
        <p>
          Processing is governed by our{" "}
          <a href="/privacy" className="text-olive underline">
            privacy notice
          </a>
          , including the automatic deletion of identity documents 30 days after
          service completion.
        </p>
      </Clause>

      <Clause heading="8. Governing law">
        <p>
          These terms are governed by Spanish law. Consumer disputes may be brought
          before the courts of the consumer's domicile, and you may use the Spanish
          consumer arbitration system (Sistema Arbitral de Consumo) or the EU Online
          Dispute Resolution platform.
        </p>
      </Clause>
    </LegalPage>
  );
}
