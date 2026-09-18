"use client";

import { useTranslations } from "next-intl";

/**
 * A single GDPR consent control.
 *
 * The checkbox is a controlled input whose parent state initialises to `false`,
 * and there is deliberately no `defaultChecked` path: valid consent under GDPR
 * Art. 4(11) must be a freely given, affirmative act. A pre-ticked box is not
 * consent, so the component offers no way to render one.
 */
export function ConsentBox({
  name,
  checked,
  onChange,
  label,
  body,
  error,
  optional = false,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  body: string;
  error?: string;
  optional?: boolean;
}) {
  const t = useTranslations("intake.consent");
  return (
    <div
      className={[
        "border p-5 transition-colors",
        error
          ? "border-accent border-l-2 bg-accent-tint"
          : checked
            ? "border-paper-edge bg-white"
            : "border-paper-line bg-white",
      ].join(" ")}
    >
      <label className="flex cursor-pointer gap-3.5">
        <input
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${name}-body`}
          className="mt-0.5 h-4 w-4 flex-none accent-accent"
        />
        <span>
          <span className="block font-sans text-sm font-bold tracking-tight text-ink">
            {label}
            {optional && (
              <span className="ml-2 text-xs font-normal text-ink-soft">{t("optional")}</span>
            )}
          </span>
          <span
            id={`${name}-body`}
            className="mt-2 block font-sans text-xs leading-relaxed text-ink-muted"
          >
            {body}
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="field-error ml-8">
          {error}
        </p>
      )}
    </div>
  );
}
