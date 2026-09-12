import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { BUCKETS, countCasesByBucket, listCases, type CaseBucket } from "@/lib/server/case-listing";
import type { DocumentKind } from "@/lib/db/schema";
import { getTier } from "@/lib/pricing";
import { countryDisplayName } from "@/lib/countries";
import { missingTemplates, missingTemplatesMessage } from "@/lib/forms/templates";
import {
  Badge,
  BUCKET_LABEL,
  PaymentBadge,
  StageBadge,
  formatDate,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
// Absolute: a layout's title template applies to child segments, not its own page.
export const metadata = { title: { absolute: "Cases · Staff · BCN Student Concierge" } };

const LIMIT = 200;
const DOCS: { kind: DocumentKind; letter: string; name: string; required: boolean }[] = [
  { kind: "passport", letter: "P", name: "Passport", required: true },
  { kind: "acceptance-letter", letter: "M", name: "Matrícula letter", required: true },
  { kind: "lease", letter: "L", name: "Lease", required: false },
];

const EMPTY: Record<CaseBucket, string> = {
  action: "Nothing waiting. New paid cases appear here.",
  in_progress: "No cases in progress.",
  unpaid: "No unpaid submissions.",
  completed: "No completed cases awaiting deletion.",
  purged: "No erased cases yet.",
  all: "No cases yet.",
};

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; q?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const bucket: CaseBucket = (BUCKETS as readonly string[]).includes(params.bucket ?? "")
    ? (params.bucket as CaseBucket)
    : "action";
  const q = (params.q ?? "").slice(0, 100);

  const [counts, rows, missingForms] = await Promise.all([
    countCasesByBucket(),
    listCases({ bucket, query: q, limit: LIMIT }),
    missingTemplates(),
  ]);

  const href = (b: CaseBucket) =>
    `/admin?bucket=${b}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Without the official PDFs no form can be generated, and the first
          sign of it would otherwise be a student's failed download. */}
      {missingForms.length > 0 && (
        <p role="alert" className="rounded-lg border border-terracotta/40 bg-terracotta/5 px-4 py-3 text-sm text-terracotta">
          <strong className="font-semibold">Form templates missing.</strong>{" "}
          {missingTemplatesMessage(missingForms)}
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Cases</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {counts.action > 0
              ? `${counts.action} paid ${counts.action === 1 ? "case needs" : "cases need"} action.`
              : "No paid cases waiting."}
          </p>
        </div>
        <InvoiceExport />
        <form method="get" className="flex gap-2" role="search">
          <input type="hidden" name="bucket" value={bucket} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, email, passport or ref"
            aria-label="Search cases"
            className="field-input !mt-0 w-72"
          />
          <button type="submit" className="btn-secondary !py-2">Search</button>
          {q && (
            <Link href={`/admin?bucket=${bucket}`} className="btn-secondary !py-2">Clear</Link>
          )}
        </form>
      </div>

      <nav aria-label="Queues" className="flex flex-wrap gap-1 border-b border-bone-line">
        {BUCKETS.map((b) => {
          const active = b === bucket;
          return (
            <Link
              key={b}
              href={href(b)}
              aria-current={active ? "page" : undefined}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-olive font-semibold text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {BUCKET_LABEL[b]}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  b === "action" && counts.action > 0
                    ? "bg-terracotta text-white"
                    : "bg-bone-warm text-ink-soft"
                }`}
              >
                {counts[b]}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-bone-line bg-white">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-bone-line bg-bone-warm/50 text-left text-xs font-medium uppercase tracking-wide text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-2.5">Applicant</th>
              <th scope="col" className="px-4 py-2.5">Ref</th>
              <th scope="col" className="px-4 py-2.5">Route</th>
              <th scope="col" className="px-4 py-2.5">Package</th>
              <th scope="col" className="px-4 py-2.5">Payment</th>
              <th scope="col" className="px-4 py-2.5">Documents</th>
              <th scope="col" className="px-4 py-2.5">Stage</th>
              <th scope="col" className="px-4 py-2.5 text-right">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-bone-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-ink-soft">
                  {q ? `No cases match “${q}”.` : EMPTY[bucket]}
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} className="group hover:bg-bone-warm/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/cases/${c.id}`} className="font-medium text-ink group-hover:underline">
                    {c.applicant ?? <span className="italic text-ink-soft">Erased</span>}
                  </Link>
                  {c.email && <div className="text-xs text-ink-soft">{c.email}</div>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-muted">{c.ref}</td>
                <td className="px-4 py-3">
                  <Badge>{c.formId}</Badge>
                  {c.nationality && (
                    <div className="mt-1 text-xs text-ink-soft">{countryDisplayName(c.nationality, "en")}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {getTier(c.tierId)?.name.replace(/^The /, "") ?? c.tierId}
                </td>
                <td className="px-4 py-3"><PaymentBadge status={c.paymentStatus} /></td>
                <td className="px-4 py-3">
                  {c.purgedAt ? (
                    <span className="text-xs text-ink-soft">—</span>
                  ) : (
                    <DocDots kinds={c.documentKinds} />
                  )}
                </td>
                <td className="px-4 py-3">
                  <StageBadge stage={c.stage} purged={Boolean(c.purgedAt)} />
                  {c.documentsSubmittedAt && !c.purgedAt && (
                    <div className="mt-1 text-xs text-olive">Docs submitted</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-ink-muted">{formatDate(c.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === LIMIT && (
        <p className="text-xs text-ink-soft">Showing the {LIMIT} most recent. Search to narrow down.</p>
      )}
    </div>
  );
}

function DocDots({ kinds }: { kinds: DocumentKind[] }) {
  const missing = DOCS.filter((d) => d.required && !kinds.includes(d.kind));
  return (
    <div className="flex items-center gap-1">
      {DOCS.map((d) => {
        const has = kinds.includes(d.kind);
        return (
          <span
            key={d.kind}
            title={`${d.name}: ${has ? "uploaded" : d.required ? "missing" : "not provided"}`}
            className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold ${
              has
                ? "bg-olive text-bone"
                : d.required
                  ? "border border-terracotta/50 text-terracotta"
                  : "border border-dashed border-bone-line text-ink-soft"
            }`}
          >
            {d.letter}
          </span>
        );
      })}
      <span className="sr-only">
        {missing.length ? `Missing: ${missing.map((d) => d.name).join(", ")}` : "All required documents uploaded"}
      </span>
    </div>
  );
}

/**
 * CSV invoice register for the gestor. Defaults to the current quarter —
 * IVA (modelo 303) is filed quarterly, so that is the range asked for most.
 * A plain GET form: the browser downloads the file directly.
 */
function InvoiceExport() {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3);
  const year = now.getUTCFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${year}-${pad(q * 3 + 1)}-01`;
  const lastDay = new Date(Date.UTC(year, q * 3 + 3, 0)).getUTCDate();
  const to = `${year}-${pad(q * 3 + 3)}-${pad(lastDay)}`;
  return (
    <form
      method="get"
      action="/api/admin/invoices/export"
      className="flex items-end gap-2 rounded-xl border border-bone-line bg-white px-3 py-2"
    >
      <label className="text-xs text-ink-soft">
        From
        <input type="date" name="from" defaultValue={from} required className="field-input !mt-1 !py-1.5" />
      </label>
      <label className="text-xs text-ink-soft">
        To
        <input type="date" name="to" defaultValue={to} required className="field-input !mt-1 !py-1.5" />
      </label>
      <button type="submit" className="btn-secondary !py-2 whitespace-nowrap">Export invoices (CSV)</button>
    </form>
  );
}
