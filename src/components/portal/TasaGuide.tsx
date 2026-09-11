"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Tasa012Summary } from "@/lib/tasa012";
import { caixabankAtmSteps } from "@/lib/guides/caixabank-atm";
import { LocalizedCopyButton } from "@/components/LocalizedCopyButton";

/**
 * Student-facing Modelo 790 Código 012: what to type on the police portal,
 * then how to pay in cash at an ATM. The portal's field labels stay in
 * Spanish, verbatim, because they must match the screen the student sees.
 */
export function TasaGuide({ summary }: { summary: Tasa012Summary }) {
  const t = useTranslations("portal.tasa");
  const tg = useTranslations("guides");
  const locale = useLocale();
  const missingNie = !summary.fields.find((f) => f.label === "N.I.F./N.I.E.")?.value;
  const em = (chunks: ReactNode) => <em className="text-ink">{chunks}</em>;
  const strong = (chunks: ReactNode) => <strong className="text-ink">{chunks}</strong>;

  return (
    <div className="space-y-5">
      {missingNie ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("missingNie")}</p>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>
              {t("open")}{" "}
              <a href={summary.url} target="_blank" rel="noopener noreferrer" className="font-medium text-olive underline">
                sede.policia.gob.es ↗
              </a>
            </li>
            <li>{t("fill")}</li>
            <li>{t.rich("tick", { tramite: summary.tramite, fee: summary.feeFormatted, em, strong })}</li>
            <li>{t.rich("payment", { method: summary.paymentMethod, em, strong })}</li>
            <li>{t("print")}</li>
          </ol>

          <table className="w-full text-sm">
            <caption className="sr-only">{t("caption")}</caption>
            <tbody className="divide-y divide-bone-line">
              {summary.fields.filter((f) => f.value).map((f) => (
                <tr key={f.label}>
                  <th scope="row" lang="es" className="w-2/5 py-2 pr-3 text-left font-normal text-ink-soft">{f.label}</th>
                  <td className="py-2 pr-3 font-mono text-[13px] text-ink">{f.value}</td>
                  <td className="w-16 py-1.5 text-right"><LocalizedCopyButton value={f.value} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {locale !== "es" && <p className="text-xs text-ink-soft">{t("labelsNote")}</p>}
        </>
      )}

      <details className="group rounded-xl border border-olive/30 bg-olive/[0.03]">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-olive">
          {tg("atm.summary")}{" "}
          <span className="font-normal group-open:hidden">▸</span>
          <span className="hidden font-normal group-open:inline">▾</span>
        </summary>
        <ol className="space-y-4 border-t border-olive/20 px-5 py-4">
          {caixabankAtmSteps(tg.raw, summary.feeFormatted).map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-olive text-xs font-semibold text-bone">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{step.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{step.detail}</p>
              </div>
            </li>
          ))}
          <li className="rounded-lg bg-white px-4 py-3 text-xs leading-relaxed text-ink-muted">{tg("atm.fallback")}</li>
        </ol>
      </details>
    </div>
  );
}
