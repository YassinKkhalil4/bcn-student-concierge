import type { Metadata } from "next";
import { requirePortalCaseId } from "@/lib/portal/guard";
import { getCase } from "@/lib/server/storage";
import { getTier, priceWithIva, formatEur } from "@/lib/pricing";
import { DocumentUpload } from "@/components/intake/DocumentUpload";
import { PayButton } from "@/components/portal/PayButton";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { listInvoicesForCase } from "@/lib/server/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your file",
  robots: { index: false, follow: false },
};

const DOC_LABEL: Record<string, string> = {
  passport: "Passport",
  "acceptance-letter": "University enrolment (matrícula)",
  lease: "Lease or property deed",
  "utility-bill": "Recent utility bill",
  "padron-authorization": "Signed Padrón authorisation",
  "authorizer-id": "ID of the person who signed the authorisation",
  "collective-authorization": "Residence authorisation (signed and stamped)",
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

  if (!record || !record.intake) {
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

  return (
    <div className="container-x py-12 sm:py-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Your file</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">
            {record.intake.identity.givenName.split(" ")[0]}, here is your file
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
            <h2 className="font-display text-xl font-semibold text-ink">Your documents</h2>
            {record.documents.length > 0 ? (
              <ul className="mt-4 divide-y divide-bone-line text-sm">
                {record.documents.map((d) => (
                  <li key={d.id} className="flex justify-between gap-4 py-2.5">
                    <span className="text-ink">{DOC_LABEL[d.kind] ?? d.kind}</span>
                    <span className="text-ink-soft">{DATE.format(new Date(d.uploadedAt))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-ink-muted">Nothing uploaded yet.</p>
            )}
            <div className="mt-6">
              <DocumentUpload />
            </div>
          </section>
        </div>

        <aside className="space-y-6">
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
