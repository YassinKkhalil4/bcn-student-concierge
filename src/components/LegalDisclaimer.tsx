import { useTranslations } from "next-intl";

/**
 * Anti-intrusismo disclaimer.
 *
 * Spain reserves legal representation and immigration advice to colegiado
 * abogados and registered gestores. A facilitation service must state its
 * limits prominently and consistently — the risk is not a single missing
 * paragraph but a pattern of language implying representation. Every variant
 * carries the same three claims: independence, no representation, no legal
 * advice. The text lives in messages/<locale>/common.json → disclaimer.body.
 */

type Variant = "footer" | "inline" | "prominent";

export function LegalDisclaimer({ variant = "inline" }: { variant?: Variant }) {
  const t = useTranslations("common.disclaimer");
  const body = t("body");

  // The footer is the site's dark field, so this variant is written for navy.
  if (variant === "footer") {
    return (
      <p className="max-w-4xl font-sans text-xs leading-relaxed text-onink-soft">
        <span className="font-bold uppercase tracking-[0.1em] text-onink-muted">{t("footerLabel")} </span>
        {body}
      </p>
    );
  }

  // Squared plate with a crimson cap rule. This is the only place on a paper
  // page where the accent is allowed to frame a whole block, because it is the
  // one block a reader must not skim past.
  if (variant === "prominent") {
    return (
      <aside role="note" className="border border-paper-edge border-t-3 border-t-accent bg-white p-6 sm:p-7">
        <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-accent-deep">
          {t("prominentLabel")}
        </p>
        <p className="prose-body mt-4">{body}</p>
      </aside>
    );
  }

  return <p className="prose-body">{body}</p>;
}
