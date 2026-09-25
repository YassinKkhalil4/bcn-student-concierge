import { requireAdmin } from "@/lib/admin/guard";
import { guideConversionBySource } from "@/lib/server/guide-analytics";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guide conversion" };

const PERIODS = { "30": 30, "90": 90, all: null } as const;
type Period = keyof typeof PERIODS;

const pct = (n: number) => `${(n * 100).toFixed(n > 0 && n < 0.1 ? 1 : 0)} %`;

/**
 * Download → triage conversion per school link. Raw download counts are not
 * the point: a school whose readers download a lot and never ask for triage
 * is a different result from one whose few readers all do.
 */
export default async function GuideConversionPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const requested = (await searchParams).period ?? "90";
  const period: Period = requested in PERIODS ? (requested as Period) : "90";
  const days = PERIODS[period];
  const rows = await guideConversionBySource(days ? new Date(Date.now() - days * 86_400_000) : undefined);
  const total = rows.reduce(
    (sum, r) => ({ downloaders: sum.downloaders + r.downloaders, triaged: sum.triaged + r.triaged }),
    { downloaders: 0, triaged: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-2xl font-semibold text-ink">Guide: download → triage</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {total.downloaders} downloaders, {total.triaged} sent triage
            {total.downloaders ? ` (${pct(total.triaged / total.downloaders)})` : ""}. Each browser is counted once,
            under the first school link it downloaded through.
          </p>
        </div>
        <nav aria-label="Period" className="flex gap-1 text-sm">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <a
              key={p}
              href={`/admin/guide?period=${p}`}
              aria-current={p === period ? "page" : undefined}
              className={`px-3 py-1 ${p === period ? "bg-ink text-paper" : "text-ink-muted hover:text-ink"}`}
            >
              {p === "all" ? "All time" : `${p} days`}
            </a>
          ))}
        </nav>
      </div>

      <div tabIndex={0} role="region" aria-label="Guide downloads" className="overflow-x-auto border border-paper-line bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-paper-line bg-paper-dim text-left text-xs font-medium uppercase tracking-wide text-ink-soft">
            <tr>
              <th scope="col" className="px-4 py-2.5">Source (?s=)</th>
              <th scope="col" className="px-4 py-2.5 text-right">Downloaders</th>
              <th scope="col" className="px-4 py-2.5 text-right">Triage</th>
              <th scope="col" className="px-4 py-2.5 text-right">Download → triage</th>
              <th scope="col" className="px-4 py-2.5 text-right">Intakes</th>
              <th scope="col" className="px-4 py-2.5 text-right">Paid</th>
              <th scope="col" className="px-4 py-2.5 text-right">Downloads</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-paper-line tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-ink-soft">No downloads in this period.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.source ?? "none"}>
                <td className="px-4 py-3 font-mono text-xs text-ink">{r.source ?? <span className="italic text-ink-soft">no link</span>}</td>
                <td className="px-4 py-3 text-right">{r.downloaders}</td>
                <td className="px-4 py-3 text-right">{r.triaged}</td>
                <td className="px-4 py-3 text-right font-semibold text-ink">{pct(r.triageRate)}</td>
                <td className="px-4 py-3 text-right">{r.intakes}</td>
                <td className="px-4 py-3 text-right">{r.paid}</td>
                <td className="px-4 py-3 text-right text-ink-soft">{r.downloads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
