"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Oldest and youngest ages offered. The schema still validates the result. */
const MAX_AGE = 100;
const MIN_AGE = 14;

const pad = (n: number) => String(n).padStart(2, "0");

function daysIn(month: number, year: number): number {
  // Before a year is chosen, allow 29 February.
  return new Date(Date.UTC(year || 2000, month, 0)).getUTCDate();
}

/** "20/01/2000" → { day: "20", month: "1", year: "2000" }; anything else → blanks. */
function parts(value: string): { day: string; month: string; year: string } {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return m
    ? { day: String(Number(m[1])), month: String(Number(m[2])), year: m[3]! }
    : { day: "", month: "", year: "" };
}

/**
 * A date chosen from three lists — day, month, year — instead of typed. The
 * value handed back is still DD/MM/YYYY, the format the Spanish forms print,
 * so nothing downstream changes. Until all three are chosen the value is empty
 * and the step's validation asks for it.
 */
export function DateSelectField({
  label,
  name,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  const t = useTranslations("intake.date");
  const [picked, setPicked] = useState(() => parts(value));
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => thisYear - MIN_AGE - i);
  const dayCount = picked.month ? daysIn(Number(picked.month), Number(picked.year)) : 31;

  function choose(field: "day" | "month" | "year", next: string) {
    const updated = { ...picked, [field]: next };
    // 31 → February: drop a day the new month does not have, rather than roll it over.
    if (updated.day && updated.month && Number(updated.day) > daysIn(Number(updated.month), Number(updated.year))) {
      updated.day = "";
    }
    setPicked(updated);
    const { day, month, year } = updated;
    onChange(day && month && year ? `${pad(Number(day))}/${pad(Number(month))}/${year}` : "");
  }

  const describedBy = [error ? errorId : null, hint && !error ? hintId : null].filter(Boolean).join(" ") || undefined;
  const select = (field: "day" | "month" | "year", options: { value: string; label: string }[]) => (
    <div>
      <label htmlFor={`${name}-${field}`} className="sr-only">
        {t(field)}
      </label>
      <select
        id={`${name}-${field}`}
        name={`${name}-${field}`}
        value={picked[field]}
        onChange={(e) => choose(field, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="field-input"
      >
        <option value="">{t(field)}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    // id + tabIndex: the error summary's "Date of birth" link lands on the
    // group so a screen reader reads the legend, rather than dropping the
    // reader into an unexplained list of numbers.
    <fieldset id={name} tabIndex={-1} className="min-w-0 border-0 p-0 focus:outline-none">
      <legend className="field-label">{label}</legend>
      {/*
        Proportional, not fixed. The columns were 4.75rem and 6.25rem, which at
        200% browser text is a 368px floor on a 320px phone — the three lists
        could not get narrower than the screen. The ratios keep the month list
        the widest, which is the reason the sizes differed in the first place.
      */}
      <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.5fr)_minmax(0,1fr)] gap-2">
        {select("day", Array.from({ length: dayCount }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })))}
        {select("month", MONTHS.map((m) => ({ value: String(m), label: t(`months.${m}`) })))}
        {select("year", years.map((y) => ({ value: String(y), label: String(y) })))}
      </div>
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
    </fieldset>
  );
}
