"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** Opens Stripe Checkout for the signed-in student's own file. */
export function PayButton({ label }: { label: string }) {
  const t = useTranslations("portal.pay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setError(t("failed"));
    } catch {
      setError(t("network"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void pay()} disabled={busy} className="btn-primary">
        {busy ? t("opening") : label}
      </button>
      {error && (
        <p role="alert" className="enter-alert mt-3 border-l-2 border-accent pl-3 font-sans text-sm font-semibold text-accent-deep">
          {error}
        </p>
      )}
    </div>
  );
}
