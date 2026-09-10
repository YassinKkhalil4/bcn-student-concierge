/**
 * Anti-intrusismo disclaimer.
 *
 * Spain reserves legal representation and immigration advice to colegiado
 * abogados and registered gestores. A facilitation service must state its
 * limits prominently and consistently — the risk is not a single missing
 * paragraph but a pattern of language implying representation. Every variant
 * below carries the same three claims: independence, no representation, no
 * legal advice.
 */

type Variant = "footer" | "inline" | "prominent";

const BODY =
  "BCN Student Concierge is an independent administrative facilitation and " +
  "appointment-booking service. We are not a law firm and not a registered " +
  "gestoría. We do not provide legal representation, we do not act as your " +
  "legal representative before any Spanish authority, and nothing we provide " +
  "constitutes binding legal or immigration advice. All applications are " +
  "submitted by you, in your own name. Decisions on residency, registration " +
  "and documentation rest solely with the competent Spanish authorities, and " +
  "no outcome is guaranteed. For legal advice on your immigration status, " +
  "consult a colegiado abogado.";

export function LegalDisclaimer({ variant = "inline" }: { variant?: Variant }) {
  if (variant === "footer") {
    return (
      <p className="max-w-4xl text-xs leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink-muted">Scope of service. </span>
        {BODY}
      </p>
    );
  }

  if (variant === "prominent") {
    return (
      <aside
        role="note"
        className="rounded-xl border border-terracotta/25 bg-terracotta/[0.04] p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">
          Important — scope of service
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{BODY}</p>
      </aside>
    );
  }

  return <p className="text-sm leading-relaxed text-ink-muted">{BODY}</p>;
}
