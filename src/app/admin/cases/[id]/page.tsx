import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { getCase, type StoredDocument } from "@/lib/server/storage";
import type { DocumentKind, Locale } from "@/lib/db/schema";
import { getTier, tierPriceCents, routeForForm, formatEur } from "@/lib/pricing";
import { buildTasa012 } from "@/lib/tasa012";
import { countryDisplayName, spanishFormName } from "@/lib/countries";
import { listInvoicesForCase } from "@/lib/server/invoices";
import { listAppointments } from "@/lib/server/appointments";
import { AppointmentsCard } from "@/components/admin/AppointmentsCard";
import { InvoiceList } from "@/components/portal/InvoiceList";
import { Tasa012Helper } from "@/components/admin/Tasa012Helper";
import { CopyButton } from "@/components/CopyButton";
import {
  Badge,
  Card,
  Fields,
  PaymentBadge,
  StageBadge,
  formatDate,
  formatBytes,
  formatDateTime,
} from "@/components/admin/ui";
import { changeStage, eraseNow } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Case" };

const GENDER: Record<string, string> = { H: "H — male", M: "M — female", X: "X — not specified" };
/** The student's language: their emails and appointment sheet are written in it. */
const LANGUAGE: Record<Locale, string> = {
  en: "English",
  es: "Spanish",
  ca: "Catalan",
  fr: "French",
  it: "Italian",
  de: "German",
};
const MARITAL: Record<string, string> = {
  S: "S — single", C: "C — married", V: "V — widowed", D: "D — divorced", Sp: "Sp — separated",
};
const DOC_SLOTS: { kind: DocumentKind; name: string; required: boolean }[] = [
  { kind: "passport", name: "Passport", required: true },
  { kind: "acceptance-letter", name: "University acceptance (matrícula)", required: true },
  { kind: "lease", name: "Lease / accommodation", required: false },
];
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? "30");

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; appointment_error?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { error, appointment_error: appointmentError } = await searchParams;
  const c = await getCase(id);
  if (!c) notFound();
  const invoices = await listInvoicesForCase(c.id);
  const appointmentRows = await listAppointments(c.id);

  const tier = getTier(c.tierId);
  const price = tier ? tierPriceCents(tier, routeForForm(c.formId)) : null;
  const i = c.intake;
  const name = i
    ? `${[i.identity.firstSurname, i.identity.secondSurname].filter(Boolean).join(" ")}, ${i.identity.givenName}`
    : "Erased case";
  const deletionDue = c.serviceCompletedAt
    ? new Date(Date.parse(c.serviceCompletedAt) + RETENTION_DAYS * 86_400_000).toISOString()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">← All cases</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-ink">{name}</h1>
          <Badge>{c.formId}</Badge>
          <PaymentBadge status={c.paymentStatus} />
          <StageBadge stage={c.stage} purged={Boolean(c.purgedAt)} />
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
          Ref <span className="font-mono">{c.ref}</span>
          <CopyButton value={c.ref} label="Copy ref" />
          · Received {formatDateTime(c.createdAt)}
        </p>
      </div>

      {!i ? (
        <Card title="Personal data erased">
          <p className="text-sm text-ink-muted">
            Identity data and documents were permanently deleted on{" "}
            <strong className="text-ink">{c.purgedAt ? formatDateTime(c.purgedAt) : "—"}</strong>.
            Only the accounting record remains: package, payment status and dates, as
            Spanish invoicing law requires.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card title="Applicant">
              <Fields
                rows={[
                  ["Passport", <span key="p" className="font-mono">{i.identity.passportNumber}</span>],
                  ["NIE", i.identity.nie ? <span key="n" className="font-mono">{i.identity.nie}</span> : ""],
                  ["First surname", i.identity.firstSurname],
                  ["Second surname", i.identity.secondSurname ?? ""],
                  ["Given name(s)", i.identity.givenName],
                  ["Gender", GENDER[i.identity.gender] ?? i.identity.gender],
                  ["Date of birth", i.identity.birthDate],
                  ["Place of birth", `${i.identity.birthCity}, ${countryDisplayName(i.identity.birthCountry, "en")}`],
                  ["Nationality", `${countryDisplayName(i.identity.nationality, "en")} · on the form: ${spanishFormName(i.identity.nationality)}`],
                  ["Marital status", MARITAL[i.family.maritalStatus] ?? i.family.maritalStatus],
                  ["Father", i.family.fatherFirstName],
                  ["Mother", i.family.motherFirstName],
                ]}
              />
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card title="Address in Spain">
                <Fields
                  rows={[
                    ["Street", i.address.streetName],
                    ["Number", i.address.buildingNumber],
                    ["Floor / door", i.address.floorDoor ?? ""],
                    ["Postal code", i.address.postalCode],
                    ["City", i.address.city],
                    ["Province", i.address.province],
                  ]}
                />
              </Card>
              <Card title="Contact">
                <Fields
                  rows={[
                    ["Phone", <a key="t" href={`tel:${i.contact.phone}`} className="hover:underline">{i.contact.phone}</a>],
                    ["WhatsApp", <a key="w" href={`https://wa.me/${i.contact.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:underline">Open chat ↗</a>],
                    ["Email", <a key="e" href={`mailto:${i.contact.email}`} className="hover:underline">{i.contact.email}</a>],
                    ["Language", LANGUAGE[c.locale]],
                    ["Marketing", i.consent.marketingOptIn ? "Opted in" : "No"],
                  ]}
                />
              </Card>
            </div>

            <Card title="Documents">
              <ul className="divide-y divide-bone-line">
                {DOC_SLOTS.map((slot) => {
                  const docs = c.documents.filter((d) => d.kind === slot.kind);
                  return (
                    <li key={slot.kind} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium text-ink">{slot.name}</p>
                        {docs.length === 0 && (
                          <p className={`text-xs ${slot.required ? "text-terracotta" : "text-ink-soft"}`}>
                            {slot.required ? "Missing — required" : "Not provided"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {docs.map((d, n) => <DocLink key={d.id} caseId={c.id} doc={d} n={docs.length > 1 ? n + 1 : 0} />)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>

            <Card title="Modelo 790 · Código 012">
              <Tasa012Helper summary={buildTasa012(i, c.formId)} />
            </Card>
          </div>

          <aside className="space-y-6">
            <Card title="Workflow">
              <p className="text-sm text-ink-muted">
                Stage: <strong className="text-ink">{c.stage === "in_progress" ? "In progress" : c.stage === "new" ? "New" : "Completed"}</strong>
              </p>
              {c.paymentStatus !== "paid" && c.stage === "new" && (
                <p className="mt-2 text-xs text-amber-800">Payment not received yet.</p>
              )}
              <div className="mt-4 flex flex-col gap-2">
                {c.stage === "new" && <StageButton id={c.id} stage="in_progress" label="Start work" primary />}
                {c.stage === "in_progress" && <StageButton id={c.id} stage="completed" label="Mark completed" primary />}
                {c.stage === "completed" && <StageButton id={c.id} stage="in_progress" label="Reopen" />}
                {c.stage === "in_progress" && <StageButton id={c.id} stage="new" label="Move back to new" />}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                {deletionDue
                  ? <>Personal data and documents will be deleted automatically on <strong className="text-ink">{formatDate(deletionDue)}</strong>. Reopening stops the clock.</>
                  : `Marking completed starts the ${RETENTION_DAYS}-day deletion clock.`}
              </p>
            </Card>

            <AppointmentsCard caseId={c.id} appointments={appointmentRows} error={appointmentError} />

            <Card title={`Official form · ${c.formId}`}>
              <a href={`/api/admin/cases/${c.id}/form`} className="btn-primary w-full !py-2.5">
                Download pre-filled {c.formId}
              </a>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                Check every value against the passport before sending. Sections 2 and 3
                and the DEHú box are left blank by design.
              </p>
            </Card>

            <Card title="Payment">
              <Fields
                rows={[
                  ["Package", tier?.name.replace(/^The /, "") ?? c.tierId],
                  ["Total", price ? formatEur(price) : ""],
                  ["Status", <PaymentBadge key="s" status={c.paymentStatus} />],
                  ["Stripe", c.stripePaymentIntentId
                    ? <a key="st" href={`https://dashboard.stripe.com/payments/${c.stripePaymentIntentId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">View payment ↗</a>
                    : ""],
                ]}
              />
            </Card>

            <Card title="Invoices">
              <InvoiceList invoices={invoices} hrefBase="/api/admin/invoices" />
            </Card>

            {c.documentsSubmittedAt && (
              <Card title="Documents submitted">
                <p className="text-sm text-ink-muted">
                  The student marked their file complete on{" "}
                  <strong className="text-ink">{formatDateTime(c.documentsSubmittedAt)}</strong>.
                </p>
              </Card>
            )}

            <Card title="Erase personal data" className="border-terracotta/30">
              <form action={eraseNow} id="erase" className="space-y-3">
                <input type="hidden" name="caseId" value={c.id} />
                <p className="text-xs leading-relaxed text-ink-muted">
                  For erasure requests. Deletes identity data and every document now,
                  permanently. Payment records are kept.
                </p>
                <label className="flex items-start gap-2 text-xs text-ink">
                  <input type="checkbox" name="confirm" value="yes" required className="mt-0.5" />
                  I understand this cannot be undone.
                </label>
                {error === "confirm" && <p role="alert" className="text-xs text-terracotta">Tick the box to confirm.</p>}
                <button type="submit" className="w-full rounded-full border border-terracotta/50 px-4 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta/5">
                  Erase now
                </button>
              </form>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}

function StageButton({ id, stage, label, primary }: { id: string; stage: string; label: string; primary?: boolean }) {
  return (
    <form action={changeStage}>
      <input type="hidden" name="caseId" value={id} />
      <input type="hidden" name="stage" value={stage} />
      <button type="submit" className={`${primary ? "btn-primary" : "btn-secondary"} w-full !py-2`}>{label}</button>
    </form>
  );
}

function DocLink({ caseId, doc, n }: { caseId: string; doc: StoredDocument; n: number }) {
  return (
    <a
      href={`/api/admin/cases/${caseId}/documents/${doc.id}`}
      className="inline-flex items-center gap-2 rounded-md border border-bone-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-bone-warm"
    >
      Download{n ? ` #${n}` : ""}
      <span className="font-normal text-ink-soft">
        {formatBytes(doc.byteSize)} · {formatDate(doc.uploadedAt)}
      </span>
    </a>
  );
}
