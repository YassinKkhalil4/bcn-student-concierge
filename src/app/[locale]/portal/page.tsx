import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { requirePortalCaseId } from "@/lib/portal/guard";
import { getCase } from "@/lib/server/storage";
import { getTier, tierPrice, routeForForm, formatEur } from "@/lib/pricing";
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
  const [record, invoices, { submitted, checkout }, t, ti, format] = await Promise.all([
    getCase(caseId),
    listInvoicesForCase(caseId),
    searchParams,
    getTranslations("portal.file"),
    getTranslations("portal.invoices"),
    getFormatter(),
  ]);
  const invoiceCopy = { empty: ti("empty"), refund: ti("refund"), pdf: ti("pdf") };

  if (!record) {
    // A validly signed session whose case does not exist (e.g. a development
    // database that was reset). Not "closed" — just a stale sign-in.
    return (
      <div className="container-x py-16">
        <h1 className="font-display text-3xl font-semibold text-ink">{t("notFoundTitle")}</h1>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">{t("notFoundBody")}</p>
        <SignOut locale={locale} label={t("signOut")} />
      </div>
    );
  }

  if (!record.intake) {
    return (
      <div className="container-x py-16">
        <h1 className="font-display text-3xl font-semibold text-ink">{t("closedTitle")}</h1>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">{t("closedBody")}</p>
        <div className="mt-6 max-w-md">
          <InvoiceList invoices={invoices} hrefBase="/api/portal/invoices" copy={invoiceCopy} locale={locale} />
        </div>
        <div className="mt-6"><SignOut locale={locale} label={t("signOut")} /></div>
      </div>
    );
  }

  const tp = await getTranslations("pricing");
  const tier = getTier(record.tierId);
  const price = tier ? tierPrice(tier, routeForForm(record.formId)) : null;
  const paid = record.paymentStatus === "paid";
  const uploadedKinds = [...new Set(record.documents.map((d) => d.kind))];
  // Only what the wizards need to fill templates: the student's own data,
  // sent to the student's own signed-in browser.
  const person = { identity: record.intake.identity, address: record.intake.address };
  const appts = await listAppointments(caseId);
  const police = appts.find((a) => a.kind === "police");
  const padron = appts.find((a) => a.kind === "padron");

  return (
    <div className="container-x py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            {t("greeting", { name: titleCase(record.intake.identity.givenName.split(" ")[0]!) })}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {t("reference")} <span className="font-mono font-medium text-ink">{record.ref}</span>
            {tier && <> · {tp(`tiers.${tier.id}.name`)}</>} · {record.formId}
          </p>
        </div>
        <SignOut locale={locale} label={t("signOut")} />
      </div>

      {submitted && (
        <p role="status" className="mt-8 rounded-lg bg-olive/10 px-4 py-3 text-sm text-olive">
          {t("submitted")}
        </p>
      )}
      {checkout === "cancelled" && !paid && (
        <p role="status" className="mt-8 rounded-lg bg-bone-warm px-4 py-3 text-sm text-ink-muted">
          {t("checkoutCancelled")}
        </p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {!paid && record.paymentStatus === "pending" && (
            <section className="rounded-2xl border border-terracotta/30 bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-ink">{t("paymentTitle")}</h2>
              <p className="mt-2 text-sm text-ink-muted">
                {t("paymentBody")}
                {price && <> {t("paymentTotal", { total: formatEur(price.totalCents) })}</>}
              </p>
              <div className="mt-5">
                <PayButton label={price ? t("pay", { total: formatEur(price.totalCents) }) : t("payNow")} />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">{t("passport")}</h2>
            <div className="mt-4">
              <DocumentUpload kinds={["passport"]} uploaded={uploadedKinds} />
            </div>
          </section>

          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">{t("enrolment")}</h2>
            <div className="mt-4">
              <EnrolmentWizard person={person} uploaded={uploadedKinds} />
            </div>
          </section>

          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">{t("padron")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {t("padronIntro", {
                address: `${record.intake.address.streetName} ${record.intake.address.buildingNumber}`,
              })}
            </p>
            <div className="mt-5">
              <PadronWizard person={person} uploaded={uploadedKinds} />
            </div>
          </section>

          {paid && (
            <section className="rounded-2xl border border-bone-line bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-ink">{t("tasaTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t("tasaIntro")}</p>
              <div className="mt-5">
                <TasaGuide summary={buildTasa012(record.intake, record.formId)} />
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {(police || padron) && (
            <section className="rounded-2xl border border-olive/40 bg-white p-6">
              <h2 className="text-sm font-semibold text-ink">{t("appointments")}</h2>
              {[police, padron].filter(Boolean).map((a) => {
                const when = formatMadrid(a!.scheduledAt, locale === "en" ? "en-GB" : locale);
                return (
                  <div key={a!.kind} className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                      {a!.kind === "police" ? t("police") : t("padronAppointment")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">{when.date}, {when.time}</p>
                    <p className="text-sm text-ink-muted">{a!.officeName}</p>
                    <p className="text-sm text-ink-muted">{a!.officeAddress}</p>
                    {a!.nearestMetro && <p className="text-sm text-ink-muted">{t("metro", { metro: a!.nearestMetro })}</p>}
                  </div>
                );
              })}
              {police && (
                <div className="mt-5 flex flex-col gap-2">
                  <a href="/api/portal/appointment-sheet" className="btn-primary w-full !py-2.5">
                    {t("sheet")}
                  </a>
                  <a href="/api/portal/form" className="btn-secondary w-full !py-2.5">
                    {t("myForm", { form: record.formId })}
                  </a>
                </div>
              )}
            </section>
          )}
          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="text-sm font-semibold text-ink">{t("invoices")}</h2>
            <InvoiceList invoices={invoices} hrefBase="/api/portal/invoices" copy={invoiceCopy} locale={locale} />
          </section>
          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="text-sm font-semibold text-ink">{t("reviewTitle")}</h2>
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
    </div>
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
