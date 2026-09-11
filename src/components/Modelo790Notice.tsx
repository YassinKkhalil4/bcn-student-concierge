import { useTranslations } from "next-intl";

/**
 * Modelo 790 Código 012 payment guidance.
 *
 * The single most common point of failure on appointment day: the form MUST
 * arrive at the police station already stamped as paid, and — for a student
 * with no Spanish digital certificate — the only route to that stamp is a
 * physical bank.
 */

const BANKS = ["CaixaBank", "BBVA", "Banco Santander", "Banco Sabadell"];

export function Modelo790Notice() {
  const t = useTranslations("common.modelo790");
  const steps = t.raw("steps") as string[];
  return (
    <div className="rounded-2xl border border-bone-line bg-white p-7">
      <h3 className="font-display text-xl font-semibold text-ink">{t("title")}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{t("intro")}</p>
      <ol className="mt-6 space-y-4">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-4">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-olive text-[11px] font-semibold text-bone">
              {i + 1}
            </span>
            <span className="text-sm leading-relaxed text-ink-muted">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-lg bg-bone-warm px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink">{t("branchesTitle")}</p>
        <p className="mt-2 text-sm text-ink-muted">{BANKS.join(" · ")}</p>
        <p className="mt-2.5 text-xs leading-relaxed text-ink-soft">{t("branchesNote")}</p>
      </div>
      <p className="mt-5 text-xs leading-relaxed text-ink-soft">{t("footnote")}</p>
    </div>
  );
}
