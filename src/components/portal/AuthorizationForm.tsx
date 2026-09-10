"use client";

import { useState } from "react";
import { Field } from "@/components/intake/Field";

type Relation = "owner" | "tenant" | "usufruct";
type Errors = Record<string, string>;

/**
 * Details of the person who authorises the student — used ONCE to fill
 * Barcelona's official form, then discarded. Nothing typed here is stored.
 */
export function AuthorizationForm() {
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
          error?: string;
          issues?: { path: string; message: string }[];
        };
        const mapped: Errors = {};
        for (const issue of json.issues ?? []) mapped[issue.path] ??= issue.message;
        setErrors(mapped);
        setMessage(json.error ?? "Could not generate the form.");
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
      setMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-bone-line bg-bone-warm/40 p-5">
      <h4 className="text-sm font-semibold text-ink">1. Generate the authorisation</h4>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        The person who signs is whoever holds the flat: the owner, or the main tenant
        whose name is on the lease. We fill in Barcelona&rsquo;s official form with your
        details and theirs. We do not keep what you type here.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Their full name" name="signerName" value={values.signerName}
          onChange={set("signerName")} error={errors.signerName}
          hint="Exactly as on their ID." />
        <Field label="Their DNI, NIE or passport number" name="signerId" value={values.signerId}
          onChange={set("signerId")} error={errors.signerId} maxLength={20} />
      </div>

      <fieldset className="mt-5">
        <legend className="field-label">They are…</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {([
            ["owner", "The owner of the flat"],
            ["tenant", "The main tenant (on the lease)"],
            ["usufruct", "The usufruct holder"],
          ] as const).map(([value, label]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${relation === value ? "border-olive bg-white" : "border-bone-line bg-white/60"}`}>
              <input type="radio" name="relation" value={value} checked={relation === value}
                onChange={() => setRelation(value)} className="mt-0.5" />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.relation && <p role="alert" className="field-error">{errors.relation}</p>}
      </fieldset>

      {relation === "tenant" && (
        <div className="mt-5 rounded-lg border border-bone-line bg-white p-4">
          <p className="text-xs leading-relaxed text-ink-muted">
            When the main tenant signs, the form also asks for the owner&rsquo;s details.
            You will find them on the lease.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Owner's name (person or company)" name="ownerName" value={values.ownerName}
              onChange={set("ownerName")} error={errors.ownerName} />
            <Field label="Owner's NIF" name="ownerTaxId" value={values.ownerTaxId}
              onChange={set("ownerTaxId")} error={errors.ownerTaxId} maxLength={12} />
          </div>
        </div>
      )}

      <label className="mt-5 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={forCompany} onChange={(e) => setForCompany(e.target.checked)} />
        They sign on behalf of a company (for example a coliving operator)
      </label>
      {forCompany && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Company name" name="companyName" value={values.companyName}
            onChange={set("companyName")} error={errors.companyName} />
          <Field label="Company NIF" name="companyTaxId" value={values.companyTaxId}
            onChange={set("companyTaxId")} error={errors.companyTaxId} maxLength={12} />
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-ink-muted">
          Optional: cadastral reference
        </summary>
        <div className="mt-3 max-w-sm">
          <Field label="Cadastral reference" name="cadastralRef" required={false}
            value={values.cadastralRef} onChange={set("cadastralRef")} error={errors.cadastralRef}
            hint="20 letters and digits, on the property tax (IBI) receipt. Leave blank if unknown."
            maxLength={24} />
        </div>
      </details>

      <button type="button" onClick={() => void generate()} disabled={status === "busy"}
        className="btn-primary mt-6">
        {status === "busy" ? "Preparing the form…" : "Download the pre-filled form"}
      </button>
      {status === "done" && (
        <p role="status" className="mt-3 text-sm text-olive">
          ✓ Downloaded. Now print it and follow step 2.
        </p>
      )}
      {message && status === "error" && (
        <p role="alert" className="mt-3 text-sm text-terracotta">{message}</p>
      )}
    </div>
  );
}
