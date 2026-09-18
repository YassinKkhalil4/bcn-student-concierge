"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Field } from "@/components/intake/Field";
import { translateIssue } from "@/lib/validation-keys";

type Relation = "owner" | "tenant" | "usufruct";
type Errors = Record<string, string>;

/**
 * Details of the person who authorises the student — used ONCE to fill
 * Barcelona's official form, then discarded. Nothing typed here is stored.
 */
export function AuthorizationForm() {
  const t = useTranslations("portal.authorization");
  const tv = useTranslations("validation");
  const [values, setValues] = useState({
    signerName: "",
    signerId: "",
    ownerName: "",
    ownerTaxId: "",
    companyName: "",
    companyTaxId: "",
    cadastralRef: "",
  });
  const [relation, setRelation] = useState<Relation | "">("");
  const [forCompany, setForCompany] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  /** Label, hint and (translated) error for one of the signer's fields. */
  const field = (name: keyof typeof values) => {
    const label = t(`fields.${name}.label`);
    return {
      name,
      label,
      hint: t.has(`fields.${name}.hint`) ? t(`fields.${name}.hint`) : undefined,
      value: values[name],
      onChange: set(name),
      error: errors[name] ? translateIssue(errors[name], label, tv) : undefined,
    };
  };

  const set = (key: keyof typeof values) => (v: string) => {
    setValues((s) => ({ ...s, [key]: v }));
    setErrors((e) => {
      const { [key]: _gone, ...rest } = e;
      return rest;
    });
  };

  async function generate() {
    setStatus("busy");
    setMessage(null);
    setErrors({});
    try {
      const res = await fetch("/api/portal/padron/authorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signerName: values.signerName,
          signerId: values.signerId,
          relation: relation || undefined,
          ownerName: relation === "tenant" ? values.ownerName : undefined,
          ownerTaxId: relation === "tenant" ? values.ownerTaxId : undefined,
          companyName: forCompany ? values.companyName : undefined,
          companyTaxId: forCompany ? values.companyTaxId : undefined,
          cadastralRef: values.cadastralRef || undefined,
        }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          code?: "notBarcelona" | "unprintable";
          params?: Record<string, string>;
          issues?: { path: string; message: string }[];
        };
        const mapped: Errors = {};
        for (const issue of json.issues ?? []) mapped[issue.path] ??= issue.message;
        setErrors(mapped);
        setMessage(
          json.issues
            ? t("checkFields")
            : json.code
              ? t(json.code, json.params ?? {})
              : res.status === 503
                ? t("unavailable")
                : t("failed"),
        );
        setStatus("error");
        return;
      }

      const blob = await res.blob();
      const name =
        /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ??
    "Autoritzacio-padro.pdf";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("done");
    } catch {
      setMessage(t("network"));
      setStatus("error");
    }
  }

  return (
    <div className="border border-paper-line bg-paper-dim p-5">
      <h4 className="text-sm font-semibold text-ink">{t("title")}</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{t("intro")}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field {...field("signerName")} />
        <Field {...field("signerId")} maxLength={20} />
      </div>

      <fieldset className="mt-5">
        <legend className="field-label">{t("relationLegend")}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {(["owner", "tenant", "usufruct"] as const).map((value) => (
            <label key={value} className={`flex cursor-pointer items-start gap-2 border p-3 text-sm ${relation === value ? "border-ink bg-white" : "border-paper-line bg-white/60"}`}>
              <input type="radio" name="relation" value={value} checked={relation === value}
                onChange={() => setRelation(value)} className="mt-0.5" />
              <span>{t(`relations.${value}`)}</span>
            </label>
          ))}
        </div>
        {errors.relation && (
          <p role="alert" className="field-error">
            {translateIssue(errors.relation, t("relationLegend"), tv)}
          </p>
        )}
      </fieldset>

      {relation === "tenant" && (
        <div className="mt-5 border border-paper-line bg-white p-4">
          <p className="text-xs leading-relaxed text-ink-muted">{t("tenantNote")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field {...field("ownerName")} />
            <Field {...field("ownerTaxId")} maxLength={12} />
          </div>
        </div>
      )}

      <label className="mt-5 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={forCompany} onChange={(e) => setForCompany(e.target.checked)} />
        {t("forCompany")}
      </label>
      {forCompany && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field {...field("companyName")} />
          <Field {...field("companyTaxId")} maxLength={12} />
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-ink-muted">
          {t("cadastralToggle")}
        </summary>
        <div className="mt-3 max-w-sm">
          <Field {...field("cadastralRef")} required={false} maxLength={24} />
        </div>
      </details>

      <button type="button" onClick={() => void generate()} disabled={status === "busy"}
        className="btn-primary mt-6">
        {status === "busy" ? t("preparing") : t("download")}
      </button>
      {status === "done" && (
        <p role="status" className="mt-3 text-sm font-medium text-ink">
          {t("done")}
        </p>
      )}
      {message && status === "error" && (
        <p role="alert" className="mt-3 border-l-2 border-accent pl-3 font-sans text-sm font-semibold text-accent-deep">{message}</p>
      )}
    </div>
  );
}
