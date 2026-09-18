"use client";

import { useState, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { z } from "zod";
import {
  identitySchema,
  familySchema,
  addressSchema,
  contactSchema,
} from "@/lib/schema";
import { TIERS, getTier, tierPriceCents, formatEur, SERVICE_ROUTES, type ServiceRoute } from "@/lib/pricing";
import { routeForNationality } from "@/lib/forms/field-map";
import { DocumentUpload } from "./DocumentUpload";
import { PadronWizard } from "@/components/portal/PadronWizard";
import { EnrolmentWizard } from "@/components/portal/EnrolmentWizard";
import { Modelo790Notice } from "@/components/Modelo790Notice";
import { Link } from "@/i18n/navigation";
import { TickMark } from "@/components/icons";
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
  const t = useTranslations("intake");
  const tp = useTranslations("portal.file");
  const tprice = useTranslations("pricing");
  const locale = useLocale();
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
  /**
   * The student's own data, for the wizards that build their Padrón and
   * enrolment requests. Parsed from what they just submitted — the same
   * schemas the server used — and never sent anywhere by those wizards.
   */
  const person = useMemo(() => {
    const identity = identitySchema.safeParse(values);
    const address = addressSchema.safeParse(values);
    return identity.success && address.success
      ? { identity: identity.data, address: address.data }
      : null;
  }, [values]);
  /**
   * EU/EEA/Swiss or not, from the nationality the student picks in step 1 —
   * the same derivation the server uses for the price and for EX-17 vs EX-18.
   * Null until they have chosen: the summary then shows both prices rather
   * than guessing, because guessing would quote half of them the wrong fee.
   */
  const route = useMemo<ServiceRoute | null>(() => {
    const n = values.nationality?.trim();
    return n ? routeForNationality(n) : null;
  }, [values.nationality]);
  const price = useMemo(() => (route ? tierPriceCents(tier, route) : null), [tier, route]);

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
      // Only presence matters here: ConsentStep words the error itself.
      if (!consent.gdprDataProcessing) missing.gdprDataProcessing = "missing";
      if (!consent.gdprSensitiveDocuments) missing.gdprSensitiveDocuments = "missing";
      if (!consent.disclaimerAcknowledged) missing.disclaimerAcknowledged = "missing";
      setErrors(missing);
      return Object.keys(missing).length === 0;
    }

    return true;
  }

  function buildPayload() {
    return {
      tierId,
      // Emails and PDFs for this student are produced in this language.
      locale,
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
          setSubmitError(t("wizard.fixEarlier"));
          return;
        }
        setSubmitError(t("wizard.submitFailed"));
        return;
      }

      setCaseRef(json.ref ?? null);
      setStep(5);
    } catch {
      setSubmitError(t("wizard.networkRetry"));
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
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      setSubmitError(
        t(
          res.status === 401
            ? "wizard.sessionExpired"
            : res.status === 409
              ? "wizard.alreadyPaid"
              : "wizard.checkoutFailed",
        ),
      );
    } catch {
      setSubmitError(t("wizard.checkoutNetwork"));
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
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
      <div>
        {/*
          A progress register, not a row of pills. Each step is a column under
          its own rule: ink once done, crimson for where you are, hairline for
          what is still ahead. It reads as a position in a document rather than
          as a set of buttons, and it survives six languages because each label
          wraps under its own rule instead of reflowing the whole row.
        */}
        <nav aria-label={t("steps.progress")} className="mb-10">
          <ol className="grid grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? "step" : undefined}
                className={[
                  "border-t-2 pt-2.5",
                  i < step ? "border-ink" : i === step ? "border-accent" : "border-paper-edge",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-3 items-center font-mono text-[0.6875rem] font-medium",
                    i < step ? "text-ink" : i === step ? "text-accent" : "text-ink-soft",
                  ].join(" ")}
                >
                  {i < step ? <TickMark className="h-3 w-3" /> : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={[
                    "mt-1.5 block font-sans text-[0.6875rem] font-bold uppercase leading-tight tracking-[0.08em]",
                    i <= step ? "text-ink" : "text-ink-soft",
                  ].join(" ")}
                >
                  {t(`steps.${s}`)}
                </span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="border border-paper-edge border-t-3 border-t-ink bg-white p-6 sm:p-9">
          {step === 0 && <IdentityStep {...stepProps} />}
          {step === 1 && <FamilyStep {...stepProps} />}
          {step === 2 && <AddressStep {...stepProps} />}
          {step === 3 && <ContactStep {...stepProps} />}
          {step === 4 && (
            <ConsentStep consent={consent} setConsent={setConsent} errors={errors} />
          )}

          {step === 5 && caseRef && (
            <div>
              <h2 className="text-display-md text-ink">{t("wizard.uploadTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {t.rich("wizard.uploadIntro", {
                  ref: caseRef,
                  code: (chunks) => (
                    <code className="bg-paper-dim px-1.5 py-0.5 text-xs">{chunks}</code>
                  ),
                })}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {t.rich("wizard.uploadLater", {
                  link: (chunks) => (
                    <Link href="/portal" className="font-medium text-accent-deep underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>

              {/* The same sections, and the same wizards, as the portal: a
                  student who can get everything now should not have to come
                  back for it. Section titles are shared with the portal so the
                  two screens read identically. */}
              <div className="mt-8 space-y-8">
                <section>
                  <h3 className="text-display-sm text-ink">{tp("passport")}</h3>
                  <div className="mt-4">
                    <DocumentUpload kinds={["passport"]} />
                  </div>
                </section>

                {person && (
                  <>
                    <section>
                      <h3 className="text-display-sm text-ink">{tp("enrolment")}</h3>
                      <div className="mt-4">
                        <EnrolmentWizard person={person} />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-display-sm text-ink">{tp("padron")}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                        {tp("padronIntro", {
                          address: `${person.address.streetName} ${person.address.buildingNumber}`,
                        })}
                      </p>
                      <div className="mt-5">
                        <PadronWizard person={person} />
                      </div>
                    </section>
                  </>
                )}
              </div>

              <div className="mt-8">
                <Modelo790Notice />
              </div>

              {/* Reachable only after the case is created, so the nationality —
                  and therefore the route and its price — is always known here. */}
              {price !== null && (
                <>
                  <button
                    type="button"
                    onClick={() => void startCheckout()}
                    disabled={busy}
                    className="btn-primary mt-8 w-full"
                  >
                    {busy
                      ? t("wizard.openingCheckout")
                      : t("wizard.pay", { total: formatEur(price) })}
                  </button>
                  <p className="mt-4 text-center font-sans text-xs text-ink-soft">{t("wizard.stripeNote")}</p>
                </>
              )}
            </div>
          )}

          {submitError && (
            <p
              role="alert"
              className="mt-6 border-l-2 border-accent bg-accent-tint px-4 py-3 text-sm font-medium text-accent-deep"
            >
              {submitError}
            </p>
          )}

          {step < 5 && (
            <div className="mt-10 flex items-center justify-between gap-4 border-t border-paper-line pt-6">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || busy}
                className="btn-secondary"
              >
                {t("wizard.back")}
              </button>
              <button type="button" onClick={next} disabled={busy} className="btn-primary">
                {busy ? t("wizard.saving") : step === 4 ? t("wizard.submit") : t("wizard.continue")}
              </button>
            </div>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="border border-paper-edge border-t-3 border-t-accent bg-white p-6">
          <p className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.2em] text-ink-soft">{t("summary.selected")}</p>
          <h2 className="mt-3 text-display-sm text-ink">
            {tprice(`tiers.${tier.id}.name`)}
          </h2>

          {price !== null && route ? (
            <dl className="mt-5 space-y-2 border-y border-paper-line py-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-muted">{t("summary.route")}</dt>
                <dd className="text-ink">{tprice(route === "eu" ? "card.routeEu" : "card.routeNonEu")}</dd>
              </div>
              <div className="flex justify-between pt-1 font-semibold">
                <dt className="text-ink">{t("summary.total")}</dt>
                <dd className="text-ink">{formatEur(price)}</dd>
              </div>
            </dl>
          ) : (
            <div className="mt-5 border-y border-paper-line py-4">
              <dl className="space-y-2 text-sm">
                {SERVICE_ROUTES.map((r) => (
                  <div key={r} className="flex justify-between">
                    <dt className="text-ink-muted">
                      {tprice(r === "eu" ? "card.routeEu" : "card.routeNonEu")}
                    </dt>
                    <dd className="text-ink">{formatEur(tierPriceCents(tier, r))}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">{t("summary.routePending")}</p>
            </div>
          )}

          {/* Package can only change before any data is entered, so the price
              shown at checkout is always the one the client reviewed. */}
          {step === 0 && (
            <div className="mt-5">
              <label htmlFor="tier-switch" className="field-label">
                {t("summary.change")}
              </label>
              <select
                id="tier-switch"
                value={tierId}
                onChange={(e) => setTierId(e.target.value)}
                className="field-input"
              >
                {TIERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {tprice(`tiers.${option.id}.name`)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-ink-soft">{t("summary.govFees")}</p>
        </div>
      </aside>
    </div>
  );
}
