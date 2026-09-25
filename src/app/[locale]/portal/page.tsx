import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getFormatter, getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { CLIENT_NAMESPACES, pick } from "@/i18n/messages";
import { requirePortalCaseId } from "@/lib/portal/guard";
import { getCase } from "@/lib/server/storage";
import { getTier, tierPriceCents, routeForForm, formatEur } from "@/lib/pricing";
import { DocumentUpload } from "@/components/intake/DocumentUpload";
import { PadronWizard } from "@/components/portal/PadronWizard";
import { titleCase } from "@/lib/request-templates";
import { EnrolmentWizard } from "@/components/portal/EnrolmentWizard";
import { PayButton } from "@/components/portal/PayButton";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { listInvoicesForCase } from "@/lib/server/invoices";
import { listAppointments } from "@/lib/server/appointments";
import { buildTasa012 } from "@/lib/tasa012";
import { formatMadrid } from "@/lib/time";
import { TasaGuide } from "@/components/portal/TasaGuide";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "portal.meta" });
  return { title: t("file"), robots: { index: false, follow: false } };
}

export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ submitted?: string; checkout?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const caseId = await requirePortalCaseId();
  const [record, invoices, { submitted, checkout }, t, ti, format, messages] = await Promise.all([
    getCase(caseId),
    listInvoicesForCase(caseId),
    searchParams,
    getTranslations("portal.file"),
    getTranslations("portal.invoices"),
    getFormatter(),
    getMessages(),
  ]);
  /** Every branch below returns client components, so one wrapper for all of them. */
  const withMessages = (children: React.ReactNode) => (
    <NextIntlClientProvider locale={locale} messages={pick(messages, CLIENT_NAMESPACES.portal)}>
      {children}
    </NextIntlClientProvider>
  );
  const invoiceCopy = { empty: ti("empty"), refund: ti("refund"), pdf: ti("pdf") };

  if (!record) {
    // A validly signed session whose case does not exist (e.g. a development
    // database that was reset). Not "closed" — just a stale sign-in.
    return withMessages(
      <div className="container-x py-16">
        <h1 className="text-display-lg text-ink">{t("notFoundTitle")}</h1>
        <p className="prose-lede measure mt-5">{t("notFoundBody")}</p>
        <SignOut locale={locale} label={t("signOut")} />
      </div>,
    );
  }

  if (!record.intake) {
    return withMessages(
      <div className="container-x py-16">
        <h1 className="text-display-lg text-ink">{t("closedTitle")}</h1>
        <p className="prose-lede measure mt-5">{t("closedBody")}</p>
        <div className="mt-6 max-w-md">
          <InvoiceList invoices={invoices} hrefBase="/api/portal/invoices" copy={invoiceCopy} locale={locale} />
        </div>
        <div className="mt-6"><SignOut locale={locale} label={t("signOut")} /></div>
      </div>,
    );
  }

  const tp = await getTranslations("pricing");
  const tier = getTier(record.tierId);
  const price = tier ? tierPriceCents(tier, routeForForm(record.formId)) : null;
  const paid = record.paymentStatus === "paid";
  const uploadedKinds = [...new Set(record.documents.map((d) => d.kind))];
  // Only what the wizards need to fill templates: the student's own data,
  // sent to the student's own signed-in browser.
  const person = { identity: record.intake.identity, address: record.intake.address };
  const appts = await listAppointments(caseId);
  const police = appts.find((a) => a.kind === "police");
  const padron = appts.find((a) => a.kind === "padron");

  return withMessages(
    <div className="container-x py-12 sm:py-16 lg:py-20">
      <div className="flex flex-wrap items-start justify-between gap-6 border-t-3 border-accent pt-8">
        <div>
          <p className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-accent-deep">
            {t("eyebrow")}
          </p>
          <h1 className="mt-4 text-display-lg text-ink">
            {t("greeting", { name: titleCase(record.intake.identity.givenName.split(" ")[0]!) })}
          </h1>
          {/* The reference, the package and the form code, set in the mono
              face: these are the three things a student is asked to quote. */}
          <dl className="mt-5 flex flex-wrap items-baseline gap-x-8 gap-y-2 font-mono text-sm">
            <div className="flex gap-2">
              <dt className="text-ink-soft">{t("reference")}</dt>
              <dd className="font-medium text-ink">{record.ref}</dd>
            </div>
            {tier && <dd className="text-ink-muted">{tp(`tiers.${tier.id}.name`)}</dd>}
            <dd className="text-ink-muted">{record.formId}</dd>
          </dl>
        </div>
        <SignOut locale={locale} label={t("signOut")} />
      </div>

      {submitted && (
        <p role="status" className="mt-8 border-l-2 border-ink bg-paper-dim px-4 py-3 text-sm font-medium text-ink">
          {t("submitted")}
        </p>
      )}
      {checkout === "cancelled" && !paid && (
        <p role="status" className="mt-8 border-l-2 border-paper-edge bg-paper-dim px-4 py-3 text-sm text-ink-muted">
          {t("checkoutCancelled")}
        </p>
      )}

      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        <div className="space-y-8">
          {!paid && record.paymentStatus === "pending" && (
            <section className="border border-paper-edge border-t-3 border-t-accent bg-white p-6 sm:p-7">
              <h2 className="text-display-md text-ink">{t("paymentTitle")}</h2>
              <p className="prose-body mt-3">
                {t("paymentBody")}
                {price && <> {t("paymentTotal", { total: formatEur(price) })}</>}
              </p>
              <div className="mt-5">
                <PayButton label={price ? t("pay", { total: formatEur(price) }) : t("payNow")} />
              </div>
            </section>
          )}

          <section className="panel">
            <h2 className="text-display-md text-ink">{t("passport")}</h2>
            <div className="mt-4">
              <DocumentUpload kinds={["passport"]} uploaded={uploadedKinds} />
            </div>
          </section>

          <section className="panel">
            <h2 className="text-display-md text-ink">{t("enrolment")}</h2>
            <div className="mt-4">
              <EnrolmentWizard person={person} uploaded={uploadedKinds} />
            </div>
          </section>

          <section className="panel">
            <h2 className="text-display-md text-ink">{t("padron")}</h2>
            <p className="prose-body mt-3">
              {t("padronIntro", {
                address: `${record.intake.address.streetName} ${record.intake.address.buildingNumber}`,
              })}
            </p>
            <div className="mt-5">
              <PadronWizard person={person} uploaded={uploadedKinds} />
            </div>
          </section>

          {paid && (
            <section className="panel">
              <h2 className="text-display-md text-ink">{t("tasaTitle")}</h2>
              <p className="prose-body mt-3">{t("tasaIntro")}</p>
              <div className="mt-5">
                <TasaGuide summary={buildTasa012(record.intake, record.formId)} />
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {(police || padron) && (
            <section className="panel">
              <h2 className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-ink-soft">{t("appointments")}</h2>
              {[police, padron].filter(Boolean).map((a) => {
                const when = formatMadrid(a!.scheduledAt, locale === "en" ? "en-GB" : locale);
                return (
                  <div key={a!.kind} className="mt-4">
                    <p className="font-sans text-[0.625rem] font-bold uppercase tracking-[0.16em] text-ink-soft">
                      {a!.kind === "police" ? t("police") : t("padronAppointment")}
                    </p>
                    <p className="mt-1.5 font-mono text-sm font-medium text-ink">{when.date}, {when.time}</p>
                    <p className="font-sans text-sm text-ink-muted">{a!.officeName}</p>
                    <p className="font-sans text-sm text-ink-muted">{a!.officeAddress}</p>
                    {a!.nearestMetro && <p className="font-sans text-sm text-ink-muted">{t("metro", { metro: a!.nearestMetro })}</p>}
                  </div>
                );
              })}
              {police && (
                <div className="mt-5 flex flex-col gap-2">
                  <a href="/api/portal/appointment-sheet" className="btn-primary w-full !px-4 !py-2.5">
                    {t("sheet")}
                  </a>
                  <a href="/api/portal/form" className="btn-secondary w-full !px-4 !py-2.5">
                    {t("myForm", { form: record.formId })}
                  </a>
                </div>
              )}
            </section>
          )}
          <section className="panel">
            <h2 className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-ink-soft">{t("invoices")}</h2>
            <InvoiceList invoices={invoices} hrefBase="/api/portal/invoices" copy={invoiceCopy} locale={locale} />
          </section>
          <section className="panel">
            <h2 className="font-sans text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-ink-soft">{t("reviewTitle")}</h2>
            {record.documentsSubmittedAt ? (
              <p className="mt-2 text-sm text-ink-muted">
                {t("reviewDone", {
                  date: format.dateTime(new Date(record.documentsSubmittedAt), {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "Europe/Madrid",
                  }),
                })}
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-muted">{t("reviewPrompt")}</p>
                <form action="/api/portal/submit" method="post" className="mt-4">
                  <input type="hidden" name="locale" value={locale} />
                  <button type="submit" className="btn-primary w-full">{t("reviewSubmit")}</button>
                </form>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>,
  );
}

function SignOut({ locale, label }: { locale: string; label: string }) {
  return (
    <form action="/api/portal/logout" method="post">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="btn-secondary">{label}</button>
    </form>
  );
}
