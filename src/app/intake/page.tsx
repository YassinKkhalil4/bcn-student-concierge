import type { Metadata } from "next";
import { IntakeWizard } from "@/components/intake/IntakeWizard";

export const metadata: Metadata = {
  title: "Secure Client Intake",
  description:
    "Encrypted intake questionnaire and document portal for BCN Student Concierge clients.",
  // The intake portal must never appear in search results or be archived:
  // it is a form that collects passport data.
  robots: { index: false, follow: false, nocache: true },
};

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="container-x py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">Secure intake</p>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your file starts here.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-muted">
          Six short steps. Everything you enter is transmitted over TLS and stored
          encrypted; uploaded identity documents are encrypted individually with
          their own AES-256 key.
        </p>
      </div>

      <div className="mt-12">
        {/* The tier from the query string is untrusted input. It is validated
            against the tier table inside the wizard, and again server-side at
            checkout, where the price is read from the table rather than the URL. */}
        <IntakeWizard initialTier={params.tier ?? "soft-landing"} />
      </div>
    </div>
  );
}
