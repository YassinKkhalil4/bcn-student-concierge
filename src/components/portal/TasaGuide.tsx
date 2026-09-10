"use client";

import type { Tasa012Summary } from "@/lib/tasa012";
import { caixabankAtmSteps, ATM_FALLBACK } from "@/lib/guides/caixabank-atm";
import { CopyButton } from "@/components/CopyButton";

/**
 * Student-facing Modelo 790 Código 012: what to type on the police portal,
 * then how to pay in cash at an ATM. The portal's field labels stay in
 * Spanish, verbatim, because they must match the screen the student sees.
 */
export function TasaGuide({ summary }: { summary: Tasa012Summary }) {
  const missingNie = !summary.fields.find((f) => f.label === "N.I.F./N.I.E.")?.value;

  return (
    <div className="space-y-5">
      {missingNie ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This step needs your NIE, and we do not have it yet. We will tell you as soon as
          you can do it — nothing to do for now.
        </p>
      ) : (
        <>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-muted">
            <li>
              Open the official Policía Nacional form:{" "}
              <a href={summary.url} target="_blank" rel="noopener noreferrer" className="font-medium text-olive underline">
                sede.policia.gob.es ↗
              </a>
            </li>
            <li>Fill in each box exactly as below (leave any other box empty).</li>
            <li>
              Tick only <em className="text-ink">&ldquo;{summary.tramite}&rdquo;</em> — it should show{" "}
              <strong className="text-ink">{summary.feeFormatted}</strong>. If the portal shows a different
              amount, the portal is right: pay what it shows.
            </li>
            <li>
              Under <em>Forma de pago</em>, choose <strong className="text-ink">{summary.paymentMethod}</strong>.
            </li>
            <li>Download the form and print it at 100% scale — never &ldquo;fit to page&rdquo;, or the barcode will not scan.</li>
          </ol>

          <table className="w-full text-sm">
            <caption className="sr-only">What to type on the police portal</caption>
            <tbody className="divide-y divide-bone-line">
              {summary.fields.filter((f) => f.value).map((f) => (
                <tr key={f.label}>
                  <th scope="row" className="w-2/5 py-2 pr-3 text-left font-normal text-ink-soft">{f.label}</th>
                  <td className="py-2 pr-3 font-mono text-[13px] text-ink">{f.value}</td>
                  <td className="w-16 py-1.5 text-right"><CopyButton value={f.value} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <details className="group rounded-xl border border-olive/30 bg-olive/[0.03]">
        <summary className="cursor-pointer list-none px-5 py-3.5 text-sm font-semibold text-olive">
          How to pay at a CaixaBank ATM without a Spanish card{" "}
          <span className="font-normal group-open:hidden">▸</span>
          <span className="hidden font-normal group-open:inline">▾</span>
        </summary>
        <ol className="space-y-4 border-t border-olive/20 px-5 py-4">
          {caixabankAtmSteps(summary.feeFormatted).map((step, i) => (
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
          <li className="rounded-lg bg-white px-4 py-3 text-xs leading-relaxed text-ink-muted">{ATM_FALLBACK}</li>
        </ol>
      </details>
    </div>
  );
}
