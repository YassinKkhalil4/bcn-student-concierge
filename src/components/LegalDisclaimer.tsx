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

  if (variant === "footer") {
    return (
      <p className="max-w-4xl text-xs leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink-muted">{t("footerLabel")} </span>
        {body}
      </p>
    );
  }

  if (variant === "prominent") {
    return (
      <aside role="note" className="rounded-xl border border-terracotta/25 bg-terracotta/[0.04] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-terracotta">{t("prominentLabel")}</p>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-muted">{body}</p>
      </aside>
    );
  }

  return <p className="text-sm leading-relaxed text-ink-muted">{body}</p>;
}
