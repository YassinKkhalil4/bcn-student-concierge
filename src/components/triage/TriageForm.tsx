"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { countryOptions } from "@/lib/countries";
import { routeForNationality } from "@/lib/forms/field-map";
import { translateIssue } from "@/lib/validation-keys";
import { ErrorSummary, type SummarisedError } from "@/components/ErrorSummary";
import {
  HOUSING_SITUATIONS,
  TRIAGE_DOCUMENT_KINDS,
  daysUntil,
  deadlineFor,
  triageSchema,
} from "@/lib/triage";

type Errors = Record<string, string>;

/**
 * The order the fields appear on screen. The error summary walks this rather
 * than whatever order zod reported its issues in, so working down the list
 * works down the form.
 */
const FIELD_ORDER = [
  "fullName",
  "email",
  "nationality",
  "arrivedOn",
  "housing",
  "notes",
  "gdprTriageConsent",
] as const;

/**
 * The free-triage form.
 *
 * Short on purpose: every field here earns its place by changing the answer.
 * Nationality decides the route, the entry date starts the clock, and how the
 * student is housed decides whether padrón is even possible — which is the
 * question most of them are actually stuck on.
 */
export function TriageForm() {
  const t = useTranslations("triage");
  const tv = useTranslations("validation");
  const locale = useLocale();
  // The Fixer is sold by application: its "Apply for the waitlist" button
  // lands here with ?apply=fixer, and the enquiry says so in the student's
  // own words box, where staff read it. They can edit or delete it.
  const applying = useSearchParams().get("apply") === "fixer";

  const [values, setValues] = useState({
    fullName: "",
    email: "",
    nationality: "",
    arrivedOn: "",
    housing: "",
    notes: applying ? t("fixerApplication") : "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Bumped on every rejected submit, so the summary re-announces each time. */
  const [attempt, setAttempt] = useState(0);

  // Spain is excluded: a Spanish national needs neither route.
  const nationalities = useMemo(() => countryOptions(locale, ["ES"]), [locale]);

  /**
   * A live indication of the window, shown as soon as both inputs exist.
   * Labelled as indicative, never as advice: the authorisation itself can
   * state a different period, which is exactly why we read the document.
   */
  const clock = useMemo(() => {
    if (!values.nationality || !/^\d{4}-\d{2}-\d{2}$/.test(values.arrivedOn)) return null;
    const route = routeForNationality(values.nationality);
    const deadline = deadlineFor(route, values.arrivedOn);
    if (!deadline) return { route, deadline: null, days: null };
    return { route, deadline, days: daysUntil(deadline) };
  }, [values.nationality, values.arrivedOn]);

  /**
   * In rendered order, not in the order zod happened to report them: a summary
   * that jumps around the form is harder to work through than no summary.
   */
  const summary: SummarisedError[] = FIELD_ORDER.filter((key) => errors[key]).map((key) => ({
    id: key,
    label: t(`fields.${key}`),
  }));

  const set = (key: string) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _cleared, ...rest } = e;
      return rest;
    });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const parsed = triageSchema.safeParse({ ...values, gdprTriageConsent: consent });
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        next[path] ??= translateIssue(issue.message, t(`fields.${path}`), tv);
      }
      setErrors(next);
      setAttempt((n) => n + 1);
      return;
    }

    const body = new FormData();
    for (const [key, value] of Object.entries(values)) body.set(key, value);
    body.set("gdprTriageConsent", "true");
    body.set("locale", locale);
    for (const kind of TRIAGE_DOCUMENT_KINDS) {
      const file = files[kind];
      if (file) body.set(kind, file);
    }

    setBusy(true);
    try {
      const response = await fetch("/api/triage", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as {
        ref?: string;
        error?: string;
        issues?: { path: string; message: string }[];
      };
      if (!response.ok) {
        if (data.issues) {
          const next: Errors = {};
          for (const issue of data.issues) {
            next[issue.path] ??= translateIssue(issue.message, t(`fields.${issue.path}`), tv);
          }
          setErrors(next);
          setAttempt((n) => n + 1);
        }
        setSubmitError(data.error ?? t("form.failed"));
        return;
      }
      setRef(data.ref ?? null);
    } catch {
      setSubmitError(t("form.failed"));
    } finally {
      setBusy(false);
    }
  }

  if (ref) {
    return (
      <div className="border border-paper-edge border-t-3 border-t-ink bg-white p-8 sm:p-10">
        <h2 className="text-display-md text-ink">{t("done.title")}</h2>
        <p className="prose-body mt-4">{t("done.body", { ref })}</p>
        <p className="mt-5 border-t border-paper-line pt-5 font-sans text-xs leading-relaxed text-ink-soft">
          {t("done.note")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="border border-paper-edge border-t-3 border-t-accent bg-white p-6 sm:p-8">
      <ErrorSummary title={t("form.errorSummary")} errors={summary} attempt={attempt} />

      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          name="fullName"
          label={t("fields.fullName")}
          value={values.fullName}
          onChange={set("fullName")}
          error={errors.fullName}
          autoComplete="name"
        />
        <TextInput
          name="email"
          type="email"
          label={t("fields.email")}
          value={values.email}
          onChange={set("email")}
          error={errors.email}
          autoComplete="email"
        />

        <SelectInput
          name="nationality"
          label={t("fields.nationality")}
          value={values.nationality}
          onChange={set("nationality")}
          error={errors.nationality}
          placeholder={t("form.choose")}
          options={nationalities}
        />

        <div>
          <label htmlFor="arrivedOn" className="field-label">{t("fields.arrivedOn")}</label>
          <input
            id="arrivedOn"
            name="arrivedOn"
            type="date"
            value={values.arrivedOn}
            onChange={(e) => set("arrivedOn")(e.target.value)}
            className="field-input"
            aria-invalid={errors.arrivedOn ? true : undefined}
            aria-describedby={describedBy("arrivedOn", errors.arrivedOn, true)}
          />
          <p id="arrivedOn-hint" className="field-hint">{t("fields.arrivedOnHint")}</p>
          <FieldError id="arrivedOn-error" message={errors.arrivedOn} />
        </div>
      </div>

      {/*
        The wrapper is always in the DOM, empty until there is something to say.
        A live region that is inserted at the same moment as its content is not
        reliably announced — and this sentence, "you have 11 days left", is the
        entire output of the free check and the reason the page exists.
      */}
      <div aria-live="polite" className="empty:hidden">
        {clock && (
          <p
            className={[
              "mt-5 px-4 py-3 text-sm leading-relaxed",
              clock.days !== null && clock.days < 0 ? "border-l-2 border-accent bg-accent-tint font-medium text-accent-deep" : "bg-paper-dim text-ink-muted",
            ].join(" ")}
          >
            {clock.deadline === null
              ? t("clock.eu")
              : clock.days !== null && clock.days < 0
                ? t("clock.closed", { days: Math.abs(clock.days) })
                : t("clock.open", { days: clock.days ?? 0, date: clock.deadline })}
          </p>
        )}
      </div>

      <div className="mt-5">
        <SelectInput
          name="housing"
          label={t("fields.housing")}
          value={values.housing}
          onChange={set("housing")}
          error={errors.housing}
          placeholder={t("form.choose")}
          options={HOUSING_SITUATIONS.map((h) => ({ value: h, label: t(`housing.${h}`) }))}
        />
      </div>

      <div className="mt-5">
        <label htmlFor="notes" className="field-label">
          {t("fields.notes")}
          <span className="ml-1.5 text-xs font-normal text-ink-soft">{t("form.optional")}</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          value={values.notes}
          onChange={(e) => set("notes")(e.target.value)}
          className="field-input"
          maxLength={2000}
          aria-invalid={errors.notes ? true : undefined}
          aria-describedby={describedBy("notes", errors.notes, false)}
        />
        <FieldError id="notes-error" message={errors.notes} />
      </div>

      <fieldset className="mt-7">
        <legend className="field-label">{t("uploads.title")}</legend>
        <p className="field-hint">{t("uploads.note")}</p>
        <div className="mt-4 space-y-3">
          {TRIAGE_DOCUMENT_KINDS.map((kind) => (
            <div key={kind} className="border border-paper-line bg-paper px-4 py-3.5">
              <label htmlFor={kind} className="field-label">
                {t(`uploads.${kind}`)}
              </label>
              <input
                id={kind}
                name={kind}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFiles((f) => ({ ...f, [kind]: e.target.files?.[0] ?? null }))}
                className="mt-2 block w-full text-sm text-ink-muted file:mr-3 file:border-0 file:bg-paper-dim file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <label className="mt-7 flex gap-3 text-sm leading-relaxed text-ink-muted">
        <input
          id="gdprTriageConsent"
          type="checkbox"
          checked={consent}
          aria-invalid={errors.gdprTriageConsent ? true : undefined}
          aria-describedby={errors.gdprTriageConsent ? "gdprTriageConsent-error" : undefined}
          onChange={(e) => {
            setConsent(e.target.checked);
            setErrors((err) => {
              const { gdprTriageConsent: _c, ...rest } = err;
              return rest;
            });
          }}
          className="mt-1 h-4 w-4 flex-none accent-accent"
        />
        <span>{t("form.consent")}</span>
      </label>
      <FieldError id="gdprTriageConsent-error" message={errors.gdprTriageConsent} />

      <button type="submit" disabled={busy} className="btn-primary mt-7 w-full">
        {busy ? t("form.sending") : t("form.submit")}
      </button>
      <p className="mt-4 text-center font-sans text-xs text-ink-soft">{t("form.freeNote")}</p>

      {submitError && (
        <p role="alert" className="enter-alert mt-4 border-l-2 border-accent bg-accent-tint px-4 py-3 text-sm font-medium text-accent-deep">
          {submitError}
        </p>
      )}
    </form>
  );
}

/**
 * No `role="alert"`. Six of these used to announce simultaneously the moment a
 * submit was rejected; ErrorSummary is the one announcement now, and these are
 * what it points at.
 */
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      {message}
    </p>
  );
}

/** The hint and the error a control points at, whichever of them exist. */
function describedBy(name: string, error: string | undefined, hint: boolean): string | undefined {
  return [hint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ") || undefined;
}

function SelectInput({
  name,
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">{label}</label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

function TextInput({
  name,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: "text" | "email";
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="field-label">{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}
