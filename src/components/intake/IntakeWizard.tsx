"use client";

import { useState, useMemo } from "react";
import type { z } from "zod";
import {
  identitySchema,
  familySchema,
  addressSchema,
  contactSchema,
} from "@/lib/schema";
import { TIERS, getTier, priceWithIva, formatEur } from "@/lib/pricing";
import { DocumentUpload } from "./DocumentUpload";
import { Modelo790Notice } from "@/components/Modelo790Notice";
import {
  IdentityStep,
  FamilyStep,
  AddressStep,
  ContactStep,
  ConsentStep,
  type ConsentState,
} from "./steps";
import {
  STEPS,
  INITIAL_VALUES,
  type Values,
  type Errors,
} from "./constants";

/**
 * Multi-step intake.
 *
 * Client-side validation runs against the SAME zod schemas the API uses, so a
 * step cannot pass here and then fail server-side for an unrelated reason. The
 * client check is purely a convenience: the server re-validates everything,
 * because anything running in the browser is advisory.
 */

function collectErrors(result: z.SafeParseReturnType<unknown, unknown>): Errors {
  if (result.success) return {};
  const out: Errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    // First error per field only — three messages on one input is noise, and
    // the first is almost always the actionable one.
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}

const STEP_SCHEMAS = [identitySchema, familySchema, addressSchema, contactSchema];

export function IntakeWizard({ initialTier }: { initialTier: string }) {
  const [tierId, setTierId] = useState(() =>
    getTier(initialTier) ? initialTier : "soft-landing",
  );
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Values>(INITIAL_VALUES);
  const [consent, setConsent] = useState<ConsentState>({
    gdprDataProcessing: false,
    gdprSensitiveDocuments: false,
    disclaimerAcknowledged: false,
    marketingOptIn: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [caseRef, setCaseRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const tier = getTier(tierId) ?? TIERS[1]!;
  const price = useMemo(() => priceWithIva(tier.basePriceCents), [tier]);

  const set = (key: string) => (value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    // Clear this field's error as soon as the user edits it, rather than
    // leaving stale red text under an input they have already fixed.
    setErrors((e) => {
      if (!e[key]) return e;
      const { [key]: _cleared, ...rest } = e;
      return rest;
    });
  };

  function validateStep(index: number): boolean {
    const schema = STEP_SCHEMAS[index];
    if (schema) {
      const found = collectErrors(schema.safeParse(values));
      setErrors(found);
      return Object.keys(found).length === 0;
    }

    if (index === 4) {
      const missing: Errors = {};
      if (!consent.gdprDataProcessing)
        missing.gdprDataProcessing = "Required to process your file";
      if (!consent.gdprSensitiveDocuments)
        missing.gdprSensitiveDocuments = "Required to hold your documents";
      if (!consent.disclaimerAcknowledged)
        missing.disclaimerAcknowledged = "Please acknowledge the scope of service";
      setErrors(missing);
      return Object.keys(missing).length === 0;
    }

    return true;
  }

  function buildPayload() {
    return {
      tierId,
      identity: {
        passportNumber: values.passportNumber,
        nie: values.nie,
        firstSurname: values.firstSurname,
        secondSurname: values.secondSurname,
        givenName: values.givenName,
        gender: values.gender,
        birthDate: values.birthDate,
        birthCity: values.birthCity,
        birthCountry: values.birthCountry,
        nationality: values.nationality,
      },
      family: {
        maritalStatus: values.maritalStatus,
        fatherFirstName: values.fatherFirstName,
        motherFirstName: values.motherFirstName,
      },
      address: {
        streetName: values.streetName,
        buildingNumber: values.buildingNumber,
        floorDoor: values.floorDoor,
        city: values.city,
        postalCode: values.postalCode,
        province: values.province,
      },
      contact: { phone: values.phone, email: values.email },
      consent,
    };
  }

  async function submitIntake(): Promise<void> {
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = (await res.json()) as {
        ref?: string;
        error?: string;
        issues?: { path: string; message: string }[];
      };

      if (!res.ok) {
        if (json.issues) {
          const mapped: Errors = {};
          for (const issue of json.issues) {
            const key = issue.path.split(".").pop();
            if (key && !mapped[key]) mapped[key] = issue.message;
          }
          setErrors(mapped);
          setSubmitError("Some answers need correcting — check the earlier steps.");
          return;
        }
        setSubmitError(json.error ?? "Submission failed.");
        return;
      }

      setCaseRef(json.ref ?? null);
      setStep(5);
    } catch {
      setSubmitError("Network error. Your answers are still here — please retry.");
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout(): Promise<void> {
    if (!caseRef) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No body: the server takes the case from the signed session cookie
        // it set when the intake was submitted.
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setSubmitError(json.error ?? "Could not open checkout.");
    } catch {
      setSubmitError("Network error opening checkout.");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!validateStep(step)) return;
    if (step === 4) {
      void submitIntake();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  const stepProps = { values, errors, set };

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <nav aria-label="Progress" className="mb-9">
          <ol className="flex flex-wrap gap-2 text-xs">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <span
                  aria-current={i === step ? "step" : undefined}
                  className={[
                    "rounded-full px-3 py-1.5 font-medium",
                    i === step
                      ? "bg-olive text-bone"
                      : i < step
                        ? "bg-olive/10 text-olive"
                        : "bg-bone-warm text-ink-soft",
                  ].join(" ")}
                >
                  {i < step ? "✓ " : ""}
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="rounded-2xl border border-bone-line bg-white p-7 sm:p-9">
          {step === 0 && <IdentityStep {...stepProps} />}
          {step === 1 && <FamilyStep {...stepProps} />}
          {step === 2 && <AddressStep {...stepProps} />}
          {step === 3 && <ContactStep {...stepProps} />}
          {step === 4 && (
            <ConsentStep consent={consent} setConsent={setConsent} errors={errors} />
          )}

          {step === 5 && caseRef && (
            <div>
              <h2 className="font-display text-xl font-semibold text-ink">
                Upload your documents
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Your file is open. Reference{" "}
                <code className="rounded bg-bone-warm px-1.5 py-0.5 text-xs">
                  {caseRef}
                </code>
                . Upload what you have now, then continue to payment.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Missing something, like a Padrón document from your landlord? That is
                normal. Pay now and upload it later from{" "}
                <a href="/portal" className="font-medium text-olive underline">
                  your file
                </a>
                : sign in any time with the email you gave us.
              </p>

              <div className="mt-7">
                <DocumentUpload />
              </div>

              <div className="mt-8">
                <Modelo790Notice />
              </div>

              <button
                type="button"
                onClick={() => void startCheckout()}
                disabled={busy}
                className="btn-primary mt-8 w-full"
              >
                {busy
                  ? "Opening secure checkout…"
                  : `Continue to payment — ${formatEur(price.totalCents)}`}
              </button>
              <p className="mt-3 text-center text-xs text-ink-soft">
                Card and Apple Pay, processed by Stripe. We never see your card details.
              </p>
            </div>
          )}

          {submitError && (
            <p
              role="alert"
              className="mt-6 rounded-lg bg-terracotta/5 px-4 py-3 text-sm font-medium text-terracotta"
            >
              {submitError}
            </p>
          )}

          {step < 5 && (
            <div className="mt-9 flex items-center justify-between border-t border-bone-line pt-6">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || busy}
                className="btn-secondary"
              >
                Back
              </button>
              <button type="button" onClick={next} disabled={busy} className="btn-primary">
                {busy ? "Saving…" : step === 4 ? "Submit and continue" : "Continue"}
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-bone-line bg-white p-6">
          <p className="eyebrow">Selected package</p>
          <h2 className="mt-2.5 font-display text-lg font-semibold text-ink">
            {tier.name}
          </h2>

          <dl className="mt-5 space-y-2 border-y border-bone-line py-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Service fee</dt>
              <dd className="text-ink">{formatEur(price.baseCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">IVA (21%)</dt>
              <dd className="text-ink">{formatEur(price.ivaCents)}</dd>
            </div>
            <div className="flex justify-between pt-1 font-semibold">
              <dt className="text-ink">Total</dt>
              <dd className="text-ink">{formatEur(price.totalCents)}</dd>
            </div>
          </dl>

          {/* Package can only change before any data is entered, so the price
              shown at checkout is always the one the client reviewed. */}
          {step === 0 && (
            <div className="mt-5">
              <label htmlFor="tier-switch" className="field-label">
                Change package
              </label>
              <select
                id="tier-switch"
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="field-input"
              >
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-ink-soft">
            Government fees (Modelo 790, card issuance) are paid by you directly to the
            Spanish authorities and are not included.
          </p>
        </div>
      </aside>
    </div>
  );
}
