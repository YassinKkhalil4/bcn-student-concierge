"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { GENDERS, MARITAL_STATUSES } from "@/lib/schema";
import { Field, SelectField, FieldGroup } from "./Field";
import { ConsentBox } from "./ConsentBox";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import { countryOptions } from "@/lib/countries";
import { translateIssue } from "@/lib/validation-keys";
import {
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  CONSENT_ITEMS,
  type Values,
  type Errors,
} from "./constants";

export interface StepProps {
  values: Values;
  errors: Errors;
  set: (key: string) => (value: string) => void;
}

/**
 * Everything a field needs from the catalogue: its label, its hint, and its
 * error turned from a schema key into a sentence that names the field.
 */
function useFieldText({ values, errors, set }: StepProps) {
  const t = useTranslations("intake.fields");
  const tv = useTranslations("validation");
  return (name: string) => {
    const label = t(`${name}.label`);
    const message = errors[name];
    return {
      name,
      label,
      hint: t.has(`${name}.hint`) ? t(`${name}.hint`) : undefined,
      value: values[name] ?? "",
      onChange: set(name),
      error: message ? translateIssue(message, label, tv) : undefined,
    };
  };
}

export function IdentityStep(props: StepProps) {
  const t = useTranslations("intake");
  const locale = useLocale();
  const f = useFieldText(props);
  // Names in the student's language; the codes are what get stored. Spain is
  // not offered as a nationality: Spanish citizens need neither form.
  const birthCountries = useMemo(() => countryOptions(locale), [locale]);
  const nationalities = useMemo(() => countryOptions(locale, ["ES"]), [locale]);
  // The Spanish word is what the form prints; Spanish readers need no gloss.
  const genders = GENDER_OPTIONS.map((o) => {
    const gloss = t(`gender.${o.value}`);
    const text = !o.spanish ? gloss : locale === "es" ? o.spanish : `${o.spanish} / ${gloss}`;
    return { value: o.value, label: `${o.value} — ${text}` };
  });

  return (
    <FieldGroup title={t("identity.title")} description={t("identity.description")}>
      <Field {...f("passportNumber")} autoComplete="off" maxLength={20} />
      <Field {...f("nie")} required={false} placeholder="X1234567L" maxLength={9} />
      <Field {...f("firstSurname")} autoComplete="family-name" />
      <Field {...f("secondSurname")} required={false} />
      <Field {...f("givenName")} autoComplete="given-name" />
      <SelectField {...f("gender")} options={genders}
        hint={t("field.officialCodes", { codes: GENDERS.join(" / ") })} />
      <Field {...f("birthDate")} uppercase={false} placeholder={t("fields.birthDate.placeholder")}
        inputMode="numeric" maxLength={10} />
      <Field {...f("birthCity")} />
      <SelectField {...f("birthCountry")} options={birthCountries} />
      <SelectField {...f("nationality")} options={nationalities} />
    </FieldGroup>
  );
}

export function FamilyStep(props: StepProps) {
  const t = useTranslations("intake");
  const locale = useLocale();
  const f = useFieldText(props);
  const statuses = MARITAL_OPTIONS.map((o) => ({
    value: o.value,
    label:
      locale === "es"
        ? `${o.value} — ${o.spanish}`
        : `${o.value} — ${o.spanish} (${t(`marital.${o.value}`)})`,
  }));

  return (
    <FieldGroup title={t("family.title")} description={t("family.description")}>
      <SelectField {...f("maritalStatus")} options={statuses}
        hint={t("field.officialCodes", { codes: MARITAL_STATUSES.join(" / ") })} />
      <div className="hidden sm:block" aria-hidden="true" />
      <Field {...f("fatherFirstName")} />
      <Field {...f("motherFirstName")} />
    </FieldGroup>
  );
}

export function AddressStep(props: StepProps) {
  const t = useTranslations("intake.address");
  const f = useFieldText(props);
  return (
    <FieldGroup title={t("title")} description={t("description")}>
      <Field {...f("streetName")} />
      <Field {...f("buildingNumber")} maxLength={10} />
      <Field {...f("floorDoor")} required={false} placeholder="3 2A" />
      <Field {...f("city")} />
      <Field {...f("postalCode")} uppercase={false} inputMode="numeric" maxLength={5}
        placeholder="08013" />
      <Field {...f("province")} />
    </FieldGroup>
  );
}

export function ContactStep(props: StepProps) {
  const t = useTranslations("intake.contact");
  const f = useFieldText(props);
  return (
    <FieldGroup title={t("title")} description={t("description")}>
      <Field {...f("phone")} uppercase={false} type="tel" inputMode="tel" autoComplete="tel"
        placeholder="+34600000000" />
      <Field {...f("email")} uppercase={false} type="email" inputMode="email"
        autoComplete="email" />
    </FieldGroup>
  );
}

export interface ConsentState {
  gdprDataProcessing: boolean;
  gdprSensitiveDocuments: boolean;
  disclaimerAcknowledged: boolean;
  marketingOptIn: boolean;
}

export function ConsentStep({
  consent,
  setConsent,
  errors,
}: {
  consent: ConsentState;
  setConsent: (updater: (c: ConsentState) => ConsentState) => void;
  errors: Errors;
}) {
  const t = useTranslations("intake.consent");
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">{t("title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("intro")}</p>

      <div className="mt-7 space-y-4">
        {CONSENT_ITEMS.map((item) => (
          <ConsentBox
            key={item.name}
            name={item.name}
            checked={consent[item.name]}
            onChange={(v) => setConsent((c) => ({ ...c, [item.name]: v }))}
            label={t(`${item.name}.label`)}
            body={t(`${item.name}.body`)}
            error={errors[item.name] ? t(`${item.name}.error`) : undefined}
            optional={!item.required}
          />
        ))}
      </div>

      <div className="mt-7">
        <LegalDisclaimer variant="prominent" />
      </div>
    </div>
  );
}
