"use client";

import type { Tasa012Summary } from "@/lib/tasa012";
import { CopyButton } from "./CopyButton";

/**
 * Modelo 790 Código 012 panel.
 *
 * The form cannot be generated here — the Policía Nacional portal issues it
 * with a unique barcode. So this panel gives staff exactly what the student
 * must type, field by field, plus a ready-to-send message.
 */
export function Tasa012Helper({ summary }: { summary: Tasa012Summary }) {
  const blocked = summary.warnings.length > 0;

  return (
    <div className="space-y-4">
      {blocked && (
        <div role="alert" className="rounded-lg border border-terracotta/30 bg-terracotta/5 px-4 py-3">
          <p className="text-sm font-semibold text-terracotta">Resolve before sending</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-ink-muted">
            {summary.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Fee">
          <span className="text-lg font-semibold tabular-nums">{summary.feeFormatted}</span>
        </Stat>
        <Stat label="Route">{summary.formId}</Stat>
        <Stat label="Forma de pago">
          <span className="font-semibold text-olive">{summary.paymentMethod}</span>
        </Stat>
      </div>

      <div className="rounded-lg bg-bone-warm px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
              Trámite to tick
            </p>
            <p className="mt-1 text-sm text-ink">{summary.tramite}</p>
          </div>
          <CopyButton value={summary.tramite} />
        </div>
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">Values to enter on the Tasa 012 portal</caption>
        <tbody className="divide-y divide-bone-line">
          {summary.fields.map((f) => (
            <tr key={f.label} className="align-top">
              <th scope="row" className="w-2/5 py-2 pr-3 text-left font-normal text-ink-soft">
                {f.label}
                {f.required && <span className="text-terracotta"> *</span>}
              </th>
              <td className="py-2 pr-3 font-mono text-[13px] text-ink">
                {f.value ||
                  (f.required ? (
                    <span className="font-sans font-medium text-terracotta">Missing — required</span>
                  ) : (
                    <span className="font-sans text-ink-soft">leave blank</span>
                  ))}
                {f.review && <p className="mt-1 font-sans text-xs text-amber-800">⚠ {f.review}</p>}
              </td>
              <td className="w-16 py-1.5 text-right">
                {f.value && <CopyButton value={f.value} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-xs leading-relaxed text-ink-soft">
        The fee shown is the configured amount. The portal displays the live amount on
        the selected trámite and is authoritative — update{" "}
        <code className="rounded bg-bone-warm px-1">src/lib/tasa012.ts</code> if they differ.
      </p>

      <div className="flex flex-wrap items-center gap-2 border-t border-bone-line pt-4">
        <CopyButton
          value={summary.studentMessage}
          label="Copy instructions for student"
          className="!bg-olive !px-3 !py-2 !text-bone hover:!bg-olive-deep"
        />
        <a
          href={summary.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-bone-line px-3 py-2 text-xs font-medium text-ink hover:bg-bone-warm"
        >
          Open official portal ↗
        </a>
      </div>

      <details className="rounded-lg border border-bone-line">
        <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-ink-muted">
          Preview message
        </summary>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap border-t border-bone-line px-4 py-3 text-xs leading-relaxed text-ink">
          {summary.studentMessage}
        </pre>
      </details>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-bone-line px-3 py-2">
      <p className="text-xs text-ink-soft">{label}</p>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}
