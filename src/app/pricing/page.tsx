import type { Metadata } from "next";
import { TIERS, IVA_RATE } from "@/lib/pricing";
import { PricingCard } from "@/components/PricingCard";
import { Modelo790Notice } from "@/components/Modelo790Notice";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";

export const metadata: Metadata = {
  title: "Services & Pricing",
  description:
    "Three fixed-fee packages for international students arriving in Barcelona: " +
    "administrative baseline, digital soft-landing, and turnkey relocation with housing audit.",
};

const NOT_INCLUDED = [
  {
    item: "Modelo 790 Código 012 state fee",
    note: "Paid by you directly to the Spanish tax agency at a bank. Amount is set by the government and varies by card type.",
  },
  {
    item: "University tuition, deposits and rent",
    note: "We never handle client funds for third parties. All payments go directly from you to the landlord or institution.",
  },
  {
    item: "Legal representation or appeals",
    note: "Outside our scope. If your case needs it, we will say so and recommend a colegiado abogado.",
  },
  {
    item: "Translation or apostille services",
    note: "We identify what needs sworn translation and can refer you to a traductor jurado; their fee is separate.",
  },
];

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-bone-line bg-bone-warm">
        <div className="container-x py-16 sm:py-20">
          <p className="eyebrow">Services & pricing</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
            Fixed fees for a process with no fixed timeline.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">
            Every package is quoted exclusive of IVA and shown with the{" "}
            {Math.round(IVA_RATE * 100)}% total before you pay. Nothing is billed
            hourly, and no package includes government fees.
          </p>
        </div>
      </section>

      <section className="container-x py-16 sm:py-20">
        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <PricingCard key={tier.id} tier={tier} />
          ))}
        </div>
      </section>

      {/* ── Modelo 790 payment mechanics ─────────────────────────────── */}
      <section className="border-y border-bone-line bg-bone-warm py-16 sm:py-20">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="eyebrow">Government fees</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
              The one payment we cannot make for you.
            </h2>
          </div>
          <div className="mt-10 max-w-3xl">
            <Modelo790Notice />
          </div>
        </div>
      </section>

      {/* ── What is not included ─────────────────────────────────────── */}
      <section className="container-x py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">Full transparency</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink">
            What our fee does not cover.
          </h2>
        </div>
        <dl className="mt-10 max-w-3xl divide-y divide-bone-line border-y border-bone-line">
          {NOT_INCLUDED.map((row) => (
            <div key={row.item} className="grid gap-2 py-5 sm:grid-cols-3 sm:gap-6">
              <dt className="font-medium text-ink">{row.item}</dt>
              <dd className="text-sm leading-relaxed text-ink-muted sm:col-span-2">
                {row.note}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 max-w-3xl">
          <LegalDisclaimer variant="prominent" />
        </div>
      </section>
    </>
  );
}
