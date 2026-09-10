import type { Metadata } from "next";
import Link from "next/link";
import { Modelo790Notice } from "@/components/Modelo790Notice";

export const metadata: Metadata = {
  title: "Intake complete",
  robots: { index: false, follow: false },
};

const NEXT_STEPS = [
  {
    title: "We verify your file (within 1 business day)",
    body: "Your uploads are checked against the data you entered. If anything is inconsistent — a surname that differs from the passport, an unreadable scan — we email you before anything is filed.",
  },
  {
    title: "Forms generated and sent for review",
    body: "We prepare your EX-17 or EX-18 and your Modelo 790 Código 012, and send both as print-ready PDFs. Review them carefully: you are the applicant, and the declaration is yours.",
  },
  {
    title: "Appointments secured",
    body: "We monitor the cita previa system and book your Padrón and police appointments, then send a dated itinerary with the address, documents to carry, and what will be asked.",
  },
];

export default function CompletePage() {
  return (
    <div className="container-x py-16 sm:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Payment received</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your file is open.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          A confirmation and invoice are on their way to the email address you gave.
          Here is exactly what happens next — and the one payment you will need to
          make yourself.
        </p>
      </div>

      <ol className="mt-12 max-w-3xl space-y-7">
        {NEXT_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-5">
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-olive text-sm font-semibold text-bone">
              {i + 1}
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-ink">
                {step.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-14 max-w-3xl">
        <Modelo790Notice />
      </div>

      <div className="mt-12">
        <Link href="/" className="btn-secondary">
          Return to homepage
        </Link>
      </div>
    </div>
  );
}
