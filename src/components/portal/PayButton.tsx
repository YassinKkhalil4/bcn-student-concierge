"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ADDONS, IVA_RATE_BP, ivaCents, formatEur, type AddonId } from "@/lib/pricing";

/**
 * Opens Stripe Checkout for the signed-in student's own file.
 *
 * The package is already chosen. What is chosen here is the optional extras,
 * and the summary shows the whole sum — package, extras, IVA, total — before
 * the student is sent to the card form, because the prices on the site are
 * ex-IVA and the total should never be a surprise at Stripe.
 *
 * Only add-on ids are sent. The server prices them from its own table, so
 * nothing here can change what is charged.
 */
export function PayButton({ packageName, packageCents }: { packageName: string; packageCents: number }) {
  const t = useTranslations("portal.pay");
  const tp = useTranslations("pricing.addons");
  const [selected, setSelected] = useState<ReadonlySet<AddonId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(() => ADDONS.filter((a) => selected.has(a.id)), [selected]);
  const base = packageCents + chosen.reduce((n, a) => n + a.priceCents, 0);
  const iva = ivaCents(base);

  function toggle(id: AddonId) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addons: chosen.map((a) => a.id) }),
      });
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setError(t(res.status === 401 ? "expired" : res.status === 409 ? "paid" : "failed"));
    } catch {
      setError(t("network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <fieldset>
        <legend className="font-sans text-sm font-bold text-ink">{t("addonsTitle")}</legend>
        <p className="prose-body mt-1">{t("addonsHint")}</p>
        <ul className="mt-4 divide-y divide-paper-line border-y border-paper-line">
          {ADDONS.map((addon) => (
            <li key={addon.id}>
              <label className="flex cursor-pointer items-start gap-3.5 py-3.5">
                <input
                  type="checkbox"
                  checked={selected.has(addon.id)}
                  onChange={() => toggle(addon.id)}
                  className="mt-1 h-4 w-4 flex-none accent-accent"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-sans text-sm font-semibold text-ink">
                    {tp(`items.${addon.id}.name`)}
                  </span>
                  <span className="mt-0.5 block font-sans text-xs leading-relaxed text-ink-muted">
                    {tp(`items.${addon.id}.what`)}
                  </span>
                </span>
                <span className="font-sans text-sm font-bold tabular-nums text-ink">
                  +{formatEur(addon.priceCents)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <dl className="mt-5 space-y-1.5 font-sans text-sm text-ink-muted" aria-live="polite">
        <Row label={packageName} value={formatEur(packageCents)} />
        {chosen.map((a) => (
          <Row key={a.id} label={tp(`items.${a.id}.name`)} value={formatEur(a.priceCents)} />
        ))}
        <Row label={t("iva", { rate: IVA_RATE_BP / 100 })} value={formatEur(iva)} />
        <div className="flex items-baseline justify-between gap-4 border-t-2 border-ink pt-2.5 text-ink">
          <dt className="font-bold">{t("total")}</dt>
          <dd className="text-lg font-extrabold tabular-nums">{formatEur(base + iva)}</dd>
        </div>
      </dl>

      <button type="button" onClick={() => void pay()} disabled={busy} className="btn-primary mt-5">
        {busy ? t("opening") : t("button", { total: formatEur(base + iva) })}
      </button>
      {error && (
        <p role="alert" className="enter-alert mt-3 border-l-2 border-accent pl-3 font-sans text-sm font-semibold text-accent-deep">
          {error}
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
