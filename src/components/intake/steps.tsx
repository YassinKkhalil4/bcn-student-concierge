"use client";

import { GENDERS, MARITAL_STATUSES } from "@/lib/schema";
import { Field, SelectField, FieldGroup } from "./Field";
import { ConsentBox } from "./ConsentBox";
import { LegalDisclaimer } from "@/components/LegalDisclaimer";
import {
  GENDER_OPTIONS,
  MARITAL_OPTIONS,
  CONSENT_COPY,
  type Values,
  type Errors,
} from "./constants";

export interface StepProps {
  values: Values;
  errors: Errors;
  set: (key: string) => (value: string) => void;
}

export function IdentityStep({ values, errors, set }: StepProps) {
  return (
    <FieldGroup
      title="Identity"
      description="Enter these exactly as they appear in your passport. Spanish authorities match every character, and a mismatch here is the most common cause of a rejected file."
    >
      <Field label="Passport number" name="passportNumber"
        value={values.passportNumber ?? ""} onChange={set("passportNumber")}
        error={errors.passportNumber} autoComplete="off" maxLength={20} />
      <Field label="Pre-assigned NIE" name="nie" required={false}
        value={values.nie ?? ""} onChange={set("nie")} error={errors.nie}
        hint="On your visa, if issued. Leave blank if you do not have one yet."
        placeholder="X1234567L" maxLength={9} />
      <Field label="First surname" name="firstSurname"
        value={values.firstSurname ?? ""} onChange={set("firstSurname")}
        error={errors.firstSurname} autoComplete="family-name" />
      <Field label="Second surname" name="secondSurname" required={false}
        value={values.secondSurname ?? ""} onChange={set("secondSurname")}
        error={errors.secondSurname}
        hint="Leave blank if your passport shows only one surname. Never enter “N/A”." />
      <Field label="Given name(s)" name="givenName"
        value={values.givenName ?? ""} onChange={set("givenName")}
        error={errors.givenName} autoComplete="given-name" />
      <SelectField label="Gender" name="gender" value={values.gender ?? ""}
        onChange={set("gender")} options={GENDER_OPTIONS} error={errors.gender}
        hint={`Official codes: ${GENDERS.join(" / ")}`} />
      <Field label="Date of birth" name="birthDate" value={values.birthDate ?? ""}
        onChange={set("birthDate")} error={errors.birthDate} uppercase={false}
        placeholder="DD/MM/YYYY" hint="Day first, as written on Spanish forms."
        inputMode="numeric" maxLength={10} />
      <Field label="City of birth" name="birthCity" value={values.birthCity ?? ""}
        onChange={set("birthCity")} error={errors.birthCity} />
      <Field label="Country of birth" name="birthCountry"
        value={values.birthCountry ?? ""} onChange={set("birthCountry")}
        error={errors.birthCountry} />
      <Field label="Nationality" name="nationality" value={values.nationality ?? ""}
        onChange={set("nationality")} error={errors.nationality}
        hint="This determines whether we prepare an EX-17 (TIE) or EX-18 (EU certificate)." />
    </FieldGroup>
  );
}

export function FamilyStep({ values, errors, set }: StepProps) {
  return (
    <FieldGroup
      title="Civil and family status"
      description="Spanish residency forms require parental given names even for adult applicants. First names only — surnames are not requested."
    >
      <SelectField label="Marital status" name="maritalStatus"
        value={values.maritalStatus ?? ""} onChange={set("maritalStatus")}
        options={MARITAL_OPTIONS} error={errors.maritalStatus}
        hint={`Official codes: ${MARITAL_STATUSES.join(" / ")}`} />
      <div className="hidden sm:block" aria-hidden="true" />
      <Field label="Father's first name" name="fatherFirstName"
        value={values.fatherFirstName ?? ""} onChange={set("fatherFirstName")}
        error={errors.fatherFirstName} />
      <Field label="Mother's first name" name="motherFirstName"
        value={values.motherFirstName ?? ""} onChange={set("motherFirstName")}
        error={errors.motherFirstName} />
    </FieldGroup>
  );
}

export function AddressStep({ values, errors, set }: StepProps) {
  return (
    <FieldGroup
      title="Spanish address"
      description="This must match your Padrón certificate exactly, including floor and door. If you have not registered yet, use the address on your lease."
    >
      <Field label="Street name" name="streetName" value={values.streetName ?? ""}
        onChange={set("streetName")} error={errors.streetName}
        hint="Include the type: CARRER, CALLE, AVINGUDA, PASSEIG…" />
      <Field label="Building number" name="buildingNumber"
        value={values.buildingNumber ?? ""} onChange={set("buildingNumber")}
        error={errors.buildingNumber} maxLength={10} />
      <Field label="Floor / door" name="floorDoor" required={false}
        value={values.floorDoor ?? ""} onChange={set("floorDoor")}
        error={errors.floorDoor} placeholder="3 2A"
        hint="Leave blank if the address has no floor or door." />
      <Field label="City / municipality" name="city" value={values.city ?? ""}
        onChange={set("city")} error={errors.city} />
      <Field label="Postal code" name="postalCode" value={values.postalCode ?? ""}
        onChange={set("postalCode")} error={errors.postalCode} uppercase={false}
        inputMode="numeric" maxLength={5} placeholder="08013" />
      <Field label="Province" name="province" value={values.province ?? ""}
        onChange={set("province")} error={errors.province} />
    </FieldGroup>
  );
}

export function ContactStep({ values, errors, set }: StepProps) {
  return (
    <FieldGroup
      title="Contact"
      description="We use these for appointment confirmations. Give the number your student will actually carry in Spain if you already know it."
    >
      <Field label="Mobile phone" name="phone" value={values.phone ?? ""}
        onChange={set("phone")} error={errors.phone} uppercase={false}
        type="tel" inputMode="tel" autoComplete="tel" placeholder="+34600000000"
        hint="International format, including the country code." />
      <Field label="Email address" name="email" value={values.email ?? ""}
        onChange={set("email")} error={errors.email} uppercase={false}
        type="email" inputMode="email" autoComplete="email" />
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
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-ink">Consent and scope</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        Each box below is unchecked by default and must be actively ticked. We do not
        treat silence, or a pre-ticked box, as consent.
      </p>

      <div className="mt-7 space-y-4">
        {CONSENT_COPY.map((item) => (
          <ConsentBox
            key={item.name}
            name={item.name}
            checked={consent[item.name]}
            onChange={(v) => setConsent((c) => ({ ...c, [item.name]: v }))}
            label={item.label}
            body={item.body}
            error={errors[item.name]}
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
