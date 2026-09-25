"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

interface FieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Display-uppercase only. The authoritative transform is server-side. */
  uppercase?: boolean;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric" | "tel" | "email";
}

export function Field({
  label,
  name,
  value,
  onChange,
  error,
  hint,
  placeholder,
  required = true,
  uppercase = true,
  type = "text",
  autoComplete,
  maxLength,
  inputMode,
}: FieldProps) {
  const t = useTranslations("intake.field");
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
        {!required && <span className="ml-1.5 text-xs text-ink-soft">{t("optional")}</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") ||
          undefined
        }
        className={uppercase ? "field-input-upper" : "field-input"}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  error?: string;
  hint?: string;
}) {
  const t = useTranslations("intake.field");
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") || undefined
        }
        className="field-input"
      >
        <option value="">{t("select")}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-ink-soft">{hint}</p>}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function FieldGroup({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-display-md text-ink">{title}</legend>
      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {description}
        </p>
      )}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
