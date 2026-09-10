import type { Metadata } from "next";
import { requirePortalCaseId } from "@/lib/portal/guard";
import { getCase } from "@/lib/server/storage";
import { getTier, priceWithIva, formatEur } from "@/lib/pricing";
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
export const metadata: Metadata = {
  title: "Your file",
  robots: { index: false, follow: false },
};

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const caseId = await requirePortalCaseId();
  const [record, invoices] = await Promise.all([getCase(caseId), listInvoicesForCase(caseId)]);
  const { submitted } = await searchParams;

  if (!record) {
    // A validly signed session whose case does not exist (e.g. a development
    // database that was reset). Not "closed" — just a stale sign-in.
    return (
      <div className="container-x py-16">
        <h1 className="font-display text-3xl font-semibold text-ink">We could not find your file</h1>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">
          Please sign out and sign in again with the email address you used on the form.
        </p>
        <SignOut />
      </div>
    );
  }

  if (!record.intake) {
    return (
      <div className="container-x py-16">
        <h1 className="font-display text-3xl font-semibold text-ink">This file is closed</h1>
        <p className="mt-3 max-w-xl text-sm text-ink-muted">
          Your service is complete and, as promised, your personal data and documents have
          been permanently deleted. Your invoice records are kept as Spanish tax law requires.
        </p>
        <div className="mt-6 max-w-md">
          <InvoiceList invoices={invoices} hrefBase="/api/portal/invoices" />
        </div>
        <div className="mt-6"><SignOut /></div>
      </div>
    );
  }

  const tier = getTier(record.tierId);
  const price = tier ? priceWithIva(tier.basePriceCents) : null;
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
          <p className="eyebrow">Your file</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            {titleCase(record.intake.identity.givenName.split(" ")[0]!)}, here is your file
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Reference <span className="font-mono font-medium text-ink">{record.ref}</span>
            {tier && <> · {tier.name}</>} · {record.formId}
          </p>
        </div>
        <SignOut />
      </div>

      {submitted && (
        <p role="status" className="mt-8 rounded-lg bg-olive/10 px-4 py-3 text-sm text-olive">
          Thank you — your documents are with us. We check them within one business day.
        </p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {!paid && record.paymentStatus === "pending" && (
            <section className="rounded-2xl border border-terracotta/30 bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-ink">Payment outstanding</h2>
              <p className="mt-2 text-sm text-ink-muted">
                We start work as soon as your payment is confirmed.
                {price && <> Total {formatEur(price.totalCents)}, IVA included.</>}
              </p>
              <div className="mt-5">
                <PayButton label={price ? `Pay ${formatEur(price.totalCents)}` : "Pay now"} />
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">1. Passport</h2>
            <div className="mt-4">
              <DocumentUpload kinds={["passport"]} uploaded={uploadedKinds} />
            </div>
          </section>

          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">2. University enrolment</h2>
            <div className="mt-4">
              <EnrolmentWizard person={person} uploaded={uploadedKinds} />
            </div>
          </section>

          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="font-display text-xl font-semibold text-ink">3. Proof of address for the Padrón</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              To register at the Padrón — the city&rsquo;s register of residents — you must show
              you live at {record.intake.address.streetName} {record.intake.address.buildingNumber}.
              What counts as proof depends on how you live.
            </p>
            <div className="mt-5">
              <PadronWizard person={person} uploaded={uploadedKinds} />
            </div>
          </section>

          {paid && (
            <section className="rounded-2xl border border-bone-line bg-white p-6">
              <h2 className="font-display text-xl font-semibold text-ink">4. Pay the state fee (Modelo 790 · 012)</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                The police charge this fee separately from our service. It is paid in cash at a
                Spanish bank, using a form you generate on the police website.
              </p>
              <div className="mt-5">
                <TasaGuide summary={buildTasa012(record.intake, record.formId)} />
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6">
          {(police || padron) && (
            <section className="rounded-2xl border border-olive/40 bg-white p-6">
              <h2 className="text-sm font-semibold text-ink">Your appointments</h2>
              {[police, padron].filter(Boolean).map((a) => {
                const when = formatMadrid(a!.scheduledAt);
                return (
                  <div key={a!.kind} className="mt-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-soft">
                      {a!.kind === "police" ? "Police" : "Padrón"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-ink">{when.date}, {when.time}</p>
                    <p className="text-sm text-ink-muted">{a!.officeName}</p>
                    <p className="text-sm text-ink-muted">{a!.officeAddress}</p>
                    {a!.nearestMetro && <p className="text-sm text-ink-muted">Metro: {a!.nearestMetro}</p>}
                  </div>
                );
              })}
              {police && (
                <div className="mt-5 flex flex-col gap-2">
                  <a href="/api/portal/appointment-sheet" className="btn-primary w-full !py-2.5">
                    Appointment-day sheet
                  </a>
                  <a href="/api/portal/form" className="btn-secondary w-full !py-2.5">
                    My pre-filled {record.formId}
                  </a>
                </div>
              )}
            </section>
          )}
          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="text-sm font-semibold text-ink">Invoices</h2>
            <InvoiceList invoices={invoices} hrefBase="/api/portal/invoices" />
          </section>
          <section className="rounded-2xl border border-bone-line bg-white p-6">
            <h2 className="text-sm font-semibold text-ink">Ready for review?</h2>
            {record.documentsSubmittedAt ? (
              <p className="mt-2 text-sm text-ink-muted">
                Submitted on {DATE.format(new Date(record.documentsSubmittedAt))}. You can still
                upload a replacement if we ask for one.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-muted">
                  When everything is uploaded, tell us and we will check your file.
                </p>
                <form action="/api/portal/submit" method="post" className="mt-4">
                  <button type="submit" className="btn-primary w-full">Submit for review</button>
                </form>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function SignOut() {
  return (
    <form action="/api/portal/logout" method="post">
      <button type="submit" className="btn-secondary">Sign out</button>
    </form>
  );
}
